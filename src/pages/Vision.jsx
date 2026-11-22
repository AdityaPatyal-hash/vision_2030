import { useEffect, useRef, useState, useCallback } from 'react'
import Tesseract from 'tesseract.js'
import { Link } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { useSpeech } from '../hooks/useSpeech'

const HINDI_LABELS = {
  person: 'व्यक्ति',
  chair: 'कुर्सी',
  bottle: 'बोतल',
  laptop: 'लैपटॉप',
  book: 'किताब',
  cup: 'कप',
  'cell phone': 'मोबाइल फ़ोन',
  phone: 'फ़ोन',
  table: 'मेज',
  'dining table': 'मेज',
  couch: 'सोफा',
  bed: 'बिस्तर',
  tv: 'टीवी',
  mouse: 'माउस',
  keyboard: 'कीबोर्ड',
  backpack: 'बैग',
  umbrella: 'छाता',
  handbag: 'पर्स',
  clock: 'घड़ी',
  scissors: 'कैंची',
  banana: 'केला',
  apple: 'सेब',
  bowl: 'कटोरी',
  dog: 'कुत्ता',
  cat: 'बिल्ली',
  car: 'कार',
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1)
}

export default function Vision() {
  const { t, lang } = useSettings()
  const { speak, stop, speaking } = useSpeech()

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const cocoModelRef = useRef(null)
  const mobilenetRef = useRef(null)
  const isRunningRef = useRef(false)
  const loopTimeoutRef = useRef(null)
  const sceneRef = useRef('')
  const lastSpokenRef = useRef(0)

  const [streaming, setStreaming] = useState(false)
  const [camError, setCamError] = useState(false)
  const [modelStatus, setModelStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [sensitivity, setSensitivity] = useState(0.28) // 0.28 (high recall), 0.38 (balanced), 0.50 (strict)
  const [detections, setDetections] = useState([])
  const [classifiedItems, setClassifiedItems] = useState([])
  const [matchedCustom, setMatchedCustom] = useState([])
  const [aspectRatio, setAspectRatio] = useState('16 / 10')

  // OCR state
  const [image, setImage] = useState(null)
  const [ocrText, setOcrText] = useState('')
  const [ocrBusy, setOcrBusy] = useState(false)

  // Custom Object Training state
  const [customObjects, setCustomObjects] = useState(() => {
    try {
      const saved = localStorage.getItem('mira_custom_objects')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [teachName, setTeachName] = useState('')
  const [teaching, setTeaching] = useState(false)
  const [trainFeedback, setTrainFeedback] = useState('')

  // Persist trained objects
  useEffect(() => {
    try {
      localStorage.setItem('mira_custom_objects', JSON.stringify(customObjects))
    } catch (err) {
      console.warn('Could not save custom objects to localStorage:', err)
    }
  }, [customObjects])

  // Load both COCO-SSD (mobilenet_v2) and MobileNet (ImageNet 1,000 categories)
  const loadModels = useCallback(async () => {
    if (cocoModelRef.current && mobilenetRef.current) return
    try {
      setModelStatus('loading')
      for (let i = 0; i < 30; i++) {
        if (window.cocoSsd && window.mobilenet && window.tf) break
        await new Promise((r) => setTimeout(r, 200))
      }

      if (!window.cocoSsd || !window.mobilenet) {
        throw new Error('Vision libraries failed to load from CDN')
      }

      const [coco, mobile] = await Promise.all([
        window.cocoSsd.load({ base: 'mobilenet_v2' }),
        window.mobilenet.load({ version: 2, alpha: 1.0 }),
      ])

      cocoModelRef.current = coco
      mobilenetRef.current = mobile
      setModelStatus('ready')
    } catch (err) {
      console.warn('Error loading dual vision models:', err)
      setModelStatus('error')
    }
  }, [])

  useEffect(() => {
    loadModels()
  }, [loadModels])

  const describeScene = useCallback((dets, classified, custom) => {
    const customNames = (custom || []).map((c) => c.name)
    const cocoNames = (dets || []).map((d) => (lang === 'hi' ? HINDI_LABELS[d.label] || d.label : d.label))
    const classNames = (classified || []).slice(0, 2).map((c) => c.name)

    // Combine distinct object names
    const all = Array.from(new Set([...customNames, ...cocoNames, ...classNames])).filter(Boolean)
    if (!all.length) return

    const joined = all.slice(0, 4).join(', ')
    const sentence = lang === 'hi'
      ? `दृश्य में ${joined} दिखाई दे रहे हैं।`
      : `I see ${joined} in front of you.`
    speak(sentence)
  }, [lang, speak])

  const stopCamera = useCallback(() => {
    isRunningRef.current = false
    if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop())
    }
    streamRef.current = null
    setStreaming(false)
    setDetections([])
    setClassifiedItems([])
    setMatchedCustom([])
    sceneRef.current = ''
  }, [])

  // Continuous multi-model detection loop
  const runDetection = useCallback(async () => {
    if (!isRunningRef.current) return

    const video = videoRef.current
    const coco = cocoModelRef.current
    const mobilenet = mobilenetRef.current

    if (video && video.readyState >= 2) {
      try {
        const vw = video.videoWidth || 640
        const vh = video.videoHeight || 480
        if (vw && vh) setAspectRatio(`${vw} / ${vh}`)

        // 1. Spatial bounding box detection (COCO-SSD)
        let dets = []
        if (coco) {
          const preds = await coco.detect(video)
          const valid = preds.filter((p) => p.score >= sensitivity)
          dets = valid.map((p, i) => {
            const [x, y, w, h] = p.bbox
            return {
              label: p.class,
              conf: p.score,
              left: Math.max(0, Math.min(100, (x / vw) * 100)),
              top: Math.max(0, Math.min(100, (y / vh) * 100)),
              width: Math.max(2, Math.min(100, (w / vw) * 100)),
              height: Math.max(2, Math.min(100, (h / vh) * 100)),
              second: i % 2 === 1,
            }
          })
          setDetections(dets)
        }

        // 2. Deep ImageNet 1,000-class identification (MobileNet)
        let topClassified = []
        let liveEmbedding = null
        if (mobilenet && window.tf) {
          try {
            const [classes, activation] = await Promise.all([
              mobilenet.classify(video, 3),
              mobilenet.infer(video, true),
            ])

            topClassified = (classes || [])
              .filter((c) => c.probability >= 0.20)
              .map((c) => ({
                name: c.className.split(',')[0].trim(),
                conf: c.probability,
              }))
            setClassifiedItems(topClassified)

            const data = await activation.data()
            activation.dispose()
            liveEmbedding = Array.from(data)
          } catch (e) {
            console.warn('MobileNet classification error:', e)
          }
        }

        // 3. Match against user's custom-trained objects
        const matched = []
        if (liveEmbedding && customObjects.length > 0) {
          for (const item of customObjects) {
            let maxSim = 0
            for (const sample of item.samples) {
              const sim = cosineSimilarity(liveEmbedding, sample)
              if (sim > maxSim) maxSim = sim
            }
            if (maxSim >= 0.72) {
              matched.push({ name: item.name, conf: maxSim })
            }
          }
          setMatchedCustom(matched)
        } else {
          setMatchedCustom([])
        }

        // 4. Voice speech announcement (throttled to avoid spam)
        const sceneKey = [
          ...matched.map((m) => `custom:${m.name}`),
          ...dets.map((d) => d.label),
          ...topClassified.map((c) => c.name),
        ].sort().join('|')

        const now = Date.now()
        if (sceneKey && sceneKey !== sceneRef.current && now - lastSpokenRef.current > 3800) {
          sceneRef.current = sceneKey
          lastSpokenRef.current = now
          describeScene(dets, topClassified, matched)
        }
      } catch (err) {
        console.warn('Detection error:', err)
      }
    }

    if (isRunningRef.current) {
      loopTimeoutRef.current = setTimeout(runDetection, 400)
    }
  }, [sensitivity, customObjects, describeScene])

  const startCamera = async () => {
    try {
      setCamError(false)
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
      }

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setStreaming(true)
      isRunningRef.current = true
      sceneRef.current = ''
      lastSpokenRef.current = Date.now()

      if (!cocoModelRef.current || !mobilenetRef.current) {
        await loadModels()
      }

      runDetection()
    } catch (err) {
      console.error('Camera startup error:', err)
      setCamError(true)
    }
  }

  useEffect(() => () => stopCamera(), [stopCamera])

  // Teach / Train Custom Object Feature
  const trainCurrentObject = async () => {
    if (!teachName.trim()) {
      setTrainFeedback('Please enter an object name first.')
      return
    }
    if (!videoRef.current || !streaming) {
      setTrainFeedback('Please start the camera and point it at the object.')
      return
    }
    if (!mobilenetRef.current || !window.tf) {
      setTrainFeedback('AI model still initializing. Please wait a moment.')
      return
    }

    setTeaching(true)
    setTrainFeedback('Capturing visual feature embeddings...')
    try {
      const activation = mobilenetRef.current.infer(videoRef.current, true)
      const data = await activation.data()
      activation.dispose()
      const embedding = Array.from(data)

      const trimmed = teachName.trim()
      setCustomObjects((prev) => {
        const existing = prev.find((o) => o.name.toLowerCase() === trimmed.toLowerCase())
        if (existing) {
          return prev.map((o) =>
            o.name.toLowerCase() === trimmed.toLowerCase()
              ? { ...o, samples: [...o.samples.slice(-4), embedding] }
              : o
          )
        } else {
          return [...prev, { name: trimmed, samples: [embedding], createdAt: Date.now() }]
        }
      })

      setTrainFeedback(`✓ Trained "${trimmed}"! Add 2–3 more angles for best accuracy.`)
      speak(lang === 'hi' ? `${trimmed} सीख लिया गया है।` : `Learned ${trimmed}.`)
    } catch (err) {
      console.error('Training error:', err)
      setTrainFeedback('Error capturing features. Try again.')
    } finally {
      setTeaching(false)
    }
  }

  const deleteCustomObject = (name) => {
    setCustomObjects((prev) => prev.filter((o) => o.name !== name))
  }

  // OCR Functions
  const runOcr = async (source) => {
    setOcrBusy(true)
    setOcrText('')
    try {
      const ocrLang = lang === 'hi' ? 'hin' : 'eng'
      const { data } = await Tesseract.recognize(source, ocrLang)
      const text = (data.text || '').trim()
      setOcrText(text || (lang === 'hi' ? 'कोई टेक्स्ट नहीं मिला।' : 'No text found in this image.'))
    } catch {
      try {
        const { data } = await Tesseract.recognize(source, 'eng')
        const text = (data.text || '').trim()
        setOcrText(text || (lang === 'hi' ? 'कोई टेक्स्ट नहीं मिला।' : 'No text found in this image.'))
      } catch {
        setOcrText(lang === 'hi' ? 'OCR विफल। पुनः प्रयास करें।' : 'OCR failed. Please try again.')
      }
    } finally {
      setOcrBusy(false)
    }
  }

  const captureFrame = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) return
      setImage(URL.createObjectURL(blob))
      runOcr(blob)
    }, 'image/jpeg', 0.95)
  }

  const onUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(URL.createObjectURL(file))
    runOcr(file)
  }

  return (
    <main className="page">
      <div className="module-head">
        <h1 className="section-title" style={{ margin: 0 }}>{t('nav_vision')}</h1>
        <span className="live-badge">
          <span className="pulse-dot" /> {streaming ? `${t('status_live')} · DUAL AI (1,000+ OBJECTS)` : 'DUAL AI VISION READY'}
        </span>
        <Link to="/dashboard" style={{ marginLeft: 'auto' }}>
          <button className="btn btn-ghost btn-sm">← {t('back_dashboard')}</button>
        </Link>
      </div>

      <div className="grid grid-2">
        <section className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>{t('vision_live')}</h3>
            {modelStatus === 'loading' && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                <span className="spinner" style={{ width: 12, height: 12, marginRight: 6 }} /> Loading Dual AI Engines...
              </span>
            )}
            {modelStatus === 'ready' && (
              <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>● 1,000+ Categories &amp; Custom Training Active</span>
            )}
          </div>

          <p style={{ marginBottom: '0.8rem', fontSize: '0.9rem' }}>
            {lang === 'hi'
              ? 'MIRA दोहरे AI मॉडल (COCO-SSD + 1,000+ श्रेणी MobileNet) से रीयल-टाइम में वस्तुएं पहचानता है। आप नीचे किसी भी नई वस्तु को सिखा भी सकते हैं।'
              : 'Dual-Engine Vision: COCO-SSD for spatial tracking + MobileNet for 1,000+ ImageNet classes. Plus train custom items below.'}
          </p>

          {/* Sensitivity Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Detection Sensitivity:</span>
            {[
              { label: 'High (Detect More)', val: 0.28 },
              { label: 'Balanced', val: 0.38 },
              { label: 'Strict', val: 0.50 },
            ].map((s) => (
              <button
                key={s.val}
                className={`pill-btn ${sensitivity === s.val ? 'active' : ''}`}
                style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem' }}
                onClick={() => setSensitivity(s.val)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Camera Viewport */}
          <div className={`cam-panel ${streaming ? 'scanning' : ''}`} style={{ aspectRatio }}>
            <video ref={videoRef} muted playsInline />

            {/* Custom Trained Match Banner */}
            {matchedCustom.length > 0 && (
              <div style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {matchedCustom.map((m) => (
                  <span
                    key={m.name}
                    style={{
                      background: '#2ba640',
                      color: '#000',
                      fontWeight: 700,
                      padding: '0.3rem 0.75rem',
                      borderRadius: 6,
                      fontSize: '0.85rem',
                      boxShadow: '0 2px 10px rgba(43, 166, 64, 0.5)',
                    }}
                  >
                    ★ TRAINED: {m.name.toUpperCase()} ({(m.conf * 100).toFixed(0)}%)
                  </span>
                ))}
              </div>
            )}

            {/* COCO-SSD Bounding Boxes */}
            {detections.map((d, i) => (
              <div
                key={i}
                className={`det-box ${d.second ? 'second' : ''}`}
                style={{
                  left: `${d.left}%`,
                  top: `${d.top}%`,
                  width: `${d.width}%`,
                  height: `${d.height}%`,
                }}
              >
                <span className="det-label">
                  {(lang === 'hi' ? HINDI_LABELS[d.label] || d.label : d.label).toUpperCase()} {(d.conf * 100).toFixed(0)}%
                </span>
              </div>
            ))}

            {!streaming && (
              <div className="cam-placeholder">
                {camError
                  ? t('no_camera')
                  : `${t('start_camera')} — DUAL-ENGINE AI OBJECT TRACKING`}
              </div>
            )}
          </div>

          {/* Top Classified 1,000+ Categories Pills */}
          {streaming && classifiedItems.length > 0 && (
            <div className="classified-pills">
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', alignSelf: 'center' }}>Also Identified:</span>
              {classifiedItems.map((c, i) => (
                <span key={i} className="classified-pill">
                  <b>{c.name}</b> ({(c.conf * 100).toFixed(0)}%)
                </span>
              ))}
            </div>
          )}

          {/* Camera Action Buttons */}
          <div style={{ display: 'flex', gap: '0.7rem', marginTop: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {!streaming ? (
              <button className="btn" onClick={startCamera}>{t('start_camera')}</button>
            ) : (
              <button className="btn btn-ghost" onClick={stopCamera}>{t('stop_camera')}</button>
            )}
            {streaming && (
              <button className="btn btn-ghost" onClick={captureFrame}>
                {lang === 'hi' ? '📷 कैमरे से टेक्स्ट पढ़ें' : '📷 Capture & Read Text'}
              </button>
            )}
            {speaking ? (
              <button className="btn btn-ghost" onClick={stop}>{t('stop_speaking')}</button>
            ) : (
              <button
                className="btn btn-ghost"
                disabled={!detections.length && !classifiedItems.length && !matchedCustom.length}
                onClick={() => describeScene(detections, classifiedItems, matchedCustom)}
              >
                {t('read_aloud')}
              </button>
            )}
          </div>

          {/* Teach MIRA / Custom Object Training Section */}
          <div className="teach-box">
            <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#f1f1f1' }}>
              🎯 Teach MIRA New Objects (Custom AI Training)
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', margin: '0.4rem 0 0.8rem' }}>
              Hold any object in front of the camera (e.g. your keys, medicine, notebook, wallet), give it a name, and tap <b>Train Object</b>. MIRA will immediately learn its visual features!
            </p>

            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Object Name (e.g., House Keys, Medicine Bottle)"
                value={teachName}
                onChange={(e) => setTeachName(e.target.value)}
                style={{ flex: '1 1 220px', padding: '0.55rem 0.85rem', fontSize: '0.9rem' }}
              />
              <button
                className="btn"
                disabled={!streaming || !teachName.trim() || teaching}
                onClick={trainCurrentObject}
              >
                {teaching ? 'Training...' : '📸 Train Object'}
              </button>
            </div>

            {trainFeedback && (
              <div style={{ fontSize: '0.85rem', color: trainFeedback.startsWith('✓') ? 'var(--success)' : '#ff9800', marginTop: '0.6rem' }}>
                {trainFeedback}
              </div>
            )}

            {/* List of Custom Trained Objects */}
            {customObjects.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.4rem' }}>
                  Your Trained Objects ({customObjects.length}):
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {customObjects.map((obj) => (
                    <span key={obj.name} className="trained-tag">
                      <span>★ <b>{obj.name}</b> ({obj.samples.length} {obj.samples.length === 1 ? 'sample' : 'samples'})</span>
                      <button
                        onClick={() => deleteCustomObject(obj.name)}
                        style={{ background: 'none', border: 'none', color: '#ff4e45', cursor: 'pointer', fontSize: '0.85rem' }}
                        title="Remove trained object"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* OCR Section */}
        <section className="card">
          <h3 style={{ marginBottom: '0.4rem' }}>{t('ocr_title')}</h3>
          <p style={{ marginBottom: '1rem' }}>{t('ocr_desc')}</p>
          {image && <img className="ocr-preview" src={image} alt="uploaded" />}
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
            <input type="file" accept="image/*" id="ocr-upload" hidden onChange={onUpload} />
            <label htmlFor="ocr-upload" style={{ margin: 0, display: 'inline-block' }}>
              <span className="btn btn-ghost">{t('upload_image')}</span>
            </label>
            {streaming && (
              <button className="btn" onClick={captureFrame}>
                {lang === 'hi' ? 'कैमरे से कैप्चर करें' : '📷 Capture from Camera'}
              </button>
            )}
          </div>
          <label>{t('extracted_text')}</label>
          <div className="ocr-text-box">
            {ocrBusy && <><span className="spinner" /> {t('listening_scene')}</>}
            {!ocrBusy && ocrText}
          </div>
          <div style={{ display: 'flex', gap: '0.7rem', marginTop: '1rem' }}>
            <button className="btn btn-sm" disabled={!ocrText || ocrBusy} onClick={() => speak(ocrText)}>
              {t('read_aloud')}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              disabled={!ocrText || ocrBusy}
              onClick={() => { setOcrText(''); setImage(null) }}
            >
              {t('clear')}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

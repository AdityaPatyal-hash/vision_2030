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

export default function Vision() {
  const { t, lang } = useSettings()
  const { speak, stop, speaking } = useSpeech()

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const modelRef = useRef(null)
  const isRunningRef = useRef(false)
  const loopTimeoutRef = useRef(null)
  const sceneRef = useRef('')
  const lastSpokenRef = useRef(0)

  const [streaming, setStreaming] = useState(false)
  const [camError, setCamError] = useState(false)
  const [modelStatus, setModelStatus] = useState('idle') // 'idle' | 'loading' | 'ready' | 'error'
  const [detections, setDetections] = useState([])
  const [image, setImage] = useState(null)
  const [ocrText, setOcrText] = useState('')
  const [ocrBusy, setOcrBusy] = useState(false)
  const [aspectRatio, setAspectRatio] = useState('16 / 10')

  // Load COCO-SSD model
  const loadModel = useCallback(async () => {
    if (modelRef.current) return modelRef.current
    try {
      setModelStatus('loading')
      // Poll for window.cocoSsd if the CDN script is still downloading
      for (let i = 0; i < 25; i++) {
        if (window.cocoSsd) break
        await new Promise((r) => setTimeout(r, 200))
      }
      if (!window.cocoSsd) {
        throw new Error('TensorFlow / COCO-SSD script not available')
      }
      const model = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' })
      modelRef.current = model
      setModelStatus('ready')
      return model
    } catch (err) {
      console.warn('Failed to load COCO-SSD model:', err)
      setModelStatus('error')
      return null
    }
  }, [])

  // Preload model on mount
  useEffect(() => {
    loadModel()
  }, [loadModel])

  const describeScene = useCallback((dets) => {
    if (!dets || !dets.length) return
    const names = dets.map((d) => (lang === 'hi' ? HINDI_LABELS[d.label] || d.label : d.label)).join(', ')
    const sentence = lang === 'hi'
      ? `दृश्य में ${names} दिखाई दे रहे हैं।`
      : `I see ${names} in front of you.`
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
    sceneRef.current = ''
  }, [])

  // Continuous real-time detection loop
  const runDetection = useCallback(async () => {
    if (!isRunningRef.current) return

    const video = videoRef.current
    const model = modelRef.current

    if (model && video && video.readyState >= 2) {
      try {
        const predictions = await model.detect(video)
        if (isRunningRef.current) {
          const vw = video.videoWidth || 640
          const vh = video.videoHeight || 480
          if (vw && vh) {
            setAspectRatio(`${vw} / ${vh}`)
          }

          // Filter out detections below 45% confidence
          const valid = predictions.filter((p) => p.score >= 0.45)
          const dets = valid.map((p, i) => {
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

          // Audio scene description (throttled to avoid stutter)
          const key = valid.map((p) => p.class).sort().join('|')
          const now = Date.now()
          if (key && key !== sceneRef.current && now - lastSpokenRef.current > 3500) {
            sceneRef.current = key
            lastSpokenRef.current = now
            describeScene(dets)
          }
        }
      } catch (err) {
        console.warn('Detection error:', err)
      }
    }

    // Schedule next frame (~450ms for smooth real-time response without CPU lag)
    if (isRunningRef.current) {
      loopTimeoutRef.current = setTimeout(runDetection, 450)
    }
  }, [describeScene])

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

      // Ensure model is ready before starting detection loop
      if (!modelRef.current) {
        await loadModel()
      }

      runDetection()
    } catch (err) {
      console.error('Camera startup error:', err)
      setCamError(true)
    }
  }

  useEffect(() => () => stopCamera(), [stopCamera])

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
          <span className="pulse-dot" /> {streaming ? `${t('status_live')} · COCO-SSD AI` : 'COCO-SSD AI READY'}
        </span>
        <Link to="/dashboard" style={{ marginLeft: 'auto' }}>
          <button className="btn btn-ghost btn-sm">← {t('back_dashboard')}</button>
        </Link>
      </div>

      <div className="grid grid-2">
        <section className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <h3 style={{ margin: 0 }}>{t('vision_live')}</h3>
            {modelStatus === 'loading' && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                <span className="spinner" style={{ width: 12, height: 12, marginRight: 6 }} /> Loading AI Model...
              </span>
            )}
            {modelStatus === 'ready' && (
              <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>● Real AI Model Active</span>
            )}
          </div>
          <p style={{ marginBottom: '1rem' }}>
            {lang === 'hi'
              ? 'कैमरा शुरू करें। MIRA आपके सामने मौजूद 80+ वास्तविक वस्तुओं (जैसे व्यक्ति, कुर्सी, बोतल, लैपटॉप, किताब आदि) को पहचानकर आवाज़ में बताएगा।'
              : 'Real-time object detection powered by in-browser TensorFlow & COCO-SSD. MIRA detects 80+ real-world objects and describes what it sees.'}
          </p>

          <div className={`cam-panel ${streaming ? 'scanning' : ''}`} style={{ aspectRatio }}>
            <video ref={videoRef} muted playsInline />
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
                  : `${t('start_camera')} — REAL-TIME COCO-SSD OBJECT DETECTION`}
              </div>
            )}
          </div>

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
                disabled={!detections.length}
                onClick={() => describeScene(detections)}
              >
                {t('read_aloud')}
              </button>
            )}
            {streaming && detections.length > 0 && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>
                {detections.length} {detections.length === 1 ? 'object' : 'objects'} detected
              </span>
            )}
          </div>
        </section>

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

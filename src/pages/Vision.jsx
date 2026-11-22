import { useEffect, useRef, useState, useCallback } from 'react'
import Tesseract from 'tesseract.js'
import { Link } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { useSpeech } from '../hooks/useSpeech'

// Sample detections used until the FastAPI + YOLO backend is plugged in
const SAMPLE_OBJECTS = [
  { label: 'person', conf: 0.94 },
  { label: 'chair', conf: 0.88 },
  { label: 'bottle', conf: 0.91 },
  { label: 'laptop', conf: 0.86 },
  { label: 'book', conf: 0.83 },
  { label: 'cup', conf: 0.9 },
]

function randomBox(i) {
  return {
    left: 8 + Math.random() * 45,
    top: 12 + Math.random() * 40,
    width: 18 + Math.random() * 20,
    height: 22 + Math.random() * 25,
    second: i % 2 === 1,
  }
}

export default function Vision() {
  const { t, lang } = useSettings()
  const { speak, stop, speaking } = useSpeech()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const sceneRef = useRef('')
  const [streaming, setStreaming] = useState(false)
  const [camError, setCamError] = useState(false)
  const [detections, setDetections] = useState([])
  const [image, setImage] = useState(null)
  const [ocrText, setOcrText] = useState('')
  const [ocrBusy, setOcrBusy] = useState(false)

  const stopCamera = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
    setStreaming(false)
    setDetections([])
  }, [])

  const describeScene = useCallback((dets) => {
    if (!dets.length) return
    const names = dets.map((d) => d.label).join(', ')
    const sentence = lang === 'hi'
      ? `दृश्य में ${names} दिखाई दे रहे हैं।`
      : `I see ${names} in front of you.`
    speak(sentence)
  }, [lang, speak])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStreaming(true)
      setCamError(false)
      sceneRef.current = ''
      timerRef.current = setInterval(() => {
        // Demo-mode inference: pick 1–3 sample objects. Swap this block with a
        // POST to http://localhost:8000/detect to run real YOLO inference.
        const count = 1 + Math.floor(Math.random() * 3)
        const pool = [...SAMPLE_OBJECTS].sort(() => Math.random() - 0.5).slice(0, count)
        const dets = pool.map((o, i) => ({ ...o, ...randomBox(i) }))
        setDetections(dets)
        const key = dets.map((d) => d.label).sort().join('|')
        if (key !== sceneRef.current) {
          sceneRef.current = key
          describeScene(dets)
        }
      }, 2600)
    } catch {
      setCamError(true)
    }
  }

  useEffect(() => () => stopCamera(), [stopCamera])

  const runOcr = async (file) => {
    setOcrBusy(true)
    setOcrText('')
    try {
      const { data } = await Tesseract.recognize(file, lang === 'hi' ? 'eng' : 'eng')
      const text = (data.text || '').trim()
      setOcrText(text || (lang === 'hi' ? 'कोई टेक्स्ट नहीं मिला।' : 'No text found in this image.'))
    } catch {
      setOcrText(lang === 'hi' ? 'OCR विफल। पुनः प्रयास करें।' : 'OCR failed. Please try again.')
    } finally {
      setOcrBusy(false)
    }
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
        <span className="live-badge"><span className="pulse-dot" /> {streaming ? t('status_live') : t('demo_note').toUpperCase()}</span>
        <Link to="/dashboard" style={{ marginLeft: 'auto' }}><button className="btn btn-ghost btn-sm">← {t('back_dashboard')}</button></Link>
      </div>

      <div className="grid grid-2">
        <section className="card">
          <h3 style={{ marginBottom: '0.4rem' }}>{t('vision_live')}</h3>
          <p style={{ marginBottom: '1rem' }}>{t('vision_live_desc')}</p>
          <div className={`cam-panel ${streaming ? 'scanning' : ''}`}>
            <video ref={videoRef} muted playsInline />
            {detections.map((d, i) => (
              <div
                key={i}
                className={`det-box ${d.second ? 'second' : ''}`}
                style={{ left: `${d.left}%`, top: `${d.top}%`, width: `${d.width}%`, height: `${d.height}%` }}
              >
                <span className="det-label">{d.label.toUpperCase()} {(d.conf * 100).toFixed(1)}%</span>
              </div>
            ))}
            {!streaming && (
              <div className="cam-placeholder">
                {camError ? t('no_camera') : `${t('start_camera')} — CV SIGN RECOGNITION | LIVE FEED`}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.7rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            {!streaming ? (
              <button className="btn" onClick={startCamera}>{t('start_camera')}</button>
            ) : (
              <button className="btn btn-ghost" onClick={stopCamera}>{t('stop_camera')}</button>
            )}
            {speaking
              ? <button className="btn btn-ghost" onClick={stop}>{t('stop_speaking')}</button>
              : <button className="btn btn-ghost" disabled={!detections.length} onClick={() => describeScene(detections)}>{t('read_aloud')}</button>}
          </div>
        </section>

        <section className="card">
          <h3 style={{ marginBottom: '0.4rem' }}>{t('ocr_title')}</h3>
          <p style={{ marginBottom: '1rem' }}>{t('ocr_desc')}</p>
          {image && <img className="ocr-preview" src={image} alt="uploaded" />}
          <div style={{ marginTop: '1rem' }}>
            <input type="file" accept="image/*" id="ocr-upload" hidden onChange={onUpload} />
            <label htmlFor="ocr-upload" style={{ margin: 0, display: 'inline-block' }}>
              <span className="btn">{t('upload_image')}</span>
            </label>
          </div>
          <label>{t('extracted_text')}</label>
          <div className="ocr-text-box">
            {ocrBusy && <><span className="spinner" /> {t('listening_scene')}</>}
            {!ocrBusy && ocrText}
          </div>
          <div style={{ display: 'flex', gap: '0.7rem', marginTop: '1rem' }}>
            <button className="btn btn-sm" disabled={!ocrText || ocrBusy} onClick={() => speak(ocrText)}>{t('read_aloud')}</button>
            <button className="btn btn-ghost btn-sm" disabled={!ocrText || ocrBusy} onClick={() => { setOcrText(''); setImage(null) }}>{t('clear')}</button>
          </div>
        </section>
      </div>
    </main>
  )
}

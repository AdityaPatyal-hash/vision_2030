import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { useSpeech, useDictation } from '../hooks/useSpeech'
import { classifyLetter, drawHand, LETTER_GUIDES, EMERGENCY_PHRASES } from '../utils/gesture'

function HandTracker({ onLetter, active }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [running, setRunning] = useState(false)
  const [mirrored, setMirrored] = useState(true)
  const [error, setError] = useState('')
  const [liveLetter, setLiveLetter] = useState(null)
  const streamRef = useRef(null)
  const cameraRef = useRef(null)
  const stableRef = useRef({ letter: null, count: 0 })

  const stop = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.stop()
      cameraRef.current = null
    }
    if (streamRef.current) streamRef.current.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
    setRunning(false)
    setLiveLetter(null)
  }, [])

  const start = useCallback(async () => {
    if (!window.Hands) {
      setError('MediaPipe failed to load — check your internet connection and reload.')
      return
    }
    try {
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: { ideal: 'user' } },
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
      }

      streamRef.current = stream
      const video = videoRef.current
      video.srcObject = stream
      await video.play()

      const hands = new window.Hands({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`,
      })

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })

      hands.onResults((res) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480

        if (res.multiHandLandmarks && res.multiHandLandmarks.length) {
          const lm = res.multiHandLandmarks[0]
          drawHand(ctx, lm, canvas.width, canvas.height)
          const letter = classifyLetter(lm)
          setLiveLetter(letter)

          const s = stableRef.current
          if (letter && letter === s.letter) {
            s.count += 1
            // Fast 4-frame stability (~130-160ms for instant detection)
            if (s.count === 4) {
              onLetter(letter)
            }
          } else {
            stableRef.current = { letter, count: 1 }
          }
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          stableRef.current = { letter: null, count: 0 }
          setLiveLetter(null)
        }
      })

      if (window.Camera) {
        const cam = new window.Camera(video, {
          onFrame: async () => {
            await hands.send({ image: video })
          },
          width: 640,
          height: 480,
        })
        cam.start()
        cameraRef.current = cam
      } else {
        setError('Camera utils unavailable — try a Chromium browser.')
      }
      setRunning(true)
    } catch {
      setError('Camera permission denied. Allow camera access and try again.')
    }
  }, [onLetter])

  useEffect(() => () => stop(), [stop])

  return (
    <div className={`cam-panel ${running ? 'scanning' : ''} ${mirrored ? 'mirrored' : ''}`} style={{ aspectRatio: '4/3' }}>
      <video ref={videoRef} muted playsInline />
      <canvas ref={canvasRef} />

      {running && liveLetter && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'rgba(15, 15, 15, 0.9)',
            border: '2px solid var(--blue)',
            padding: '4px 12px',
            borderRadius: 8,
            fontSize: '1rem',
            color: '#fff',
            fontWeight: 700,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span className="pulse-dot" style={{ background: 'var(--blue)' }} /> ISL: {liveLetter}
        </div>
      )}

      {!running && <div className="cam-placeholder">{error || 'Camera off — Click Start Camera below'}</div>}
      <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 8, zIndex: 10 }}>
        {!running ? (
          <button className="btn btn-sm" onClick={start}>Start Camera</button>
        ) : (
          <>
            <button className="btn btn-ghost btn-sm" onClick={stop}>Stop</button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setMirrored((m) => !m)}
              title="Toggle Flip / Mirror"
            >
              🔄 {mirrored ? 'Mirrored (Natural)' : 'Raw (Flipped)'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function Connect() {
  const { t, lang } = useSettings()
  const { speak, stop, speaking } = useSpeech()
  const { dictate, listening, supported: sttSupported } = useDictation()
  const [tab, setTab] = useState('sign')
  const [sentence, setSentence] = useState('')
  const [lastLetter, setLastLetter] = useState(null)
  const [typed, setTyped] = useState('')
  const [emergency, setEmergency] = useState(null)
  const [target, setTarget] = useState('A')
  const [feedback, setFeedback] = useState(null)

  const addLetter = useCallback((letter) => {
    setLastLetter(letter)
    setSentence((s) => (s + letter).slice(-60))
  }, [])

  const checkLetter = useCallback((letter) => {
    setLastLetter(letter)
    if (tab === 'learn') {
      if (letter === target) {
        setFeedback('ok')
        speak(lang === 'hi' ? 'सही! बहुत बढ़िया।' : 'Correct! Great job.')
      } else if (letter) {
        setFeedback('bad')
      }
    }
  }, [tab, target, lang, speak])

  const phraseText = (p) => (lang === 'hi' ? p.hi : p.en)

  const triggerEmergency = (p) => {
    setEmergency(p)
    speak(phraseText(p))
  }

  const tabBtn = (id, label) => (
    <button className={`tab ${tab === id ? 'active' : ''}`} onClick={() => { setTab(id); setFeedback(null) }}>
      {label}
    </button>
  )

  const lettersList = Object.keys(LETTER_GUIDES)

  return (
    <main className="page">
      <div className="module-head">
        <h1 className="section-title" style={{ margin: 0 }}>{t('nav_connect')}</h1>
        <span className="live-badge">
          <span className="pulse-dot" /> INDIAN SIGN LANGUAGE (ISL A–Z)
        </span>
        <Link to="/dashboard" style={{ marginLeft: 'auto' }}>
          <button className="btn btn-ghost btn-sm">← {t('back_dashboard')}</button>
        </Link>
      </div>

      <div className="tabs">
        {tabBtn('sign', lang === 'hi' ? 'साइन टू टेक्स्ट (ISL)' : 'Sign to Text (ISL)')}
        {tabBtn('type', t('type_speak_title'))}
        {tabBtn('emergency', t('emergency_title'))}
        {tabBtn('learn', lang === 'hi' ? 'ISL सीखें (लर्निंग मोड)' : 'Learn ISL Alphabet')}
      </div>

      {tab === 'sign' && (
        <div className="grid grid-2">
          <section className="card">
            <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
              {lang === 'hi'
                ? 'कैमरे के सामने कोई भी ISL वर्णमाला (A–Z) साइन करें। पहचाने गए अक्षर तुरंत आपके वाक्य में जुड़ जाएँगे।'
                : 'Show any Indian Sign Language (ISL) alphabet sign (A–Z) to the camera. Recognized letters are added to your sentence in real-time.'}
            </p>
            <HandTracker onLetter={addLetter} active />
          </section>

          <section className="card">
            <div className="sub">{t('recognized_letter')}</div>
            <div className="letter-display">{lastLetter || '—'}</div>
            <div className="sub" style={{ marginTop: '1.2rem' }}>{t('your_sentence')}</div>
            <div className="sentence-bar">{sentence || '…'}</div>
            <div style={{ display: 'flex', gap: '0.7rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button className="btn" disabled={!sentence} onClick={() => speak(sentence)}>{t('speak')}</button>
              <button className="btn btn-ghost" disabled={!sentence} onClick={() => { setSentence(''); setLastLetter(null) }}>{t('clear')}</button>
              {speaking && <button className="btn btn-ghost" onClick={stop}>{t('stop_speaking')}</button>}
            </div>
          </section>
        </div>
      )}

      {tab === 'type' && (
        <section className="card" style={{ maxWidth: 760 }}>
          <p style={{ marginBottom: '1rem' }}>{t('type_speak_desc')}</p>
          <textarea rows={4} placeholder={t('placeholder_type')} value={typed} onChange={(e) => setTyped(e.target.value)} />
          <div style={{ display: 'flex', gap: '0.7rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button className="btn" disabled={!typed.trim()} onClick={() => speak(typed)}>{t('speak')}</button>
            {speaking && <button className="btn btn-ghost" onClick={stop}>{t('stop_speaking')}</button>}
            {sttSupported && (
              <button className="btn btn-ghost" disabled={listening} onClick={() => dictate((txt) => setTyped(txt), lang)}>
                {listening ? '…' : t('mic_listen')}
              </button>
            )}
          </div>
        </section>
      )}

      {tab === 'emergency' && (
        <section className="card">
          <p style={{ marginBottom: '1rem' }}>{t('emergency_desc')}</p>
          <div className="emg-grid">
            {EMERGENCY_PHRASES.map((p) => (
              <button key={p.en} className="emg-card" onClick={() => triggerEmergency(p)}>
                <b>{p.en}</b>
                <span>{p.hi}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === 'learn' && (
        <div className="grid grid-2">
          <section className="card">
            <div className="sub">{t('select_letter')} (ISL A–Z)</div>
            <div className="letter-picker" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {lettersList.map((l) => (
                <button
                  key={l}
                  className={`letter-btn ${target === l ? 'active' : ''}`}
                  onClick={() => { setTarget(l); setFeedback(null) }}
                >
                  {l}
                </button>
              ))}
            </div>

            <div className="guide-panel" style={{ marginTop: '1rem' }}>
              <div className="sub">{t('handshape_guide')} — ISL "{target}"</div>
              <p style={{ marginTop: '0.5rem', fontWeight: 500 }}>
                {LETTER_GUIDES[target] ? LETTER_GUIDES[target][lang] : ''}
              </p>
              <p style={{ marginTop: '0.8rem', color: 'var(--blue)', fontSize: '0.85rem' }}>{t('perform_sign')}</p>
            </div>

            {feedback && (
              <div className={`feedback ${feedback === 'ok' ? 'ok' : 'bad'}`}>
                {feedback === 'ok' ? t('correct') : `${t('try_again')} (${t('recognized_letter')}: ${lastLetter || '—'})`}
              </div>
            )}
          </section>

          <section className="card">
            <p style={{ marginBottom: '1rem' }}>{t('learning_desc')}</p>
            <HandTracker onLetter={checkLetter} active />
          </section>
        </div>
      )}

      {emergency && (
        <div className="emg-overlay" onClick={() => setEmergency(null)} role="alert">
          <div className="box">
            <div style={{ fontSize: '0.8rem', letterSpacing: '0.3em', color: 'var(--danger)', marginBottom: '0.6rem' }}>EMERGENCY</div>
            <h2>{phraseText(emergency)}</h2>
            <p>{lang === 'hi' ? emergency.en : emergency.hi}</p>
            <button className="btn btn-danger" style={{ marginTop: '1.6rem' }} onClick={() => setEmergency(null)}>
              {t('clear')}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

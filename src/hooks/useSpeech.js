import { useCallback, useRef, useState } from 'react'
import { useSettings } from '../context/SettingsContext'

export function useSpeech() {
  const { lang } = useSettings()
  const [speaking, setSpeaking] = useState(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const utterRef = useRef(null)

  const speak = useCallback((text, overrideLang) => {
    if (!supported || !text) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = overrideLang || (lang === 'hi' ? 'hi-IN' : 'en-US')
    u.rate = 1
    u.pitch = 1
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    utterRef.current = u
    setSpeaking(true)
    window.speechSynthesis.speak(u)
  }, [supported, lang])

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  return { speak, stop, speaking, supported }
}

export function useDictation() {
  const [listening, setListening] = useState(false)
  const supported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

  const dictate = useCallback((onResult, lang) => {
    if (!supported) return
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new Rec()
    rec.lang = lang === 'hi' ? 'hi-IN' : 'en-US'
    rec.interimResults = false
    rec.onresult = (e) => onResult(e.results[0][0].transcript)
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    setListening(true)
    rec.start()
  }, [supported])

  return { dictate, listening, supported }
}

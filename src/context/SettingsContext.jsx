import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { translate } from '../i18n'

const SettingsContext = createContext(null)

const SIZES = ['sm', 'md', 'lg', 'xl']

export function SettingsProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('mira-lang') || 'en')
  const [contrast, setContrast] = useState(() => localStorage.getItem('mira-contrast') === '1')
  const [textSize, setTextSize] = useState(() => localStorage.getItem('mira-size') || 'md')

  useEffect(() => {
    const root = document.documentElement
    root.dataset.contrast = contrast ? 'high' : 'normal'
    root.dataset.size = textSize
    root.lang = lang
    localStorage.setItem('mira-lang', lang)
    localStorage.setItem('mira-contrast', contrast ? '1' : '0')
    localStorage.setItem('mira-size', textSize)
  }, [lang, contrast, textSize])

  const t = useCallback((key) => translate(lang, key), [lang])

  const bumpSize = (dir) => {
    setTextSize((s) => {
      const i = SIZES.indexOf(s)
      const next = Math.min(SIZES.length - 1, Math.max(0, i + dir))
      return SIZES[next]
    })
  }

  return (
    <SettingsContext.Provider value={{ lang, setLang, contrast, toggleContrast: () => setContrast((c) => !c), textSize, bumpSize, t }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}

import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'

export default function Dashboard() {
  const { t, lang } = useSettings()

  return (
    <main className="page">
      <div className="module-head">
        <h1 className="section-title" style={{ margin: 0 }}>{t('nav_dashboard')}</h1>
        <span className="live-badge"><span className="pulse-dot" /> {t('status_ready')}</span>
      </div>
      <div className="status-bar">
        <span>◉ Frontend · React + Vite — OK</span>
        <span>◉ OCR · Tesseract.js — OK</span>
        <span>◉ Voice · Web Speech API — OK</span>
        <span>◉ Vision · COCO-SSD Real AI — OK</span>
        <span style={{ marginLeft: 'auto' }}>TensorFlow.js · In-Browser ML Active</span>
      </div>

      <div className="grid grid-2">
        <motion.div whileHover={{ y: -5 }}>
          <Link to="/vision">
            <div className="card">
              <div className="card-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--blue)' }}>
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <h3>{t('feat_vision_title')}</h3>
              <div className="sub">{t('feat_vision_sub')}</div>
              <p>{t('feat_vision_desc')}</p>
              <ul style={{ color: 'var(--text-dim)', fontSize: '0.9rem', margin: '0.8rem 0 1.2rem 1.2rem', lineHeight: 1.9 }}>
                <li>{t('vision_live')}</li>
                <li>{t('ocr_title')}</li>
                <li>{t('read_aloud')} / TTS</li>
              </ul>
              <span className="btn">{t('open_module')} →</span>
            </div>
          </Link>
        </motion.div>

        <motion.div whileHover={{ y: -5 }}>
          <Link to="/connect">
            <div className="card">
              <div className="card-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--red)' }}>
                  <path d="M12 2a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" />
                </svg>
              </div>
              <h3>{t('feat_connect_title')}</h3>
              <div className="sub">{t('feat_connect_sub')}</div>
              <p>{t('feat_connect_desc')}</p>
              <ul style={{ color: 'var(--text-dim)', fontSize: '0.9rem', margin: '0.8rem 0 1.2rem 1.2rem', lineHeight: 1.9 }}>
                <li>{t('connect_sign_title')} — {lang === 'hi' ? 'A · B · L · V · Y' : 'ISL alphabet recognition'}</li>
                <li>{t('type_speak_title')}</li>
                <li>{t('emergency_title')} + {t('learning_title')}</li>
              </ul>
              <span className="btn">{t('open_module')} →</span>
            </div>
          </Link>
        </motion.div>
      </div>

      <div className="grid grid-3 section">
        {[
          { k: 'how_1_t', d: 'how_1_d' },
          { k: 'how_2_t', d: 'how_2_d' },
          { k: 'how_3_t', d: 'how_3_d' },
        ].map((x) => (
          <div className="card" key={x.k}>
            <h3 style={{ fontSize: '1.05rem' }}>{t(x.k)}</h3>
            <p>{t(x.d)}</p>
          </div>
        ))}
      </div>
    </main>
  )
}

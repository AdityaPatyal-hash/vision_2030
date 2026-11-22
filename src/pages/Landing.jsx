import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.55 },
}

export default function Landing() {
  const { t } = useSettings()

  return (
    <main className="page" style={{ maxWidth: '1280px' }}>
      <section className="hero">
        <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="hero-badge"><span className="pulse-dot" /> MIRA · {t('tagline')}</div>
          <h1>
            {t('hero_title_1')}<br />
            <span className="grad-text">{t('hero_title_2')}</span><br />
            {t('hero_title_3')}
          </h1>
          <p className="sub">{t('hero_sub')}</p>
          <div className="hero-cta">
            <Link to="/dashboard"><button className="btn">{t('get_started')} →</button></Link>
            <Link to="/vision"><button className="btn btn-ghost">{t('explore_vision')}</button></Link>
          </div>
        </motion.div>
        <motion.div className="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <div className="stat"><b>80+</b><span>Objects detected</span></div>
          <div className="stat"><b>26</b><span>ISL letters</span></div>
          <div className="stat"><b>2</b><span>Languages · EN / HI</span></div>
          <div className="stat"><b>&lt;200ms</b><span>Gesture latency</span></div>
        </motion.div>
      </section>

      <motion.section className="section" {...fadeUp}>
        <h2 className="section-title">{t('feat_vision_title')} <span className="grad-text">&amp;</span> {t('feat_connect_title')}</h2>
        <p className="section-sub" style={{ marginBottom: '1.4rem' }}>{t('tagline')}</p>
        <div className="grid grid-2">
          <Link to="/vision">
            <motion.div className="card" whileHover={{ scale: 1.02 }}>
              <div className="card-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--blue)' }}>
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <h3>{t('feat_vision_title')}</h3>
              <div className="sub">{t('feat_vision_sub')}</div>
              <p>{t('feat_vision_desc')}</p>
              <br />
              <span className="btn btn-sm">{t('open_module')}</span>
            </motion.div>
          </Link>
          <Link to="/connect">
            <motion.div className="card" whileHover={{ scale: 1.02 }}>
              <div className="card-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--red)' }}>
                  <path d="M12 2a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" />
                </svg>
              </div>
              <h3>{t('feat_connect_title')}</h3>
              <div className="sub">{t('feat_connect_sub')}</div>
              <p>{t('feat_connect_desc')}</p>
              <br />
              <span className="btn btn-sm">{t('open_module')}</span>
            </motion.div>
          </Link>
        </div>
      </motion.section>

      <motion.section className="section" {...fadeUp}>
        <h2 className="section-title">{t('how_title')}</h2>
        <div className="grid grid-3" style={{ marginTop: '1.4rem' }}>
          {['how_1', 'how_2', 'how_3'].map((k, i) => (
            <motion.div className="card" key={k} whileHover={{ y: -4 }}>
              <div className="card-icon">
                <b style={{ color: '#ffffff', fontSize: '1.2rem' }}>{i + 1}</b>
              </div>
              <h3>{t(`${k}_t`)}</h3>
              <p>{t(`${k}_d`)}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section className="section" {...fadeUp} style={{ textAlign: 'center' }}>
        <h2 className="section-title">{t('tech_title')}</h2>
        <div className="chip-row">
          {['React.js', 'FastAPI', 'YOLOv8', 'Tesseract.js', 'MediaPipe', 'Web Speech API', 'Ollama-ready'].map((c) => (
            <span className="chip" key={c}>{c}</span>
          ))}
        </div>
      </motion.section>
    </main>
  )
}

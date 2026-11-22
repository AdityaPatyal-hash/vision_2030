import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'

export default function Navbar() {
  const { lang, setLang, contrast, toggleContrast, textSize, bumpSize, t } = useSettings()
  const [open, setOpen] = useState(false)

  const links = [
    { to: '/', key: 'nav_home' },
    { to: '/dashboard', key: 'nav_dashboard' },
    { to: '/vision', key: 'nav_vision' },
    { to: '/connect', key: 'nav_connect' },
  ]

  const settings = (
    <>
      <button className={`pill-btn ${contrast ? 'active' : ''}`} onClick={toggleContrast} aria-pressed={contrast} title={t('contrast')}>
        ◐ {t('contrast')}
      </button>
      <span style={{ display: 'inline-flex', gap: 2 }}>
        <button className="icon-btn" onClick={() => bumpSize(-1)} aria-label="decrease text size">A−</button>
        <button className="icon-btn" onClick={() => bumpSize(1)} aria-label="increase text size" style={{ fontSize: '1.05em' }}>A+</button>
      </span>
      <button
        className="pill-btn active"
        onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
        aria-label={t('language')}
      >
        {lang === 'en' ? 'EN | हिं' : 'हिं | EN'}
      </button>
    </>
  )

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="brand">
          <span className="brand-badge">M</span>
          <span>
            MIRA
            <span className="brand-dots">AI · VISION · ASSISTANCE</span>
          </span>
        </Link>
        <div className="nav-links">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              {t(l.key)}
            </NavLink>
          ))}
        </div>
        <div className="nav-settings">{settings}</div>
        <button className="icon-btn hamburger" onClick={() => setOpen((o) => !o)} aria-label="menu" aria-expanded={open}>
          {open ? '✕' : '☰'}
        </button>
      </nav>
      {open && (
        <div className="mobile-menu">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} onClick={() => setOpen(false)}>
              {t(l.key)}
            </NavLink>
          ))}
          <div className="row">{settings}</div>
        </div>
      )}
    </>
  )
}

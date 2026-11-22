import { useSettings } from '../context/SettingsContext'

export default function Footer() {
  const { t } = useSettings()
  return <footer className="footer">© 2026 MIRA · {t('footer')}</footer>
}

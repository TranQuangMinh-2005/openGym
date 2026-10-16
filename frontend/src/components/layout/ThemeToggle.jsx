import { useStore } from '../../store/useStore.js'
import { useMediaQuery } from './useMediaQuery.js'
import { t } from '../../lib/i18n.js'
import Icon from '../Icon.jsx'

export default function ThemeToggle({ className = '' }) {
  const theme = useStore(s => s.S.theme)
  const update = useStore(s => s.update)
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const light = theme === 'light' || (theme === 'system' && !systemDark)
  const label = light ? t('Switch to dark theme') : t('Switch to light theme')
  return <button type="button" className={'workspace-theme-toggle ' + className} aria-label={label} title={label}
    onClick={() => update(s => { s.theme = light ? 'dark' : 'light' })}>
    <Icon name={light ? 'moon' : 'sun'} />
  </button>
}

import GymMascot from '../GymMascot.jsx'
import { t } from '../../lib/i18n.js'

export default function BuddyHint({ title = 'GymBuddy', children, state = 'idle', className = '' }) {
  return <div className={'buddy-hint ' + className}>
    <GymMascot size={60} state={state} animate={false} />
    <div><strong>{t(title)}</strong><p>{children}</p></div>
  </div>
}

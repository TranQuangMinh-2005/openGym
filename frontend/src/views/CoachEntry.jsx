import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { coachAvailable } from '../lib/coach.js'
import { t } from '../lib/i18n.js'
import { MOBILE } from '../lib/mobile.js'
import { DEMO } from '../lib/demo.js'
import CoachChat from './CoachChat.jsx'
import GymMascot from '../components/GymMascot.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

export default function CoachEntry() {
  const config = useStore(s => s.config)
  const user = useStore(s => s.user)
  const coachMode = useStore(s => s.coachLocal?.mode)
  const nav = useNavigate()
  if (coachAvailable(config, user, { demo: DEMO, mobile: MOBILE, coachMode })) return <CoachChat key={user?.id || 'guest'} />
  return <div className="buddy-welcome">
    <div className="buddy-welcome-hero">
      <GymMascot size={220} animate={false} />
      <div><span className="workspace-eyebrow">{t('YOUR TRAINING COMPANION')}</span><h1>{t('Meet GymBuddy.')}</h1>
        <p>{t('A little guidance for your next step. Build a program, explore exercises and keep track of the work you put in.')}</p>
        <p>{t('Connect an AI provider to create and review programs together. Nothing in your plan changes without your approval.')}</p>
        {user?.admin ? <Button variant="primary" icon="sparkles" onClick={() => nav('/admin')}>{t('Connect AI')}</Button>
          : MOBILE ? <Button variant="primary" onClick={() => nav('/coach/setup')}>{t('Set up Coach')}</Button>
          : <div className="tag">{t('Ask your admin to connect an AI provider.')}</div>}
      </div>
    </div>
    <div className="buddy-welcome-links">
      <button onClick={() => nav('/plan')}><Icon name="calendar" /><strong>{t('Your next session')}</strong><span>{t('Build and adjust the program you want to follow.')}</span></button>
      <button onClick={() => nav('/library')}><Icon name="dumbbell" /><strong>{t('Understand your exercises')}</strong><span>{t('Explore movements, equipment and the muscles involved.')}</span></button>
      <button onClick={() => nav('/history')}><Icon name="history" /><strong>{t('Look back, move forward')}</strong><span>{t('See your logged sessions and what you actually lifted.')}</span></button>
    </div>
  </div>
}

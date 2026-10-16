import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { coachAvailable } from '../../lib/coach.js'
import { effectiveRoutines } from '../../lib/history.js'
import { todayISO } from '../../lib/format.js'
import { t, exerciseNameFor } from '../../lib/i18n.js'
import { EXDB } from '../../lib/exercises.js'
import { MOBILE } from '../../lib/mobile.js'
import { DEMO } from '../../lib/demo.js'
import GymMascot from '../GymMascot.jsx'
import Icon from '../Icon.jsx'

const copyFor = path => path.startsWith('/plan') ? t('Your program, one session at a time. Keep the exercises that work for you.')
  : path === '/library' || path === '/muscles' ? t('Explore an exercise, check its equipment and add it to your program.')
  : path === '/history' ? t('Every session tells a story. Open a workout to see what you actually did.')
  : path === '/stats' ? t('Look for patterns across your sessions. Progress takes more than one workout.')
  : path === '/measurements' ? t('Compare your measurements over time, at your own pace.')
  : path.startsWith('/settings') ? t('Make this space work for you. Your training stays saved as you adjust your preferences.')
  : t('Here for your next step.')

export default function BuddyRail({ pathname, onClose, shown = true }) {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const config = useStore(s => s.config)
  const coachLocal = useStore(s => s.coachLocal)
  const activity = useUI(s => s.buddyActivity) || 'idle'
  const [motion, setMotion] = useState(() => { try { return localStorage.getItem('gym_buddy_motion') !== '0' } catch { return true } })
  const [visible, setVisible] = useState(!document.hidden)
  useEffect(() => {
    const changed = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', changed)
    return () => document.removeEventListener('visibilitychange', changed)
  }, [])
  const toggleMotion = () => setMotion(v => { try { localStorage.setItem('gym_buddy_motion', v ? '0' : '1') } catch {} return !v })
  const available = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE, coachMode: coachLocal?.mode })
  const today = effectiveRoutines(S, todayISO())
  const current = S.active?.entries?.[S.active.cur || 0]
  const last = S.workouts?.at(-1)
  const doneToday = (S.workouts || []).some(w => w.d === todayISO())
  const state = activity !== 'idle' ? activity : S.active ? 'training' : doneToday ? 'success' : 'idle'
  const context = pathname.startsWith('/plan/r/')
    ? S.routines.find(r => r.id === pathname.split('/').at(-1))
    : today[0]
  const openCoach = () => { onClose?.(); nav('/coach') }
  const go = path => { onClose?.(); nav(path) }

  return <aside className="buddy-rail" aria-label={t('GymBuddy assistant')}>
    <div className="buddy-rail-header"><span><span className={'presence-dot' + (available ? ' connected' : '')} />GymBuddy</span>
      <div className="row"><button className="iconbtn" aria-label={motion ? t('Pause Buddy animation') : t('Play Buddy animation')} aria-pressed={!motion} onClick={toggleMotion}><Icon name={motion ? 'pause' : 'play'} /></button>
      {onClose && <button className="iconbtn buddy-close" onClick={onClose} aria-label={t('Close assistant')}><Icon name="xmark" /></button>}</div>
    </div>
    <div className="buddy-rail-avatar"><GymMascot state={state} size={160} animate={motion && visible && shown} /></div>
    <div className="buddy-rail-greeting">
      <h2>{state === 'training' ? t('You’ve got this') : state === 'success' ? t('Well done today') : t('Your training companion')}</h2>
      <p>{copyFor(pathname)}</p>
    </div>
    {pathname.startsWith('/coach') ? <div className="buddy-context"><span className="workspace-eyebrow">{t('Your program')}</span>
      {S.routines?.length ? S.routines.slice(0, 5).map(r => <button key={r.id} onClick={() => go('/plan/r/' + r.id)}><Icon name="clipboard" /><span>{r.name}<small>{r.ex.length} {t('exercises')}</small></span><Icon name="chevronRight" /></button>) : <p>{t('Your new program will appear here after you accept it.')}</p>}
    </div> : <>
      <div className="buddy-context"><span className="workspace-eyebrow">{t('Your next session')}</span>
        {context ? <button onClick={() => go('/plan/r/' + context.id)}><Icon name="calendar" /><span>{context.name}<small>{context.ex.length} {t('exercises')}</small></span><Icon name="chevronRight" /></button>
          : <button onClick={() => go('/plan')}><Icon name="calendar" /><span>{t('Build your program')}<small>{t('Start with a session that fits you')}</small></span><Icon name="chevronRight" /></button>}
        {current && <div className="buddy-context-note">{t('Current exercise')}: {exerciseNameFor([...EXDB, ...(S.customEx || [])].find(e => e.id === current.id) || { name: current.id })}</div>}
        {last && <button onClick={() => go('/history')}><Icon name="history" /><span>{t('Last workout')}<small>{last.name} · {last.d}</small></span><Icon name="chevronRight" /></button>}
      </div>
    </>}
    {(!pathname.startsWith('/coach') || !available) && <button className="btn primary buddy-chat-button" onClick={!available && user?.admin ? () => go('/admin') : openCoach}><Icon name="sparkles" />{available ? t('Chat with Buddy') : user?.admin ? t('Connect AI') : t('Meet your coach')}<Icon name="chevronRight" /></button>}
    <div className="buddy-rail-footer" title={t('Your plan changes only when you approve.')}><Icon name={available ? 'shield' : 'cloud'} />{available ? t('Your plan changes only when you approve.') : t('AI not connected')}</div>
  </aside>
}

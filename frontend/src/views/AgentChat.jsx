import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t, getLang } from '../lib/i18n.js'
import * as agent from '../lib/agent-api.js'
import { exOr } from '../lib/exercises.js'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import GymMascot from '../components/GymMascot.jsx'
import '../coach.css'
import './AgentChat.css'

gsap.registerPlugin(useGSAP)

export function AssistantText({ text }) {
  return String(text || '').split(/(\*\*[^*]+\*\*|\[kb-[\w-]+\])/g).map((part, i) => part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : /^\[kb-/.test(part) ? <small className="agent-citation" key={i}>{part}</small> : part)
}
const labels = {
  available_equipment: 'Available equipment', avoid_equipment: 'Avoid equipment',
  avoid_exercise: 'Avoid exercise', avoid_region: 'Protect area',
  max_session_minutes: 'Max session length', days_per_week: 'Days per week',
  priority_muscles: 'Priority muscles', goal: 'Goal', experience: 'Experience', preference: 'Preference',
  shoulder: 'shoulder', back: 'back', knee: 'knee', wrist: 'wrist', elbow: 'elbow',
  hip: 'hip', ankle: 'ankle', neck: 'neck', chest: 'chest',
  add: 'add', set: 'set', remove: 'remove', required: 'required', hard: 'required', soft: 'preferred', preferred: 'preferred',
  add_exercise: 'Add exercise', remove_exercise: 'Remove exercise', update_exercise: 'Change exercise',
  add_routine: 'Add session', remove_routine: 'Remove session', update_routine: 'Change session', set_weekday: 'Move day'
}
const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const exerciseName = id => exOr(id).missing ? id : t(exOr(id).n)
const valueText = value => {
  if (value == null) return '–'
  if (Array.isArray(value)) return value.map(valueText).join(', ')
  if (typeof value === 'object') {
    if ('sets' in value) return `${value.sets}×${value.sec != null ? value.sec + ' s' : value.repsMin != null ? value.repsMin + '–' + value.repsMax : value.reps}${value.weight != null ? ' · ' + value.weight + ' kg' : ''}`
    return Object.entries(value).map(([key, item]) => `${labels[key] || key}: ${valueText(item)}`).join(', ')
  }
  return labels[value] || String(value)
}
const dayIds = (week, index) => [].concat(week?.[index] ?? []).filter(Boolean)

export function PlanDiff({ diff = {} }) {
  const routine = id => diff.routines?.find(r => r.id === id)
  const routineName = id => routine(id)?.after?.name || routine(id)?.before?.name || id
  const daysOf = id => weekdays.filter((_, index) => dayIds(diff.week?.after, index).includes(id))
  return (
    <div className="agent-plan">
      {(diff.routines || []).map(({ id, before, after }) => {
        const days = daysOf(id)
        const lines = [...new Set([...(before?.ex || []).map(e => e.id), ...(after?.ex || []).map(e => e.id)])].map(exId => {
          const oldEx = before?.ex?.find(e => e.id === exId)
          const newEx = after?.ex?.find(e => e.id === exId)
          if (JSON.stringify(oldEx) === JSON.stringify(newEx)) return null
          return (
            <li className={!oldEx ? 'agent-added' : !newEx ? 'agent-removed' : 'agent-changed'} key={exId}>
              <span className="agent-ex-name">{exerciseName(exId)}</span>
              <span className="agent-ex-dose">{!oldEx ? valueText(newEx) : !newEx ? t('removed') : `${valueText(oldEx)} → ${valueText(newEx)}`}</span>
            </li>
          )
        })
        return (
          <section className="agent-routine" key={id}>
            <header>
              <span className="agent-eyebrow">{!before ? t('New session') : !after ? t('Removed session') : t('Changed session')}{days.length ? ' · ' + days.join(', ') : ''}</span>
              <h4>{before && after && before.name !== after.name ? `${before.name} → ${after.name}` : (after || before)?.name}</h4>
            </header>
            <ul>{lines}</ul>
          </section>
        )
      })}
      {diff.week && <div className="agent-week" aria-label={t('Weekly schedule')}>{weekdays.map((day, index) => {
        const ids = dayIds(diff.week.after, index)
        const name = ids.length ? ids.map(routineName).join(' + ') : t('Rest')
        return <div key={day} className={ids.length ? 'on' : ''} title={name}><span className="agent-eyebrow">{day}</span><strong>{ids.length ? name.split(/[\s(–-]/)[0] : '·'}</strong></div>
      })}</div>}
    </div>
  )
}

function ConstraintEntry({ entry }) {
  return (
    <p className="agent-constraint">
      <strong>{labels[entry.type] || entry.type}</strong> {entry.type === 'avoid_exercise' ? exerciseName(entry.value) : valueText(entry.value)}
      <span className="agent-tag">{labels[entry.strength] || entry.strength}</span><span className="agent-tag">{labels[entry.op] || entry.op}</span>
      {entry.weekdays?.length ? <span className="agent-tag">{entry.weekdays.map(day => weekdays[day]).join(', ')}</span> : null}
    </p>
  )
}

export function ConstraintDiff({ draft }) {
  return (
    <div>
      <p className="agent-summary">{draft.summary}</p>
      {(Array.isArray(draft.diff) ? draft.diff : []).map((change, index) => (
        <div key={index}>
          {change.before && <ConstraintEntry entry={change.before} />}
          {change.before && <span>→</span>}
          {change.after && <ConstraintEntry entry={change.after} />}
        </div>
      ))}
    </div>
  )
}

function ShortList({ items }) {
  return items?.length ? (
    <ul className="agent-notes">
      {items.map((item, index) => <li key={index}>{typeof item === 'string' ? item : item.message || item.summary || item.why}</li>)}
    </ul>
  ) : null
}

// Numbers computed by the server from the draft itself (planFacts), not written by the model.
const muscleNames = { pectorals: 'Chest', delts: 'Shoulders', triceps: 'Triceps', biceps: 'Biceps', lats: 'Lats', 'upper back': 'Upper back',
  traps: 'Traps', quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', abs: 'Abs', forearms: 'Forearms',
  adductors: 'Adductors', abductors: 'Abductors', spine: 'Lower back', 'serratus anterior': 'Serratus', 'levator scapulae': 'Levator scapulae',
  'cardiovascular system': 'Cardio' }
export function PlanFacts({ facts, exercises }) {
  if (!facts?.byPrimaryMuscle) return null
  const rows = Object.entries(facts.byPrimaryMuscle).sort((a, b) => b[1].setsPerWeek - a[1].setsPerWeek)
  const max = Math.max(1, ...rows.map(([, v]) => v.setsPerWeek))
  const minutes = Object.values(facts.minutesByRoutine || {})
  const stats = [
    [facts.trainingDaysPerWeek, t('days / week')],
    minutes.length ? ['~' + Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length), t('min / session')] : null,
    exercises ? [exercises, t('exercises')] : null,
    [rows.reduce((sum, [, v]) => sum + v.setsPerWeek, 0), t('sets / week')]
  ].filter(Boolean)
  return (
    <div className="agent-facts">
      <dl className="agent-stats">{stats.map(([value, label]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <span className="agent-eyebrow">{t('Weekly volume by muscle')}</span>
      <ul className="agent-volume">{rows.map(([muscle, v]) => (
        <li key={muscle}>
          <span className="agent-muscle">{t(muscleNames[muscle] || muscle)}</span>
          <span className="agent-track" aria-hidden="true"><span className="agent-bar" style={{ width: `${v.setsPerWeek / max * 100}%` }} /></span>
          <span className="agent-sets">{v.setsPerWeek}</span>
          <span className="agent-freq" title={t('sessions per week')}>{v.sessionsPerWeek}×</span>
        </li>
      ))}</ul>
    </div>
  )
}
export function ApprovalCard({ draft, onDecision, disabled }) {
  const changes = draft.changes || draft.diff?.changes || []
  const [selected, setSelected] = useState(() => changes.map(change => change.id))
  const decide = decision => onDecision({
    draftId: draft.id,
    decision,
    ...(decision === 'approve' && draft.kind === 'plan_edit' ? { acceptedChangeIds: selected } : {})
  })
  const exercises = new Set((draft.diff?.routines || []).flatMap(r => (r.after?.ex || []).map(e => e.id))).size
  return (
    <section className="agent-approval">
      <span className="agent-kind">{({ plan_create: t('New program'), plan_edit: t('Program changes'), constraints: t('Confirm training rules') })[draft.kind]}</span>
      {draft.kind === 'constraints' ? <ConstraintDiff draft={draft} /> : <>
        <h3 className="agent-summary">{draft.summary}</h3>
        <PlanFacts facts={draft.facts} exercises={draft.kind === 'plan_create' ? exercises : null} />
        <PlanDiff diff={draft.diff} />
      </>}
      {draft.kind === 'plan_edit' && changes.map(change => (
        <label className="agent-change" key={change.id}>
          <input
            type="checkbox"
            checked={selected.includes(change.id)}
            onChange={event => setSelected(ids => event.target.checked ? [...ids, change.id] : ids.filter(id => id !== change.id))}
          />
          <span><strong>{labels[change.type] || t('Change')} {change.target?.exId ? exerciseName(change.target.exId) : change.target?.routineId} {change.target?.weekday != null ? weekdays[change.target.weekday] : ''}</strong>
            <span className="agent-ex-dose">{valueText(change.before)} → {valueText(change.after)}</span>{change.why && <small>{change.why}</small>}</span>
        </label>
      ))}
      <ShortList items={draft.warnings} />
      <ShortList items={draft.conflicts} />
      <div className="agent-actions">
        <button className="agent-primary" disabled={disabled || (draft.kind === 'plan_edit' && !selected.length)} onClick={() => decide('approve')}>{t('Approve')}</button>
        <button disabled={disabled} onClick={() => decide('reject')}>{t('Reject')}</button>
      </div>
      <p className="agent-fineprint">{t('Nothing changes in your plan until you approve.')}</p>
    </section>
  )
}

function Transcript({ messages = [] }) {
  return (
    <div className="agent-transcript" role="log" aria-live="polite">
      {messages.map((message, index) => (
        <div className={'msg ' + (message.role === 'user' ? 'user' : 'coach')} key={index}>
          {message.role !== 'user' && <span className="agent-avatar">{messages[index - 1]?.role !== 'assistant' && <GymMascot size={30} animate={false} speechHeader={false} />}</span>}
          <span className="agent-text"><AssistantText text={message.text} /></span>
        </div>
      ))}
    </div>
  )
}

function Composer({ text, setText, disabled, onSend }) {
  return (
    <form className="agent-composer" onSubmit={event => { event.preventDefault(); if (text.trim() && !disabled) onSend() }}>
      <textarea rows={1} placeholder={t('Ask about your program, technique or progress…')} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) { event.preventDefault(); if (text.trim() && !disabled) onSend() } }} disabled={disabled} aria-label={t('Message')} maxLength={2000} value={text} onChange={event => setText(event.target.value)} />
      <button aria-label={t('Send')} disabled={disabled || !text.trim()}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg></button>
    </form>
  )
}

function ConstraintsPanel({ ledger, drafts }) {
  const active = ledger.filter(entry => entry.status === 'active')
  const pending = drafts.filter(draft => draft.kind === 'constraints')
  if (!active.length && !pending.length) return null
  return (
    <details className="agent-constraints" open>
      <summary><span className="agent-eyebrow">{t('Training rules')}</span><span className="agent-count">{active.length}</span></summary>
      {active.map((entry, index) => <ConstraintEntry key={entry.id || index} entry={entry} />)}
      {pending.map(draft => <ConstraintDiff key={draft.id} draft={draft} />)}
    </details>
  )
}

const suggestions = [
  ['Build me a program', 'Build me a 3-day-a-week program for my gym', 'calendar'],
  ['Review my progress', 'Review my progress and tell me what to change', 'chart'],
  ['How many sets per week?', 'How many sets per week should I do per muscle to build muscle?', 'book']
]
const icons = {
  calendar: 'M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  chart: 'M4 20h16M7 16v-5m5 5V7m5 9v-8',
  book: 'M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z'
}
const statusText = { idle: 'Ready', searching: 'Thinking…', success: 'Saved to your plan', error: 'Something went wrong', waiting: 'Waiting for your approval' }

export default function AgentChat() {
  const uid = useStore(s => s.user?.id)
  const ledger = useStore(s => s.S.coach?.ledger) || []
  const [thread, setThread] = useState(null)
  const [drafts, setDrafts] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const ctl = useRef(null)
  const scope = useRef(null)
  const [celebrateKey, setCelebrateKey] = useState(0)
  const { contextSafe } = useGSAP({ scope })
  useGSAP(() => {
    if (typeof window.matchMedia !== 'function') return
    // Each element enters once (data-entered), and fromTo names the end state: a from() started
    // twice (StrictMode, a matchMedia re-run) took the half-faded state as its end and left
    // messages invisible.
    const fresh = selector => [...scope.current.querySelectorAll(selector)].filter(el => !el.dataset.entered && (el.dataset.entered = '1'))
    const messages = fresh('.msg')
    const cards = fresh('.agent-approval')
    const intro = fresh('.agent-empty')
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      intro.forEach(el => gsap.fromTo(el.querySelectorAll('.agent-hero > *, .agent-suggestion'), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .45, ease: 'power3.out', stagger: .07, clearProps: 'transform,opacity,visibility' }))
      gsap.fromTo(messages, { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .32, ease: 'power3.out', stagger: .05, clearProps: 'transform,opacity,visibility' })
      cards.forEach(card => gsap.timeline()
        .fromTo(card, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .4, ease: 'power3.out', clearProps: 'transform,opacity,visibility' })
        .fromTo(card.querySelectorAll('.agent-stats > div'), { y: 8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .3, stagger: .06, clearProps: 'transform,opacity,visibility' }, '-=.2')
        .fromTo(card.querySelectorAll('.agent-bar'), { scaleX: 0 }, { scaleX: 1, duration: .5, ease: 'power2.out', stagger: .035, clearProps: 'transform' }, '-=.15'))
      if (thread?.status === 'running') gsap.timeline({ repeat: -1 }).to('.agent-dot', { y: -5, duration: .3, stagger: .15 }).to('.agent-dot', { y: 0, duration: .3, stagger: .15 }, .3)
    })
    return () => mm.revert()
  }, { scope, dependencies: [thread] })
  useEffect(() => { scope.current?.querySelector('.agent-end')?.scrollIntoView?.({ block: 'nearest' }) }, [thread])
  const finish = async (id, sync = false) => {
    const result = await agent.pollThread(id, { signal: ctl.current.signal, onUpdate: setThread })
    if (sync) await useStore.getState().pullState()
    setDrafts(await agent.listDrafts())
    setSuccess(result.lastRun?.status === 'done' || result.status === 'done')
  }
  useEffect(() => {
    ctl.current = new AbortController()
    const id = agent.savedThread(uid)
    if (id) finish(id).catch(e => { if (e.name !== 'AbortError') setError(e.message) })
    agent.listDrafts().then(setDrafts).catch(e => setError(e.message))
    return () => ctl.current.abort()
  }, [uid])
  useEffect(() => { if (success) { const timer = setTimeout(() => setSuccess(false), 2000); return () => clearTimeout(timer) } }, [success])
  const run = async (decision, message = text) => {
    setBusy(true)
    setError('')
    try {
      const result = decision ? await agent.resume(thread.threadId, [decision]) : await agent.sendMessage({ threadId: thread?.threadId, text: message.trim(), lang: getLang() === 'vi' ? 'vi' : 'en' })
      agent.savedThread(uid, result.threadId)
      setText('')
      await finish(result.threadId, !!decision)
      if (decision?.decision === 'approve') setCelebrateKey(key => key + 1)
    } catch (e) { if (e.name !== 'AbortError') setError(e.message) }
    finally { setBusy(false) }
  }
  const running = thread?.status === 'running'
  const blocked = thread?.status === 'awaiting_approval'
  // A proposal waiting for approval is good news: the mascot stays calm rather than showing the
  // red "blocked" alert face; the status line says what it waits for.
  const state = error || ['error', 'cancelled'].includes(thread?.status) ? 'error' : running || (busy && !blocked) ? 'searching' : success ? 'success' : 'idle'
  const status = blocked && state === 'idle' ? 'waiting' : state
  const started = !!thread?.messages?.length
  return <div className="agent-chat" ref={scope}>
    <main>
      <header className="agent-header">
        {started && <GymMascot state={state} size={52} celebrateKey={celebrateKey} />}
        <div><span className="agent-eyebrow">{t('GymBuddy Coach')}</span>
          <p className={'agent-status ' + status} aria-live="polite"><i aria-hidden="true" />{t(statusText[status])}</p></div>
      </header>
      {!started && <div className="agent-empty">
        <div className="agent-hero">
          <GymMascot state={state} size={132} celebrateKey={celebrateKey} />
          <h1>{t('What are we training today?')}</h1>
          <p>{t('Ask for a program, a progress check or the science behind a set. Nothing changes until you approve it.')}</p>
        </div>
        <div className="agent-suggestions">{suggestions.map(([title, prompt, icon]) => (
          <button className="agent-suggestion" disabled={busy || blocked || running} key={title} onClick={contextSafe(() => run(null, t(prompt)))}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[icon]} /></svg>
            <span>{t(title)}</span>
            <svg className="agent-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
          </button>
        ))}</div>
      </div>}
      <Transcript messages={thread?.messages} />
      {thread?.approval?.drafts?.map(d => <ApprovalCard key={d.id} draft={d} disabled={busy} onDecision={run} />)}
      {error && <p className="agent-error" role="alert">{error}</p>}
      {running && <div className="agent-thinking"><span className="agent-dots" aria-hidden="true">{[0, 1, 2].map(n => <span className="agent-dot" key={n} />)}</span><span>{t('Coach is working on it')}</span><button onClick={async () => { try { await agent.cancel(thread.threadId); ctl.current.abort(); ctl.current = new AbortController(); await finish(thread.threadId) } catch (e) { setError(e.message) } }}>{t('Cancel')}</button></div>}
      <div className="agent-end" />
      {blocked ? <p className="agent-hint">{t('Approve or reject the proposal to keep chatting.')}</p>
        : <div className="agent-compose-wrap">
          <Composer text={text} setText={setText} disabled={busy || running} onSend={contextSafe(() => run())} /></div>}
    </main>
    <ConstraintsPanel ledger={ledger} drafts={drafts} />
  </div>
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t, tn } from '../lib/i18n.js'
import { WorkoutRow, DayNoteRow, workoutDetailSheet, logPastWorkoutSheet } from '../sheets.jsx'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { dayNoteOf } from '../lib/day-notes.js'
import { fmtDate, fmtDur, fmtVol } from '../lib/format.js'
import { setsDone } from '../lib/history.js'
import BuddyHint from '../components/buddy/BuddyHint.jsx'

// Newest first: every workout, and in between them the days off you left a note on (#261). A
// note on a day that has a workout too stays in the day sheet; the workout speaks for that day.
export function historyRows(S) {
  const trained = new Set((S.workouts || []).map(w => w?.d))
  const notes = Object.keys(S.dayNotes || {}).filter(d => !trained.has(d)).map(d => ({ d, note: dayNoteOf(S, d) })).filter(x => x.note)
  const rows = [...(S.workouts || []).map(w => ({ d: w.d, w })), ...notes]
  // Stable, so workouts keep the order they are stored in (by day, then start) within a day.
  return rows.map((r, i) => [r, i]).sort((a, b) => (a[0].d < b[0].d ? 1 : a[0].d > b[0].d ? -1 : b[1] - a[1])).map(([r]) => r)
}

export default function History() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const rows = historyRows(S).filter(r => (!query || (r.w?.name || r.note?.text || '').toLowerCase().includes(query.toLowerCase())) && (!from || r.d >= from) && (!to || r.d <= to))
  return <>
    <div className="hdr"><button className="iconbtn" onClick={() => nav('/stats')} aria-label={t('Stats')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 12 }}><h1>{t('History')}</h1><div className="sub">{tn('{0} workout', '{0} workouts', S.workouts.length)}</div></div></div>
    <BuddyHint>{t('Your training, as it happened. Open a session to review the sets, notes and progress.')}</BuddyHint>
    <div className="page-toolbar">
      <label className="search"><input className="input" aria-label={t('Search workouts')} placeholder={t('Search workouts')} value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label className="history-date"><span>{t('From')}</span><input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label className="history-date"><span>{t('To')}</span><input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      <Button icon="plus" onClick={logPastWorkoutSheet}>{t('Log a past workout')}</Button>
    </div>
    {rows.length ? <>
      <div className="history-desktop history-table-wrap"><table className="history-table"><thead><tr><th>{t('Session')}</th><th>{t('Date')}</th><th>{t('Duration')}</th><th>{t('Sets')}</th><th>{t('Volume')}</th></tr></thead><tbody>{rows.map(r => <tr key={r.w?.id || 'note-' + r.d}>
        <td>{r.w ? <button className="history-open" onClick={() => workoutDetailSheet(r.w)}><Icon name="dumbbell" />{r.w.name}</button> : <DayNoteRow iso={r.d} note={r.note} />}</td>
        <td>{fmtDate(r.d, true)}</td><td>{r.w && r.w.end > r.w.start ? fmtDur(r.w.end - r.w.start) : t('Not recorded')}</td><td>{r.w ? setsDone(r.w) : ''}</td><td>{r.w && Number.isFinite(r.w.vol) ? fmtVol(r.w.vol, S.unit) : ''}</td>
      </tr>)}</tbody></table></div>
      <div className="history-mobile list">{rows.map(r => r.w ? <WorkoutRow key={r.w.id} w={r.w} onClick={() => workoutDetailSheet(r.w)} /> : <DayNoteRow key={'note-' + r.d} iso={r.d} note={r.note} />)}</div>
    </> : <div className="empty"><div className="ico"><Icon name="history" /></div>{S.workouts.length ? t('No sessions match these filters.') : t('No workouts yet. Your first one will land here.')}</div>}

  </>
}

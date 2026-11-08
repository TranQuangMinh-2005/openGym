/* Hand-ported client apply rules, pinned by coach-apply-parity.test.js.
 * Like payload.js's modeOf/isBw copies, keep behavior synchronized with the app.
 * Call on a transaction clone: on failure the caller must discard that clone.
 * label is a translation callback (key => localized label); now is epoch milliseconds.
 */
import { EXERCISES, EXALIAS } from './library-data.js'
import { modeOf as readMode } from './payload.js'
const EXIDX = Object.fromEntries(EXERCISES.map(e => [e.id, e]))
const canonicalExId = id => typeof id === 'string' && Object.hasOwn(EXALIAS, id) && EXIDX[EXALIAS[id]] ? EXALIAS[id] : id
const modeOf = cfg => readMode(cfg, EXIDX[cfg?.id])
const POLICIES = ['off', 'linear', 'greyskull', 'double', 'triple', 'time']
export const SNAPSHOT_MAX = 3
export const LOG_MAX = 50
const NAMESPACE_MAX = 256 * 1024
const MUSCLES = [
  'trapezius', 'deltoids', 'chest', 'upper-back', 'serratus',
  'biceps', 'triceps', 'forearm',
  'abs', 'obliques', 'lower-back',
  'gluteal', 'quadriceps', 'hamstring', 'adductors', 'hip-flexors',
  'calves', 'tibialis',
]

// A picked list in the map's own order rather than the order the chips were tapped in — two
// people building the same exercise get the same exercise. Unknown names keep their place at the end.
const inMuscleOrder = list => {
  const at = m => { const i = MUSCLES.indexOf(m); return i < 0 ? MUSCLES.length : i }
  return [...(list || [])].sort((a, b) => at(a) - at(b))
}


function runtime({ now, newId, label = key => key }) {
const uid = newId
const t = label
const todayISO = () => { const d = new Date(now); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const emptyCoach = () => ({
  consent: null, profile: null, cadence: 'off', lastReview: null, log: [], snapshots: [],
  // The conversation as the user saw it (views/CoachChat.jsx): their messages, and what the
  // Coach did with them. Short, synced, and trimmed with the log — the proposal itself lives
  // server-side (or in the phone's device file) until it is applied or dismissed.
  chat: [],
  // How long the last few jobs took, so the typing bubble can say "usually about 2 minutes".
  timings: []
})

const coachOf = s => (s.coach = s.coach || emptyCoach())

const findRoutine = (S, id) => (S.routines || []).find(r => r.id === id) || null
const findEx = (routine, id) => (routine?.ex || []).find(e => e.id === id) || null


function validateProposal(p) {
  if (!p || typeof p !== 'object') throw new Error(t('That proposal can’t be read.'))
  if (p.bundle) {
    if (!Array.isArray(p.bundle.routines) || !p.bundle.routines.length) throw new Error(t('That proposal can’t be read.'))
    // The server rejects a routine with no exercises; so must this, or an empty one is appended,
    // gets scheduled, and "start today's session" opens a workout with nothing in it.
    for (const r of p.bundle.routines) {
      if (!Array.isArray(r.ex) || !r.ex.length) throw new Error(t('That proposal can’t be read.'))
    }
    return true
  }
  if (!Array.isArray(p.changes)) throw new Error(t('That proposal can’t be read.'))
  for (const c of p.changes) {
    if (!CHANGE_APPLY[c.type]) throw new Error(t('That proposal can’t be read.'))
  }
  return true
}

/* ============================ snapshots & revert ============================ */

const clone = o => JSON.parse(JSON.stringify(o))

/**
 * Remember the `dayPlan` entries an apply step deleted, on the snapshot that will undo it.
 *
 * A patch, not a clone: `dayPlan` holds every date the user ever rescheduled, and three copies
 * of it in the snapshot ring would crowd real snapshots out of the 256 KB namespace budget that
 * `trim()` enforces. The first value recorded for a date wins — that is the pre-apply one.
 */
function recordDayPlanDrops(s, dropped) {
  if (!Object.keys(dropped).length) return
  const snaps = coachOf(s).snapshots || []
  const snap = snaps[snaps.length - 1]
  if (!snap) return
  snap.dayPlanRestore = { ...dropped, ...(snap.dayPlanRestore || {}) }
}

/**
 * Drop per-date reschedules from `iso` onwards.
 *
 * A created plan replaces the whole week, so overrides made against the old one are no longer
 * about anything: `'rest'` would hide a session the new plan schedules, and a routine id wins
 * over the new week on that day. Past dates stay — those are history, not intent.
 */
function sweepDayPlan(s, fromIso) {
  const dropped = {}
  Object.keys(s.dayPlan || {}).forEach(iso => {
    if (iso >= fromIso) { dropped[iso] = s.dayPlan[iso]; delete s.dayPlan[iso] }
  })
  recordDayPlanDrops(s, dropped)
}

/** Snapshot `{routines, week}` before touching either. The unit of revert (FR-30/31). */
function pushSnapshot(s, proposalId, label) {
  const c = coachOf(s)
  c.snapshots = [...(c.snapshots || []), {
    at: now, proposalId: proposalId || null, label: label || '',
    routines: clone(s.routines || []), week: clone(s.week || {})
  }].slice(-SNAPSHOT_MAX)
  trim(s)
}


function appendLog(s, entry) {
  const c = coachOf(s)
  const e = { id: entry.id || uid(), ...entry }
  c.log = [...(c.log || []), e].slice(-LOG_MAX)
  trim(s)
  return e.id
}

function lightBundle(b) {
  if (!b) return null
  return {
    name: b.name || '', summary: b.summary || '', week: { ...(b.week || {}) },
    routines: (b.routines || []).map(r => ({
      id: r.id, name: r.name, emoji: r.emoji || '', why: r.why || '',
      ex: (r.ex || []).map(e => ({
        id: e.id, sets: e.sets, mode: e.mode || 'reps',
        ...(e.reps != null ? { reps: e.reps } : {}), ...(e.sec != null ? { sec: e.sec } : {}),
        ...(e.min != null ? { min: e.min } : {}), ...(e.weight ? { weight: e.weight } : {}),
        ...(e.why ? { why: String(e.why).slice(0, 200) } : {})
      }))
    }))
  }
}
const decisionOf = (c, status) => ({ id: c.id, type: c.type, target: c.target || null, before: c.before ?? null, after: c.after ?? null, why: c.why, routineName: c.routineName || null, status })


/**
 * Last line of defence for the 5 MB sync body: if the Coach namespace ever outgrows its
 * budget, drop the oldest history rather than let a PUT start failing for reasons nobody
 * would connect to this feature.
 */
function trim(s) {
  const c = coachOf(s)
  let guard = 0
  while (JSON.stringify(c).length > NAMESPACE_MAX && guard++ < 60) {
    if ((c.chat || []).length > 8) c.chat.shift()
    else if ((c.snapshots || []).length > 1) c.snapshots.shift()
    else if ((c.log || []).length > 1) c.log.shift()
    else break
  }
}


function applyCreatedPlan(s, proposal, { schedule } = {}) {
  validateProposal(proposal)
  pushSnapshot(s, proposal.id, t('Before the Coach’s plan'))
  const bundle = proposal.bundle
  // The Coach's `why` texts are for the review screen; they have no place in the routine data.
  // A link is never the Coach's to write: validatePlan already drops one from the model's plan,
  // and this drops it again on the way into mergePlan, which would otherwise carry a `url` on a
  // plan's own exercises through to the profile (cleanCustom keeps links for shared plans).
  const stripped = {
    ...bundle,
    routines: bundle.routines.map(r => ({ ...r, why: undefined, ex: r.ex.map(e => ({ ...e, why: undefined, name: undefined })) })),
    customEx: (bundle.customEx || []).map(c => { const { url, media, ...rest } = c || {}; return rest })
  }
  const res = mergePlan(s, stripped, { schedule })
  // Only when the week actually moved — with the switch off the old schedule still stands, and
  // so do the reschedules made against it.
  if (schedule) sweepDayPlan(s, todayISO())
  res.logId = appendLog(s, {
    kind: 'create', at: now, proposalId: proposal.id,
    summary: proposal.summary || '', routines: res.routines, iteration: proposal.iteration || 1,
    bundle: lightBundle(bundle), scheduled: !!schedule
  })
  return res
}

/* ============================ applying a change-set ============================ */

// One implementation per allowed type. The object is the closed list on this side of the
// wire: a type with no entry here cannot be applied, whatever the server let through.
const CHANGE_APPLY = {
  'add-exercise': (s, c) => {
    const r = need(findRoutine(s, c.target.routineId))
    const a = c.after || {}
    // A drawing's id the Coach may have picked up names the exercise it draws.
    const e = { id: canonicalExId(a.id), sets: a.sets || 3, mode: a.mode || 'reps' }
    if (e.mode === 'cardio') { e.min = a.min || 20; e.speed = a.speed || 8 }
    else if (e.mode === 'time') e.sec = a.sec || 45
    else e.reps = a.reps || 10
    if (a.weight > 0) e.weight = a.weight
    if (POLICIES.includes(a.prog)) e.prog = a.prog
    if (Number.isInteger(a.repsMin)) e.repsMin = a.repsMin
    if (Number.isInteger(a.repsMax)) e.repsMax = a.repsMax
    if (Number.isInteger(a.setsMax)) e.setsMax = a.setsMax   // triple progression's set ceiling
    // Only when the Coach disagreed with the catalogue: an absent flag has always meant
    // "whatever the exercise says", and writing one out would freeze today's dataset into
    // the plan.
    if (a.bodyweight != null) e.bodyweight = !!a.bodyweight
    if (a.side) e.side = true
    const at = Number.isInteger(a.position) ? Math.min(a.position, r.ex.length) : r.ex.length
    r.ex.splice(at, 0, e)
    cleanupSg(r.ex)
  },
  'remove-exercise': (s, c) => {
    const r = need(findRoutine(s, c.target.routineId))
    r.ex = r.ex.filter(e => e.id !== c.target.exId)
    cleanupSg(r.ex)
  },
  'swap-exercise': (s, c) => {
    const r = need(findRoutine(s, c.target.routineId))
    const i = r.ex.findIndex(e => e.id === c.target.exId)
    if (i < 0) throw new Error('missing exercise')
    const old = r.ex[i], a = c.after || {}
    // Keep the old prescription unless the Coach deliberately changed it: a swap is about the
    // movement, and silently resetting sets and reps would be a second change nobody approved.
    //
    // The two v1.2.4 flags are the exception, and they have to be: they describe the *movement*,
    // not the prescription. Carrying `side: true` from a lunge onto a leg press would make the
    // app halve a rep count that was never per-side, so an explicit flag is dropped and the new
    // exercise goes back to whatever the catalogue says about it.
    const { bodyweight, side, ...keep } = old
    r.ex[i] = { ...keep, id: canonicalExId(a.id), ...(a.sets ? { sets: a.sets } : {}), ...(a.reps ? { reps: a.reps } : {}), ...(a.weight > 0 ? { weight: a.weight } : {}) }
  },
  sets: (s, c) => { need(findExIn(s, c)).sets = c.after },
  reps: (s, c) => { need(findExIn(s, c)).reps = c.after },
  repsMin: (s, c) => { need(findExIn(s, c)).repsMin = c.after },
  repsMax: (s, c) => { need(findExIn(s, c)).repsMax = c.after },
  sec: (s, c) => { need(findExIn(s, c)).sec = c.after },
  cardio: (s, c) => {
    const e = need(findExIn(s, c))
    if (c.after?.min != null) e.min = c.after.min
    if (c.after?.speed != null) e.speed = c.after.speed
  },
  inc: (s, c) => { need(findExIn(s, c)).inc = c.after },
  'exercise-prog': (s, c) => { need(findExIn(s, c)).prog = c.after },
  'routine-prog': (s, c) => { need(findRoutine(s, c.target.routineId)).prog = c.after },
  reorder: (s, c) => {
    const r = need(findRoutine(s, c.target.routineId))
    const by = new Map(r.ex.map(e => [e.id, e]))
    const next = c.after.map(id => by.get(id)).filter(Boolean)
    // Distinct exercises, not just the right count: an order naming one id twice maps to the
    // same object twice and still counts right, which drops an exercise and leaves the
    // survivor aliased into two slots that then edit each other.
    if (next.length !== r.ex.length || new Set(next).size !== r.ex.length) throw new Error('incomplete reorder')
    r.ex = next
    cleanupSg(r.ex)
  },
  superset: (s, c) => {
    const r = need(findRoutine(s, c.target.routineId))
    const i = r.ex.findIndex(e => e.id === c.target.exId)
    if (i < 0) throw new Error('missing exercise')
    if (!c.after?.link) { delete r.ex[i].sg; cleanupSg(r.ex); return }
    // Splicing the partner out from under the anchor when they are the same exercise leaves
    // nothing to tag; refuse rather than reorder the routine on the way to a TypeError.
    if (c.after.with === c.target.exId) throw new Error('superset with itself')
    const j = r.ex.findIndex(e => e.id === c.after.with)
    if (j < 0) throw new Error('missing partner')
    // Supersets are a property of adjacency in this app; move the partner next to it first.
    const [partner] = r.ex.splice(j, 1)
    const at = r.ex.findIndex(e => e.id === c.target.exId)
    r.ex.splice(at + 1, 0, partner)
    const tag = uid().slice(0, 6)
    r.ex[at].sg = tag
    r.ex[at + 1].sg = tag
  },
  'add-routine': (s, c) => {
    const a = c.after
    s.routines.push({
      id: uid(), name: a.name, emoji: a.emoji || '🏋️',
      ...(POLICIES.includes(a.prog) ? { prog: a.prog } : {}),
      ex: a.ex.map(e => ({
        id: canonicalExId(e.id), sets: e.sets || 3, mode: e.mode || 'reps',
        ...(e.mode === 'time' ? { sec: e.sec || 45 } : { reps: e.reps || 10 }),
        ...(Number.isInteger(e.repsMax) ? { repsMax: e.repsMax } : {}),
        ...(Number.isInteger(e.setsMax) ? { setsMax: e.setsMax } : {}),
        ...(e.bodyweight != null ? { bodyweight: !!e.bodyweight } : {}),
        ...(e.side ? { side: true } : {})
      }))
    })
  },
  'remove-routine': (s, c) => {
    // The same delete as Plan and RoutineEdit. It used to compare each weekday with ===, which
    // missed a combined day (a list) and left the deleted id on it. The week comes back from the
    // snapshot on a revert; the dropped reschedules are not in the snapshot, so they are recorded.
    recordDayPlanDrops(s, deleteRoutine(s, c.target.routineId))
  },
  'rename-routine': (s, c) => { need(findRoutine(s, c.target.routineId)).name = c.after },
  week: (s, c) => {
    // A single-routine op: the slot is a list, but the Coach only ever names one routine (or
    // rest), and it replaces the day. This collapses a combined day to one routine — the same
    // stated limitation as a DayOverride (see docs/dev/COMBINE_ROUTINES.md §8).
    const d = c.target.weekday
    if (c.after == null || c.after === 'rest') delete s.week[d]
    else s.week[d] = [c.after]
  }
}
const CHANGE_TYPES = Object.keys(CHANGE_APPLY)

function findExIn(s, c) { return findEx(findRoutine(s, c.target.routineId), c.target.exId) }
function need(x) { if (!x) throw new Error('missing target'); return x }

/**
 * Apply the accepted subset, atomically (FR-30).
 *
 * Atomic comes free from how the store works: `update()` hands us a throwaway clone and only
 * keeps it if we return normally. Throwing part-way through therefore discards every change
 * this function already made, which is precisely the transaction we want — no half-applied
 * change-set, ever.
 */
function applyChangeSet(s, proposal, acceptedIds) {
  validateProposal(proposal)
  const accepted = new Set(acceptedIds || [])
  const changes = (proposal.changes || []).filter(c => accepted.has(c.id) && c.status !== 'stale')
  if (!changes.length) return { applied: 0 }

  pushSnapshot(s, proposal.id, t('Before the Coach’s changes'))
  const applied = []
  for (const c of changes) {
    CHANGE_APPLY[c.type](s, c)
    applied.push(decisionOf(c, 'accepted'))
  }
  // Turned-down changes keep their before/after too: the chat shows the whole proposal back
  // later, and "you declined something about sets" is not a memory anyone can use.
  const rejected = (proposal.changes || [])
    .filter(c => !accepted.has(c.id))
    .map(c => decisionOf(c, c.status === 'stale' ? 'stale' : 'rejected'))

  const logId = appendLog(s, {
    kind: 'review', at: now, proposalId: proposal.id,
    summary: proposal.summary || '', evidence: proposal.evidence || null,
    notes: proposal.notes || [], decisions: [...applied, ...rejected]
  })
  coachOf(s).lastReview = { at: now }
  return { applied: applied.length, rejected: rejected.length, logId }
}

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0]   // every getDay() index; only the reader's own
                                          // screen puts them in an order (see weekOrder)
const PLAN_UNITS = new Set(['kg', 'lb'])

// A plan's numbers are in the unit that wrote it. Missing unit is deliberately legacy-compatible:
// old files were read as already being in the recipient's unit, so keep their values unchanged.
const planUnit = value => value === 'lbs' ? 'lb' : PLAN_UNITS.has(value) ? value : null
const unitError = () => { throw new Error(t('this isn’t a GymBuddy plan file')) }

function declaredPlanUnit(data) {
  let declared = null
  for (const key of ['unit', 'weightUnit']) {
    if (data[key] == null) continue
    const unit = planUnit(data[key])
    if (!unit || (declared && declared !== unit)) unitError()
    declared = unit
  }
  return declared
}

function convertedExercise(e, sourceUnit, destinationUnit) {
  if (!sourceUnit || sourceUnit === destinationUnit) return e
  const out = { ...e }
  if (out.weight != null) out.weight = convertWeight(out.weight, sourceUnit, destinationUnit)
  // A timed increment is seconds, not a load. Rep-mode increments are load overrides.
  if (modeOf(out) === 'reps' && out.inc > 0) out.inc = convertWeight(out.inc, sourceUnit, destinationUnit)
  if (Array.isArray(out.pyramidWeight)) out.pyramidWeight = out.pyramidWeight.map(w => (w > 0 ? convertWeight(w, sourceUnit, destinationUnit) : w))
  return out
}

function convertedBundle(bundle, destinationUnit) {
  const sourceUnit = declaredPlanUnit(bundle)
  if (!sourceUnit || sourceUnit === destinationUnit) return bundle
  return {
    ...bundle,
    unit: destinationUnit,
    routines: (bundle.routines || []).map(r => ({
      ...r,
      ex: (r.ex || []).map(e => convertedExercise(e, sourceUnit, destinationUnit))
    }))
  }
}

const CUSTOM_MUSCLES = new Set([...MUSCLES, 'cardiovascular system'])
const muscleList = v => inMuscleOrder([...new Set((Array.isArray(v) ? v : []).filter(m => CUSTOM_MUSCLES.has(m)))])

/** A custom exercise with its own metadata — equipment, muscles, description — in the shape
 *  CustomExForm writes, minus the recipient-side `custom`/`sm` fields mergePlan adds. The bundle
 *  used to carry only {id, n, bp}, so the exercise arrived with an empty equipment tag, no muscle
 *  credit, and (stored without `custom: true`) no way to edit or delete it (QA C7). The same gate
 *  runs on the way in as on the way out, since a plan file is someone else's data: only muscles the
 *  map can draw, a secondary never repeating a primary, the way the form itself enforces. Fields
 *  that are empty stay absent, so a file written before this change reads the same as one after. */
function cleanCustom(c) {
  const o = { id: c.id, n: c.n, bp: c.bp }
  if (c.desc) o.desc = c.desc
  // The link to a video or guide travels with a shared plan (#246), cleaned both ways like any
  // other field of someone else's file; the exercise's own photo or video never does — it is a
  // file on the sender's device and server, and a plan file is plain JSON.
  const url = cleanUrl(c.url)
  if (url) o.url = url
  if (typeof c.eq === 'string' && c.eq) o.eq = c.eq
  const prim = muscleList(c.primaries)
  const sm = muscleList(c.secondaries).filter(m => !prim.includes(m))
  // `tg` is the legacy single primary; the form keeps it equal to the first primary.
  const tg = prim[0] || (CUSTOM_MUSCLES.has(c.tg) ? c.tg : '')
  if (tg) o.tg = tg
  if (prim.length) o.primaries = prim
  if (sm.length) o.secondaries = sm
  if (prim.length || sm.length) o.muscleGroups = [...prim, ...sm]
  return o
}

function mergePlan(s, bundle, { schedule } = {}) {
  const destination = planUnit(s.unit == null ? 'kg' : s.unit)
  if (!destination) unitError()
  const source = convertedBundle(bundle, destination)
  s.customEx = s.customEx || []
  const exIdMap = {}
  ;(source.customEx || []).forEach(c => {
    const same = s.customEx.find(x => (x.n || '').toLowerCase() === (c.n || '').toLowerCase() && x.bp === c.bp)
    if (same) { exIdMap[c.id] = same.id; return }
    const nid = uid()
    exIdMap[c.id] = nid
    // Stored exactly as the form would have created it — `custom: true` is what lets the recipient
    // edit or delete it, and `sm` mirrors the secondaries the way the form writes them.
    const clean = cleanCustom(c)
    s.customEx.push({ ...clean, id: nid, ...(clean.secondaries ? { sm: clean.secondaries } : {}), custom: true })
  })
  const ridMap = {}
  source.routines.forEach(r => {
    const nid = uid()
    ridMap[r.id] = nid
    s.routines.push({
      id: nid,
      name: r.name || t('Shared routine'),
      emoji: r.emoji,
      ...(r.prog ? { prog: r.prog } : {}),
      ...(r.excludeFromProgression === true ? { excludeFromProgression: true } : {}),
      ex: (r.ex || []).map(e => ({ ...e, id: exIdMap[e.id] || canonicalExId(e.id) }))
    })
  })
  if (schedule) {
    WEEK_DAYS.forEach(d => { delete s.week[d] })
    Object.entries(source.week || {}).forEach(([d, val]) => {
      // `[].concat` tolerates a pre-upgrade scalar bundle value. An element whose routine id
      // didn't survive parsing is dropped, not written as undefined; a day that ends up empty
      // is left absent rather than stored as `[]`.
      const ids = [].concat(val).map(oldId => ridMap[oldId]).filter(Boolean)
      if (ids.length) s.week[d] = ids
    })
  }
  return { routines: source.routines.length }
}

function deleteRoutine(s, id) {
  s.routines = s.routines.filter(r => r.id !== id)
  Object.keys(s.week || {}).forEach(d => {
    const ids = [].concat(s.week[d])
    if (!ids.includes(id)) return
    const next = ids.filter(rid => rid !== id)
    if (next.length) s.week[d] = next; else delete s.week[d]
  })
  const dropped = {}
  Object.keys(s.dayPlan || {}).forEach(iso => {
    if (s.dayPlan[iso] === id) { dropped[iso] = id; delete s.dayPlan[iso] }
  })
  return dropped
}

function cleanupSg(ex) {
  ex.forEach((e, i) => {
    if (e.sg && !(ex[i - 1]?.sg === e.sg || ex[i + 1]?.sg === e.sg)) delete e.sg
  })
  // A superset's name and rest (#292) follow its members in and out of the group.
  syncSupersetMeta(ex)
}

// A superset's own name and its rest between rounds (#292). Carried on every member of the group
// (`sgName`, `sgRest` on a routine exercise, so on an entry's `target` once a session starts):
// a reorder, a member taken out or the routine copied into a session keeps them without a second
// structure to keep in step. The first member that has a value speaks for the group.
const SG_NAME_MAX = 40

const fieldsOf = (item, onTarget) => (onTarget ? item?.target : item) || {}

/** { name, rest } of the group of `unit` (indices into `list`); `onTarget` for session entries. */
function supersetMeta(list, unit, { onTarget = false } = {}) {
  let name = '', rest = 0
  for (const idx of unit || []) {
    const f = fieldsOf(list?.[idx], onTarget)
    if (!name && typeof f.sgName === 'string' && f.sgName.trim()) name = f.sgName.trim().slice(0, SG_NAME_MAX)
    if (!rest && Number(f.sgRest) > 0) rest = Math.round(Number(f.sgRest))
  }
  return { name, rest }
}

/** Writes name and rest onto every member of group `sg` in a routine's `ex`; empty clears. */
function setSupersetMeta(ex, sg, { name = '', rest = 0 } = {}) {
  const clean = String(name || '').trim().slice(0, SG_NAME_MAX)
  const sec = Number(rest) > 0 ? Math.round(Number(rest)) : 0
  for (const e of ex || []) {
    if (!e || !sg || e.sg !== sg) continue
    if (clean) e.sgName = clean; else delete e.sgName
    if (sec) e.sgRest = sec; else delete e.sgRest
  }
  return ex
}

/** A member that joined or left a group: it takes the group's meta, or drops what it carried. */
function syncSupersetMeta(ex) {
  const groups = new Map()
  for (const e of ex || []) {
    if (!e?.sg) { if (e) { delete e.sgName; delete e.sgRest }; continue }
    const g = groups.get(e.sg) || { name: '', rest: 0 }
    if (!g.name && e.sgName) g.name = e.sgName
    if (!g.rest && Number(e.sgRest) > 0) g.rest = Number(e.sgRest)
    groups.set(e.sg, g)
  }
  for (const [sg, g] of groups) setSupersetMeta(ex, sg, g)
  return ex
}
const MAX_URL = 2048
function cleanUrl(raw) {
  if (typeof raw !== 'string') return null
  let s = raw.trim()
  if (!s || s.length > MAX_URL) return null
  if (!/^https?:\/\//i.test(s)) {
    if (/^[a-z0-9+.-]+:/i.test(s)) return null
    s = 'https://' + s
  }
  // Chrome's URL parser takes "https://not a url" and percent-encodes the spaces into the host,
  // so "not a url" typed into the link field was saved as a link (QA 1.3.9). The host has to
  // be one a browser could reach: no whitespace in what was typed, and a dotted name,
  // localhost or an IP address.
  const authority = /^https?:\/\/([^/?#]*)/i.exec(s)?.[1] || ''
  if (/\s/.test(authority)) return null
  let u
  try { u = new URL(s) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (!u.hostname || u.username || u.password) return null
  if (!plausibleHost(u.hostname)) return null
  return u.href.length <= MAX_URL ? u.href : null
}
const LB_PER_KG = 2.2046226218

function convertWeight(value, from, to) {
  if (from === to || value == null || value === '' || !Number.isFinite(Number(value))) return value
  const v = Number(value)
  if (to === 'lb') return Math.round(v * LB_PER_KG * 2) / 2
  return Math.round(v / LB_PER_KG * 4) / 4
}


return { applyCreatedPlan, applyChangeSet }
}
export function applyCreatedPlanServer(s, proposal, options) { return runtime(options).applyCreatedPlan(s, proposal, options) }
export function applyChangeSetServer(s, proposal, acceptedIds, options) { return runtime(options).applyChangeSet(s, proposal, acceptedIds) }

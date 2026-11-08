import { it, expect, vi } from 'vitest'
vi.mock('./format.js', async importOriginal => ({ ...await importOriginal(), uid: () => 'fresh-id' }))
import { applyCreatedPlan, applyChangeSet } from './coach.js'
import { applyCreatedPlanServer, applyChangeSetServer } from '../../../api/coach/core/apply.js'
const now = 1800000000000
const options = { now, newId: () => 'fresh-id', label: x => x }
const state = () => ({ routines: [{ id: 'r', name: 'Push', ex: [{ id: '0001', sets: 3, bodyweight: true, side: true }, { id: '0025', sets: 2 }] }], week: { 1: ['r'] }, customEx: [], dayPlan: { '2099-01-01': 'r' } })
const cases = { 'add-exercise': { id: '0043', side: true }, 'remove-exercise': null, 'swap-exercise': { id: '0043' }, sets: 5, reps: 8, repsMin: 6, repsMax: 12, sec: 30, cardio: { min: 10, speed: 6 }, inc: 2, 'exercise-prog': 'triple', 'routine-prog': 'double', reorder: ['0025', '0001'], superset: { link: true, with: '0025' }, 'add-routine': { name: 'Pull', ex: [{ id: '0043' }] }, 'remove-routine': null, 'rename-routine': 'Renamed', week: 'rest' }
for (const [type, after] of Object.entries(cases)) it(`parity ${type}`, () => {
 vi.spyOn(Date, 'now').mockReturnValue(now)
 const a = state(), b = structuredClone(a)
 const p = { id: 'p', changes: [{ id: 'c', type, target: { routineId: 'r', exId: '0001', weekday: 1 }, after }, { id: 'skip', type: 'sets', target: { routineId: 'r', exId: '0025' }, after: 9 }, { id: 'stale', status: 'stale', type: 'sets' }] }
 expect(applyChangeSetServer(b, p, ['c', 'stale'], options)).toEqual(applyChangeSet(a, p, ['c', 'stale']))
 expect(b).toEqual(a); vi.restoreAllMocks()
})
for (const schedule of [false, true]) it(`create ${schedule}`, () => {
 vi.useFakeTimers(); vi.setSystemTime(now)
 const a = state(), b = structuredClone(a)
 const p = { id: 'p', bundle: { routines: [{ id: 'new', name: 'New', ex: [{ id: '0001', sets: 3 }] }], week: { 2: ['new'] } } }
 expect(applyCreatedPlanServer(b, p, { ...options, schedule })).toEqual(applyCreatedPlan(a, p, { schedule })); expect(b).toEqual(a); vi.useRealTimers()
})
for (const [type, target, after] of [['sets', { routineId: 'missing' }, 3], ['reorder', { routineId: 'r' }, ['0001']], ['superset', { routineId: 'r', exId: '0001' }, { link: true, with: '0001' }]]) it(`invalid ${type}`, () => {
 const original = state(), p = { changes: [{ id: 'c', type, target, after }] }
 expect(() => applyChangeSet(structuredClone(original), p, ['c'])).toThrow()
 expect(() => applyChangeSetServer(structuredClone(original), p, ['c'], options)).toThrow()
 expect(original).toEqual(state())
})
it('merges custom metadata, reuses matching customs and converts units', () => {
 vi.useFakeTimers(); vi.setSystemTime(now)
 const a = state(); a.unit = 'lb'; a.customEx = [{ id: 'existing', n: 'My lift', bp: 'back' }]
 const b = structuredClone(a)
 const p = { bundle: { unit: 'kg', customEx: [{ id: 'c1', n: 'My lift', bp: 'back' }, { id: 'c2', n: 'New lift', bp: 'chest', primaries: ['chest'], secondaries: ['triceps'], url: 'https://example.com' }], routines: [{ id: 'r2', ex: [{ id: 'c1', weight: 20, inc: 2.5 }, { id: 'c2', weight: 10 }] }], week: { 3: 'r2' } } }
 expect(applyCreatedPlanServer(b, p, { ...options, schedule: true })).toEqual(applyCreatedPlan(a, p, { schedule: true })); expect(b).toEqual(a); vi.useRealTimers()
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyChangeSetServer, applyCreatedPlanServer } from '../coach/core/apply.js'
const opts = { now: 1800000000000, newId: () => 'new' }
test('empty acceptance leaves state untouched', () => { const s = {}; assert.deepEqual(applyChangeSetServer(s, { changes: [] }, [], opts), { applied: 0 }); assert.deepEqual(s, {}) })
test('invalid proposal rejected', () => { assert.throws(() => applyCreatedPlanServer({}, null, opts)) })
test('changes update prescription and review', () => { const s = { routines: [{ id: 'r', ex: [{ id: 'e' }] }] }; assert.equal(applyChangeSetServer(s, { changes: [{ id: 'c', type: 'sets', target: { routineId: 'r', exId: 'e' }, after: 5 }] }, ['c'], opts).applied, 1); assert.equal(s.routines[0].ex[0].sets, 5); assert.equal(s.coach.lastReview.at, opts.now) })

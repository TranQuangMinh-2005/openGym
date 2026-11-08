import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData } from './helpers.mjs';
import { join } from 'node:path';
const data = tempData();
process.env.AGENT_DB_PATH = join(data, 'agent.db');
const { estimateMinutes, planFacts, check_plan, propose_plan, isDraftStale, find_alternatives } = await import('../coach/agent/tools/program.js');
const { getDraft, closeAgentDb } = await import('../coach/agent/db.js');
const { details } = await import('../coach/agent/kb.js');
const exercise = details.find(e => e.eq === 'dumbbell' && e.tg === 'biceps');
const S = { routines: [1, 2, 3].map(id => ({ id: `r${id}`, name: `Routine ${id}`, ex: [{ id: exercise.id, sets: 3, reps: 10, weight: 5 }] })), week: { 1: ['r1'], 3: ['r2'], 6: ['r3'] }, coach: { ledger: [{ type: 'avoid_equipment', value: { equipment: ['barbell'] }, strength: 'hard', status: 'active' }, { type: 'avoid_region', value: { regions: ['shoulder'] }, strength: 'hard', status: 'pending' }, { type: 'max_session_minutes', value: { minutes: 45, weekdays: [6] }, strength: 'hard', status: 'active' }] } };
const ctx = { uid: 'u', readState: async () => S };
test('estimator', () => {
  assert.equal(estimateMinutes({ ex: [{ sets: 3, reps: 6 }] }), 15);
  assert.equal(estimateMinutes({ ex: [{ sets: 3, reps: 10 }] }), 12);
  assert.equal(estimateMinutes({ ex: [{ sets: 3, reps: 15 }] }), 10);
  assert.equal(estimateMinutes({ ex: [{ mode: 'cardio', min: 20 }] }), 25);
});
test('unknown exercise fails validation', async () => {
  const result = await check_plan.run({ plan: { routines: [{ id: 'new', name: 'New', ex: [{ id: 'unknown', sets: 3, reps: 10 }] }], week: { 1: ['new'] } } }, ctx);
  assert.equal(result.ok, false);
});
test('alternatives respect equipment and pain restrictions', async () => {
  const result = await find_alternatives.run({ exerciseId: exercise.id, equipment: ['dumbbell'], limit: 10 }, ctx);
  assert.ok(result.length);
  assert.ok(result.every(e => e.eq === 'dumbbell' && e.tg === exercise.tg && e.id !== exercise.id));
});
test('draft ablation stores without mutating state and detects stale plans', async () => {
  const before = structuredClone(S);
  const result = await propose_plan.run({ mode: 'create', plan: { routines: [], week: {} }, summary: 'Test', rationale: [] }, { ...ctx, flags: { noCheck: true } });
  assert.equal(result.ok, true);
  assert.deepEqual(S, before);
  const draft = getDraft(result.draftId);
  assert.equal(isDraftStale(S, draft), false);
  const changed = structuredClone(S);
  changed.routines[0].ex[0].sets++;
  assert.equal(isDraftStale(changed, draft), true);
  closeAgentDb();
});

test('time-mode estimator includes set duration and rest', () => {
  assert.equal(estimateMinutes({ ex: [{ mode: 'time', sets: 3, sec: 60 }] }), 11);
});

const planFor = (ex, day = 1) => ({ routines: [{ id: 'new', name: 'Upper body', ex }], week: { [day]: 'new' } });
const prescription = e => ({ id: e.id, sets: 3, reps: 10 });
test('hard equipment exclusions reject barbell exercises', async () => {
  const barbell = details.find(e => e.eq === 'barbell');
  const result = await check_plan.run({ plan: planFor([prescription(barbell)]) }, ctx);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('avoid_equipment')), JSON.stringify(result));
});

test('pending shoulder pain rejects a new delts exercise', async () => {
  const shoulder = details.find(e => e.tg === 'delts');
  assert.ok(shoulder);
  const result = await check_plan.run({ plan: planFor([prescription(shoulder)]) }, { ...ctx, pendingConstraints: S.coach.ledger.filter(e => e.status === 'pending') });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('avoid_region')), JSON.stringify(result));
});

test('Saturday duration limit allows the same long routine on Monday', async () => {
  const ex = Array.from({ length: 5 }, (_, i) => ({ ...prescription(details.filter(e => e.eq === 'dumbbell' && e.tg === 'biceps')[i]), sets: 5 }));
  const saturday = await check_plan.run({ plan: planFor(ex, 6) }, ctx);
  assert.equal(saturday.ok, false);
  assert.ok(saturday.errors.some(e => e.includes('exceeds 45')), JSON.stringify(saturday));
  assert.equal((await check_plan.run({ plan: planFor(ex, 1) }, ctx)).ok, true);
});

test('days per week constraint rejects a one-day schedule', async () => {
  const state = structuredClone(S);
  state.coach.ledger.push({ type: 'days_per_week', value: { days: 3 }, status: 'active', strength: 'hard' });
  const result = await check_plan.run({ plan: planFor([prescription(exercise)]) }, { ...ctx, readState: async () => state });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => /3 days|daysPerWeek|3 were asked/i.test(e)), JSON.stringify(result));
});

test('pending pain rejects shoulder progression and reports existing violations', async () => {
  const shoulder = details.find(e => e.tg === 'delts' && e.eq === 'dumbbell');
  const state = structuredClone(S);
  state.routines[0].ex = [prescription(shoulder)];
  const result = await check_plan.run({ changes: [{ type: 'sets', target: { routineId: 'r1', exId: shoulder.id }, before: 3, after: 4, why: 'Increase weekly volume' }] }, { ...ctx, readState: async () => state, pendingConstraints: state.coach.ledger.filter(e => e.status === 'pending') });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('pain_region_progression')), JSON.stringify(result));
  assert.ok(result.existingViolations.some(e => e.includes(shoulder.id)));
});

test('create and edit drafts apply on clones without changing state', async () => {
  const { applyCreatedPlanServer, applyChangeSetServer } = await import('../coach/core/apply.js');
  const before = structuredClone(S);
  let seq = 0;
  const options = { now: Date.now(), newId: () => `generated-${++seq}`, schedule: true };
  const created = await propose_plan.run({ mode: 'create', plan: planFor([prescription(exercise)]), summary: 'New upper day', rationale: ['Consistent volume'] }, ctx);
  assert.equal(created.ok, true, JSON.stringify(created));
  const createDraft = getDraft(created.draftId);
  const copy = structuredClone(S);
  assert.equal(applyCreatedPlanServer(copy, { id: created.draftId, ...createDraft.payload }, options).routines, 1);
  const edited = await propose_plan.run({ mode: 'edit', changes: [{ type: 'sets', target: { routineId: 'r1', exId: exercise.id }, before: 3, after: 4, why: 'Increase biceps volume' }], summary: 'More volume', rationale: [] }, ctx);
  assert.equal(edited.ok, true, JSON.stringify(edited));
  const draft = getDraft(edited.draftId);
  const editCopy = structuredClone(S);
  assert.equal(applyChangeSetServer(editCopy, { id: edited.draftId, ...draft.payload }, draft.payload.changes.map(c => c.id), options).applied, 1);
  assert.equal(editCopy.routines[0].ex[0].sets, 4);
  assert.deepEqual(S, before);
  closeAgentDb();
});

test('planFacts counts sessions and sets per primary muscle from the schedule', () => {
  const pick = tg => details.find(e => e.tg === tg).id;
  const [pecs, lats, quads] = ['pectorals', 'lats', 'quads'].map(pick);
  const ppl = { routines: [
    { id: 'push', name: 'Push', ex: [{ id: pecs, sets: 4, reps: 8 }] },
    { id: 'pull', name: 'Pull', ex: [{ id: lats, sets: 4, reps: 8 }] },
    { id: 'legs', name: 'Legs', ex: [{ id: quads, sets: 3, reps: 10 }] }],
  week: { 1: 'push', 3: ['pull'], 5: 'legs' } };
  const facts = planFacts(ppl);
  assert.equal(facts.trainingDaysPerWeek, 3);
  assert.deepEqual(facts.byPrimaryMuscle.pectorals, { sessionsPerWeek: 1, setsPerWeek: 4 });
  assert.deepEqual(facts.byPrimaryMuscle.quads, { sessionsPerWeek: 1, setsPerWeek: 3 });
  // The same routine on three days, with a muscle twice in it: three sessions, not six.
  const fullBody = { routines: [{ id: 'fb', name: 'Full', ex: [{ id: pecs, sets: 3, reps: 8 }, { id: pecs + 'x', sets: 0 }, { id: pick('pectorals') , sets: 2, reps: 12 }] }],
    week: { 1: 'fb', 3: 'fb', 5: 'fb', 6: 'missing' } };
  const fb = planFacts(fullBody);
  assert.equal(fb.trainingDaysPerWeek, 3);
  assert.deepEqual(fb.byPrimaryMuscle.pectorals, { sessionsPerWeek: 3, setsPerWeek: 15 });
  assert.equal(fb.minutesByRoutine.Full, estimateMinutes(fullBody.routines[0]));
});

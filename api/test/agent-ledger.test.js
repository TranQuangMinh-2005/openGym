import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData } from './helpers.mjs';
import { join } from 'node:path';
const data = tempData();
process.env.AGENT_DB_PATH = join(data, 'agent.db');
const { stageChanges, commitLedger, detectConflicts, pendingFromDrafts } = await import('../coach/agent/ledger.js');

test('scoped staging is immutable and approval supersedes only that scope', () => {
  const global = { id: 'global', type: 'max_session_minutes', value: { minutes: 60 }, strength: 'hard', status: 'active' };
  const saturday = { ...global, id: 'sat', value: { minutes: 40, weekdays: [6] } };
  const S = { coach: { profile: { goal: 'recomp' }, ledger: [global, saturday] } };
  const before = structuredClone(S);
  const { entries } = stageChanges(S, [{ type: 'max_session_minutes', value: { minutes: 30, weekdays: [6] }, strength: 'hard' }]);
  assert.deepEqual(S, before);
  assert.equal(entries[0].supersedes, 'sat');
  commitLedger(S, entries, 'approve');
  assert.equal(global.status, 'active');
  assert.equal(saturday.status, 'superseded');
  assert.equal(S.coach.ledger.at(-1).status, 'active');
  assert.deepEqual(S.coach.profile, before.coach.profile);
});
test('reject pending entries and report direct equipment contradictions', () => {
  const S = { coach: { ledger: [] } };
  const { entries } = stageChanges(S, [
    { type: 'available_equipment', value: { equipment: ['barbell'] }, strength: 'hard' },
    { type: 'avoid_equipment', value: { equipment: ['barbell'] }, strength: 'hard' }
  ]);
  assert.equal(detectConflicts(entries).length, 1);
  const before = structuredClone(S);
  commitLedger(S, entries, 'reject');
  assert.deepEqual(S, before);
});

test('additive exercise exclusions coexist and removing one withdraws only its match', () => {
  const S = {};
  for (const id of ['bench', 'squat']) {
    const staged = stageChanges(S, [{ type: 'avoid_exercise', value: { ids: [id] }, strength: 'hard' }]);
    assert.deepEqual(staged.conflicts, []);
    commitLedger(S, staged.entries, 'approve');
  }
  assert.deepEqual(S.coach.ledger.map(e => e.status), ['active', 'active']);
  const { entries } = stageChanges(S, [{ type: 'avoid_exercise', op: 'remove', value: { ids: ['bench'] }, strength: 'hard' }]);
  commitLedger(S, entries, 'approve');
  assert.equal(S.coach.ledger[0].status, 'withdrawn');
  assert.equal(S.coach.ledger[1].status, 'active');
});

test('single-valued constraints conflict only in the same scope', () => {
  const entry = (id, minutes, weekdays) => ({ id, type: 'max_session_minutes', status: 'pending', value: { minutes, ...(weekdays ? { weekdays } : {}) } });
  assert.equal(detectConflicts([entry('a', 45, [6]), entry('b', 60, [6])]).length, 1);
  assert.deepEqual(detectConflicts([entry('a', 45, [6]), entry('b', 60)]), []);
});

test('pendingFromDrafts flattens only pending constraint drafts and returns a copy', () => {
  const entries = [{ id: 'pain', value: { regions: ['shoulder'] } }];
  const drafts = [{ kind: 'constraints', status: 'pending', payload: { entries } }, { kind: 'constraints', status: 'approved', payload: { entries } }, { kind: 'plan_edit', status: 'pending', payload: { entries } }];
  const result = pendingFromDrafts(drafts);
  assert.deepEqual(result, entries);
  result[0].value.regions.push('knee');
  assert.deepEqual(entries[0].value.regions, ['shoulder']);
});

test('staging preserves safety provenance and injected time without mutating state', () => {
  const S = { coach: { ledger: [] } }, before = structuredClone(S);
  const { entries } = stageChanges(S, [{ type: 'avoid_region', value: { regions: ['shoulder'] }, strength: 'hard', kind: 'safety' }], { now: 0 });
  assert.deepEqual(S, before);
  assert.equal(entries[0].source.kind, 'safety');
  for (const at of [entries[0].source.at, entries[0].createdAt, entries[0].updatedAt]) assert.equal(at, '1970-01-01T00:00:00.000Z');
  assert.deepEqual(commitLedger(S, entries, 'reject'), []);
  assert.deepEqual(S, before);
  commitLedger(S, entries, 'approve');
  assert.equal(S.coach.ledger[0].status, 'active');
  assert.equal(entries[0].status, 'pending');
});

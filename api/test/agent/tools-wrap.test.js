import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tempData } from '../helpers.mjs';

const dir = tempData();
process.env.AGENT_DB_PATH = path.join(dir, 'agent.db');
const { buildTools } = await import('../../agent/tools/index.js');

const S = {
  _rev: 1, routines: [], week: {}, workouts: [], customEx: [],
  coach: { profile: { goal: 'hypertrophy', equipment: ['dumbbell'] }, ledger: [] }
};
const ctx = () => ({
  uid: 'u1', threadId: 't', readState: async () => S, retrieved: [], pendingConstraints: [],
  now: Date.now(), flags: {}, onToolCall: () => {}
});
const call = async (tools, name, args) => JSON.parse(await tools.find(t => t.name === name).invoke(args));

// Live run 2026-11-06: every array-returning tool answered {error} through the wrapper, and the
// program agent looped until the recursion limit. The graph tests stub these tools, so only a test
// over the real ones catches it.
test('real tools that return arrays come through the LangChain wrapper intact', async () => {
  const tools = buildTools('program_agent', ctx());
  assert.ok(Array.isArray(await call(tools, 'get_constraints', {})));
  const found = await call(tools, 'search_exercises', { query: 'bench press', equipment: ['dumbbell'], limit: 3 });
  assert.ok(Array.isArray(found) && found.length > 0, JSON.stringify(found));
  const alts = await call(tools, 'find_alternatives', { exerciseId: found[0].id });
  assert.ok(!alts.error, JSON.stringify(alts));
});

test('only update_constraints feeds staged entries into the turn context', async () => {
  const c = ctx();
  const tools = buildTools('profile_progress_agent', c);
  await call(tools, 'get_constraints', {});
  assert.equal(c.pendingConstraints.length, 0);
  const staged = await call(tools, 'update_constraints', {
    changes: [{ type: 'avoid_equipment', value: { equipment: ['barbell'] }, strength: 'hard' }]
  });
  assert.ok(staged.draftId);
  assert.equal(c.pendingConstraints.length, 1);
});

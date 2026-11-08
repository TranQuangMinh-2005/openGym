import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData } from './helpers.mjs';
import { join } from 'node:path';
const data = tempData();
process.env.AGENT_DB_PATH = join(data, 'agent.db');
const { buildProgramContext } = await import('../coach/agent/context.js');

test('missing intake stays absent and schema remains valid', async () => {
  const result = await buildProgramContext({ S: {} });
  assert.equal(result.ok, true);
  assert.equal(result.missing.length, 5);
  assert.equal(result.context.daysPerWeek, undefined);
});

test('active ledger overrides intake while pending pain is visible', async () => {
  const S = { coach: { profile: { goal: 'strength', sessionMin: 60 }, ledger: [
    { type: 'goal', value: { goal: 'hypertrophy' }, status: 'active' },
    { type: 'avoid_region', value: { regions: ['shoulder'] }, status: 'pending' }
  ] } };
  const result = await buildProgramContext({ S, pendingConstraints: S.coach.ledger.filter(e => e.status === 'pending') });
  assert.equal(result.context.goal, 'hypertrophy');
  assert.deepEqual(result.context.painRegions, ['shoulder']);
  assert.equal(result.context.sessionMinutes.default, 60);
});

test('equipment uses coach profile before active equipment fallback', async () => {
  const S = { coach: { profile: { equipment: ['dumbbell'] } }, equipProfiles: [{ id: 'gym', equipment: ['barbell'] }], activeEquipId: 'gym', equipFilterOn: true };
  assert.deepEqual((await buildProgramContext({ S })).context.equipment, ['dumbbell']);
  S.coach.profile.equipment = [];
  assert.deepEqual((await buildProgramContext({ S })).context.equipment, ['barbell']);
});

test('missing intake identifies exactly absent fields with bilingual questions', async () => {
  const { missing } = await buildProgramContext({ S: { coach: { profile: { goal: 'recomp', equipment: ['dumbbell'] } } } });
  assert.deepEqual(missing.map(x => x.field), ['experience', 'daysPerWeek', 'sessionMinutes']);
  for (const item of missing) {
    assert.equal(item.reason, 'Not provided');
    assert.match(item.question_vi, /[ạảấểượờỗ]/);
    assert.match(item.question_en, /\?$/);
  }
});

test('library includes custom exercises with bounded catalogue candidates', async () => {
  const { context } = await buildProgramContext({ S: { customEx: [{ id: 'mine', n: 'My lift', bp: 'back' }] }, cfg: { programLibraryMax: 2 } });
  assert.equal(context.library.length, 3);
  assert.deepEqual(context.library[0], { id: 'mine', n: 'My lift', bp: 'back', tg: null, eq: 'custom' });
});

test('unmapped chat equipment keeps catalogue candidates', async () => {
  const { programInputs } = await import('../coach/agent/agents.js');
  const { S } = programInputs({}, [], { equipment: ['full gym'] });
  const { context } = await buildProgramContext({ S, cfg: { programLibraryMax: 7 } });
  assert.ok(context.library.length > 0);
  assert.ok(context.library.length <= 7);
});

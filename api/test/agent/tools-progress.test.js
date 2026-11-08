import test from 'node:test';
import assert from 'node:assert/strict';
import { get_progress_metrics, get_workout_history } from '../../agent/tools/progress.js';

export const fixture = () => ({ workouts: [21, 14, 7].map(days => ({ d: new Date(Date.now() - days * 86400000).toISOString().slice(0, 10), name: 'Upper', entries: [
  { id: 'bench', target: { sets: 1, reps: 10 }, sets: [{ w: 200, r: 10, done: true, phase: 'warmup' }, { w: 60, r: 8, rir: 2, done: true }] },
  { id: 'missing', sets: [{ r: 8, done: true }] },
  { id: 'bodyweight', sets: [{ w: 0, r: 12, done: true }] }
] })) });

test('working sets exclude warmups and preserve missing metrics', async () => {
  const S = fixture();
  const before = JSON.stringify(S);
  const ctx = { readState: async () => S };
  const result = await get_progress_metrics.run({}, ctx);
  assert.equal(result.exercises[0].sessionCount, 3);
  assert.equal(result.exercises[0].stallWeeks, 3);
  assert.equal(result.exercises[0].bestSet.weight, 60);
  assert.equal(result.exercises[1].bestSet, undefined);
  assert.equal(result.exercises[2].bestSet, undefined);
  assert.equal(result.exercises[1].averageRIR, undefined);
  const history = await get_workout_history.run({ limit: 1 }, ctx);
  assert.equal(history.length, 1);
  assert.equal(history[0].exercises[0].sets.length, 2);
  assert.equal(JSON.stringify(S), before);
});

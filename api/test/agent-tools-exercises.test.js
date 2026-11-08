import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { openAgentDb, closeAgentDb } from '../coach/agent/db.js';
import { search_exercises, get_exercise } from '../coach/agent/tools/exercises.js';
test('exercise filters, details, suggestions and generated freshness', () => {
  const ctx = { db: openAgentDb(':memory:') };
  const rows = search_exercises.run({ equipment: ['dumbbell'], bodyPart: 'upper legs' }, ctx);
  assert.ok(rows.length);
  assert.ok(rows.every((e) => e.eq === 'dumbbell' && e.bp === 'upper legs'));
  assert.ok(
    search_exercises
      .run({ excludeIds: [rows[0].id], equipment: ['dumbbell'], bodyPart: 'upper legs' }, ctx)
      .every((e) => e.id !== rows[0].id)
  );
  assert.ok(search_exercises.run({ equipment: ['imaginary'] }, ctx).validValues.equipment.includes('dumbbell'));
  closeAgentDb();
});
test('exercise details and suggestions', () => {
  const ctx = { db: openAgentDb(':memory:') };
  const rows = search_exercises.run({ equipment: ['dumbbell'], bodyPart: 'upper legs' }, ctx);
  const e = get_exercise.run({ id: rows[0].id }, ctx);
  assert.ok(Array.isArray(e.secondaryMuscles));
  assert.ok(e.instructions.length);
  assert.ok(get_exercise.run({ id: 'dumbbell squat' }, ctx).suggestions.length);
  closeAgentDb();
});
test('generated details freshness', () => {
  execFileSync(process.execPath, ['../scripts/build-agent-exercise-details.mjs', '--check']);
  closeAgentDb();
});

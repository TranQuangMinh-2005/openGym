#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EXERCISES } from '../api/coach/core/library-data.js';
const root = new URL('../', import.meta.url);
const rows = EXERCISES.map(({ id }) => {
  const e = JSON.parse(readFileSync(new URL(`catalogue/exercises/${id}.json`, root), 'utf8'));
  return { id, n:e.name, bp:e.bodyPart, tg:e.target, eq:e.equipment, sm:e.secondaryMuscles, cat:e.category, d:e.description, st:e.instructions };
}).sort((a,b) => a.id.localeCompare(b.id, 'en'));
const body = '[\n' + rows.map(e => JSON.stringify(e)).join(',\n') + '\n]\n';
const file = new URL('api/coach/agent/kb/exercise-details.json', root);
if (process.argv.includes('--check')) {
  let current; try { current = readFileSync(file,'utf8'); } catch {}
  if (current !== body) { console.error('Exercise details stale; run node scripts/build-agent-exercise-details.mjs'); process.exit(1); }
} else writeFileSync(file,body);
console.log(`${rows.length} exercises, ${Buffer.byteLength(body)} bytes: ${fileURLToPath(file)}`);

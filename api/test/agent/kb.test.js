import test from 'node:test';
import assert from 'node:assert/strict';
import { openAgentDb, closeAgentDb } from '../../agent/db.js';
import { ensureIndexes, kbSearch } from '../../agent/kb.js';
import { kb_search } from '../../agent/tools/knowledge.js';
test('indexes, folded queries, safe MATCH and citation recording', () => {
  const db = openAgentDb(':memory:');
  assert.deepEqual(ensureIndexes(db), ['kb', 'exercises']);
  assert.deepEqual(ensureIndexes(db), []);
  db.prepare("UPDATE kb_meta SET value='stale' WHERE key='kb'").run();
  assert.deepEqual(ensureIndexes(db, { force: true }), ['kb']);
  closeAgentDb();
});
test('folded queries and safe MATCH', () => {
  const db = openAgentDb(':memory:');
  const ids = (q) => kbSearch(q, { db }).retrievedIds;
  assert.deepEqual(ids('đau vai'), ids('dau vai'));
  assert.deepEqual(ids('ĐAU VAI'), ids('dau vai'));
  assert.ok(ids('đau vai').length);
  assert.ok(kbSearch('shoulder pain', { db, lang: 'en' }).results.some((r) => r.text.includes('shoulder')));
  for (const q of ['"', 'squat OR', 'NEAR(', '*', 'title:x']) assert.doesNotThrow(() => ids(q));
  closeAgentDb();
});
test('citation recording', () => {
  const db = openAgentDb(':memory:');
  const ctx = { db, retrieved: new Set() };
  const r = kb_search.run({ query: 'volume' }, ctx);
  assert.ok(r.results.length);
  assert.ok(r.results.every((e) => e.status === 'placeholder' && ctx.retrieved.has(e.id)));
  closeAgentDb();
});

test('language titles and unknown map ids', async () => {
  const { CHUNKS_BY_ID, DETAILS_BY_ID } = await import('../../agent/kb.js');
  const db = openAgentDb(':memory:');
  for (const lang of ['en', 'vi']) {
    const r = kbSearch('volume', { db, lang }).results[0];
    assert.equal(r.title, CHUNKS_BY_ID.get(r.id)[`title_${lang}`]);
  }
  assert.equal(CHUNKS_BY_ID.get('unknown'), undefined);
  assert.equal(DETAILS_BY_ID.get('unknown'), undefined);
  closeAgentDb();
});

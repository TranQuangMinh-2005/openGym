import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fold } from './safety/normalize.js';
import { openAgentDb } from './db.js';
const chunksFile = new URL('./kb/chunks.json', import.meta.url);
const detailsFile = new URL('./kb/exercise-details.json', import.meta.url);
export const chunks = JSON.parse(readFileSync(chunksFile, 'utf8'));
export const details = JSON.parse(readFileSync(detailsFile, 'utf8'));
export const DETAILS_BY_ID = new Map(details.map((row) => [row.id, row]));
export const CHUNKS_BY_ID = new Map(chunks.map((row) => [row.id, row]));
const indexedDatabases = new WeakMap();
export const matchQuery = (query) => (fold(query).match(/[\p{L}\p{N}]+/gu) || []).map((t) => `"${t}"`).join(' OR ');
export function ensureIndexes(db = openAgentDb(), { force = false } = {}) {
  if (!force && indexedDatabases.has(db)) return [];
  const changed = [];
  for (const [key, file, table] of [
    ['kb', chunksFile, 'kb_fts'],
    ['exercises', detailsFile, 'exercise_fts']
  ]) {
    const raw = readFileSync(file, 'utf8');
    const hash = createHash('sha256').update(raw).digest('hex');
    db.exec('BEGIN IMMEDIATE');
    try {
      if (db.prepare('SELECT value FROM kb_meta WHERE key=?').get(key)?.value !== hash) {
        db.exec(`DELETE FROM ${table}`);
        const rows = JSON.parse(raw);
        if (key === 'kb') {
          const stmt = db.prepare('INSERT INTO kb_fts VALUES(?,?,?,?,?)');
          for (const c of rows)
            for (const lang of ['vi', 'en'])
              stmt.run(c.id, fold(c.topic), fold(c.title_vi + ' ' + c.title_en), fold(c[`text_${lang}`]), lang);
        } else {
          const stmt = db.prepare('INSERT INTO exercise_fts VALUES(?,?,?,?,?,?,?)');
          for (const e of rows)
            stmt.run(e.id, ...[e.n, e.bp, e.tg, e.eq, (e.sm || []).join(' '), e.cat || ''].map(fold));
        }
        db.prepare('INSERT OR REPLACE INTO kb_meta VALUES(?,?)').run(key, hash);
        changed.push(key);
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  indexedDatabases.set(db, true);
  return changed;
}
export function kbSearch(query, { k = 5, lang = 'vi', db = openAgentDb() } = {}) {
  ensureIndexes(db);
  const match = matchQuery(query);
  const minScoreHint =
    Number.isFinite(Number(process.env.AGENT_KB_MIN_SCORE)) && process.env.AGENT_KB_MIN_SCORE?.trim()
      ? Number(process.env.AGENT_KB_MIN_SCORE)
      : 0.000001;
  const rows = match
    ? db
        .prepare('SELECT id, -bm25(kb_fts) AS score FROM kb_fts WHERE kb_fts MATCH ? ORDER BY score DESC, id')
        .all(match)
    : [];
  const seen = new Set();
  const results = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const c = CHUNKS_BY_ID.get(row.id);
    results.push({
      id: c.id,
      title: c[`title_${lang}`],
      text: c[`text_${lang}`],
      score: row.score,
      source: c.source,
      status: c.status,
      relevant: row.score >= minScoreHint
    });
    if (results.length >= k) break;
  }
  return { results, retrievedIds: results.map((r) => r.id), minScoreHint };
}

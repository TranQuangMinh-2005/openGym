import fs from 'node:fs';
import path from 'node:path';

const emitWarning = process.emitWarning;
process.emitWarning = function(warning, ...args) {
  if (String(warning).includes('SQLite is an experimental feature') && (args[0] === 'ExperimentalWarning' || warning?.name === 'ExperimentalWarning')) return;
  return emitWarning.call(this, warning, ...args);
};
let DatabaseSync;
try { ({ DatabaseSync } = await import('node:sqlite')); }
finally { process.emitWarning = emitWarning; }
const databases = new Map();
const jsonColumns = new Set(['payload', 'diff', 'plan', 'data']);
const decode = row => row && Object.fromEntries(Object.entries(row).map(([k, v]) => [k, jsonColumns.has(k) && v !== null ? JSON.parse(v) : v]));

let defaultDbPath;
export function setDefaultAgentDbPath(file) { defaultDbPath = file; }

export function openAgentDb(file = defaultDbPath || process.env.AGENT_DB_PATH || path.join(process.env.DATA_DIR || '/data', 'agent.db')) {
  file = file === ':memory:' ? file : path.resolve(file);
  if (databases.has(file)) return databases.get(file);
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.closeSync(fs.openSync(file, 'a', 0o600));
    fs.chmodSync(file, 0o600);
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY);');
  const migrations = [
    [1, `
        CREATE TABLE drafts(id TEXT PRIMARY KEY, uid TEXT, thread_id TEXT, kind TEXT CHECK(kind IN ('plan_create','plan_edit','constraints')), payload TEXT, diff TEXT, base_rev INTEGER, base_hash TEXT, status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','stale','expired')), created_at INTEGER, resolved_at INTEGER);
        CREATE INDEX drafts_uid_status ON drafts(uid,status);
        CREATE TABLE plan_versions(id TEXT PRIMARY KEY, uid TEXT, draft_id TEXT, plan TEXT, plan_hash TEXT, state_rev INTEGER, created_at INTEGER);
        CREATE INDEX plan_versions_uid_created ON plan_versions(uid,created_at);
        CREATE TABLE agent_runs(id TEXT PRIMARY KEY, uid TEXT, thread_id TEXT, status TEXT, started_at INTEGER, ended_at INTEGER, model_calls INTEGER DEFAULT 0, prompt_tokens INTEGER DEFAULT 0, completion_tokens INTEGER DEFAULT 0, reasoning_tokens INTEGER DEFAULT 0, cost REAL DEFAULT 0, error TEXT);
        CREATE TABLE agent_events(id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, at INTEGER, type TEXT, node TEXT, data TEXT);
        CREATE INDEX agent_events_run ON agent_events(run_id);
        CREATE TABLE checkpoints(thread_id TEXT, checkpoint_ns TEXT DEFAULT '', checkpoint_id TEXT, parent_checkpoint_id TEXT, type TEXT, checkpoint BLOB, metadata BLOB, PRIMARY KEY(thread_id,checkpoint_ns,checkpoint_id));
        CREATE TABLE writes(thread_id TEXT, checkpoint_ns TEXT, checkpoint_id TEXT, task_id TEXT, idx INTEGER, channel TEXT, type TEXT, value BLOB, PRIMARY KEY(thread_id,checkpoint_ns,checkpoint_id,task_id,idx));

      `],
    [2, 'ALTER TABLE checkpoints ADD COLUMN metadata_type TEXT;'],
    [3, `CREATE VIRTUAL TABLE kb_fts USING fts5(id UNINDEXED, topic, title, body, lang UNINDEXED, tokenize='unicode61 remove_diacritics 2');
      CREATE VIRTUAL TABLE exercise_fts USING fts5(id UNINDEXED, name, body_part, target, equipment, secondary, category, tokenize='unicode61 remove_diacritics 2');
      CREATE TABLE kb_meta(key TEXT PRIMARY KEY, value TEXT);` ]
  ];
  for (const [version, sql] of migrations) {
    db.exec('BEGIN IMMEDIATE');
    try {
      if (!db.prepare('SELECT version FROM schema_migrations WHERE version=?').get(version)) {
        db.exec(sql);
        db.prepare('INSERT INTO schema_migrations VALUES(?)').run(version);
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
  }
  databases.set(file, db);
  return db;
}

export function closeAgentDb() {
  for (const db of databases.values()) db.close();
  databases.clear();
}
const columns = {
  drafts: 'id uid thread_id kind payload diff base_rev base_hash status created_at resolved_at',
  plan_versions: 'id uid draft_id plan plan_hash state_rev created_at',
  agent_runs: 'id uid thread_id status started_at ended_at model_calls prompt_tokens completion_tokens reasoning_tokens cost error',
  agent_events: 'id run_id at type node data'
};
function insert(table, value) {
  const allowed = columns[table]?.split(' ');
  for (const key of Object.keys(value)) {
    if (!allowed?.includes(key)) throw new Error(`Unknown column: ${table}.${key}`);
  }
  const entries = Object.entries(value).filter(([, v]) => v !== undefined);
  openAgentDb().prepare(`INSERT INTO ${table} (${entries.map(([k]) => k).join(',')}) VALUES (${entries.map(() => '?').join(',')})`).run(...entries.map(([k, v]) => jsonColumns.has(k) ? JSON.stringify(v) : v));
}
export function insertDraft(value) { insert('drafts', { created_at: Date.now(), ...value }); }
export function getDraft(id) { return decode(openAgentDb().prepare('SELECT * FROM drafts WHERE id=?').get(id)); }
export function setDraftStatus(id, status) { openAgentDb().prepare('UPDATE drafts SET status=?, resolved_at=? WHERE id=?').run(status, status === 'pending' ? null : Date.now(), id); }
export function listDrafts(uid, status) {
  return (status === undefined ? openAgentDb().prepare('SELECT * FROM drafts WHERE uid=? ORDER BY created_at').all(uid) : openAgentDb().prepare('SELECT * FROM drafts WHERE uid=? AND status=? ORDER BY created_at').all(uid, status)).map(decode);
}
export function insertPlanVersion(value) { insert('plan_versions', { created_at: Date.now(), ...value }); }
export function listPlanVersions(uid) { return openAgentDb().prepare('SELECT * FROM plan_versions WHERE uid=? ORDER BY created_at').all(uid).map(decode); }
export function startRun(value) { insert('agent_runs', { status: 'running', started_at: Date.now(), ...value }); }
export function addRunUsage(id, usage) {
  openAgentDb().prepare('UPDATE agent_runs SET model_calls=model_calls+1, prompt_tokens=prompt_tokens+?, completion_tokens=completion_tokens+?, reasoning_tokens=reasoning_tokens+?, cost=cost+? WHERE id=?').run(usage.promptTokens || 0, usage.completionTokens || 0, usage.reasoningTokens || 0, usage.cost || 0, id);
}
export function endRun(id, status, error = null) { openAgentDb().prepare('UPDATE agent_runs SET status=?, error=?, ended_at=? WHERE id=?').run(status, error, Date.now(), id); }
export function addEvent(runId, type, node, data) { insert('agent_events', { run_id: runId, at: Date.now(), type, node, data }); }
export function getRun(id) { return decode(openAgentDb().prepare('SELECT * FROM agent_runs WHERE id=?').get(id)); }
export function listEvents(id) { return openAgentDb().prepare('SELECT * FROM agent_events WHERE run_id=? ORDER BY id').all(id).map(decode); }

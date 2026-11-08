// Drives the agent runtime against the real LLM with a throwaway data dir and a small profile.
//   node eval/live-e2e.mjs <dataDir> "<message>" [threadId] [approve|reject]
import fs from 'node:fs';
import path from 'node:path';
const [dir, text, threadArg, decision] = process.argv.slice(2);
process.env.DATA_DIR = dir;
process.env.AGENT_DB_PATH = path.join(dir, 'agent.db');
const { loadAgentConfig } = await import('../api/coach/agent/config.js');
const { createAgentRuntime } = await import('../api/coach/agent/runtime.js');
const { createStateStore } = await import('../api/state-store.js');
const { stampPut } = await import('../api/sync-stamps.js');
const file = path.join(dir, 'state-u1.json');
if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({
  _rev: 1, unit: 'kg', routines: [], week: {}, workouts: [], customEx: [],
  coach: { profile: { goal: 'hypertrophy', experience: 'beginner', daysPerWeek: 3, sessionMin: 45, equipment: ['dumbbell', 'body weight', 'cable'] } }
}));
const UNREADABLE = Symbol('u');
const read = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return UNREADABLE; } };
const store = createStateStore({ readStateStrict: read, UNREADABLE, stateFile: () => file, stateCache: new Map(),
  atomicWrite: (f, t) => { fs.writeFileSync(f + '.tmp', t); fs.renameSync(f + '.tmp', f); },
  records: v => (Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : []), forClient: S => S });
const cfg = loadAgentConfig();
const rt = await createAgentRuntime({ cfg, commitState: store.commitState, readState: () => read() });
const t0 = Date.now();
const res = decision
  ? await rt.resume({ uid: 'u1', threadId: threadArg, decisions: (await rt.getThread({ uid: 'u1', threadId: threadArg })).approval?.drafts?.map(d => ({ draftId: d.id, decision })) ?? [] })
  : await rt.run({ uid: 'u1', threadId: threadArg, text, lang: 'vi' });
console.log(JSON.stringify({ status: res.status, threadId: res.threadId, secs: ((Date.now() - t0) / 1000).toFixed(1),
  calls: res.usage?.model_calls, tokens: (res.usage?.prompt_tokens || 0) + (res.usage?.completion_tokens || 0), error: res.usage?.error,
  approval: res.approval?.drafts?.map(d => ({ kind: d.kind, summary: d.summary })) }, null, 1));
console.log('REPLY:', res.reply);
const { listEvents } = await import('../api/coach/agent/db.js');
console.log('PATH:', listEvents(res.runId).filter(e => e.type === 'node_end').map(e => e.node).join(' → '));
const S = read(); console.log('STATE: rev', S._rev, 'routines', S.routines.map(r => `${r.name}(${r.ex.length})`).join(', '), 'ledger', (S.coach.ledger || []).map(e => `${e.type}:${e.status}`).join(','));

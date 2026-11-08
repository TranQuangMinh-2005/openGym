import { randomUUID } from 'node:crypto';
import { loadAgentConfig } from './config.js';

export function agentRoutes({ json, readBody, readSession, getRuntime }) {
  const latest = new Map();
  const validId = x => typeof x === 'string' && x.length > 0 && x.length <= 200;
  const wrap = handler => async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    let runtime;
    try {
      if (!loadAgentConfig().enabled) throw new Error();
      runtime = await getRuntime();
      if (!runtime) throw new Error();
    } catch { return json(res, 503, { code: 'off' }); }
    try { return await handler(req, res, user.id, runtime); }
    catch (error) { console.error('Agent request failed:', error instanceof Error ? error.name : 'Error'); return json(res, 500, { error: 'agent request failed' }); }
  };
  const start = (res, uid, threadId, task) => {
    if (latest.get(uid)?.status === 'running') return json(res, 409, { code: 'busy' });
    const run = { id: randomUUID(), threadId, status: 'running' };
    latest.set(uid, run);
    Promise.resolve().then(task).then(result => {
      run.status = result.status === 'done' ? 'idle' : result.status;
      run.result = result;
    }, () => { run.status = 'error'; });
    return json(res, 202, { runId: run.id, threadId });
  };
  return {
    'POST /api/coach/agent/messages': wrap(async (req, res, uid, rt) => {
      const b = await readBody(req);
      if (!b || typeof b.text !== 'string' || !b.text.trim() || b.text.length > 2000 || (b.threadId !== undefined && !validId(b.threadId)) || (b.lang !== undefined && !['en', 'vi'].includes(b.lang))) return json(res, 400, { error: 'Invalid text, threadId or lang' });
      const threadId = b.threadId || randomUUID();
      return start(res, uid, threadId, () => rt.run({ uid, threadId, text: b.text, lang: b.lang }));
    }),
    'GET /api/coach/agent/thread': wrap(async (req, res, uid, rt) => {
      const threadId = new URL(req.url, 'http://localhost').searchParams.get('id');
      if (!validId(threadId)) return json(res, 400, { error: 'thread id required' });
      const thread = await rt.getThread({ uid, threadId });
      if (!thread) return json(res, 404, { error: 'Thread not found' });
      const run = latest.get(uid);
      const own = run?.threadId === threadId ? run : null;
      const usage = own?.result?.usage || {};
      return json(res, 200, { threadId, status: own?.status || (thread.awaitingApproval ? 'awaiting_approval' : 'idle'), messages: thread.messages, ...(thread.awaitingApproval ? { approval: thread.approval || own?.result?.approval } : {}), lastRun: own ? { id: own.id, status: own.result?.status || own.status, model_calls: usage.model_calls || 0, prompt_tokens: usage.prompt_tokens || 0, completion_tokens: usage.completion_tokens || 0, reasoning_tokens: usage.reasoning_tokens || 0, cost: usage.cost || 0 } : null });
    }),
    'POST /api/coach/agent/resume': wrap(async (req, res, uid, rt) => {
      const b = await readBody(req);
      if (!b || !validId(b.threadId) || !Array.isArray(b.decisions) || !b.decisions.length || b.decisions.some(d => !d || !validId(d.draftId) || !['approve', 'reject'].includes(d.decision) || (d.acceptedChangeIds !== undefined && (!Array.isArray(d.acceptedChangeIds) || !d.acceptedChangeIds.every(validId))))) return json(res, 400, { error: 'Invalid approval decisions' });
      if (latest.get(uid)?.status === 'running') return json(res, 409, { code: 'busy' });
      const thread = await rt.getThread({ uid, threadId: b.threadId });
      if (!thread?.awaitingApproval) return json(res, 409, { error: 'Nothing awaiting approval' });
      return start(res, uid, b.threadId, () => rt.resume({ uid, threadId: b.threadId, decisions: b.decisions }));
    }),
    'POST /api/coach/agent/cancel': wrap(async (req, res, uid, rt) => {
      const b = await readBody(req);
      if (!b || !validId(b.threadId)) return json(res, 400, { error: 'threadId required' });
      await rt.cancel({ uid, threadId: b.threadId });
      const run = latest.get(uid);
      if (run?.threadId === b.threadId) run.status = 'cancelled';
      return json(res, 200, { ok: true });
    }),
    'GET /api/coach/agent/drafts': wrap(async (req, res, uid) => {
      const db = await import('./db.js');
      return json(res, 200, db.listDrafts(uid, 'pending').map(d => ({ id: d.id, kind: d.kind, summary: d.payload?.summary || '', diff: d.diff, created_at: d.created_at })));
    })
  };
}

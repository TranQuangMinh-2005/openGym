import { randomUUID, createHash } from 'node:crypto';
import * as db from './db.js';
import { createChatModel } from './llm.js';

export async function createAgentRuntime({ cfg, commitState, readState,
  model, checkpointer }) {
  const [{ buildGraph, DecisionsSchema }, { createCheckpointer },
    { HumanMessage }, { Command }] = await Promise.all([
    import('./graph.js'), import('./checkpointer.js'),
    import('@langchain/core/messages'), import('@langchain/langgraph')
  ]);
  db.setDefaultAgentDbPath(cfg.dbPath);
  checkpointer ??= createCheckpointer(db.openAgentDb(cfg.dbPath));
  const active = new Map();
  const config = (uid, threadId) => ({ configurable: {
    thread_id: `${uid}:${threadId}`
  } });
  const compile = currentModel => buildGraph({ cfg, model: currentModel,
    deps: { readState, commitState } }).compile({ checkpointer });
  const snapshot = (uid, threadId) => compile(model).getState(config(uid, threadId));
  const approval = state => state.tasks?.flatMap(t => t.interrupts ?? [])[0]?.value;
  async function execute({ uid, threadId = randomUUID(), text, lang = 'vi',
    signal, decisions }) {
    const key = `${uid}:${threadId}`;
    if (active.has(key)) return { status: 'busy' };
    const runId = randomUUID();
    const controller = new AbortController();
    active.set(key, controller);
    db.startRun({ id: runId, uid, thread_id: threadId });
    let calls = 0;
    const combined = AbortSignal.any([controller.signal,
      AbortSignal.timeout(cfg.runTimeoutMs ?? 120000), ...(signal ? [signal] : [])]);
    try {
      const currentModel = model ?? await createChatModel({ cfg, threadId,
        signal: combined, onUsage: usage => db.addRunUsage(runId, usage),
        onCost: cost => {
          db.openAgentDb(cfg.dbPath).prepare(
            'UPDATE agent_runs SET cost=cost+? WHERE id=?').run(cost, runId);
        } });
      // Wrap each runnable so cancellation and budgets also cover structured safety calls.
      const wrap = runnable => new Proxy(runnable, { get(target, property) {
        if (property === 'bindTools' || property === 'withStructuredOutput') {
          return (...args) => wrap(target[property](...args));
        }
        if (property === 'invoke') return async (messages, options = {}) => {
          combined.throwIfAborted();
          if (cfg.maxModelCalls != null && calls >= cfg.maxModelCalls) {
            throw new Error('Model call limit reached');
          }
          calls++;
          if (model) db.addRunUsage(runId, {});
          // Race providers that do not implement AbortSignal cancellation themselves.
          let abort;
          try {
            return await Promise.race([
              target.invoke(messages, { ...options, signal: combined }),
              new Promise((_, reject) => {
                abort = () => reject(combined.reason);
                combined.addEventListener('abort', abort, { once: true });
                if (combined.aborted) abort();
              })
            ]);
          } finally { combined.removeEventListener('abort', abort); }
        };
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      } });
      const graph = buildGraph({ cfg, model: wrap(currentModel), deps: {
        readState, commitState,
        onGuardResult: (node, result) => db.addEvent(runId, 'guard', node, result),
        onToolCall: ({ tool, args, ms, ok }) => db.addEvent(runId, 'tool', tool, {
          argsHash: createHash('sha256').update(JSON.stringify(args)).digest('hex'), ms, ok
        })
      } }).compile({ checkpointer });
      const options = { ...config(uid, threadId), signal: combined,
        recursionLimit: cfg.recursionLimit ?? 100,
        callbacks: [{ handleChainStart(_chain, _inputs, _id, _parent, _tags, metadata) {
          if (metadata?.langgraph_node) {
            db.addEvent(runId, 'node_start', metadata.langgraph_node, {});
          }
        } }]
      };
      const input = decisions ? new Command({ resume: DecisionsSchema.parse({ decisions }) })
        : { uid, threadId, lang, messages: [new HumanMessage(text)] };
      for await (const update of await graph.stream(input, { ...options, streamMode: 'updates' })) {
        combined.throwIfAborted();
        for (const node of Object.keys(update)) {
          db.addEvent(runId, 'node_end', node, {});
          if (node === 'commit') db.addEvent(runId, 'commit', node, {});
        }
      }
      const state = await graph.getState(options);
      const pending = approval(state);
      const status = pending ? 'awaiting_approval' : 'done';
      if (pending) db.addEvent(runId, 'interrupt', 'approval', {});
      db.endRun(runId, status);
      return { runId, threadId, status, reply: state.values.final?.text ?? '',
        ...(pending ? { approval: pending } : {}), usage: db.getRun(runId) };
    } catch (error) {
      const status = controller.signal.aborted || signal?.aborted ? 'cancelled' : 'error';
      let message = String(error.message ?? error);
      if (cfg.apiKey) message = message.split(cfg.apiKey).join('[REDACTED]');
      message = message.replace(/Bearer\s+[^\s,;"']+/gi, 'Bearer [REDACTED]');
      db.endRun(runId, status, `${error.name ?? 'Error'}: ${message.slice(0, 200)}`);
      return { runId, threadId, status, reply: lang === 'en'
        ? 'Unable to finish. Nothing was saved.' : 'Chưa thể hoàn tất. Chưa lưu thay đổi nào.',
      usage: db.getRun(runId) };
    } finally { active.delete(key); }
  }
  return {
    run: execute,
    async resume(args) {
      if (active.has(`${args.uid}:${args.threadId}`)) return { status: 'busy' };
      const state = await snapshot(args.uid, args.threadId);
      if (!approval(state)) {
        return { status: 'error', error: 'nothing to approve' };
      }
      return execute({ lang: state.values.lang, ...args });
    },
    cancel({ uid, threadId }) {
      active.get(`${uid}:${threadId}`)?.abort();
    },
    async getThread({ uid, threadId }) {
      const state = await snapshot(uid, threadId);
      return { messages: (state.values.messages ?? []).map(m => ({
        role: m.getType() === 'human' ? 'user' : 'assistant', text: m.content
      })), awaitingApproval: !!approval(state), approval: approval(state) };
    }
  };
}

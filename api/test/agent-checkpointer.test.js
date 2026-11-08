import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tempData } from './helpers.mjs';
const dir = tempData();
process.env.AGENT_DB_PATH = path.join(dir, 'agent.db');
test('checkpoint restart and interrupt resume', async t => {
  let graph;
  try { graph = await import('@langchain/langgraph'); } catch { return t.skip('optional @langchain/langgraph is not installed'); }
  const { openAgentDb, closeAgentDb } = await import('../coach/agent/db.js');
  const { createCheckpointer } = await import('../coach/agent/checkpointer.js');
  const { StateGraph, Annotation, START, END, interrupt, Command } = graph;
  const state = Annotation.Root({ value: Annotation() });
  const build = saver => new StateGraph(state).addNode('ask', () => ({ value: interrupt('value?') })).addEdge(START, 'ask').addEdge('ask', END).compile({ checkpointer: saver });
  const cfg = { configurable: { thread_id: 'restart' } };
  let saver = createCheckpointer(openAgentDb());
  await build(saver).invoke({ value: 'initial' }, cfg);
  assert.ok(await saver.getTuple(cfg));
  assert.equal((await Array.fromAsync(saver.list(cfg, { limit: 1 }))).length, 1);
  closeAgentDb();
  saver = createCheckpointer(openAgentDb());
  const result = await build(saver).invoke(new Command({ resume: 'done' }), cfg);
  assert.equal(result.value, 'done');
  await saver.deleteThread('restart');
  assert.equal(await saver.getTuple(cfg), undefined);
  closeAgentDb();
});

test('checkpoint queries isolate threads, order newest first, and apply limits, before and metadata filters', async () => {
  const { openAgentDb } = await import('../coach/agent/db.js');
  const { NodeSqliteSaver } = await import('../coach/agent/checkpointer.js');
  const serde = {
    dumpsTyped: async value => ['custom', Buffer.from(JSON.stringify(value))],
    loadsTyped: async (type, data) => { assert.equal(type, 'custom'); return JSON.parse(Buffer.from(data).toString()); }
  };
  const saver = new NodeSqliteSaver(openAgentDb(), serde);
  const a = { configurable: { thread_id: 'A' } };
  for (const id of ['01', '02', '03']) await saver.put(a, { id }, { group: id === '02' ? 'yes' : 'no' });
  await saver.put({ configurable: { thread_id: 'B' } }, { id: '04' }, {});
  const ids = async options => (await Array.fromAsync(saver.list(a, options))).map(t => t.checkpoint.id);
  assert.deepEqual(await ids(), ['03', '02', '01']);
  assert.deepEqual(await ids({ limit: 2 }), ['03', '02']);
  assert.deepEqual(await ids({ before: { configurable: { checkpoint_id: '03' } } }), ['02', '01']);
  assert.deepEqual(await ids({ filter: { group: 'yes' }, limit: 1 }), ['02']);
  assert.equal((await saver.getTuple(a)).checkpoint.id, '03');
  assert.deepEqual((await saver.getTuple(a)).metadata, { group: 'no' });
  const cfg = (await saver.getTuple(a)).config;
  await saver.putWrites(cfg, [['x', 1], ['y', 2]], 'b');
  await saver.putWrites(cfg, [['__error__', 'old']], 'a');
  await saver.putWrites(cfg, [['__error__', 'new']], 'a');
  assert.deepEqual((await saver.getTuple(cfg)).pendingWrites, [['a', '__error__', 'new'], ['b', 'x', 1], ['b', 'y', 2]]);
});

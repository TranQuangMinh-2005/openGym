import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatModel, setChatModelFactoryForTests, resetChatModelFactoryForTests } from '../coach/agent/llm.js';
import { loadAgentConfig } from '../coach/agent/config.js';
test('factory injection', async () => {
  setChatModelFactoryForTests(options => options.threadId);
  try { assert.equal(await createChatModel({ threadId: 'test' }), 'test'); }
  finally { resetChatModelFactoryForTests(); }
});
test('real factory configuration', async t => {
  try { await import('@langchain/openai'); } catch { return t.skip('optional @langchain/openai is not installed'); }
  const model = await createChatModel({ cfg: loadAgentConfig({ AGENT_LLM_API_KEY: 'test' }), threadId: 'thread' });
  assert.equal(model.clientConfig.defaultHeaders['x-opencode-session'], 'gymbuddy-thread');
  assert.match(model.clientConfig.defaultHeaders['User-Agent'], /^gymbuddy-agent\//);
  assert.equal(model.clientConfig.baseURL, 'https://opencode.ai/zen/go/v1');
  assert.ok(!('response_format' in model.modelKwargs));
});

test('fetch reports provider cost and preserves JSON and non-JSON responses', async () => {
  const original = globalThis.fetch;
  const costs = [];
  try {
    const model = await createChatModel({ cfg: loadAgentConfig({ AGENT_LLM_API_KEY: 'test' }), threadId: 'cost', onCost: cost => costs.push(cost) });
    const body = JSON.stringify({ usage: { opencode: { list_cost: 0.25 } }, choices: [] });
    let response = new Response(body, { headers: { 'content-type': 'application/json' } });
    globalThis.fetch = async () => response;
    assert.equal(await model.clientConfig.fetch('unused'), response);
    assert.equal(await response.text(), body);
    assert.deepEqual(costs, [0.25]);
    response = new Response('invalid', { headers: { 'content-type': 'application/json' } });
    assert.equal(await model.clientConfig.fetch('unused'), response);
    assert.equal(await response.text(), 'invalid');
    response = new Response('plain');
    assert.equal(await model.clientConfig.fetch('unused'), response);
    assert.deepEqual(costs, [0.25]);
  } finally { globalThis.fetch = original; }
});
test('invalid reasoning effort falls back to low', () => {
  assert.equal(loadAgentConfig({ AGENT_LLM_EFFORT: 'medium' }).reasoningEffort, 'low');
  for (const effort of ['low', 'high', 'max']) assert.equal(loadAgentConfig({ AGENT_LLM_EFFORT: effort }).reasoningEffort, effort);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAgentConfig, publicAgentConfig } from '../../agent/config.js';

test('config defaults, validation and public projection', () => {
  const cfg = loadAgentConfig({});
  assert.ok(Object.isFrozen(cfg));
  assert.equal(cfg.recursionLimit, 40);
  assert.equal(cfg.maxModelCalls, null);
  assert.equal(cfg.dbPath, '/data/agent.db');
  assert.equal(loadAgentConfig({ AGENT_RECURSION_LIMIT: '4', AGENT_CALL_TIMEOUT_MS: 'no' }).callTimeoutMs, 90000);
  assert.equal(loadAgentConfig({ AGENT_RECURSION_LIMIT: '4' }).recursionLimit, 40);
  assert.equal(loadAgentConfig({ AGENT_MAX_MODEL_CALLS: '0' }).maxModelCalls, null);
  assert.equal(loadAgentConfig({ AGENT_MAX_MODEL_CALLS: '8' }).maxModelCalls, 8);
  assert.ok(!('apiKey' in publicAgentConfig(loadAgentConfig({ AGENT_LLM_API_KEY: 'test' }))));
});

test('library and handoff config defaults and integer parsing', () => {
  assert.equal(loadAgentConfig({}).programLibraryMax, 120);
  assert.equal(loadAgentConfig({}).maxHandoffsPerAgent, 3);
  assert.equal(loadAgentConfig({ AGENT_MAX_HANDOFFS_PER_AGENT: '2' }).maxHandoffsPerAgent, 2);
  for (const value of ['0', '-1', '1.5', 'bad', '']) assert.equal(loadAgentConfig({ AGENT_MAX_HANDOFFS_PER_AGENT: value }).maxHandoffsPerAgent, 3);
});

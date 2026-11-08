import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemorySaver } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { buildGraph } from '../../agent/graph.js';
import { FakeChatModel } from '../helpers/fake-chat-model.mjs';

process.env.AGENT_DB_PATH = join(mkdtempSync(join(tmpdir(), 'agent-graph-')), 'agent.db');

test('invalid citation gets one repair and fallback without system transcript', async () => {
  const finish = { tool: 'finish', args: {
    text: 'Training claim', citations: ['never-retrieved'], claimsNeedCitation: true
  } };
  const model = new FakeChatModel({
    safety: [{ level: 'none', regions: [], matches: [],
      needsClarification: false, failClosed: false }],
    orchestrator: [finish, finish]
  });
  const graph = buildGraph({ model, deps: { readState: async () => ({}) } })
    .compile({ checkpointer: new MemorySaver() });
  const result = await graph.invoke({
    uid: 'test', threadId: 'repair', messages: [new HumanMessage('hello')]
  }, { configurable: { thread_id: 'test:repair' } });
  assert.equal(result.repairs, 1);
  assert.equal(result.final.claimsNeedCitation, false);
  assert.ok(result.messages.every(m => m.getType() !== 'system'));
  assert.equal(model.calls.filter(c => c.agent === 'orchestrator').length, 2);
});

const { listDrafts, closeAgentDb } = await import('../../agent/db.js');
const { details } = await import('../../agent/kb.js');
const { kb_search } = await import('../../agent/tools/knowledge.js');
const { check_plan } = await import('../../agent/tools/program.js');
const label = (level = 'none', regions = []) => ({ level, regions, reason: 'scripted' });
const call = (tool, args = {}) => ({ tool, args });
const finish = (text = 'Đã xem xét.', citations = []) =>
  call('finish', { text, citations, claimsNeedCitation: citations.length > 0 });
const submit = (extra = {}) => call('submit_result', {
  agent: 'test', kind: 'data', text: 'Thông tin', citations: [],
  claimsNeedCitation: false, clarifications: [], ...extra
});
const question = { field: 'pain', reason: 'unclear',
  question_vi: 'Vai khó chịu thế nào?', question_en: 'How does your shoulder feel?' };
const ask = () => call('ask_user', { questions: [
  { field: question.field, question: question.question_vi },
  { field: question.field, question: question.question_vi }
] });
const complete = () => ({ routines: [], week: {}, coach: { profile: {
  goal: 'hypertrophy', experience: 'beginner', daysPerWeek: 3,
  sessionMin: 45, equipment: ['dumbbell']
} } });

async function runScenario(name, queues, { text = 'Xin tư vấn tập luyện',
  S = {}, cfg = {}, tools = {}, onEvent } = {}) {
  const model = new FakeChatModel({ safety: [label()], ...queues });
  const graph = buildGraph({ cfg, model, deps: {
    readState: async () => S, listPendingDrafts: uid => listDrafts(uid, 'pending'),
    tools, onEvent
  } }).compile({ checkpointer: new MemorySaver() });
  const result = await graph.invoke({
    uid: name, threadId: name, messages: [new HumanMessage(text)]
  }, { configurable: { thread_id: name }, recursionLimit: 60 });
  return { result, model };
}

test('(a) knowledge retrieves a citation through rag and finishes with it', async () => {
  const { result, model } = await runScenario('knowledge', {
    orchestrator: [call('transfer_to_rag', { task: 'weekly volume' }),
      finish('Khối lượng phù hợp [kb-001].', ['kb-001'])],
    rag: [call('kb_search', { query: 'weekly volume', k: 5 }),
      submit({ kind: 'answer', text: 'Khối lượng [kb-001].',
        citations: ['kb-001'], claimsNeedCitation: true })]
  });
  assert.ok(result.retrieved.some(c => c.id === 'kb-001'));
  assert.deepEqual(result.final.citations, ['kb-001']);
  assert.match(result.messages.at(-1).content, /kb-001/);
  assert.equal(result.repairs, 0);
  assert.equal(model.calls.filter(c => c.agent === 'rag').length, 2);
});

test('(c) red flag stages safety constraint without orchestrator or program', async () => {
  const { result, model } = await runScenario('red', {
    safety: [label('red_flag', ['shoulder'])]
  }, { text: 'đau nhói vai khi đẩy tạ' });
  assert.equal(result.final.kind, 'safety');
  assert.ok(result.final.text.length);
  const drafts = listDrafts('red', 'pending');
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].kind, 'constraints');
  assert.ok(drafts[0].payload.entries.some(e => e.type === 'avoid_region'
    && e.value.regions.includes('shoulder') && e.source.kind === 'safety'));
  assert.deepEqual(model.calls.map(c => c.agent), ['safety']);
});

test('(d) caution dedupes specialist questions and rejects transient shoulder loading', async () => {
  let pending;
  let checked;
  const shoulder = details.find(e => e.tg === 'delts' && e.eq === 'dumbbell');
  const plan = { coach_contract: 1, routines: [{ id: 'new', name: 'Shoulders',
    ex: [{ id: shoulder.id, sets: 3, reps: 10 }] }], week: { 1: 'new', 3: 'new', 5: 'new' } };
  const { result } = await runScenario('caution', {
    safety: [label('caution', ['shoulder'])],
    orchestrator: [
      call('transfer_to_profile_progress', { task: 'Review complaint' }),
      call('transfer_to_program', { task: 'Check edit', mode: 'edit' }), ask()
    ],
    profile_progress: [submit({ kind: 'clarification', clarifications: [question] })],
    program: [call('check_plan', { plan }),
      submit({ kind: 'clarification', clarifications: [question] })]
  }, { text: 'Vai hơi mỏi sau buổi tập', S: complete(), tools: {
    check_plan: { ...check_plan, async run(args, ctx) {
      pending = structuredClone(ctx.pendingConstraints);
      checked = await check_plan.run(args, ctx);
      return checked;
    } }
  } });
  assert.equal(result.safety.level, 'caution');
  assert.equal(result.agentResults.filter(r =>
    r.clarifications.some(q => q.field === 'pain')).length, 2);
  assert.equal(result.openQuestions.length, 1);
  assert.equal(result.final.text, question.question_vi);
  assert.ok(pending.some(e => e.id === 'caution:shoulder'
    && e.status === 'pending' && e.strength === 'hard'
    && e.source.kind === 'safety' && e.type === 'avoid_region'));
  assert.equal(checked.ok, false);
  assert.ok(checked.errors.some(e => e.includes('avoid_region')), JSON.stringify(checked));
  assert.equal(listDrafts('caution', 'pending').length, 0);
});

test('(e) missing creation fields return program_context clarification without program', async () => {
  const { result, model } = await runScenario('missing', {
    orchestrator: [call('transfer_to_program', { task: 'Tạo lịch', mode: 'create' }),
      call('ask_user', { questions: [{ field: 'goal', question: 'Mục tiêu là gì?' }] })]
  });
  const clarification = result.agentResults.find(r => r.agent === 'program_context');
  assert.equal(clarification.kind, 'clarification');
  assert.ok(clarification.clarifications.some(q => q.field === 'goal'));
  assert.equal(model.calls.filter(c => c.agent === 'program').length, 0);
});

test('(f) profile progress then program in one turn injects programContext', async () => {
  const { result, model } = await runScenario('multihop', {
    orchestrator: [call('transfer_to_profile_progress', { task: 'Review progress' }),
      call('transfer_to_program', { task: 'Review plan', mode: 'edit' }), finish()],
    profile_progress: [call('get_progress_metrics'), submit()],
    program: [submit()]
  }, { S: complete() });
  assert.deepEqual(result.agentResults.map(r => r.agent),
    ['profile_progress_agent', 'program_agent']);
  const system = model.calls.find(c => c.agent === 'program').messages[0].content;
  const snapshot = JSON.parse(system.match(/<context>\n(.*)\n<\/context>/s)[1]);
  assert.ok(snapshot.programContext.library.length > 0);
  assert.ok(snapshot.programContext.library.every(e => 'tg' in e && 'eq' in e));
  assert.equal(snapshot.programContext.goal, 'hypertrophy');
  assert.equal(snapshot.programContext.sessionMinutes.default, 45);
  assert.ok(result.toolLog.some(e => e.tool === 'get_progress_metrics'));
});

test('(g) repeating specialist tool and arguments three times returns data stuck', async () => {
  const repeat = call('search_exercises', { query: 'curl' });
  const { result } = await runScenario('stall', {
    orchestrator: [call('transfer_to_rag', { task: 'Find curl' }), finish()],
    rag: [repeat, repeat, repeat]
  });
  assert.equal(result.agentResults[0].kind, 'data');
  assert.equal(result.agentResults[0].text, 'stuck');
  assert.equal(result.toolLog.filter(e => e.tool === 'search_exercises').length, 3);
});

test('(h) lexicon red flag overrides LLM none', async () => {
  const { result, model } = await runScenario('override', {
    safety: [label('none')]
  }, { text: 'đau nhói vai khi đẩy tạ' });
  assert.equal(result.safety.llm.level, 'none');
  assert.equal(result.safety.failClosed, false);
  assert.equal(result.safety.level, 'red_flag');
  assert.equal(result.final.kind, 'safety');
  assert.deepEqual(model.calls.map(c => c.agent), ['safety']);
});

test('(i) fixed RAG uses one KB search and one specialist model call', async () => {
  const searches = [];
  const { result, model } = await runScenario('fixed', {
    orchestrator: [call('transfer_to_rag', { task: 'weekly volume' }),
      finish('Khối lượng [kb-001].', ['kb-001'])],
    rag_fixed: [submit({ kind: 'answer', text: 'Khối lượng [kb-001].',
      citations: ['kb-001'], claimsNeedCitation: true })]
  }, { cfg: { ragMode: 'fixed' }, tools: {
    kb_search: { ...kb_search, run(args, ctx) {
      searches.push(args);
      return kb_search.run(args, ctx);
    } }
  } });
  assert.deepEqual(searches, [{ query: 'weekly volume', k: 5, lang: 'vi' }]);
  assert.equal(model.calls.filter(c => c.agent === 'rag_fixed').length, 1);
  assert.equal(model.calls.filter(c => c.agent === 'rag').length, 0);
  assert.ok(result.retrieved.some(c => c.id === 'kb-001'));
  assert.deepEqual(result.final.citations, ['kb-001']);
});

test.after(() => closeAgentDb());

import { programInputs } from '../../agent/agents.js';
test('chat facts fill temporary profile without persistence', () => {
  const S = {};
  const { S: merged, known } = programInputs(S, [], { goal: 'strength', daysPerWeek: 3, sessionMinutes: 40 });
  assert.equal(known.goal, 'strength');
  assert.equal(merged.coach.profile.sessionMin, 40);
  assert.equal(S.coach, undefined);
});
test('known includes complete profile without progress', () => {
  const { known } = programInputs(complete());
  assert.equal(known.goal, 'hypertrophy');
  assert.equal(known.experience, 'beginner');
  assert.equal(known.sessionMinutes, 45);
  assert.equal(known.progress, undefined);
});

for (const flagged of [false, true]) test(`stuck specialist refuses redispatch (${flagged})`, async () => {
  const events = [];
  const { result, model } = await runScenario('stuck-' + flagged, {
    orchestrator: [call('transfer_to_program', { task: 'Create', mode: 'create' }), call('transfer_to_program', { task: 'Retry', mode: 'create' })],
    program: [submit(flagged ? { stuck: true } : { text: 'stuck' })]
  }, { S: complete(), onEvent: e => events.push(e) });
  assert.equal(model.calls.filter(c => c.agent === 'program').length, 1);
  assert.match(result.final.text, /Chưa lưu thay đổi nào/);
  assert.equal(events[0].reason, 'stuck');
});
test('third handoff is refused with limit two', async () => {
  const events = [];
  const { result, model } = await runScenario('handoff-limit', {
    orchestrator: Array.from({ length: 3 }, () => call('transfer_to_program', { task: 'Review', mode: 'edit' })),
    program: [submit({ text: 'First' }), submit({ text: 'Second' })]
  }, { S: complete(), cfg: { maxHandoffsPerAgent: 2 }, onEvent: e => events.push(e) });
  assert.equal(model.calls.filter(c => c.agent === 'program').length, 2);
  assert.match(result.final.text, /Chưa lưu/);
  assert.equal(events[0].reason, 'max_handoffs');
});

test('different nested plans do not stall', async () => {
  const { result } = await runScenario('nested-plans', {
    orchestrator: [call('transfer_to_program', { task: 'Check', mode: 'edit' }), finish()],
    program: [1, 2, 3].map(n => call('check_plan', { plan: { coach_contract: 1, routines: [{ id: 'r', name: String(n), ex: [] }], week: {} } })).concat(submit({ text: 'Done' }))
  }, { S: complete(), tools: { check_plan: { ...check_plan, schema: (await import('zod')).z.object({ plan: (await import('zod')).z.any() }), run: async () => ({ ok: true }) } } });
  assert.equal(result.agentResults[0].text, 'Done');
});

for (const twice of [false, true]) test(`specialist plain text recovery twice=${twice}`, async () => {
  const { result, model } = await runScenario('plain-specialist-' + twice, {
    orchestrator: [call('transfer_to_program', { task: 'Review', mode: 'edit' }), finish()],
    program: [{ text: 'Draft response' }, twice ? { text: 'Recovered text' } : submit({ text: 'Recovered text' })]
  }, { S: complete() });
  assert.equal(result.agentResults[0].text, 'Recovered text');
  assert.equal(result.agentResults[0].kind, 'data');
  assert.equal(result.final.kind, 'answer');
  const calls = model.calls.filter(c => c.agent === 'program');
  assert.equal(calls.length, 2);
  assert.ok(calls[1].messages.some(m => m.getType() === 'human' && String(m.content).includes('Call submit_result now')));
});

test('orchestrator plain text retries then finishes through output guard', async () => {
  const { result, model } = await runScenario('plain-orchestrator', {
    orchestrator: [{ text: 'First' }, { text: 'Safe response' }]
  });
  assert.equal(result.final.text, 'Safe response');
  assert.equal(result.final.claimsNeedCitation, false);
  assert.equal(result.repairs, 0);
  const { validValues } = await import('../../agent/tools/exercises.js');
  const system = model.calls.find(c => c.agent === 'orchestrator').messages[0].content;
  const snapshot = JSON.parse(system.match(/<context>\n(.*)\n<\/context>/s)[1]);
  assert.deepEqual(snapshot.equipmentVocabulary, validValues.equipment);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAgentRuntime } from '../../agent/runtime.js';
import { FakeChatModel } from '../helpers/fake-chat-model.mjs';

const dbPath = join(mkdtempSync(join(tmpdir(), 'runtime-')), 'agent.db');


test('runtime persists transcript and namespaces user threads', async () => {
  const runtime = await createAgentRuntime({ cfg: { dbPath },
    readState: async () => ({}), commitState: () => { throw Error('unexpected write'); },
    model: new FakeChatModel({
      safety: [{ level: 'none', regions: [], reason: 'test' }],
      orchestrator: [{ tool: 'finish', args: { text: 'Hello', citations: [],
        claimsNeedCitation: false } }]
    }) });
  const result = await runtime.run({ uid: 'a', threadId: 'one', text: 'Hi', lang: 'en' });
  assert.equal(result.status, 'done');
  assert.equal(result.reply, 'Hello');
  assert.equal((await runtime.getThread({ uid: 'a', threadId: 'one' })).messages.length, 2);
  assert.deepEqual((await runtime.getThread({ uid: 'b', threadId: 'one' })).messages, []);
  assert.equal((await runtime.resume({ uid: 'b', threadId: 'one', decisions: [] })).error,
    'nothing to approve');
});

const { readFileSync, writeFileSync, renameSync } = await import('node:fs');
const { createStateStore } = await import('../../state-store.js');
const { getDraft, listEvents } = await import('../../agent/db.js');

for (const decision of ['approve', 'reject']) {
  test(`red flag ${decision} after runtime restart uses real CAS writer`, async () => {
    const directory = mkdtempSync(join(tmpdir(), 'runtime-state-'));
    const file = join(directory, 'state.json');
    const initial = JSON.stringify({ routines: [], workouts: [], coach: {}, _rev: 0 });
    writeFileSync(file, initial);
    const readState = () => JSON.parse(readFileSync(file, 'utf8'));
    const { commitState } = createStateStore({ readStateStrict: readState,
      UNREADABLE: Symbol(), stateFile: () => file, stateCache: new Map(),
      records: rows => rows.filter(x => x && typeof x === 'object'),
      forClient: x => x, atomicWrite(path, text) {
        writeFileSync(path + '.tmp', text);
        renameSync(path + '.tmp', path);
      } });
    const cfg = { dbPath, apiKey: 'secret-must-not-appear' };
    const first = await createAgentRuntime({ cfg, readState, commitState,
      model: new FakeChatModel({ safety: [{ level: 'red_flag',
        regions: ['shoulder'], reason: 'test' }] }) });
    const uid = 'safety-' + decision;
    const started = await first.run({ uid, threadId: 'confirmation',
      text: 'My shoulder hurts', lang: 'en' });
    assert.equal(started.status, 'awaiting_approval');
    const draftId = started.approval.drafts[0].id;
    const restarted = await createAgentRuntime({ cfg, readState, commitState,
      model: new FakeChatModel({}) });
    const thread = await restarted.getThread({ uid, threadId: 'confirmation' });
    assert.equal(thread.awaitingApproval, true);
    assert.deepEqual(thread.approval, started.approval);
    const result = await restarted.resume({ uid, threadId: 'confirmation',
      decisions: [{ draftId, decision }] });
    assert.equal(result.status, 'done');
    assert.equal(getDraft(draftId).status, decision === 'approve' ? 'approved' : 'rejected');
    if (decision === 'approve') {
      assert.ok(readState()._rev > 0);
      assert.ok(result.reply.includes(started.approval.drafts[0].summary));
      assert.equal(readState().coach.ledger[0].status, 'active');
    } else assert.equal(readFileSync(file, 'utf8'), initial);
    assert.ok(listEvents(started.runId).some(e => e.type === 'node_end'));
    assert.ok(!JSON.stringify(listEvents(started.runId)).includes(cfg.apiKey));
  });
}

const { details } = await import('../../agent/kb.js');
const { listPlanVersions, getRun } = await import('../../agent/db.js');
const exercise = details.find(e => e.eq === 'dumbbell' && e.tg === 'biceps');
const call = (tool, args) => ({ tool, args });
const finish = call('finish', { text: 'Ready', citations: [], claimsNeedCitation: false });
const submit = call('submit_result', { agent: 'program_agent', kind: 'proposal',
  text: 'Ready', citations: [], claimsNeedCitation: false, clarifications: [] });
const initialState = () => ({ routines: [{ id: 'old', name: 'Old',
  ex: [{ id: exercise.id, sets: 3, reps: 10 }] }], week: { 1: ['old'] },
workouts: [], coach: { profile: { goal: 'hypertrophy', experience: 'beginner',
  daysPerWeek: 1, sessionMin: 60, equipment: ['dumbbell'] } }, _rev: 0 });
const bundle = { coach_contract: 1, name: 'New', summary: 'New training day',
  routines: [{ id: 'new', name: 'New', ex: [{ id: exercise.id, sets: 3, reps: 10 }] }],
  week: { 1: 'new' }, customEx: [] };
function fixture({ fresh = false } = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'runtime-cas-'));
  const file = join(dataDir, 'state.json');
  if (!fresh) writeFileSync(file, JSON.stringify(initialState()));
  // Mirrors server.js: no state file reads as null to the store and {} to the agent.
  const readStrict = () => existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  const readState = () => readStrict() ?? {};
  const store = createStateStore({ readStateStrict: readStrict, UNREADABLE: Symbol(),
    stateFile: () => file, stateCache: new Map(), forClient: x => x,
    records: rows => rows.filter(x => x && typeof x === 'object'),
    atomicWrite(path, text) {
      writeFileSync(path + '.tmp', text);
      renameSync(path + '.tmp', path);
    } });
  return { file, readState, commitState: store.commitState };
}
async function setup(queues, options = {}, fixtureOptions) {
  const state = fixture(fixtureOptions);
  const cfg = { dbPath, apiKey: 'private-api-key-test', ...options };
  const model = new FakeChatModel({ safety: [{ level: 'none', regions: [], reason: 'test' }],
    ...queues });
  const runtime = await createAgentRuntime({ cfg, model, ...state });
  return { ...state, cfg, model, runtime };
}
const createQueues = () => ({
  orchestrator: [call('transfer_to_program', { task: 'Create plan', mode: 'create' }), finish],
  program: [call('check_plan', { plan: { ...bundle, routines: [{ id: 'bad',
    name: 'Bad', ex: [{ id: 'unknown', sets: 3 }] }], week: { 1: 'bad' } } }),
  call('check_plan', { plan: bundle }), call('propose_plan', { mode: 'create',
    plan: bundle, summary: 'New plan', rationale: [] }), submit]
});
for (const decision of ['approve', 'reject', 'stale']) {
  test(`plan creation repairs validation and ${decision} preserves CAS invariants`, async () => {
    const f = await setup(createQueues());
    const uid = 'create-' + decision;
    const started = await f.runtime.run({ uid, threadId: uid, text: 'Create a plan', lang: 'en' });
    assert.equal(started.status, 'awaiting_approval', JSON.stringify(started));
    assert.ok(started.approval.drafts[0].diff);
    const programCalls = f.model.calls.filter(c => c.agent === 'program');
    assert.equal(programCalls.length, 4);
    const checks = programCalls.at(-1).messages.filter(m => m.getType() === 'tool')
      .map(m => JSON.parse(m.content));
    assert.equal(checks[0].ok, false);
    assert.equal(checks[1].ok, true);
    const draftId = started.approval.drafts[0].id;
    if (decision === 'stale') f.commitState(uid, S => { S.routines[0].name = 'Edited elsewhere'; });
    const before = readFileSync(f.file, 'utf8');
    const resumed = await f.runtime.resume({ uid, threadId: uid,
      decisions: [{ draftId, decision: decision === 'reject' ? 'reject' : 'approve' }] });
    assert.equal(resumed.status, 'done', JSON.stringify(resumed));
    assert.equal(getDraft(draftId).status,
      { approve: 'approved', reject: 'rejected', stale: 'stale' }[decision]);
    if (decision === 'approve') {
      assert.ok(f.readState()._rev > 0);
      assert.notDeepEqual(f.readState().routines, initialState().routines);
      assert.notDeepEqual(f.readState().week, initialState().week);
      const versions = listPlanVersions(uid);
      assert.equal(versions.length, 1);
      assert.equal(versions[0].draft_id, draftId);
      assert.equal(versions[0].state_rev, f.readState()._rev);
    } else assert.equal(readFileSync(f.file, 'utf8'), before);
    const events = [...listEvents(started.runId), ...listEvents(resumed.runId)];
    for (const type of ['node_start', 'node_end', 'guard', 'tool', 'interrupt', 'commit']) {
      assert.ok(events.some(e => e.type === type), type);
    }
    assert.ok(!JSON.stringify(events).includes(f.cfg.apiKey));
  });
}

test('plan edit accepts only selected change ids', async () => {
  const changes = [
    { id: 'sets', type: 'sets', target: { routineId: 'old', exId: exercise.id },
      before: 3, after: 4, why: 'Requested more sets' },
    { id: 'reps', type: 'reps', target: { routineId: 'old', exId: exercise.id },
      before: 10, after: 12, why: 'Requested more reps' }
  ];
  const f = await setup({ orchestrator: [call('transfer_to_program', {
    task: 'Edit plan', mode: 'edit' }), finish], program: [call('propose_plan', {
    mode: 'edit', changes, summary: 'Adjust volume', rationale: [] }), submit] });
  const uid = 'partial';
  const started = await f.runtime.run({ uid, threadId: uid, text: 'Adjust my plan' });
  assert.equal(started.status, 'awaiting_approval', JSON.stringify(started));
  const draftId = started.approval.drafts[0].id;
  assert.deepEqual(started.approval.drafts[0].changes.map(({ id, type, target }) => ({ id, type, target })),
    getDraft(draftId).payload.changes.map(({ id, type, target }) => ({ id, type, target })));
  assert.equal(started.approval.drafts[0].changes.length, 2);
  const accepted = getDraft(draftId).payload.changes.find(c => c.type === 'sets').id;
  const result = await f.runtime.resume({ uid, threadId: uid,
    decisions: [{ draftId, decision: 'approve', acceptedChangeIds: [accepted] }] });
  assert.equal(result.status, 'done');
  assert.match(result.reply, /1\/2 thay đổi/);
  assert.equal(f.readState().routines[0].ex[0].sets, 4);
  assert.equal(f.readState().routines[0].ex[0].reps, 10);
});

function loopQueues(rounds) {
  return { orchestrator: [...Array.from({ length: rounds }, () => call(
    'transfer_to_profile_progress', { task: 'Read progress' })), finish],
  profile_progress: Array.from({ length: rounds }, () => call('submit_result', {
    agent: 'profile_progress_agent', kind: 'data', text: 'Read', citations: [],
    claimsNeedCitation: false, clarifications: [] })) };
}
for (const [name, cfg, rounds, expected] of [
  ['recursionLimit 5', { recursionLimit: 5 }, 30, 'error'],
  // No model-call budget: the 30 calls come from 15 handoffs, so the per-agent handoff guard
  // (a loop guard, not a budget) is lifted for this case.
  ['unlimited 30 calls', { maxModelCalls: null, recursionLimit: 100, maxHandoffsPerAgent: 100 }, 15, 'done'],
  ['maxModelCalls 3', { maxModelCalls: 3 }, 15, 'error']
]) {
  test(`${name} enforces loop policy without state writes`, async () => {
    const f = await setup(loopQueues(rounds), cfg);
    const before = readFileSync(f.file, 'utf8');
    const result = await f.runtime.run({ uid: name, threadId: name, text: 'Review progress' });
    assert.equal(result.status, expected, JSON.stringify(result));
    assert.equal(readFileSync(f.file, 'utf8'), before);
    if (expected === 'done') assert.ok(result.usage.model_calls >= 30);
    if (cfg.maxModelCalls === 3) assert.equal(result.usage.model_calls, 3);
  });
}

test('provider errors retain useful detail while redacting API key and Bearer token', async () => {
  const f = await setup({ orchestrator: [{ throw:
    'Provider failed private-api-key-test Authorization: Bearer token-secret' }] });
  const before = readFileSync(f.file, 'utf8');
  const result = await f.runtime.run({ uid: 'provider', text: 'Hi' });
  assert.equal(result.status, 'error');
  const error = getRun(result.runId).error;
  assert.match(error, /Error: Provider failed/);
  assert.ok(!error.includes(f.cfg.apiKey));
  assert.ok(!error.includes('token-secret'));
  assert.equal(readFileSync(f.file, 'utf8'), before);
});

test('slow call cancellation is uid scoped and concurrent run and resume are busy', async () => {
  const f = fixture();
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const fake = new FakeChatModel({ safety: [{ level: 'none', regions: [], reason: 'test' }],
    orchestrator: [finish] });
  const model = { withStructuredOutput: (...args) => fake.withStructuredOutput(...args),
    bindTools(...args) {
      const bound = fake.bindTools(...args);
      return { async invoke(...values) {
        entered();
        await blocked;
        return bound.invoke(...values);
      } };
    } };
  const runtime = await createAgentRuntime({ cfg: { dbPath }, ...f, model });
  const before = readFileSync(f.file, 'utf8');
  const running = runtime.run({ uid: 'owner', threadId: 'shared', text: 'Hi' });
  await started;
  runtime.cancel({ uid: 'foreign', threadId: 'shared' });
  assert.deepEqual(await runtime.run({ uid: 'owner', threadId: 'shared', text: 'Again' }),
    { status: 'busy' });
  assert.deepEqual(await runtime.resume({ uid: 'owner', threadId: 'shared', decisions: [] }),
    { status: 'busy' });
  runtime.cancel({ uid: 'owner', threadId: 'shared' });
  const result = await running;
  release();
  assert.equal(result.status, 'cancelled');
  assert.equal(readFileSync(f.file, 'utf8'), before);
});

test('foreign uid cannot resume or approve another users pending draft', async () => {
  const f = await setup(createQueues());
  const started = await f.runtime.run({ uid: 'draft-owner', threadId: 'foreign-test',
    text: 'Create a plan', lang: 'en' });
  const draftId = started.approval.drafts[0].id;
  const before = readFileSync(f.file, 'utf8');
  assert.equal((await f.runtime.resume({ uid: 'intruder', threadId: 'foreign-test',
    decisions: [{ draftId, decision: 'approve' }] })).error, 'nothing to approve');
  // A legitimate interrupted thread still cannot accept a foreign draft id.
  const other = await createAgentRuntime({ cfg: f.cfg, readState: f.readState,
    commitState: f.commitState, model: new FakeChatModel({ safety: [{
      level: 'red_flag', regions: ['shoulder'], reason: 'test' }] }) });
  const pending = await other.run({ uid: 'intruder', threadId: 'own-thread',
    text: 'Shoulder pain', lang: 'en' });
  assert.equal(pending.status, 'awaiting_approval');
  const result = await other.resume({ uid: 'intruder', threadId: 'own-thread',
    decisions: [{ draftId, decision: 'approve' }] });
  assert.equal(result.status, 'done');
  assert.match(result.reply, /Invalid draft ignored/);
  assert.equal(getDraft(draftId).status, 'pending');
  assert.equal(readFileSync(f.file, 'utf8'), before);
});

test('failed CAS leaves the draft pending and says nothing was saved', async () => {
  const f = await setup(createQueues());
  const uid = 'failed-cas';
  const started = await f.runtime.run({ uid, threadId: uid, text: 'Create plan', lang: 'en' });
  const draftId = started.approval.drafts[0].id;
  const before = readFileSync(f.file, 'utf8');
  const restarted = await createAgentRuntime({ cfg: f.cfg, readState: f.readState,
    commitState: () => ({ ok: false, status: 409 }), model: new FakeChatModel({}) });
  const result = await restarted.resume({ uid, threadId: uid,
    decisions: [{ draftId, decision: 'approve' }] });
  assert.equal(result.status, 'done');
  assert.match(result.reply, /Nothing was saved/);
  assert.equal(getDraft(draftId).status, 'pending');
  assert.equal(listPlanVersions(uid).length, 0);
  assert.equal(readFileSync(f.file, 'utf8'), before);
});

test('L3 stored program proposal overrides ask_user and retains approval interrupt', async () => {
  const queues = createQueues();
  queues.orchestrator[1] = call('ask_user', { questions: [{ field: 'pain', question: 'Question that must not appear?' }] });
  queues.program[queues.program.length - 1] = call('submit_result', {
    agent: 'program_agent', kind: 'proposal', text: 'Proposal summary: New training day',
    citations: [], claimsNeedCitation: false, clarifications: []
  });
  const f = await setup(queues);
  const result = await f.runtime.run({ uid: 'l3', threadId: 'l3', text: 'Create plan', lang: 'vi' });
  assert.equal(result.status, 'awaiting_approval');
  assert.match(result.reply, /Proposal summary: New training day/);
  assert.doesNotMatch(result.reply, /Question that must not appear/);
  assert.equal(result.approval.drafts[0].kind, 'plan_create');
});

for (const outcome of ['approve', 'reject', 'stale', 'failure']) {
  test(`L5 Vietnamese plan_create resume reply: ${outcome}`, async () => {
    const f = await setup(createQueues());
    const uid = 'l5-' + outcome;
    const started = await f.runtime.run({ uid, threadId: uid, text: 'Tạo lịch', lang: 'vi' });
    const draftId = started.approval.drafts[0].id;
    if (outcome === 'stale') f.commitState(uid, S => { S.routines[0].name = 'Changed'; });
    const before = readFileSync(f.file, 'utf8');
    const runtime = outcome === 'failure' ? await createAgentRuntime({ cfg: f.cfg,
      readState: f.readState, commitState: () => ({ ok: false, status: 409 }),
      model: new FakeChatModel({}) }) : f.runtime;
    const result = await runtime.resume({ uid, threadId: uid,
      decisions: [{ draftId, decision: outcome === 'reject' ? 'reject' : 'approve' }] });
    assert.equal(result.status, 'done');
    if (outcome === 'approve') assert.match(result.reply, /1 buổi \(New\)/);
    if (outcome === 'reject') assert.match(result.reply, /chương trình giữ nguyên/);
    if (outcome === 'stale') assert.match(result.reply, /đã thay đổi.*Chưa lưu thay đổi nào/s);
    if (outcome === 'failure') assert.match(result.reply, /Chưa lưu thay đổi nào/);
    if (outcome !== 'approve') assert.equal(readFileSync(f.file, 'utf8'), before);
  });
}

test('orchestrator prompt prohibits probing symptom character duration and triggers', () => {
  const prompt = readFileSync(new URL('../../agent/prompts/orchestrator.md', import.meta.url), 'utf8');
  assert.match(prompt, /Never ask about pain character, duration or triggers/);
});

// Live run 2026-11-06: a thread read while a draft awaited approval showed the user's message last —
// the proposal text only reached the transcript after the decision. It must be there before, and
// the decision must add exactly one reply after it.
test('the proposal text is in the transcript while approval is pending, and the commit adds one reply', async () => {
  const f = await setup(createQueues());
  const uid = 'transcript-order';
  const started = await f.runtime.run({ uid, threadId: uid, text: 'Create a plan', lang: 'en' });
  assert.equal(started.status, 'awaiting_approval');
  const waiting = await f.runtime.getThread({ uid, threadId: uid });
  assert.deepEqual(waiting.messages.map(m => m.role), ['user', 'assistant']);
  assert.equal(waiting.messages[1].text, started.reply);
  await f.runtime.resume({ uid, threadId: uid,
    decisions: [{ draftId: started.approval.drafts[0].id, decision: 'approve' }] });
  const done = await f.runtime.getThread({ uid, threadId: uid });
  assert.deepEqual(done.messages.map(m => m.role), ['user', 'assistant', 'assistant']);
  assert.notEqual(done.messages[2].text, done.messages[1].text);
});

// Docker run 2026-11-07: approving a plan for a profile that had never synced failed with
// "Cannot read properties of undefined (reading 'push')" — the state document did not exist yet.
test('approving a created plan works for a profile with no state file', async () => {
  const queues = createQueues();
  queues.orchestrator[0] = call('transfer_to_program', { task: 'Create plan', mode: 'create',
    facts: { goal: 'hypertrophy', experience: 'beginner', daysPerWeek: 1, sessionMinutes: 60, equipment: ['dumbbell'] } });
  const f = await setup(queues, {}, { fresh: true });
  const uid = 'fresh-profile';
  const started = await f.runtime.run({ uid, threadId: uid, text: 'Create a plan', lang: 'en' });
  assert.equal(started.status, 'awaiting_approval', JSON.stringify(started));
  const resumed = await f.runtime.resume({ uid, threadId: uid,
    decisions: [{ draftId: started.approval.drafts[0].id, decision: 'approve' }] });
  assert.equal(resumed.status, 'done', JSON.stringify(resumed));
  const saved = f.readState();
  assert.equal(saved._rev, 1);
  assert.deepEqual(saved.routines.map(r => r.name), ['New']);
  assert.equal(Object.values(saved.week).flat().length, 1);
});

// Live run 2026-11-07: paraphrasing a 3-day push/pull/legs proposal, the orchestrator added
// "every muscle twice a week". A proposal now reaches the user in the program agent's words.
test('a proposal is forwarded verbatim, not in the orchestrator\'s paraphrase', async () => {
  const queues = createQueues();
  queues.orchestrator[1] = call('finish', { text: 'This plan trains every muscle twice a week.', citations: [], claimsNeedCitation: false });
  queues.program[3] = call('submit_result', { agent: 'program_agent', kind: 'proposal',
    text: 'One full-body day, 31 minutes.', citations: ['check_plan: minutes'], claimsNeedCitation: true, clarifications: [] });
  const f = await setup(queues);
  const started = await f.runtime.run({ uid: 'forward', threadId: 'forward', text: 'Create a plan', lang: 'en' });
  assert.equal(started.status, 'awaiting_approval');
  assert.match(started.reply, /^One full-body day, 31 minutes\.\n\nPlease approve or reject this proposal\.$/);
  assert.doesNotMatch(started.reply, /twice/);
  // Tool names offered as citations do not trip the guard into replacing the proposal.
  assert.equal(f.model.calls.filter(c => c.agent === 'orchestrator').length, 2);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentRoutes } from '../../agent/routes.js';
test('auth, disabled and failed lazy import are guarded', async () => {
  const old = process.env.AGENT_ENABLED;
  try {
    for (const [user, enabled, expected] of [[null,'1',401],[{id:'u'},'',503],[{id:'u'},'1',503]]) {
      process.env.AGENT_ENABLED = enabled;
      const routes = agentRoutes({ json: (r,s,b) => Object.assign(r,{s,b}), readBody: async () => ({}), readSession: () => user, getRuntime: async () => { throw Error('secret'); } });
      const res = {};
      await routes['POST /api/coach/agent/messages']({},res);
      assert.equal(res.s,expected);
      assert.ok(!JSON.stringify(res).includes('secret'));
    }
  } finally { if (old === undefined) delete process.env.AGENT_ENABLED; else process.env.AGENT_ENABLED=old; }
});

const tick = () => new Promise(resolve => setImmediate(resolve));
function harness(rt) {
  process.env.AGENT_ENABLED = '1';
  const routes = agentRoutes({ json: (r,s,b) => Object.assign(r,{s,b}),
    readBody: async req => req.body, readSession: req => ({ id: req.uid || 'a' }),
    getRuntime: async () => rt });
  return async (key, body, uid = 'a') => {
    const res = {};
    await routes[key]({ body, uid, url: '/api/coach/agent/thread?id=t' }, res);
    return res;
  };
}
const message = 'POST /api/coach/agent/messages';
const thread = 'GET /api/coach/agent/thread';
const resume = 'POST /api/coach/agent/resume';
const cancel = 'POST /api/coach/agent/cancel';
const decisions = [{ draftId: 'd', decision: 'approve' }];
test('body validation rejects invalid messages and decisions', async () => {
  const request = harness({});
  for (const body of [{}, {text:''}, {text:'  '}, {text:'x'.repeat(2001)},
    {text:'hi',lang:'xx'}, {text:'hi',threadId:''}, {text:'hi',threadId:3},
    {text:'hi',threadId:'x'.repeat(201)}]) assert.equal((await request(message,body)).s,400);
  for (const body of [{}, {threadId:'t',decisions:[]},
    {threadId:'t',decisions:[{draftId:'d',decision:'oops'}]},
    {threadId:'t',decisions:[{draftId:'d',decision:'approve',acceptedChangeIds:[3]}]}])
    assert.equal((await request(resume,body)).s,400);
});
test('async lifecycle, busy, persisted approval, and resume conflict', async () => {
  let release;
  const approval = {drafts:[{id:'d',kind:'plan_create',summary:'Plan',diff:{}}]};
  let pending = false;
  const request = harness({
    run: () => new Promise(resolve => { release = () => { pending=true; resolve({status:'awaiting_approval',approval}); }; }),
    getThread: async () => ({messages:[],awaitingApproval:pending,approval:pending ? approval : undefined}),
    resume: async () => { pending=false; return {status:'done'}; }
  });
  assert.equal((await request(resume,{threadId:'t',decisions})).s,409);
  const accepted = await request(message,{text:'hi',threadId:'t'});
  assert.equal(accepted.s,202); assert.ok(accepted.b.runId); assert.equal(accepted.b.threadId,'t');
  assert.equal((await request(message,{text:'again'})).s,409);
  assert.equal((await request(thread)).b.status,'running');
  release(); await tick();
  assert.deepEqual((await request(thread)).b.approval,approval);
  assert.equal((await request(thread)).b.status,'awaiting_approval');
  assert.equal((await request(resume,{threadId:'t',decisions})).s,202);
  await tick();
  const done = (await request(thread)).b;
  assert.equal(done.status,'idle'); assert.equal(done.lastRun.status,'done');
  const restarted = harness({getThread:async()=>({messages:[],awaitingApproval:true,approval})});
  assert.deepEqual((await restarted(thread)).b.approval,approval);
});
test('foreign uid is passed to thread, resume lookup and cancel without owner data', async () => {
  const calls=[];
  const request=harness({
    run:async()=>({status:'awaiting_approval',approval:{drafts:[{id:'private'}]}}),
    getThread:async args=>{calls.push(args); return {messages:[],awaitingApproval:false};},
    cancel:args=>calls.push(args)
  });
  await request(message,{text:'hi',threadId:'t'}); await tick();
  const foreign=await request(thread,undefined,'b');
  assert.equal(foreign.b.lastRun,null); assert.ok(!JSON.stringify(foreign).includes('private'));
  assert.equal((await request(resume,{threadId:'t',decisions},'b')).s,409);
  await request(cancel,{threadId:'t'},'b');
  assert.deepEqual(calls,Array.from({length:3},()=>({uid:'b',threadId:'t'})));
});
test('runtime exceptions return sanitized 500 and log only the name', async () => {
  const logs=[]; const original=console.error;
  console.error=(...args)=>logs.push(args);
  try {
    const request=harness({getThread:async()=>{throw new TypeError('secret-api-key');}});
    assert.deepEqual(await request(thread),{s:500,b:{error:'agent request failed'}});
    assert.match(JSON.stringify(logs),/TypeError/); assert.ok(!JSON.stringify(logs).includes('secret'));
  } finally {console.error=original;}
});
test('draft listing includes only caller pending drafts', async () => {
  const {mkdtempSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');
  const db=await import('../../agent/db.js');
  db.setDefaultAgentDbPath(mkdtempSync(tmpdir()+'/routes-')+'/agent.db');
  for(const [id,uid,status] of [['a-p','a','pending'],['a-r','a','rejected'],['b-p','b','pending']])
    db.insertDraft({id,uid,status,kind:'plan_create',payload:{summary:id},diff:{}});
  const request=harness({});
  assert.deepEqual((await request('GET /api/coach/agent/drafts')).b.map(d=>d.id),['a-p']);
  assert.deepEqual((await request('GET /api/coach/agent/drafts',undefined,'b')).b.map(d=>d.id),['b-p']);
  db.closeAgentDb();
});

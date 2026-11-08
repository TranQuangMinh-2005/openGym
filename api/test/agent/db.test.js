import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tempData } from '../helpers.mjs';
const dir = tempData();
process.env.AGENT_DB_PATH = path.join(dir, 'agent.db');
const db = await import('../../agent/db.js');

test('migrations, permissions, JSON and usage', () => {
  const first = db.openAgentDb();
  assert.equal(db.openAgentDb(), first);
  assert.equal(fs.statSync(process.env.AGENT_DB_PATH).mode & 0o777, 0o600);
  db.insertDraft({ id: 'd', uid: 'u', kind: 'constraints', payload: { a: [1] }, diff: [] });
  assert.deepEqual(db.getDraft('d').payload, { a: [1] });
  db.setDraftStatus('d', 'approved');
  assert.equal(db.listDrafts('u', 'approved').length, 1);
  db.startRun({ id: 'r', uid: 'u' });
  db.addRunUsage('r', { promptTokens: 2, cost: 0.5 });
  db.addRunUsage('r', { promptTokens: 3, cost: 0.5 });
  assert.equal(db.getRun('r').prompt_tokens, 5);
  assert.equal(db.getRun('r').cost, 1);
  db.addEvent('r', 'first', 'node', { a: 1 });
  db.addEvent('r', 'second', 'node', []);
  assert.deepEqual(db.listEvents('r').map(e => e.type), ['first', 'second']);
  db.closeAgentDb();
  assert.equal(db.openAgentDb().prepare('SELECT * FROM schema_migrations').all().length, 3);
  db.closeAgentDb();

});

test('migrations apply versions 1 through 3 once across reopen', () => {
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(db.openAgentDb().prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(r => r.version), [1, 2, 3]);
    db.closeAgentDb();
  }
});
test('draft inserts reject unknown columns and invalid kind or status', () => {
  assert.throws(() => db.insertDraft({ id: 'bad', unknown: 1 }), /Unknown column/);
  assert.throws(() => db.insertDraft({ id: 'bad', kind: 'invalid' }), /CHECK/);
  assert.throws(() => db.insertDraft({ id: 'bad', kind: 'constraints', status: 'invalid' }), /CHECK/);
});
test('draft lists filter both owner and status', () => {
  db.insertDraft({ id: 'pending', uid: 'u', kind: 'constraints' });
  db.insertDraft({ id: 'other', uid: 'other', kind: 'constraints' });
  assert.deepEqual(db.listDrafts('u', 'pending').map(d => d.id), ['pending']);
});
test('plan versions are ordered by creation time and owner', () => {
  for (const [id, uid, created_at] of [['late', 'u', 20], ['early', 'u', 10], ['foreign', 'other', 1]]) db.insertPlanVersion({ id, uid, created_at, plan: { id } });
  assert.deepEqual(db.listPlanVersions('u').map(v => v.id), ['early', 'late']);
});

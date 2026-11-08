import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStateStore } from '../state-store.js';

test('shared state writer preserves CAS, stamping and failure isolation', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-store-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'state-u.json');
  const UNREADABLE = Symbol();
  const records = v => (Array.isArray(v) ? v.filter(x => !!x && typeof x === 'object' && !Array.isArray(x)) : []);
  const forClient = S => S;
  const store = createStateStore({ UNREADABLE, stateFile: () => file, stateCache: new Map(), records, forClient,
    readStateStrict: () => { try { return JSON.parse(fs.readFileSync(file)); } catch (e) { return e.code === 'ENOENT' ? null : UNREADABLE; } },
    atomicWrite: (f, text) => { fs.writeFileSync(f + '.tmp', text); fs.renameSync(f + '.tmp', f); },
    onWritten: () => { throw new Error('bookkeeping'); } });
  // No document yet: a commit that adds nothing is refused like an empty PUT, and leaves no file.
  assert.equal(store.commitState('u', () => {}).status, 400);
  assert.equal(fs.existsSync(file), false);
  assert.equal(store.writeState('u', {}).status, 400);
  assert.equal(store.writeState('u', { routines: [], active: {} }).ok, true);
  let doc = JSON.parse(fs.readFileSync(file));
  assert.equal(doc.active, undefined);
  assert.equal(store.writeState('u', { routines: [] }, { baseRev: 0 }).status, 409);
  assert.equal(store.writeState('u', { routines: [] }, { baseRev: doc._rev, baseWid: 'wrong' }).status, 409);
  assert.equal(store.writeState('u', { routines: [{ id: 'r', name: 'old' }] }).ok, true);
  doc = JSON.parse(fs.readFileSync(file));
  const before = fs.readFileSync(file, 'utf8');
  assert.equal(store.commitState('u', () => {}, { expectRev: -1 }).status, 409);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.throws(() => store.commitState('u', s => { s.routines = []; throw new Error('mutate'); }), /mutate/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.equal(store.commitState('u', s => { s.routines[0].name = 'new'; s.week = { mon: 'r' }; s.active = {}; }).ok, true);
  const changed = JSON.parse(fs.readFileSync(file));
  assert.ok(changed._rev > doc._rev);
  assert.ok(changed.routines[0]._ts);
  assert.ok(changed.edited);
  assert.equal(changed.active, undefined);
  fs.writeFileSync(file, '{');
  assert.equal(store.commitState('u', () => {}).status, 503);
  assert.equal(store.writeState('u', { routines: [] }).status, 503);
});

test('a first server-side commit creates the document of a profile that never synced', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-store-first-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'state-u.json');
  const UNREADABLE = Symbol();
  const store = createStateStore({ UNREADABLE, stateFile: () => file, stateCache: new Map(),
    records: v => (Array.isArray(v) ? v : []), forClient: S => S,
    readStateStrict: () => { try { return JSON.parse(fs.readFileSync(file)); } catch (e) { return e.code === 'ENOENT' ? null : UNREADABLE; } },
    atomicWrite: (f, text) => fs.writeFileSync(f, text) });
  const result = store.commitState('u', S => { S.routines = [{ id: 'r', name: 'A', ex: [] }]; S.week = { 1: ['r'] }; });
  assert.equal(result.ok, true);
  const doc = JSON.parse(fs.readFileSync(file));
  assert.equal(doc.routines[0].name, 'A');
  assert.equal(doc._rev, result.rev);
});

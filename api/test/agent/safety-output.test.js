import test from 'node:test';
import assert from 'node:assert/strict';
import { checkOutput } from '../../agent/safety/output-guard.js';
import { escalate, safetyResponse, pendingPainConstraint } from '../../agent/safety/input-guard.js';
const base = () => ({ retrieved: [], painRegions: [], hardConstraints: [], library: { get: () => ({ bp: 'shoulders', tg: 'delts', eq: 'dumbbell' }) } });
const proposal = { kind: 'proposal', text: '', citations: [], proposal: { routines: [{ ex: [{ id: 'x' }] }] } };
const has = (r, code) => assert.ok(r.violations.some(v => v.code === code), code);
test('citations and replacement', () => {
  const r = checkOutput({ kind: 'answer', text: '', citations: ['fake'], claimsNeedCitation: true }, base());
  has(r, 'citation_not_retrieved'); has(r, 'missing_citation');
  assert.equal(r.ok, false);
  assert.equal(r.sanitized.text, 'Mình chưa đủ căn cứ trong tài liệu để trả lời chắc chắn câu này.');
  const ctx = base(); ctx.retrieved = [{ id: 'a', status: 'placeholder' }];
  const warning = checkOutput({ kind: 'answer', citations: ['a'], claimsNeedCitation: true }, ctx);
  has(warning, 'placeholder_source'); assert.equal(warning.ok, true);
});
test('diagnosis, pain and progression', () => {
  has(checkOutput({ text: 'Bạn bị viêm gân' }, base()), 'diagnosis_language');
  const ctx = base(); ctx.painRegions = ['shoulder'];
  has(checkOutput(proposal, ctx), 'pain_region_exercise');
  has(checkOutput({ proposal: { changes: [{ type: 'weight', target: { exId: 'x' }, before: 10, after: 12 }] } }, ctx), 'pain_region_progression');
});
test('hard constraints and exceptions', () => {
  for (const [type, value] of [['avoid_exercise', { ids: ['x'] }], ['avoid_equipment', { equipment: ['dumbbell'] }], ['avoid_region', { regions: ['shoulder'] }]]) {
    const ctx = base(); ctx.hardConstraints = [{ type, value, strength: 'hard', status: 'pending' }];
    has(checkOutput(proposal, ctx), 'hard_constraint');
  }
  const ctx = base(); ctx.library.get = () => { throw Error('offline'); };
  assert.deepEqual(checkOutput(proposal, ctx), { ok: false, violations: [{ code: 'guard_error' }] });
});
test('escalation, fixed replies and pending ledger', () => {
  const levels = ['none', 'caution', 'red_flag'];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) assert.equal(escalate({ level: levels[i] }, levels[j]), levels[Math.max(i, j)]);
  for (const lang of ['vi', 'en']) for (const matches of [[], [{ category: 'urgent' }]]) {
    const text = safetyResponse({ lang, regions: ['shoulder'], matches });
    assert.equal(checkOutput({ text }, base()).ok, true);
    assert.doesNotMatch(text, /substitut|alternative|thay thế|rehab|phục hồi/i);
    assert.match(text, /doctor|bác sĩ/);
  }
  const entry = pendingPainConstraint({ regions: ['shoulder'], matches: [], text: 'x'.repeat(300), at: 'now' });
  assert.equal(entry.type, 'avoid_region'); assert.equal(entry.strength, 'hard');
  assert.equal(entry.status, 'pending'); assert.equal(entry.source.text.length, 200);
  assert.equal(entry.source.at, 'now'); assert.deepEqual(entry.value.regions, ['shoulder']);
  assert.ok(entry.id);
});
test('clarifying questions and ordinary encouragement pass', () => {
 for (const text of ['Bạn bị đau ở vị trí nào, đau nhói hay mỏi?', 'bạn bị đau ở đâu?', 'you have a great plan']) assert.equal(checkOutput({kind:'clarification',text},base()).ok,true);
 for (const text of ['you have a sprain','Bạn bị trật khớp','rehab protocol']) has(checkOutput({kind:'clarification',text},base()),'diagnosis_language');
});

test('regional red flag requests confirmation without diagnosis', () => {
  for (const lang of ['vi', 'en']) {
    const text = safetyResponse({ lang, regions: ['shoulder'] });
    assert.match(text, lang === 'vi' ? /vai.*xác nhận/s : /shoulder.*confirm/s);
    assert.equal(checkOutput({ text }, base()).violations.some(v => v.code === 'diagnosis_language'), false);
  }
});

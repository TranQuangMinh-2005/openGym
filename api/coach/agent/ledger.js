import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const strings = z.array(z.string().min(1));
const values = {
  available_equipment: z.object({ equipment: strings }),
  avoid_equipment: z.object({ equipment: strings }),
  avoid_exercise: z.object({ ids: strings }),
  avoid_region: z.object({ regions: strings }),
  max_session_minutes: z.object({ minutes: z.number().int().min(10).max(240), weekdays: z.array(z.number().int().min(0).max(6)).min(1).optional() }),
  days_per_week: z.object({ days: z.number().int().min(1).max(7) }),
  priority_muscles: z.object({ muscles: strings }),
  goal: z.object({ goal: z.enum(['hypertrophy', 'fat_loss_keep_muscle', 'recomp']) }),
  experience: z.object({ level: z.enum(['beginner', 'intermediate', 'advanced']) }),
  preference: z.object({ text: z.string().max(300) })
};
export const ChangeSchema = z.discriminatedUnion('type', Object.entries(values).map(([type, value]) => z.object({ type: z.literal(type), value, op: z.enum(['add', 'set', 'remove']).optional(), kind: z.enum(['chat', 'safety']).optional(), strength: z.enum(['hard', 'soft']), sourceText: z.string().optional() })));
export const readLedger = S => structuredClone(S?.coach?.ledger || []);
const additive = new Set(['avoid_exercise', 'avoid_equipment', 'avoid_region', 'priority_muscles', 'preference']);
const scope = e => e.type + ':' + (e.type === 'max_session_minutes' ? [...(e.value.weekdays || [])].sort().join(',') : '');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function effectiveConstraints(S) {
  const latest = new Map();
  for (const e of readLedger(S).filter(e => e.status === 'active')) {
    const previous = latest.get((additive.has(e.type) ? e.id : scope(e)));
    if (!previous || String(e.updatedAt) >= String(previous.updatedAt)) latest.set(additive.has(e.type) ? e.id : scope(e), e);
  }
  return [...latest.values()];
}
export function detectConflicts(entries) {
  const conflicts = [];
  const live = entries.filter(e => ['active', 'pending'].includes(e.status));
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j];
    if (a.op === 'remove' || b.op === 'remove') continue;
    if (a.supersedes === b.id || b.supersedes === a.id) continue;
    let reason;
    if (!additive.has(a.type) && !additive.has(b.type) && scope(a) === scope(b) && !equal(a.value, b.value)) reason = 'Different values for the same scope';
    if ([a.type, b.type].includes('avoid_equipment') && [a.type, b.type].includes('available_equipment') && a.value.equipment.some(x => b.value.equipment.includes(x))) reason = 'Equipment is both available and avoided';
    if (reason) conflicts.push({ a: a.id, b: b.id, reason });
  }
  return conflicts;
}
export function stageChanges(S, proposed, { now = Date.now() } = {}) {
  const active = effectiveConstraints(S);
  const at = new Date(now).toISOString();
  const entries = proposed.map(input => {
    const p = ChangeSchema.parse(input);
    const op = p.op || (additive.has(p.type) ? 'add' : 'set');
    const old = op === 'set' && !additive.has(p.type) && active.find(e => scope(e) === scope(p));
    return { id: randomUUID(), type: p.type, op, value: p.value, strength: p.strength, source: { kind: p.kind || 'chat', ...(p.sourceText === undefined ? {} : { text: p.sourceText }), at }, status: 'pending', ...(old ? { supersedes: old.id } : {}), createdAt: at, updatedAt: at };
  });
  return { entries, conflicts: detectConflicts([...active, ...entries]) };
}
export function pendingFromDrafts(drafts = []) {
  return structuredClone(drafts.filter(d => d.kind === 'constraints' && d.status === 'pending')
    .flatMap(d => d.payload?.entries || []));
}
export function commitLedger(S, entries, decision, { now = Date.now() } = {}) {
  if (!['approve', 'reject'].includes(decision)) throw new Error('Invalid ledger decision');
  if (decision === 'reject') return [];
  S.coach ||= {};
  S.coach.ledger ||= [];
  const ledger = S.coach.ledger;
  const changed = new Set();
  const at = new Date(now).toISOString();
  for (const entry of entries) {
    const e = structuredClone(entry);
    if (ledger.some(x => x.id === e.id)) continue;
    for (const old of ledger) {
      if (old.status !== 'active' || old.type !== e.type) continue;
      const matches = Object.entries(e.value).every(([key, value]) =>
        Array.isArray(value) ? value.some(v => old.value[key]?.includes(v)) : equal(value, old.value[key]));
      if (e.op === 'remove' ? matches : !additive.has(e.type) && scope(old) === scope(e)) {
        old.status = e.op === 'remove' ? 'withdrawn' : 'superseded';
        old.updatedAt = at;
        changed.add(old.id);
      }
    }
    e.status = e.op === 'remove' ? 'withdrawn' : 'active';
    e.updatedAt = at;
    ledger.push(e);
    changed.add(e.id);
  }
  return [...changed];
}

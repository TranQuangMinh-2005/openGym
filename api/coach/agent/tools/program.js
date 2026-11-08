import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { canonicalPlan, build } from '../../core/payload.js';
import { validatePlan, validateReview } from '../../core/validate.js';
import { applyChangeSetServer } from '../../core/apply.js';
import { hashPlan } from '../../core/plan-hash.js';
import { LIBRARY } from '../../core/library.js';
import { details, DETAILS_BY_ID } from '../kb.js';
import { search_exercises } from './exercises.js';
import { effectiveConstraints } from '../ledger.js';
import { regionCatalogue } from '../safety/lexicon.js';
import { insertDraft } from '../db.js';

const hits = (e, regions) => regions.some(r => regionCatalogue[r]?.bp.includes(e?.bp) || regionCatalogue[r]?.tg.includes(e?.tg));
const constraints = (S, ctx) => [...effectiveConstraints(S), ...(ctx.pendingConstraints || []).filter(e => e.type === 'avoid_region' && e.op !== 'remove')];
const equipmentOf = S => effectiveConstraints(S).find(e => e.type === 'available_equipment')?.value.equipment ?? build(S, { handle: 'agent' }).coachProfile?.equipment ?? [];
function violates(e, c) {
  return (c.type === 'avoid_exercise' && c.value.ids.includes(e.id))
    || (c.type === 'avoid_equipment' && c.value.equipment.includes(e.eq))
    || (c.type === 'available_equipment' && c.value.equipment.length && !c.value.equipment.includes(e.eq))
    || (c.type === 'avoid_region' && hits(e, c.value.regions));
}
export function estimateMinutes(routine) {
  return Math.ceil(5 + (routine.ex || []).reduce((sum, e) => {
    const rest = e.reps <= 6 ? 150 : e.reps <= 12 ? 90 : 60;
    return sum + (e.mode === 'cardio' ? (e.min || 0) * 60 : (e.sets || 0) * ((e.mode === 'time' ? e.sec || 0 : 40) + rest));
  }, 0) / 60);
}
export const get_current_plan = {
  name: 'get_current_plan',
  description: 'Read the canonical current plan, weekday schedule and catalogue exercise names with routine membership before editing.',
  schema: z.object({}),
  async run(args, ctx) {
    get_current_plan.schema.parse(args);
    const S = await ctx.readState(ctx.uid);
    const plan = canonicalPlan(S);
    const ids = [...new Set(plan.routines.flatMap(r => r.ex.map(e => e.id)))];
    return { ...plan, exercises: ids.map(id => ({ id, name: DETAILS_BY_ID.get(id)?.n || S.customEx?.find(e => e.id === id)?.n || id, routines: plan.routines.filter(r => r.ex.some(e => e.id === id)).map(r => ({ id: r.id, name: r.name })) })) };
  }
};
export const find_alternatives = {
  name: 'find_alternatives',
  description: 'Find same-target catalogue substitutes, ranked by body part and movement name, excluding unavailable equipment and hard or pending pain restrictions. Returns reasons for each match.',
  schema: z.object({ exerciseId: z.string(), equipment: z.array(z.string()).optional(), excludeIds: z.array(z.string()).optional(), limit: z.number().int().min(1).max(10).default(5) }),
  async run(args, ctx) {
    const a = find_alternatives.schema.parse(args);
    const S = await ctx.readState(ctx.uid);
    const source = DETAILS_BY_ID.get(a.exerciseId);
    if (!source) return { error: `Unknown exercise id: ${a.exerciseId}` };
    const equipment = a.equipment ?? equipmentOf(S);
    const ranked = search_exercises.run({ query: source.n, target: source.tg, limit: 25 }, ctx);
    const ranks = new Map((Array.isArray(ranked) ? ranked : []).map((e, i) => [e.id, 25 - i]));
    return details.filter(e => e.tg === source.tg && e.id !== source.id && !a.excludeIds?.includes(e.id)
      && (!equipment.length || equipment.includes(e.eq)) && !constraints(S, ctx).some(c => c.strength === 'hard' && violates(e, c)))
      .sort((a, b) => ((b.bp === source.bp ? 100 : 0) + (ranks.get(b.id) || 0)) - ((a.bp === source.bp ? 100 : 0) + (ranks.get(a.id) || 0)) || a.id.localeCompare(b.id))
      .slice(0, a.limit).map(e => ({ id: e.id, name: e.n, bp: e.bp, tg: e.tg, eq: e.eq, why: `Same target: ${e.tg}${e.bp === source.bp ? '; same body part' : ''}${ranks.has(e.id) ? '; similar movement name' : ''}` }));
  }
};
// Numbers the agents may quote about a plan, computed from the plan itself so a summary cannot
// invent them (live run 2026-11-07: a 3-day push/pull/legs plan was described as training every
// muscle twice a week). Counted by each exercise's primary target muscle.
export function planFacts(plan, S = {}) {
  const routines = new Map(plan.routines.map(r => [r.id, r]));
  const days = Object.entries(plan.week || {}).map(([day, ids]) => [Number(day), [].concat(ids ?? []).filter(id => routines.has(id))]).filter(([, ids]) => ids.length);
  const muscles = {};
  for (const [, ids] of days) {
    const trainedToday = new Set();
    for (const id of ids) for (const ex of routines.get(id).ex || []) {
      const target = (DETAILS_BY_ID.get(ex.id) || S.customEx?.find(e => e.id === ex.id))?.tg || 'unknown';
      muscles[target] ??= { sessionsPerWeek: 0, setsPerWeek: 0 };
      muscles[target].setsPerWeek += ex.sets || 0;
      trainedToday.add(target);
    }
    for (const target of trainedToday) muscles[target].sessionsPerWeek += 1;
  }
  return { trainingDaysPerWeek: days.length, minutesByRoutine: Object.fromEntries(plan.routines.map(r => [r.name || r.id, estimateMinutes(r)])), byPrimaryMuscle: muscles };
}
const input = z.object({ plan: z.object({}).passthrough().optional(), changes: z.array(z.object({}).passthrough()).optional() }).refine(a => (a.plan !== undefined) !== (a.changes !== undefined), 'Provide exactly one of plan or changes');
async function check(args, ctx, S) {
  const a = input.parse(args);
  const current = canonicalPlan(S);
  const payload = build(S, { handle: 'agent' });
  const validatorCtx = { customIds: (S.customEx || []).map(e => e.id), equipment: equipmentOf(S), offered: new Set(LIBRARY.map(e => e.id)), workingWeights: payload.history?.workingWeights, daysPerWeek: effectiveConstraints(S).find(e => e.type === 'days_per_week')?.value.days ?? payload.coachProfile?.daysPerWeek };
  const validated = a.plan ? validatePlan(a.plan, validatorCtx) : validateReview({ changes: a.changes }, current, validatorCtx);
  if (!validated.ok) return { ok: false, errors: validated.errors, warnings: [], minutesByRoutine: {} };
  let plan = validated.bundle;
  if (!a.plan) {
    const copy = structuredClone(S);
    const proposal = validated.proposal || validated;
    // Only to see the resulting plan: the ids and labels this throwaway apply mints are discarded.
    applyChangeSetServer(copy, proposal, (proposal.changes || []).map(c => c.id), { now: ctx.now ?? Date.now(), newId: () => randomUUID().slice(0, 8) });
    plan = canonicalPlan(copy);
  }
  const errors = [];
  const warnings = [];
  const existingViolations = [];
  const minutesByRoutine = Object.fromEntries(plan.routines.map(r => [r.id, estimateMinutes(r)]));
  for (const c of constraints(S, ctx)) {
    const out = c.strength === 'hard' || c.status === 'pending' ? errors : warnings;
    for (const r of plan.routines) for (const ex of r.ex) {
      const e = DETAILS_BY_ID.get(ex.id) || S.customEx?.find(e => e.id === ex.id) || ex;
      if (!a.plan && c.type === 'avoid_region' && violates(e, c)) {
        const old = current.routines.find(x => x.id === r.id)?.ex.find(x => x.id === ex.id);
        if (old && ['weight', 'sets', 'reps', 'repsMin', 'repsMax'].some(k => ex[k] > (old[k] ?? 0))) {
          errors.push('pain_region_progression: ' + ex.id);
        }
      }
      if (!a.plan && violates(e, c) && (c.strength === 'hard' || c.type === 'avoid_region')) {
        const message = r.id + ': ' + ex.id + ' violates ' + c.type + '; remove or swap it in this edit';
        errors.push(message);
        if (current.routines.some(x => x.id === r.id && x.ex.some(y => y.id === ex.id))) existingViolations.push(message);
      } else if (violates(e, c)) out.push(`${r.id}: ${ex.id} violates ${c.type}`);
    }
    const days = Object.entries(plan.week || {}).filter(([, ids]) => [].concat(ids).length);
    if (c.type === 'days_per_week' && days.length !== c.value.days) out.push(`Schedule must have ${c.value.days} days per week`);
    if (c.type === 'max_session_minutes') for (const [day, ids] of days) {
      if (c.value.weekdays && !c.value.weekdays.includes(Number(day))) continue;
      const minutes = [].concat(ids).reduce((sum, id) => sum + (minutesByRoutine[id] || 0), 0);
      if (minutes > c.value.minutes) out.push(`Weekday ${day}: ${minutes} minutes exceeds ${c.value.minutes}`);
    }
  }
  return { ok: !errors.length, errors, warnings, existingViolations, minutesByRoutine, facts: planFacts(plan, S), plan, validated };
}
export const check_plan = {
  name: 'check_plan',
  description: 'Validate exactly one creation bundle or review change list against the current plan, catalogue, constraints, pain regions and session duration. Returns verbatim validator errors for repair, warnings, routine minutes and facts (training days, sets and sessions per week by primary muscle) — quote only these numbers.',
  schema: input,
  async run(args, ctx) {
    const { plan, validated, ...result } = await check(args, ctx, await ctx.readState(ctx.uid));
    return result;
  }
};
export const propose_plan = {
  name: 'propose_plan',
  description: 'Validate and store a plan draft for approval without changing user state. Returns draft id, before/after diff, minutes and warnings, or repair errors.',
  schema: z.object({ mode: z.enum(['create', 'edit']), plan: z.object({}).passthrough().optional(), changes: z.array(z.object({}).passthrough()).optional(), summary: z.string(), rationale: z.array(z.string()) }).refine(a => a.mode === 'create' ? a.plan !== undefined && a.changes === undefined : a.changes !== undefined && a.plan === undefined),
  async run(args, ctx) {
    const a = propose_plan.schema.parse(args);
    const S = await ctx.readState(ctx.uid);
    const before = canonicalPlan(S);
    // Ablation only: noCheck bypasses validation, while preserving draft-only writes.
    const checked = ctx.flags?.noCheck === true ? { ok: true, warnings: [], minutesByRoutine: {} } : await check({ plan: a.plan, changes: a.changes }, ctx, S);
    if (!checked.ok) return { ok: false, errors: checked.errors };
    const after = checked.plan || a.plan || before;
    const diff = { routines: [...new Set([...before.routines, ...after.routines].map(r => r.id))].map(id => ({ id, before: before.routines.find(r => r.id === id) || null, after: after.routines.find(r => r.id === id) || null })), week: { before: before.week, after: after.week } };
    const draftId = randomUUID();
    const payload = { summary: a.summary, rationale: a.rationale, facts: checked.facts, ...(a.mode === 'create' ? { bundle: checked.validated?.bundle || a.plan } : { changes: checked.validated?.proposal?.changes || a.changes }) };
    insertDraft({ id: draftId, uid: ctx.uid, thread_id: ctx.threadId, kind: a.mode === 'create' ? 'plan_create' : 'plan_edit', payload, diff, base_rev: S._rev || 0, base_hash: hashPlan(before) });
    return { ok: true, draftId, diff, minutesByRoutine: checked.minutesByRoutine, facts: checked.facts, warnings: checked.warnings };
  }
};
export const isDraftStale = (S, draft) => hashPlan(canonicalPlan(S)) !== draft.base_hash;

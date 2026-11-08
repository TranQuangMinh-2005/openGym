import { z } from 'zod';
import { isWarmupSet, reviewWindow, stallCount } from '../../coach/core/payload.js';
import { LIB_BY_ID } from '../../coach/core/library.js';
import { estimate1RM, formulaOf } from './onerm.js';
export { estimate1RM } from './onerm.js';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const present = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null));
export const get_workout_history = {
  name: 'get_workout_history',
  description: 'Read raw logged workouts before discussing recent training. Filter by exercise and inclusive dates; returns newest sessions first with logged sets and notes.',
  schema: z.object({ exerciseId: z.string().optional(), from: day.optional(), to: day.optional(), limit: z.number().int().min(1).max(50).default(20) }),
  async run(args, ctx) {
    const a = this.schema.parse(args);
    const S = await ctx.readState(ctx.uid);
    return (S.workouts || []).filter(w => (!a.from || w.d >= a.from) && (!a.to || w.d <= a.to) && (!a.exerciseId || w.entries?.some(e => e.id === a.exerciseId))).slice().sort((a, b) => b.d.localeCompare(a.d)).slice(0, a.limit).map(w => present({
      date: w.d,
      name: w.name,
      notes: w.notes ?? w.note,
      exercises: (w.entries || []).filter(e => !a.exerciseId || e.id === a.exerciseId).map(e => present({ id: e.id, name: e.name ?? LIB_BY_ID.get(e.id)?.n, sets: (e.sets || []).map(s => present({ reps: s.r, weight: s.w, unit: s.unit ?? e.unit ?? w.unit, rir: s.rir, effort: s.rpe, done: s.done, warmup: isWarmupSet(s) || undefined })) }))
    }));
  }
};

export const weekOf = date => {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
};
export const get_progress_metrics = {
  name: 'get_progress_metrics',
  description: 'Review exercise progress before changing a plan. Returns estimated strength trends, best sets, consecutive stalled weeks, weekly completed working sets by target muscle, effort averages and missing-data gaps. Warm-ups are excluded.',
  schema: z.object({ exerciseIds: z.array(z.string()).optional(), weeks: z.number().int().min(1).max(12).default(8) }),
  async run(args, ctx) {
    const a = this.schema.parse(args);
    const S = await ctx.readState(ctx.uid);
    const now = new Date(ctx.now ?? Date.now());
    const from = new Date(now.getTime() - a.weeks * 7 * 86400000).toISOString().slice(0, 10);
    const workouts = reviewWindow(S, from).filter(w => w.d <= now.toISOString().slice(0, 10)).sort((a, b) => a.d.localeCompare(b.d));
    const groups = new Map((a.exerciseIds || []).map(id => [id, []]));
    const weeklyHardSets = {};
    for (const w of workouts) {
      for (const e of w.entries || []) {
        if (a.exerciseIds && !a.exerciseIds.includes(e.id)) continue;
        const sets = (e.sets || []).filter(s => s.done && !isWarmupSet(s));
        if (!sets.length) continue;
        if (!groups.has(e.id)) groups.set(e.id, []);
        groups.get(e.id).push({ date: w.d, sets, target: e.target });
        const muscle = LIB_BY_ID.get(e.id)?.tg;
        if (muscle) {
          const week = weekOf(w.d);
          weeklyHardSets[week] ||= {};
          weeklyHardSets[week][muscle] = (weeklyHardSets[week][muscle] || 0) + sets.length;
        }
      }
    }
    const exercises = [...groups].map(([id, sessions]) => {
      const trend = [];
      const rir = [];
      const effort = [];
      const gaps = new Set();
      const graded = [];
      let bestSet;
      for (const session of sessions) {
        let best;
        for (const s of session.sets) {
          if (s.w == null) gaps.add('weight');
          if (s.r == null) gaps.add('reps');
          if (s.rir != null) rir.push(Number(s.rir));
          if (s.rpe != null) effort.push(Number(s.rpe));
          const est = estimate1RM(s.w, s.r, formulaOf(S), s.rir);
          if (est != null && (!best || est > best.e1RM)) best = present({ date: session.date, reps: s.r, weight: s.w, unit: s.unit, e1RM: est });
        }
        if (best) {
          trend.push(best);
          if (!bestSet || best.e1RM > bestSet.e1RM) bestSet = best;
        }
        if (session.target?.reps) graded.push({ date: session.date, ok: session.sets.length >= (session.target.sets || 1) && session.sets.every(s => s.r >= session.target.reps) });
        else gaps.add('target');
      }
      if (!rir.length) gaps.add('rir');
      if (!effort.length) gaps.add('effort');
      if (!trend.length) gaps.add('e1RM');
      const misses = stallCount(graded);
      return present({ id, name: LIB_BY_ID.get(id)?.n, e1RMTrend: trend, bestSet, sessionCount: sessions.length, stallWeeks: graded.length ? new Set(graded.slice(graded.length - misses).map(s => weekOf(s.date))).size : undefined, averageRIR: rir.length ? rir.reduce((a, b) => a + b, 0) / rir.length : undefined, averageEffort: effort.length ? effort.reduce((a, b) => a + b, 0) / effort.length : undefined, gaps: [...gaps] });
    });
    return { exercises, weeklyHardSets };
  }
};

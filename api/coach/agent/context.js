import { librarySlice, LIB_BY_ID } from '../core/library.js';
import { validValues } from './tools/exercises.js';
import { z } from 'zod';
import { effectiveConstraints } from './ledger.js';
import { canonicalPlan, build } from '../core/payload.js';
import { get_progress_metrics, get_workout_history, weekOf } from './tools/progress.js';

export const ProgramContextSchema = z.object({
  library: z.array(z.object({ id: z.string(), n: z.string().optional(), bp: z.string().optional(), tg: z.unknown(), eq: z.unknown() })),
  profile: z.record(z.string(), z.unknown()),
  goal: z.string().min(1).optional(),
  experience: z.string().min(1).optional(),
  daysPerWeek: z.number().int().min(1).max(7).optional(),
  sessionMinutes: z.object({ default: z.number().positive().optional(), byWeekday: z.record(z.string(), z.number().positive()) }),
  equipment: z.array(z.string()).optional(),
  constraints: z.array(z.unknown()),
  pendingConstraints: z.array(z.unknown()),
  painRegions: z.array(z.string()),
  currentPlan: z.object({}).passthrough(),
  history: z.object({ sessionsPerWeek: z.record(z.string(), z.number()), lastPerformance: z.array(z.unknown()) }),
  progress: z.object({ exercises: z.array(z.unknown()), weeklyHardSets: z.record(z.string(), z.unknown()) })
});

export async function buildProgramContext({ S, now = Date.now(), pendingConstraints = [], cfg = {} }) {
  const profile = { ...(S.coach?.profile || {}), equipment: build(S, { handle: 'agent' }).coachProfile?.equipment };
  const constraints = effectiveConstraints(S);
  const sessionMinutes = { ...(profile.sessionMin != null ? { default: profile.sessionMin } : {}), byWeekday: {} };
  for (const e of constraints) {
    if (e.type === 'goal') profile.goal = e.value.goal;
    if (e.type === 'experience') profile.experience = e.value.level;
    if (e.type === 'days_per_week') profile.daysPerWeek = e.value.days;
    if (e.type === 'available_equipment') profile.equipment = e.value.equipment;
    if (e.type === 'max_session_minutes') {
      if (e.value.weekdays) {
        for (const d of e.value.weekdays) sessionMinutes.byWeekday[d] = e.value.minutes;
      } else sessionMinutes.default = e.value.minutes;
    }
  }
  const ctx = { uid: '', readState: async () => S, now };
  const from = new Date(new Date(now).getTime() - 28 * 86400000).toISOString().slice(0, 10);
  const sessions = await get_workout_history.run({ from, to: new Date(now).toISOString().slice(0, 10), limit: 50 }, ctx);
  const sessionsPerWeek = {};
  const last = new Map();
  for (const session of sessions) {
    const week = weekOf(session.date);
    sessionsPerWeek[week] = (sessionsPerWeek[week] || 0) + 1;
    for (const e of session.exercises) {
      if (!last.has(e.id)) last.set(e.id, { date: session.date, ...e });
    }
  }
  const equipmentFilter = profile.equipment?.filter(e => validValues.equipment.includes(e));
  const context = {
    library: librarySlice(S, equipmentFilter?.length ? equipmentFilter : undefined, { keep: (S.routines ?? []).flatMap(r => (r.ex ?? []).map(e => e.id)), max: cfg.programLibraryMax ?? 120 }).map(e => {
      const detail = LIB_BY_ID.get(e.id);
      return { id: e.id, n: e.n, bp: e.bp, tg: detail?.tg ?? null, eq: detail?.eq ?? 'custom' };
    }),
    profile,
    ...(profile.goal ? { goal: profile.goal } : {}),
    ...(profile.experience ? { experience: profile.experience } : {}),
    ...(profile.daysPerWeek != null ? { daysPerWeek: profile.daysPerWeek } : {}),
    sessionMinutes,
    ...(profile.equipment != null ? { equipment: profile.equipment } : {}),
    constraints,
    pendingConstraints,
    painRegions: [...new Set([...constraints, ...pendingConstraints].filter(e => e.type === 'avoid_region').flatMap(e => e.value.regions))],
    currentPlan: canonicalPlan(S),
    history: { sessionsPerWeek, lastPerformance: [...last.values()] },
    progress: await get_progress_metrics.run({}, ctx)
  };
  const questions = {
    goal: ['Mục tiêu tập luyện của bạn là gì?', 'What is your training goal?'],
    experience: ['Bạn có kinh nghiệm tập luyện thế nào?', 'What is your training experience?'],
    daysPerWeek: ['Bạn tập được mấy ngày mỗi tuần?', 'How many days per week can you train?'],
    sessionMinutes: ['Bạn có bao nhiêu phút mỗi buổi?', 'How many minutes can you train per session?'],
    equipment: ['Bạn có những dụng cụ nào?', 'What equipment is available?']
  };
  const missing = Object.entries(questions).filter(([field]) => field === 'sessionMinutes' ? sessionMinutes.default == null && Object.keys(sessionMinutes.byWeekday).length < 7 : context[field] == null).map(([field, [question_vi, question_en]]) => ({ field, reason: 'Not provided', question_vi, question_en }));
  return { ok: ProgramContextSchema.safeParse(context).success, context, missing };
}

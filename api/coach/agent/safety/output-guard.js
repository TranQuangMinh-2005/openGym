import { fold } from './normalize.js';
import { bounded } from './input-guard.js';
import { diagnosisPatterns, regionCatalogue } from './lexicon.js';

export function checkOutput(result, ctx) {
  try {
    const violations = [];
    const add = (code, detail) => violations.push({ code, detail });
    const retrieved = new Map(ctx.retrieved.map(c => [c.id, c]));
    const valid = (result.citations ?? []).filter(id => retrieved.has(id));
    for (const id of result.citations ?? []) {
      if (!retrieved.has(id)) add('citation_not_retrieved', id);
      else if (retrieved.get(id).status === 'placeholder') add('placeholder_source', id);
    }
    let sanitized;
    if (result.kind === 'answer' && result.claimsNeedCitation && !valid.length) {
      add('missing_citation', 'No retrieved citation.');
      sanitized = { ...result, text: ctx.lang === 'en'
        ? 'I do not have enough evidence in the documents to answer this confidently.'
        : 'Mình chưa đủ căn cứ trong tài liệu để trả lời chắc chắn câu này.' };
    }
    // Inspect nested proposal descriptions as well as the visible answer.
    const inspect = value => {
      if (typeof value === 'string') {
        if (diagnosisPatterns.some(p => bounded(p).test(fold(value)))) add('diagnosis_language', value);
      } else if (value && typeof value === 'object') Object.values(value).forEach(inspect);
    };
    inspect(result);
    const constraints = (ctx.hardConstraints ?? []).filter(c => c.strength === 'hard' && !['rejected', 'inactive', 'superseded', 'resolved'].includes(c.status));
    const hits = (exercise, regions) => regions.some(r => {
      const map = regionCatalogue[r];
      return map && (map.bp.includes(exercise.bp) || map.tg.includes(exercise.tg));
    });
    const check = (id, progression = false) => {
      const exercise = ctx.library.get(id);
      if (!exercise) throw new Error('Unknown exercise');
      if (hits(exercise, ctx.painRegions ?? [])) add(progression ? 'pain_region_progression' : 'pain_region_exercise', id);
      for (const c of constraints) {
        if ((c.type === 'avoid_exercise' && c.value.ids.includes(id))
          || (c.type === 'avoid_equipment' && c.value.equipment.includes(exercise.eq))
          || (c.type === 'avoid_region' && hits(exercise, c.value.regions))) add('hard_constraint', id);
      }
    };
    for (const r of result.proposal?.routines ?? []) for (const e of r.ex) check(e.id);
    for (const c of result.proposal?.changes ?? []) {
      const id = c.target?.exId ?? c.exerciseId ?? c.after?.id;
      const field = c.type ?? c.field;
      const increasing = ['weight', 'sets', 'reps', 'repsMin', 'repsMax', 'inc'].includes(field)
        && (typeof c.before !== 'number' || c.after > c.before);
      if (id && (increasing || ['add-exercise', 'swap-exercise'].includes(field))) check(id, increasing);
      if (c.type === 'add-routine') for (const e of c.after.ex) check(e.id);
    }
    return { ok: !violations.some(v => v.code !== 'placeholder_source'), violations, ...(sanitized ? { sanitized } : {}) };
  } catch {
    return { ok: false, violations: [{ code: 'guard_error' }] };
  }
}

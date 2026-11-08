import { z } from 'zod';
import { details, DETAILS_BY_ID, ensureIndexes, matchQuery } from '../kb.js';
import { openAgentDb } from '../db.js';
import { LIB_BY_ID } from '../../coach/core/library.js';
const fields = { bodyPart: 'bp', target: 'tg', equipment: 'eq' };
export const validValues = Object.fromEntries(
  Object.entries(fields).map(([k, v]) => [k, [...new Set(details.map((e) => e[v]))].sort()])
);
const summary = (e) => ({ id: e.id, name: e.n, bp: e.bp, tg: e.tg, eq: e.eq, cat: e.cat });
export const search_exercises = {
  name: 'search_exercises',
  description:
    'Find catalogue exercises by name or muscle and optional exact catalogue filters. Returns ids and taxonomy for planning. Unknown filters return validValues so you can correct the request. Exclude ids already selected.',
  schema: z.object({
    query: z.string().max(300).optional(),
    bodyPart: z.string().optional(),
    target: z.string().optional(),
    equipment: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(25).default(10),
    excludeIds: z.array(z.string()).optional()
  }),
  run(args, ctx = {}) {
    const a = search_exercises.schema.parse(args),
      db = ctx.db || openAgentDb();
    ensureIndexes(db);
    const clauses = [],
      params = [];
    for (const [key, column] of Object.entries(fields)) {
      const values = key === 'equipment' ? a[key] : a[key] === undefined ? [] : [a[key]];
      for (const value of values || [])
        if (!validValues[key].some((v) => v.toLowerCase() === value.toLowerCase()))
          return { error: `Unknown ${key}: ${value}. validValues: ${JSON.stringify(validValues[key])}`, validValues };
      if (values?.length) {
        clauses.push(
          `${{ bp: 'body_part', tg: 'target', eq: 'equipment' }[column]} IN (${values.map(() => '?').join(',')})`
        );
        params.push(...values.map((v) => v.toLowerCase()));
      }
    }
    if (a.excludeIds?.length) {
      clauses.push(`id NOT IN (${a.excludeIds.map(() => '?').join(',')})`);
      params.push(...a.excludeIds);
    }
    if (a.query) {
      const match = matchQuery(a.query);
      if (!match) return [];
      clauses.push('exercise_fts MATCH ?');
      params.push(`{name target secondary} : (${match})`);
    }
    const rows = db
      .prepare(
        `SELECT id FROM exercise_fts ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''} ORDER BY ${
          a.query ? 'bm25(exercise_fts),' : ''
        } id LIMIT ?`
      )
      .all(...params, a.limit);
    return rows.map((r) => summary(DETAILS_BY_ID.get(r.id)));
  }
};
export const get_exercise = {
  name: 'get_exercise',
  description:
    'Read a catalogue exercise by id before giving technique guidance. Returns full instructions, secondary muscles and library fields. An unknown id returns suggested catalogue names; use search_exercises to locate a valid id.',
  schema: z.object({ id: z.string().min(1).max(300) }),
  run(args, ctx = {}) {
    const { id } = get_exercise.schema.parse(args),
      e = DETAILS_BY_ID.get(id);
    if (!e)
      return { error: `Unknown exercise id: ${id}`, suggestions: search_exercises.run({ query: id, limit: 5 }, ctx) };
    return {
      ...LIB_BY_ID.get(id),
      ...e,
      name: e.n,
      bodyPart: e.bp,
      target: e.tg,
      equipment: e.eq,
      secondaryMuscles: e.sm,
      category: e.cat,
      description: e.d,
      instructions: e.st
    };
  }
};

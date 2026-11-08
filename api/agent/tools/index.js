import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as exercises from './exercises.js';
import * as knowledge from './knowledge.js';
import * as program from './program.js';
import * as constraints from './constraints.js';
import * as progress from './progress.js';
import { CREATE_SCHEMA, REVIEW_SCHEMA } from '../../coach/core/schemas.js';
import { AgentResultSchema } from '../state.js';

// Keep provider-visible shapes aligned with the existing validator contract.
function shape(schema, name) {
  if (Array.isArray(schema.type)) return z.any().describe(name + ': JSON value');
  if (schema.type === 'object') {
    const fields = Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, value]) => {
      const field = shape(value, key);
      return [key, schema.required?.includes(key) ? field : field.optional()];
    }));
    return (name === 'week' ? z.record(z.string(), z.string()) : z.object(fields))
      .describe(name === 'week' ? 'Weekday 0 Sunday through 6 Saturday to routine id' : name);
  }
  if (schema.type === 'array') return z.array(shape(schema.items, name + ' item')).describe(name);
  return ({ string: z.string(), integer: z.number().int(), number: z.number(),
    boolean: z.boolean() }[schema.type] ?? z.any()).describe(name);
}
export const planInputSchema = z.object({
  plan: shape(CREATE_SCHEMA, 'Creation bundle; catalogue exercise ids').optional(),
  changes: shape(REVIEW_SCHEMA.properties.changes, 'Review changes with before and after').optional()
});
const objects = { ...exercises, ...knowledge, ...program, ...constraints, ...progress };
export const specialistTools = {
  rag_agent: ['get_exercise', 'search_exercises', 'kb_search', 'get_current_plan'],
  program_agent: ['search_exercises', 'find_alternatives', 'get_current_plan', 'get_constraints', 'check_plan', 'propose_plan'],
  profile_progress_agent: ['get_constraints', 'update_constraints', 'get_workout_history', 'get_progress_metrics']
};
export function wrapTool(object, agent, ctx) {
  return tool(async args => {
    const start = Date.now();
    let result;
    try {
      // The legacy KB tool collects ids; preserve full citation metadata separately.
      result = await object.run(args, object.name === 'kb_search' ? { ...ctx, retrieved: new Set() } : ctx);
      if (object.name === 'kb_search') {
        for (const chunk of result.chunks ?? result.results ?? []) {
          if (!ctx.retrieved.some(c => c.id === chunk.id)) ctx.retrieved.push({ id: chunk.id, source: chunk.source, status: chunk.status });
        }
      }
      // A staged constraints draft applies within this turn already (pending pain restrictions
      // are safety). Only that tool's own result: an array result also has an `entries` method.
      if (object.name === 'update_constraints' && Array.isArray(result?.entries)) ctx.pendingConstraints.push(...result.entries);
    } catch (error) { result = { error: error.message }; }
    await ctx.onToolCall?.({ agent, tool: object.name, args, ms: Date.now() - start, ok: !result?.error });
    return JSON.stringify(result);
  }, { name: object.name, description: object.description, schema: ['check_plan', 'propose_plan'].includes(object.name)
    ? (object.name === 'check_plan' ? planInputSchema : planInputSchema.extend({
      mode: z.enum(['create', 'edit']), summary: z.string().describe('Proposal summary'),
      rationale: z.array(z.string()).describe('Evidence and rationale')
    })) : object.schema });
}
export function buildTools(agent, ctx, overrides = {}) {
  return [...specialistTools[agent].map(name => wrapTool(overrides[name] ?? objects[name], agent, ctx)),
    tool(args => JSON.stringify(args), { name: 'submit_result', description: 'Return your final structured result to the supervisor.', schema: AgentResultSchema })];
}
export function handoffTools() {
  const specs = {
    transfer_to_rag: z.object({ task: z.string() }),
    transfer_to_program: z.object({ task: z.string(), mode: z.enum(['create', 'edit']), facts: z.object({ goal: z.string().optional(), experience: z.string().optional(), daysPerWeek: z.number().int().min(1).max(7).optional(), sessionMinutes: z.number().positive().optional(), equipment: z.array(z.string()).optional() }).optional() }),
    transfer_to_profile_progress: z.object({ task: z.string() }),
    ask_user: z.object({ questions: z.array(z.object({ field: z.string(), question: z.string() })).min(1) }),
    finish: z.object({ text: z.string(), citations: z.array(z.string()), claimsNeedCitation: z.boolean() })
  };
  const descriptions = {
    transfer_to_rag: 'Training knowledge or exercise technique. task: the question, what to return, any pain regions.',
    transfer_to_program: 'Create (mode create) or edit (mode edit) the training plan. facts: values the user stated in this conversation.',
    transfer_to_profile_progress: 'Progress review, or a change to profile or constraints. task: what to assess or record.',
    ask_user: 'Ask the user for missing required data, at most two questions, each tied to a field.',
    finish: 'Final reply to the user. citations: ids from specialist results only.'
  };
  return Object.entries(specs).map(([name, schema]) => tool(a => JSON.stringify(a), { name, schema, description: descriptions[name] }));
}

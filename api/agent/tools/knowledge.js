import { z } from 'zod';
import { kbSearch } from '../kb.js';
export const kb_search = {
  name: 'kb_search',
  description:
    'Search resistance-training knowledge before answering training questions. Returns ranked passages, citation ids, sources, placeholder status and relevance flags. Cite only retrieved ids; low relevance means evidence may be insufficient.',
  schema: z.object({
    query: z.string().min(1).max(300),
    k: z.number().int().min(1).max(8).default(5),
    lang: z.enum(['vi', 'en']).default('vi')
  })
};
kb_search.run = function (args, ctx = {}) {
  const { query, ...options } = kb_search.schema.parse(args);
  const result = kbSearch(query, { ...options, db: ctx.db });
  ctx.retrieved ??= new Set();
  for (const id of result.retrievedIds) {
    if (ctx.retrieved instanceof Set) ctx.retrieved.add(id);
    else if (!ctx.retrieved.includes(id)) ctx.retrieved.push(id);
  }
  return result;
};

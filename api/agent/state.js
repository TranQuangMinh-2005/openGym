import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import { z } from 'zod';

export const AgentResultSchema = z.object({
  agent: z.string(), kind: z.enum(['answer', 'proposal', 'clarification', 'data']),
  text: z.string(), citations: z.array(z.string()), claimsNeedCitation: z.boolean(),
  draftId: z.string().optional(), data: z.record(z.string(), z.unknown()).optional(),
  clarifications: z.array(z.object({ field: z.string(), reason: z.string(), question_vi: z.string(), question_en: z.string() }))
});
export const RESET = Symbol("reset");
const collection = (key, limit) => Annotation({ default: () => [], reducer: (a, b) => {
  if (b === RESET) return [];
  if (!b) return a;
  const values = key ? [...new Map([...a, ...b].map(v => [v[key] ?? v, v])).values()] : [...a, ...b];
  return limit ? values.slice(-limit) : values;
} });
export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  ...Object.fromEntries(['uid', 'threadId', 'safety', 'final', 'decisions', 'task', 'mode', 'programContext', 'guardNote'].map(k => [k, Annotation()])),
  lang: Annotation({ default: () => 'vi' }),
  retrieved: collection('id'), agentResults: collection(), openQuestions: collection('field'),
  drafts: collection('id'), toolLog: collection(null, 200), repairs: Annotation({ default: () => 0 })
});
export const turnStart = () => ({ retrieved: RESET, agentResults: RESET, openQuestions: RESET, drafts: RESET, toolLog: RESET, guardNote: null, repairs: 0, final: null, decisions: null });

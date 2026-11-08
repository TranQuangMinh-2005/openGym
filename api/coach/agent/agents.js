import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Command } from '@langchain/langgraph';
import { SystemMessage, ToolMessage, HumanMessage } from '@langchain/core/messages';
import { validValues } from './tools/exercises.js';
import { AgentResultSchema } from './state.js';
import { effectiveConstraints } from './ledger.js';
import { build } from '../core/payload.js';
import { buildTools, handoffTools } from './tools/index.js';

export const prompts = Object.fromEntries(['orchestrator', 'rag', 'program', 'profile_progress', 'rag_fixed'].map(name => [name, readFileSync(new URL(`./prompts/${name}.md`, import.meta.url), 'utf8')]));
// Key order normalised at every depth. JSON.stringify with an array replacer filters nested keys
// by the top-level list, so every check_plan({ plan }) used to hash the same and three honest
// repair rounds read as a stall.
const stableJson = value => JSON.stringify(value, (key, v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v));
async function invoke(model, tools, messages) {
  try {
    return await model.bindTools(tools, { tool_choice: 'required', parallel_tool_calls: false }).invoke(messages);
  } catch (error) {
    if (!/tool_choice|parallel_tool_calls|unsupported|not supported/i.test(error.message)) throw error;
    return model.bindTools(tools).invoke(messages);
  }
}
// Runtime data goes after the static prompt, delimited, so the model can tell rules from data.
const tagged = (tag, value) => `\n<${tag}>\n${JSON.stringify(value)}\n</${tag}>`;
const responseText = response => typeof response.content === 'string' ? response.content : (response.content ?? []).filter(v => v.type === 'text').map(v => v.text).join('\n');
async function resilientInvoke(model, tools, messages, target) {
  let response = await invoke(model, tools, messages);
  if (response.tool_calls?.length) return response;
  messages.push(response, new HumanMessage(`Call ${target} now with your result, or another tool if you still need one.`));
  response = await invoke(model, tools, messages);
  if (response.tool_calls?.length) return response;
  return { ...response, tool_calls: [{ name: target, args: target === 'finish'
    ? { text: responseText(response), citations: [], claimsNeedCitation: false }
    : { kind: 'data', text: responseText(response), stuck: false, citations: [], claimsNeedCitation: false, clarifications: [] } }] };
}
export function programInputs(S, pendingConstraints = [], facts = {}) {
  const profile = { ...(S.coach?.profile || {}), equipment: build(S, { handle: 'agent' }).coachProfile?.equipment, ...facts };
  if (facts.sessionMinutes != null) profile.sessionMin = facts.sessionMinutes;
  const hard = effectiveConstraints(S).filter(e => e.strength === 'hard');
  for (const e of hard) {
    const mapping = { goal: ['goal', 'goal'], experience: ['experience', 'level'], days_per_week: ['daysPerWeek', 'days'], available_equipment: ['equipment', 'equipment'], max_session_minutes: ['sessionMin', 'minutes'] }[e.type];
    if (mapping && !e.value.weekdays) profile[mapping[0]] = e.value[mapping[1]];
  }
  return { S: { ...S, coach: { ...S.coach, profile } }, known: { goal: profile.goal, experience: profile.experience, daysPerWeek: profile.daysPerWeek, sessionMinutes: profile.sessionMin, equipment: profile.equipment, painRegions: [...new Set([...hard, ...pendingConstraints].filter(e => e.type === 'avoid_region').flatMap(e => e.value.regions))], pendingConstraints: pendingConstraints.map(e => ({ type: e.type, value: e.value })) } };
}
export function buildAgents({ cfg, model, context, deps = {} }) {
  const orchestrator = async state => {
    const known = programInputs(await deps.readState(state.uid), context(state).pendingConstraints).known;
    const response = await resilientInvoke(model, handoffTools(), [new SystemMessage(prompts.orchestrator + tagged('context', { known, equipmentVocabulary: validValues.equipment, safety: state.safety, results: state.agentResults, openQuestions: state.openQuestions, repair: state.repairs, guardNote: state.guardNote })), ...state.messages], 'finish');
    const call = response.tool_calls?.[0];
    if (!call) throw Error('Orchestrator must call a handoff tool');
    const targets = { transfer_to_rag: 'rag_agent', transfer_to_program: 'program_context', transfer_to_profile_progress: 'profile_progress_agent', ask_user: 'ask_user', finish: 'finish' };
    if (!targets[call.name]) throw Error('Unknown handoff');
    return new Command({ goto: targets[call.name], update: { task: call.args, mode: call.args.mode } });
  };
  const fixedRag = async state => {
    const ctx = context(state);
    const tools = buildTools('rag_agent', ctx, deps.tools);
    const passages = await tools.find(t => t.name === 'kb_search').invoke({
      query: state.task.task, k: 5, lang: state.lang
    });
    const response = await resilientInvoke(model, tools.filter(t => t.name === 'submit_result'), [
      new SystemMessage(prompts.rag_fixed + `\n<passages>\n${passages}\n</passages>`), ...state.messages
    ], 'submit_result');
    const call = response.tool_calls?.[0];
    if (call?.name !== 'submit_result') throw Error('Fixed RAG must submit_result');
    return { agentResults: [AgentResultSchema.parse({ ...call.args, agent: 'rag_agent' })],
      retrieved: ctx.retrieved };
  };
  const specialist = agent => async state => {
    const ctx = context(state);
    const tools = buildTools(agent, ctx, deps.tools);
    const messages = [new SystemMessage(prompts[agent.replace('_agent', '')] + tagged('context', { task: state.task, safety: state.safety, programContext: state.programContext })), ...state.messages];
    const log = [...state.toolLog];
    let result;
    let retrievals = 0;
    const drafts = [];
    while (!result) {
      const response = await resilientInvoke(model, tools, messages, 'submit_result');
      messages.push(response);
      if (!response.tool_calls?.length) throw Error('Specialist must call submit_result');
      for (const call of response.tool_calls) {
        const argsHash = createHash('sha256').update(stableJson(call.args)).digest('hex');
        // submit_result is the way out, not a tool loop: the same final answer on three separate
        // handoffs is the handoff guard's business (graph.js), not a stall.
        if (call.name !== 'submit_result') log.push({ agent, tool: call.name, argsHash });
        if (call.name !== 'submit_result' && log.filter(v => v.agent === agent && v.tool === call.name && v.argsHash === argsHash).length >= (cfg.stallRepeat ?? 3)) {
          result = { agent, kind: 'data', text: 'stuck', citations: [], claimsNeedCitation: false, clarifications: [] };
          break;
        }
        if (call.name === 'submit_result') {
          result = AgentResultSchema.parse({ ...call.args, agent });
          // The program agent has no retrieval tool, so it has nothing to cite: its numbers come
          // from check_plan facts. Live run 2026-11-07 cited tool names, and the guard blocked it.
          if (agent === 'program_agent') Object.assign(result, { citations: [], claimsNeedCitation: false });
          if (call.args.stuck === true) result.data = { ...result.data, stuck: true };
          break;
        }
        const selected = tools.find(t => t.name === call.name);
        const output = call.name === 'kb_search' && ++retrievals > 2 ? JSON.stringify({ error: 'Maximum two retrieval rounds' }) : selected ? await selected.invoke(call.args) : JSON.stringify({ error: 'Unknown tool' });
        const toolResult = JSON.parse(output);
        if (toolResult.draftId && !toolResult.error && toolResult.ok !== false) {
          drafts.push(toolResult.draftId);
        }
        messages.push(new ToolMessage({ content: output, tool_call_id: call.id }));
      }
    }
    return { agentResults: [result], retrieved: ctx.retrieved, toolLog: log.slice(state.toolLog.length), drafts: [...new Set([...drafts, ...(result.draftId ? [result.draftId] : [])])] };
  };
  return { orchestrator, rag_agent: cfg.ragMode === 'fixed' ? fixedRag : specialist('rag_agent'), program_agent: specialist('program_agent'), profile_progress_agent: specialist('profile_progress_agent') };
}

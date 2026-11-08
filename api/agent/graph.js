import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getDraft, setDraftStatus, insertPlanVersion } from './db.js';
import { commitLedger } from './ledger.js';
import { canonicalPlan } from '../coach/core/payload.js';
import { hashPlan } from '../coach/core/plan-hash.js';
import { applyCreatedPlanServer, applyChangeSetServer } from '../coach/core/apply.js';
import { isDraftStale } from './tools/program.js';

export const DecisionsSchema = z.object({ decisions: z.array(z.object({
  draftId: z.string(), decision: z.enum(['approve', 'reject']),
  acceptedChangeIds: z.array(z.string()).optional()
})) });
import { StateGraph, START, END, Command, interrupt } from '@langchain/langgraph';
import { AIMessage } from '@langchain/core/messages';
import { AgentState, turnStart, RESET } from './state.js';
import { buildAgents, programInputs } from './agents.js';
import { assessSafety } from './safety/llm-classifier.js';
import { safetyResponse } from './safety/input-guard.js';
import { checkOutput } from './safety/output-guard.js';
import { buildProgramContext } from './context.js';
import { listDrafts } from './db.js';
import { effectiveConstraints, pendingFromDrafts } from './ledger.js';
import { update_constraints } from './tools/constraints.js';
import { DETAILS_BY_ID } from './kb.js';

export function buildGraph({ cfg = {}, model, deps }) {
  const context = s => ({ ...deps, uid: s.uid, threadId: s.threadId, retrieved: [...s.retrieved], pendingConstraints: [
    ...pendingFromDrafts((deps.listPendingDrafts ?? (uid => listDrafts(uid, 'pending')))(s.uid)),
    ...(s.safety?.level === 'caution' ? (s.safety.regions ?? []).map(region => ({
      id: 'caution:' + region, type: 'avoid_region', strength: 'hard',
      status: 'pending', source: { kind: 'safety' }, value: { regions: [region] }
    })) : [])
  ], flags: cfg.flags });
  const agents = buildAgents({ cfg, model, deps, context });
  const graph = new StateGraph(AgentState)
    .addNode('turn_start', turnStart)
    .addNode('input_guard', async s => {
      const users = s.messages.filter(m => m.getType() === 'human');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), cfg.safetyTimeoutMs ?? 20000);
      const safetyModel = { withStructuredOutput: (...args) => {
        const structured = model.withStructuredOutput(...args);
        return { invoke: messages => structured.invoke(messages, { signal: controller.signal }) };
      } };
      try {
        const safety = await assessSafety({ text: users.at(-1)?.content ?? '', history: users.slice(-5, -1).map(m => m.content), lang: s.lang, model: safetyModel, timeoutMs: cfg.safetyTimeoutMs ?? 20000 });
        deps.onGuardResult?.('input_guard', { level: safety.level });
        return new Command({ update: { safety }, goto: safety.level === 'red_flag' ? 'safety_response' : 'orchestrator' });
      } finally { clearTimeout(timer); }
    }, { ends: ['safety_response', 'orchestrator'] })
    .addNode('orchestrator', async s => {
      const command = await agents.orchestrator(s);
      // A draft's summary is forwarded verbatim from the specialist that wrote it (the
      // langgraph-supervisor forward_message pattern). Live run 2026-11-07: the orchestrator,
      // paraphrasing, added "every muscle twice a week" to a 3-day push/pull/legs plan.
      if (s.drafts.length && (command.goto.includes('ask_user') || command.goto.includes('finish'))) {
        const proposals = s.agentResults.filter(r => r.kind === 'proposal' && r.text && (!r.draftId || s.drafts.includes(r.draftId)));
        const forwarded = proposals.length ? proposals : [[...s.agentResults].reverse().find(r => r.text && r.kind !== 'clarification')].filter(Boolean);
        return new Command({ goto: 'finish', update: { task: {
          text: forwarded.map(r => r.text).join('\n\n') + (s.lang === 'en' ? '\n\nPlease approve or reject this proposal.' : '\n\nBạn phê duyệt hoặc từ chối đề xuất này nhé.'),
          citations: [...new Set(forwarded.flatMap(r => r.citations))],
          claimsNeedCitation: forwarded.some(r => r.claimsNeedCitation) } } });
      }
      const agent = { program_context: 'program_agent', rag_agent: 'rag_agent', profile_progress_agent: 'profile_progress_agent' }[command.goto];
      const counts = { ...(s.task?._handoffs ?? {}) };
      if (agent) {
        const stuck = s.agentResults.some(r => r.agent === agent && (r.stuck === true || r.data?.stuck === true || (r.kind === 'data' && r.text.trim().toLowerCase() === 'stuck')));
        const exceeded = (counts[agent] ?? 0) >= (cfg.maxHandoffsPerAgent ?? 3);
        if (stuck || exceeded) {
          await deps.onEvent?.({ type: 'handoff_refused', agent, reason: stuck ? 'stuck' : 'max_handoffs', count: counts[agent] ?? 0 });
          return new Command({ goto: 'finish', update: { drafts: RESET, task: { text: s.lang === 'en' ? 'I could not complete your request. Nothing was saved.' : 'Mình chưa thể hoàn thành yêu cầu của bạn. Chưa lưu thay đổi nào.', citations: [], claimsNeedCitation: false } } });
        }
        counts[agent] = (counts[agent] ?? 0) + 1;
      }
      command.update.task = { ...command.update.task, _handoffs: counts };
      return command;
    }, { ends: ['rag_agent', 'program_context', 'profile_progress_agent', 'ask_user', 'finish'] })
    .addNode('program_context', async s => {
      const built = await buildProgramContext({ S: programInputs(await deps.readState(s.uid), context(s).pendingConstraints, s.task.facts).S, now: deps.now, pendingConstraints: context(s).pendingConstraints, cfg });
      built.context.factsFromChat = s.task.facts ?? {};
      if (s.mode === 'create' && built.missing.length) return new Command({ goto: 'orchestrator', update: { agentResults: [{ agent: 'program_context', kind: 'clarification', text: '', citations: [], claimsNeedCitation: false, clarifications: built.missing }] } });
      return new Command({ goto: 'program_agent', update: { programContext: built.context } });
    }, { ends: ['orchestrator', 'program_agent'] })
    .addNode('safety_response', async s => {
      const drafts = [];
      if (s.safety.regions.length) {
        const draft = await update_constraints.run({ changes: [{ type: 'avoid_region', value: { regions: s.safety.regions }, strength: 'hard', kind: 'safety' }] }, context(s));
        drafts.push(draft.draftId);
      }
      return { drafts, final: { kind: 'safety', text: safetyResponse({ lang: s.lang, matches: s.safety.matches, regions: s.safety.regions }), citations: [], claimsNeedCitation: false } };
    })
    .addNode('ask_user', s => {
      const known = new Set(s.openQuestions.map(q => q.field));
      const questions = s.task.questions.filter(q => !known.has(q.field) && known.add(q.field)).slice(0, 2);
      return { openQuestions: questions.length ? questions : s.openQuestions, final: { kind: 'clarification', text: questions.map(q => q.question).join('\n'), citations: [], claimsNeedCitation: false } };
    })
    .addNode('finish', s => ({ final: { kind: 'answer', ...s.task } }))
    .addNode('output_guard', async s => {
      const result = checkOutput(s.final, { retrieved: s.retrieved, lang: s.lang, hardConstraints: effectiveConstraints(await deps.readState(s.uid)), library: DETAILS_BY_ID, painRegions: [...new Set([
        ...effectiveConstraints(await deps.readState(s.uid)), ...context(s).pendingConstraints
      ].filter(e => e.type === 'avoid_region' && e.op !== 'remove')
        .flatMap(e => e.value.regions).concat(s.safety?.regions ?? []))] });
      deps.onGuardResult?.('output_guard', { ok: result.ok });
      if (result.ok) return new Command({ goto: 'say' });
      if (s.repairs < 1) return new Command({ goto: 'orchestrator', update: { repairs: 1, guardNote: 'Repair output violations: ' + JSON.stringify(result.violations) } });
      return new Command({ goto: 'say', update: { final: { kind: 'answer', text: s.lang === 'en' ? 'I do not have enough evidence to answer safely.' : 'Mình chưa đủ căn cứ để trả lời an toàn.', citations: [], claimsNeedCitation: false } } });
    }, { ends: ['say', 'orchestrator'] })
    .addNode('approval', s => {
      if (!s.drafts.length) return new Command({ goto: 'respond' });
      const drafts = s.drafts.map(id => getDraft(id)).filter(d => d
        && d.uid === s.uid && d.status === 'pending').map(d => ({
        id: d.id, kind: d.kind, summary: d.payload.summary, ...(d.payload.facts ? { facts: d.payload.facts } : {}),
        changes: d.payload.changes, diff: d.diff, conflicts: d.payload.conflicts ?? [],
        warnings: d.payload.warnings ?? []
      }));
      if (!drafts.length) return new Command({ goto: 'respond' });
      const decisions = DecisionsSchema.parse(interrupt({ drafts }));
      return new Command({ goto: 'commit', update: { decisions } });
    }, { ends: ['respond', 'commit'] })
    .addNode('commit', async s => {
      const outcomes = [];
      for (const decision of s.decisions.decisions) {
        const draft = getDraft(decision.draftId);
        if (!s.drafts.includes(decision.draftId) || !draft
          || draft.uid !== s.uid || draft.status !== 'pending') {
          outcomes.push(s.lang === 'en' ? 'Invalid draft ignored.' : 'Bỏ qua bản nháp không hợp lệ.');
          continue;
        }
        if (decision.decision === 'reject') {
          setDraftStatus(draft.id, 'rejected');
          outcomes.push(s.lang === 'en' ? 'Proposal discarded; program unchanged.' : 'Đã bỏ đề xuất, chương trình giữ nguyên');
          continue;
        }
        const before = await deps.readState(s.uid);
        if (draft.kind !== 'constraints' && isDraftStale(before, draft)) {
          setDraftStatus(draft.id, 'stale');
          outcomes.push(s.lang === 'en' ? 'The plan changed meanwhile. Nothing was saved.' : 'Chương trình đã thay đổi trong lúc chờ. Chưa lưu thay đổi nào.');
          continue;
        }
        const now = deps.now ?? Date.now();
        const options = { now, newId: randomUUID, label: deps.label };
        const result = await deps.commitState(s.uid, S => {
          // apply.js is a port of the app's code, which always has DEF defaults. A profile that
          // has never synced has no state document yet, so supply the collections it appends to.
          S.routines ??= []; S.week ??= {}; S.dayPlan ??= {}; S.customEx ??= [];
          if (draft.kind === 'constraints') commitLedger(S, draft.payload.entries, 'approve', { now });
          else if (draft.kind === 'plan_create') applyCreatedPlanServer(S,
            { id: draft.id, ...draft.payload }, { ...options, schedule: true });
          else applyChangeSetServer(S, { id: draft.id, ...draft.payload },
            decision.acceptedChangeIds ?? draft.payload.changes.map(c => c.id), options);
        }, { expectRev: before._rev ?? 0 });
        if (!result.ok) {
          outcomes.push(s.lang === 'en' ? 'Nothing was saved.' : 'Chưa lưu thay đổi nào.');
          continue;
        }
        if (draft.kind !== 'constraints') {
          const after = await deps.readState(s.uid);
          insertPlanVersion({ id: randomUUID(), uid: s.uid, draft_id: draft.id,
            plan: canonicalPlan(after), plan_hash: hashPlan(canonicalPlan(after)),
            state_rev: after._rev });
        }
        setDraftStatus(draft.id, 'approved');
        const en = s.lang === 'en';
        if (draft.kind === 'constraints') outcomes.push((en ? 'Saved constraints: ' : 'Đã lưu điều kiện: ') + draft.payload.summary);
        else if (draft.kind === 'plan_create') {
          const routines = draft.payload.bundle.routines ?? [];
          outcomes.push(en ? `Saved new program: ${routines.length} sessions (${routines.map(r => r.name).join(', ')})` : `Đã lưu chương trình mới: ${routines.length} buổi (${routines.map(r => r.name).join(', ')})`);
        } else {
          const changes = draft.payload.changes;
          const k = changes.filter(c => !decision.acceptedChangeIds || decision.acceptedChangeIds.includes(c.id)).length;
          outcomes.push(en ? `Applied ${k}/${changes.length} changes` : `Đã áp dụng ${k}/${changes.length} thay đổi`);
        }
      }
      return { final: { ...s.final, text: outcomes.join(' ') } };
    })
    // The turn's answer joins the transcript before approval, so a thread read while it waits for
    // a decision shows the proposal text beside its approval card. respond then adds only what the
    // commit says (approval is re-executed on resume, so it cannot be the node that writes this).
    .addNode('say', s => ({ messages: [new AIMessage(s.final.text)] }))
    .addNode('respond', s => (s.decisions ? { messages: [new AIMessage(s.final.text)] } : {}));
  for (const name of ['rag_agent', 'program_agent', 'profile_progress_agent']) graph.addNode(name, agents[name]).addEdge(name, 'orchestrator');
  graph.addEdge(START, 'turn_start').addEdge('turn_start', 'input_guard').addEdge('safety_response', 'say').addEdge('say', 'approval').addEdge('ask_user', 'output_guard').addEdge('finish', 'output_guard').addEdge('commit', 'respond').addEdge('respond', END);
  return graph;
}

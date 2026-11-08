# T6 — Agent graph & runtime (spec for implementation)

Parent plan: `2026-11-05-multi-agent-coach-implementation.md` (§2, §5, §7, §8, D6, D8–D11).
Everything below lives in `api/agent/`. LangGraph.js 1.5.2 / @langchain/core 1.3.0 are installed as
optional deps; import them lazily from the runtime entry (`runtime.js`) so that `server.js` can import
the routes module without loading LangGraph when the agent is disabled.

The guiding rule (user requirement): **the LLM decides, code enforces**. Routing, query rewriting,
relevance judgement, constraint extraction and deciding what is missing are LLM work. Code is limited
to the safety invariants, validation, persistence and loop control.

## 1. Graph state (`state.js`, `Annotation.Root`)
| Channel | Type / reducer | Purpose |
|---|---|---|
| `messages` | `MessagesAnnotation` reducer | user ↔ orchestrator conversation (the transcript the UI shows) |
| `uid`, `threadId`, `lang` | last value | identity; `lang` 'vi' default |
| `safety` | last value | result of `assessSafety` for the latest user message `{level, regions, matches, needsClarification, failClosed}` |
| `retrieved` | union by id | `[{id, source, status}]` every KB chunk retrieved this turn (for G4) |
| `agentResults` | append | `AgentResult` objects returned by specialists this turn |
| `openQuestions` | merge by `field` | clarifications already asked and not yet answered (dedupe) |
| `drafts` | union by id | draft ids created this turn (plan or constraints) |
| `toolLog` | append (bounded 200) | `{agent, tool, argsHash}` for stall detection |
| `repairs` | last value | output-guard repair count this turn |
| `final` | last value | `{kind:'answer'|'proposal'|'clarification'|'safety', text, citations[], claimsNeedCitation}` |
| `decisions` | last value | resume payload after approval |
`turnStart` resets per-turn channels (`retrieved`, `agentResults`, `drafts`, `toolLog`, `repairs`, `final`, `decisions`) when a new user message arrives.

`AgentResult` (zod, exported): `{ agent, kind: 'answer'|'proposal'|'clarification'|'data', text, citations: string[], claimsNeedCitation: boolean, draftId?: string, clarifications: [{field, reason, question_vi, question_en}], data?: object }`.

## 2. Nodes & edges
```
START → turn_start → input_guard
input_guard: red_flag → safety_response → approval
             otherwise → orchestrator
orchestrator (LLM with tools) → Command(goto) to one of:
   rag_agent | program_context | profile_progress_agent | ask_user | finish
program_context (code): buildProgramContext(S, pendingConstraints)
   missing required fields AND request needs a new plan → agentResult{kind:'clarification'} → orchestrator
   otherwise → program_agent (context snapshot injected as a system message, JSON)
rag_agent | program_agent | profile_progress_agent → orchestrator   (supervisor loop)
ask_user (code): final = clarification text built by the orchestrator tool call → output_guard
finish (code): final from the orchestrator's finish tool call → output_guard
output_guard (code): checkOutput(final, ctx)
   ok → approval
   violation and repairs < 1 → orchestrator with a system message listing violations (repairs+1)
   violation otherwise → safe fallback text (sanitized or generic) → approval
approval: drafts pending for this turn → interrupt({ drafts:[{id, kind, summary, diff, conflicts}] })
          none → respond
          resume value → decisions → commit
commit (code) → respond → END
```

### input_guard
`assessSafety({ text, history: last 4 user messages, lang, model, timeoutMs: cfg.safetyTimeoutMs (default 20000) })`
with an AbortSignal that is aborted on timeout (fix: today the timeout leaves the request running).
- `red_flag`: stage a pending `avoid_region` entry (source.kind 'safety', strength 'hard') via the
  constraints draft path when regions are known; set `final` = `safetyResponse(...)` (kind 'safety').
  No planning or substitution happens this turn.
- `caution`: continue; the orchestrator system prompt receives the caution block (no load progression
  and no new exercise for the mentioned regions this turn; ask one clarifying question if
  `needsClarification`).

### orchestrator (LLM)
Tool-calling supervisor (pattern of langgraph-supervisor: handoff tools). Tools:
`transfer_to_rag({task})`, `transfer_to_program({task, mode:'create'|'edit'})`,
`transfer_to_profile_progress({task})`, `ask_user({questions:[{field, question}]})`,
`finish({text, citations, claimsNeedCitation})`. Exactly one tool call per orchestrator step
(`tool_choice: 'required'`; parallel tool calls disabled). The prompt (prompts/orchestrator.md) states:
intents (create plan, edit plan, explain/knowledge, progress review, profile/constraint update,
out-of-scope → polite refusal via finish), that only it talks to the user, that it must merge and
de-duplicate clarifications from agents against `openQuestions`, that answers containing training
knowledge must cite retrieved ids, the current safety block, and that multi-step requests chain
agents (e.g. progress → program).

### Specialists (ReAct, `createReactAgent` from `@langchain/langgraph/prebuilt`, or an equivalent
hand-written loop if that API does not fit) — each with its own prompt in `prompts/*.md` and the tools
listed below wrapped with `tool()` from `@langchain/core/tools` (schema = the zod schema already on each
tool object, `run` called with the runtime ctx). Each specialist must end by calling `submit_result`
(schema = AgentResult) — that is its only way to return. Tool results are JSON strings.
| Agent | Tools |
|---|---|
| rag_agent | get_exercise, search_exercises, kb_search, get_current_plan, submit_result |
| program_agent | search_exercises, find_alternatives, get_current_plan, get_constraints, check_plan, propose_plan, submit_result |
| profile_progress_agent | get_constraints, update_constraints, get_workout_history, get_progress_metrics, submit_result |

RAG agent prompt implements bounded agentic RAG (LangGraph agentic-RAG pattern): decide whether the
question needs the KB at all (exercise facts → get_exercise/search_exercises only); otherwise rewrite
the query (Vietnamese → also English keywords), kb_search, **judge relevance itself** (the score is a
hint), at most 2 retrieval rounds, then answer citing ids, or say there is not enough evidence.
`cfg.ragMode === 'fixed'` replaces the agent with a fixed node: one kb_search(top 5) + one LLM answer.

Program agent prompt: use the context snapshot; never invent equipment/time; on check_plan errors
repair (the validator text is verbatim); store via propose_plan; return clarifications for missing
facts instead of guessing; while a pain region is active/pending do not load it.

Profile & progress agent prompt: two sub-roles — extracting constraints (only explicit user
statements, `update_constraints` → pending draft, never active) and progress review (numbers only
from get_progress_metrics; "keep as is" is a valid conclusion).

### commit (code)
For each decision: load the draft (must belong to `uid`, status `pending`, else skip with an error
message in `final`). Reject → `setDraftStatus(id,'rejected')`, state untouched. Approve:
- `constraints` → `stateStore.commitState(uid, S => commitLedger(S, draft.payload.entries, 'approve', {now}))`.
- `plan_create` / `plan_edit` → stale check (`isDraftStale`) → if stale mark `stale` and tell the user;
  else `commitState(uid, S => applyCreatedPlanServer|applyChangeSetServer(S, draft.payload…, {now, newId, label}))`
  then `insertPlanVersion({ uid, draft_id, plan: canonicalPlan(after), plan_hash, state_rev })`.
- A `commitState` failure (409/503) → draft stays `pending`, the user is told nothing was saved
  (proposal §11: never claim a save that failed).
`commitState` is injected into the runtime by the server (it is created in `server.js`).

## 3. Runtime (`runtime.js`)
- `createAgentRuntime({ cfg, commitState, readState })` → `{ run, resume, cancel, getThread, getRun }`.
- `run({ uid, threadId?, text, lang, signal })` → new run id; streams the graph with
  `{ configurable: { thread_id: uid + ':' + threadId }, recursionLimit: cfg.recursionLimit, signal }`
  where the signal combines the caller's, `cancel(threadId)` and `cfg.runTimeoutMs`
  (`AbortSignal.any`). Returns `{ runId, threadId, status: 'done'|'awaiting_approval'|'cancelled'|'error', reply, approval?, usage }`.
- `resume({ uid, threadId, decisions })` → `new Command({ resume: decisions })`; validates with zod;
  unknown/foreign draft ids → error; only valid when the thread is interrupted.
- Thread ids are namespaced by uid so one user can never read or resume another's thread.
- Model calls: one chat model per run (`createChatModel({ cfg, threadId, onUsage, onCost })`);
  every usage event → `addRunUsage`, and `model_calls` is the number of LLM calls. **No fixed call
  budget**; `cfg.maxModelCalls` (null = unlimited) aborts the run when reached.
- Stall detection: the same `{agent, tool, argsHash}` appearing `cfg.stallRepeat` times in a turn →
  stop that agent with a submit_result of kind 'data' saying it is stuck → orchestrator decides.
- `GraphRecursionError` / abort / timeout / provider error → run status `error` or `cancelled`, a safe
  user message, `endRun` with the error, no draft committed.
- Tracing (single store): `addEvent(runId, type, node, data)` for node start/end, every tool call
  (name, args hash, duration, ok/error — never the API key or full state), guard results, interrupts,
  commits. Usage per call is in `agent_runs`.

## 4. Tests (`api/test/agent-graph*.test.js`, fake model, no network)
A scripted fake chat model (subclass of `BaseChatModel`, supports `bindTools` and
`withStructuredOutput`) whose responses are a queue per agent (identify the agent by a marker in its
system prompt). Scenarios:
1. knowledge question → orchestrator → rag (kb_search, submit with citations) → finish → ok; citation not
   retrieved → output guard → one repair → fallback.
2. red flag message → safety response, pending pain constraint draft, interrupt for confirmation;
   approve → ledger active in state; program agent never called.
3. caution message → orchestrator asks one clarifying question (dedupe: a second agent asking the same
   field does not produce a second question).
4. create plan with missing fields → program_context returns clarification, program agent not called.
5. create plan complete → program agent → check_plan error → repair → propose_plan → interrupt →
   approve → state routines/week changed via commitState, plan_versions row, `_rev` bumped;
   reject → state unchanged, draft rejected.
6. edit plan partial approval (acceptedChangeIds).
7. stale draft (state changed between interrupt and resume) → no write, draft 'stale'.
8. resume after a restart (new runtime instance over the same agent.db) works.
9. multi-hop: progress → program in one turn.
10. recursion limit hit → status error, nothing committed; stall detection; cancel mid-run; provider
    error mid-run; maxModelCalls null = unlimited (a 30-call scripted run completes) and a set value aborts.
11. foreign uid cannot resume another user's thread or draft.
12. usage accumulates in agent_runs; events recorded; no API key in any event.

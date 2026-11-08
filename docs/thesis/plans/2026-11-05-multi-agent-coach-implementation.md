# Multi-agent Coach — implementation plan

Status: implemented T1–T9 (2026-11-06), not yet committed · Branch: `feat/agent-coach` · Date: 2026-11-05

## Implementation status and deviations from this plan (2026-11-06)

All tasks T1–T9 are implemented and reviewed; T6 was split into T6a/T6b1/T6b2 and T5 into
T5a–T5d. What changed against the plan below, and why:

| Plan said | Implemented | Why |
|---|---|---|
| Safety: deterministic lexicon detects red flags | Lexicon is the **floor**; an LLM classifier (`safety/llm-classifier.js`) is the primary detector and may only escalate; classifier failure → fail closed | Held-out set (`eval/datasets/safety-heldout.json`, never shown to the implementer): lexicon recall 0.625, lexicon + LLM 0.938, no over-triage. User asked for less rule-based logic. |
| Duration words alone are red flags | Only with a pain/symptom term in the same clause | Live false positive: "mới tập được 3 tháng" was red_flag. |
| Commit writes plan versions to `agent.db` only | Commit also writes the app's own `coach.snapshots` / `coach.log` via the ported apply functions | The app's existing undo button keeps working on agent-made changes. |
| Pending constraints in `S.coach.ledger` | Pending entries live only in drafts (`pendingFromDrafts`), are read per call, and pending pain restrictions apply immediately | Active state must not change before approval. |
| Program context passed as snapshot | Snapshot + orchestrator-extracted `facts` from the chat + candidate `library` (librarySlice) | Live runs: orchestrator re-asked known facts; program agent searched 115 times one exercise at a time. |
| Recursion limit only | Plus loop guards: stall (same tool + args ×3, stable hashing), ≤3 handoffs per agent per turn, no re-dispatch after "stuck", one reminder then fallback when a model answers without a tool call | Live run hit the recursion limit after 150 calls. |
| `POST …/messages` synchronous | 202 + poll `GET …/thread?id=` | nginx `proxy_read_timeout` is 300 s. |
| `chat_messages` table | Not created; transcript = LangGraph checkpoint state | One source of truth. |
| Provider structured output via `response_format` | Forced function calling | OpenCode Go/DeepSeek rejects `response_format`. |
| Prompts: no structure specified | Every `prompts/*.md` uses the same sections — Role, Context, Workflow, Rules, Output (+ one example for the orchestrator) — in English, replying in the user's language. Runtime data is appended inside `<context>…</context>` (`<passages>` for fixed RAG); handoff tools carry real descriptions | Follows Anthropic's context-engineering guidance (right altitude, sections, few canonical examples instead of rule lists), its multi-agent delegation advice (objective, output, tools, limits per task) and OpenAI's GPT-4.1 prompt structure. The old prompts were one-line bilingual rules with duplicates. Live knowledge question afterwards: 6 calls, 14 s (before: 32 s). |
| Orchestrator writes the final answer | When a draft exists, the specialist's proposal text is forwarded verbatim (langgraph-supervisor `forward_message` pattern) plus an approve/reject line. `check_plan`/`propose_plan` return `facts` computed from the plan (training days, sessions and sets per week by primary muscle, minutes), stored in the draft; the program agent quotes only those numbers and carries no citations (it has no retrieval tool) | Live run 2026-11-07: paraphrasing a 3-day push/pull/legs draft, the orchestrator added "every muscle twice a week"; the program agent's own text did not say it. Rerun: weekly sets and minutes in the reply match `facts`. Tests: `planFacts` unit test, verbatim-forward runtime test (fails without the fix). |
| Commit assumes a state document | Commit fills `routines/week/dayPlan/customEx` defaults before applying | Docker run 2026-11-07: approving a plan for a never-synced profile failed (`reading 'push'`). Regression test in `agent-runtime.test.js`. |

Known limits: KB chunks are placeholders; safety detection of free-form language is measured, not
guaranteed (one held-out miss: "cổ cứng đơ không quay được" → caution); `coach` namespace sync is
whole-object last-writer-wins, so a device editing coach data at the same moment as a commit can
override one of them (existing behaviour for that namespace); the frontend i18n test
`coach-api.i18n.test.js` is occasionally slow under full-suite load; a proposal's wording is still the model's, so it can summarise `facts` loosely (live rerun: "each muscle once a week" while delts were trained twice). The numbers are grounded; the prose is not checked.
Inputs: `docs/thesis/proposal/project-proposal.md`, `docs/thesis/prd/ai-coach-multi-agent-prd.md`, the design doc
"GymBuddy — Thiết kế trợ lý AI đa agent" (claude.ai doc, 2026-11-05) and its architecture review.

Roles: Claude Code plans, reviews and accepts; Codex (`gpt-6.1-sol`, reasoning effort `low`,
via the `codex-plugin-cc` rescue agent) implements. No task is accepted on Codex's summary alone.

---

## 1. Current architecture assessment (verified in the repo, not taken from the proposal)

| Area | What exists today | Evidence |
|---|---|---|
| Coach pipeline | Single-call, framework-free: `prompt → adapter.invoke → extractJSON → validate → one repair round`. Three job kinds: `create` (+refine), `review`, `debrief`. | `api/coach/core/pipeline.js` |
| Security boundary | `validate.js` (650 lines) is the judge of every answer: library ids exist, equipment allowed, sets/reps bounds, change types, plan shape. | `api/coach/core/validate.js` |
| Provider adapters | HTTP (`openai`, `anthropic`, `gemini`, `compatible`) + spawned runtimes (`claude`, `codex`). JSON-schema decoding where supported. | `api/coach/core/adapters/*`, `api/coach/adapters/*` |
| Jobs | In-process queue, max 2 concurrent, 5 min timeout, per-profile and per-instance daily caps, results in `DATA_DIR/coach/<uid>.json`. | `api/coach/jobs.js` |
| Approval today | Server stores one `pending` proposal; **the client** applies accepted changes to its own state (`applyCreatedPlan`, `applyChangeSet`), snapshots for undo, then calls `POST /api/coach/pending/resolve`. | `frontend/src/lib/coach.js`, `jobs.resolvePending` |
| Routes | `/api/coach/{disclosure,status,plan,review,debrief,cohort,cohort/share,pending/resolve,forget}` + admin routes. Documented in `api/openapi.yaml`, enforced by `test/openapi-routes.test.js`. | `api/coach/routes.js` |
| User state | `DATA_DIR/state-<uid>.json`, client-authoritative, conditional write with `_rev`/`_wid` (409 on conflict), server-side stamping of unstamped writers (`stampPut`). `PUT /api/data` is "the only writer of a state file in the tree". | `api/server.js` (PUT /api/data), `api/sync-stamps.js` |
| Coach namespace in state | `S.coach = { consent, profile, cadence, lastReview, log, snapshots, chat, timings }`; constraints live as free-text in `coach.profile` (limitations, equipment, …). No ledger. | `frontend/src/lib/coach.js` (`emptyCoach`) |
| Exercise catalogue | **5,632** exercises used by the Coach (`api/coach/core/library-data.js`, `COUNT = 5632`). `catalogue/exercises/` holds 6,554 files = 5,632 exercises + 922 female-variant media entries (no `category`). `CLAUDE.md`'s "1,324" is stale. | counted 2026-11-05 |
| Knowledge base | **None.** No `kb/` directory exists. | — |
| Diagrams | `docs/thesis/architecture/multi-agent-pipeline.drawio` and `database-erd.drawio` are committed. `gymbuddy-agent-architecture.drawio` (cited by the design doc) is **not** in the repo. | `git ls-tree origin/docs/cs529-design` |
| Runtime | Docker `node:22-alpine`; default image runs `npm ci --omit=optional` (no AI deps); `--target coach` includes optional deps. Dockerfile copies an explicit list of top-level api files (`test/dockerfile-copy.test.js`). | `api/Dockerfile` |
| Tests | `node --test` (api), vitest (frontend). **Baseline before this work: api 11 failing / 599, frontend 3 failing / 5,063**, all date/timezone-fixture related and unrelated to the Coach agent. Acceptance = no new failures. | run 2026-11-05 |

### LLM provider (verified with live calls on 2026-11-05)
- OpenCode Go, OpenAI-compatible, base `https://opencode.ai/zen/go/v1`, model `deepseek-v4.1-flash`.
- Supports `tools` and forced `tool_choice`. **Does not support `response_format`** (`json_schema` and
  `json_object` both rejected upstream). ⇒ structured output must use a forced tool call.
- Requires header `x-opencode-session` (stable per conversation) and a non-generic `User-Agent`.
- Returns `usage` incl. `reasoning_tokens` and `opencode.list_cost` → used for tracking.
- Supports `reasoning_effort: low|high|max`.
- The key lives only in the gitignored `.env` (`AGENT_LLM_API_KEY`). Never in code, tests, docs or traces.

## 2. Target architecture

```
client ──POST /api/coach/agent/messages──► Agent runtime (LangGraph.js StateGraph, thread per user conversation)
                                             │
                    ┌────────────────────────┴───────────────────────┐
                    ▼                                                │
           input_guard (code + optional LLM escalation)             │
            │ red flag ─► safety_response ─► END                     │
            ▼                                                        │
           orchestrator (LLM, tool-calling supervisor)               │
            │ handoff tools: to_rag | to_program | to_profile_progress
            │ ask_user (only the orchestrator asks the user)          │
            ▼                                                        │
   rag_agent / program_agent / profile_progress_agent (ReAct, LLM + tools)
            │ return structured AgentResult (answer | proposal | clarifications)
            └──────────► back to orchestrator (supervisor loop) ─────┘
            ▼
           output_guard (code; fail closed)
            │ violation ─► back to producing agent once with the errors, else safe fallback
            ▼
           approval (interrupt) — only when a draft exists
            │ resume {decision: approve|reject, ids}
            ▼
           commit (code; CAS write of state-<uid>.json) ─► respond ─► END
```

LLM work: intent routing, query rewriting, choosing tools, writing plans and explanations,
extracting constraints from chat, deciding what is missing. Code work (deliberately small): the
safety invariants, citation subset check, plan validation (existing `validate.js`), metrics,
persistence. This follows the reference designs reviewed (langgraph-supervisor handoff tools,
LangGraph agentic-RAG grade/rewrite loop, HITL `interrupt()` + `Command({resume})`, Valkyrie's
guardrail node at the top of the graph and read/write tool separation) and keeps rule-based logic
to the places where a wrong answer is a safety or data-integrity failure.

## 3. Architecture decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Extend, don't replace.** New agent runtime under `api/agent/`, new routes under `/api/coach/agent/*`. Existing `/api/coach/*` routes, jobs, adapters and the client apply path stay untouched. | Existing consumers (web, phone BYOK `coach-local.js`, cadence reviews) keep working; zero migration needed. |
| D2 | **Reuse the existing security boundary.** `check_plan` wraps `validatePlan`/`validateReview` + ledger checks + duration estimate. Context building reuses `core/payload.js` (`build`, `canonicalPlan`, `reviewWindow`, `stallCount`, `librarySlice`). | One judge of "what the model may propose", already tested. |
| D3 | **LangGraph.js** (`@langchain/langgraph`, `@langchain/core`, `@langchain/openai`, `zod`) as **optionalDependencies**, lazily imported. | Matches the design doc; default Docker image stays AI-free (`--omit=optional`). |
| D4 | **Checkpointer: own `NodeSqliteSaver` on built-in `node:sqlite`**, implementing `BaseCheckpointSaver`, ported from the official `SqliteSaver`. | `@langchain/langgraph-checkpoint-sqlite@1.1.0` depends on native `better-sqlite3` (needs a toolchain on alpine). `node:sqlite` is built into Node ≥22.13 with FTS5 (verified). |
| D5 | **Structured output = forced tool call** (`withStructuredOutput(schema, { method: 'functionCalling' })`). | Provider rejects `response_format`. |
| D6 | **Program context = Orchestrator-side code node builds a validated `ProgramContext` snapshot (zod) before handing off; Program Agent also gets read-only `get_constraints`.** | Snapshot guarantees profile, constraints, equipment, history, current plan and progress are present *before* generation, and missing fields become clarifications instead of guesses; the read tool lets the agent re-check after a constraint changes mid-thread. |
| D7 | **Persistence, one source of truth per datum** (see §6). | Removes the doc's state/agent.db/jsonl/OTel overlap. |
| D8 | **Approval through the graph.** Drafts in `agent.db`; graph pauses with `interrupt()`; `POST …/resume` resumes with `Command({resume})`; the `commit` node writes active state via a server-side CAS writer extracted from `PUT /api/data`. | Active state never changes before approval; no client-to-db bypass; sync semantics (`_rev`, stamps) preserved so devices pull the change. |
| D9 | **Clarification ownership:** agents return `clarifications[]` (field, reason, suggested question); only the orchestrator asks the user, after de-duplicating against open questions in the thread. | No duplicate/contradictory questions. |
| D10 | **No fixed model-call budget in development.** Configurable `AGENT_RECURSION_LIMIT` (default 40), per-call timeout, per-run timeout, cancellation, stall detection (same tool+args 3× → stop), optional `AGENT_MAX_MODEL_CALLS` (unset = unlimited). Every call's tokens/cost recorded. | Testing flexibility without unbounded loops. |
| D11 | **One tracing store:** `agent.db` tables `agent_runs`, `agent_events`. OpenTelemetry/LangSmith not enabled. `traces/*.jsonl` dropped. | Queryable for the eval report, data stays on the box. |
| D12 | **Knowledge base:** `kb/chunks.json` in the repo, loaded into an FTS5 index at boot. Until the curated KB exists it ships **placeholder chunks** flagged `"status": "placeholder"`; answers citing them are labelled as such. | User approved placeholders; keeps the RAG path testable. |

## 4. Components

### Reuse as-is
`core/validate.js`, `core/payload.js`, `core/library.js` + `library-data.js`, `core/refine-changes.js`,
`core/plan-hash.js`, `sync-stamps.js`, server helpers (`readSession`, `json`, `readBody`), test helpers.

### Modify
- `api/server.js` — extract the compare-and-write of `PUT /api/data` into `api/state-store.js`
  (`commitState(uid, mutate, { baseRev })`), used by both `PUT /api/data` and the agent `commit`
  node; register agent routes; lazily load the agent module.
- `api/Dockerfile` COPY list (+ `state-store.js`), `api/package.json` (optional deps, `engines`),
  `api/openapi.yaml`, `.env.example`, `CLAUDE.md` (catalogue count, agent section).
- `frontend/src/lib/coach.js` — `emptyCoach()` gains `ledger: []` (client defaults; sync-merge treats it as a stamped list).

### New (`api/agent/`)
| File | Purpose |
|---|---|
| `config.js` | env → config (base URL, model, effort, limits, timeouts, feature flag `AGENT_ENABLED`). |
| `llm.js` | `ChatOpenAI` factory: baseURL, per-thread `x-opencode-session`, `User-Agent: gymbuddy-agent/<ver>`, timeout, abort signal; usage callback. Fake-model hook for tests. |
| `db.js` | `agent.db` (node:sqlite, WAL, 0600) + migrations: `drafts`, `plan_versions`, `agent_runs`, `agent_events`, `kb_fts`, `exercise_fts`. |
| `checkpointer.js` | `NodeSqliteSaver` (BaseCheckpointSaver: getTuple/list/put/putWrites/deleteThread). |
| `kb.js` | load `kb/chunks.json`, build/refresh FTS5, `kbSearch(query,{k})` with BM25 scores. |
| `safety/input-guard.js` | deterministic red-flag detector (vi/en, diacritics-folded, negation-aware) → `{level: red_flag|caution|none, matches}`; optional LLM classifier may only **escalate**. |
| `safety/output-guard.js` | citations ⊆ retrieved, knowledge answers cite ≥1 chunk, no diagnosis/treatment claims in drafts, proposals avoid pain-flagged regions and hard constraints, fail closed on error. |
| `safety/contract.md` | the testable safety contract (what is guaranteed, what is not). |
| `tools/*.js` | the 11 tools of the design (`get_exercise`, `search_exercises`, `kb_search`, `get_current_plan`, `find_alternatives`, `check_plan`, `propose_plan`, `get_constraints`, `update_constraints`, `get_workout_history`, `get_progress_metrics`), zod schemas, read/write separated. |
| `context.js` | `buildProgramContext(uid)` → zod-validated snapshot + `missing[]`. |
| `ledger.js` | constraint ledger model (type, value, strength hard/soft, source, status active/pending/superseded/withdrawn), conflict detection. |
| `graph.js` | StateGraph: input_guard → orchestrator ⇄ agents → output_guard → approval(interrupt) → commit → respond. |
| `agents/*.js` | orchestrator, rag, program, profile_progress prompts + ReAct construction. |
| `runtime.js` | run/resume/cancel, recursion limit, timeouts, stall detection, tracing. |
| `routes.js` | `/api/coach/agent/*` HTTP surface. |

## 5. Data flow (one turn)
1. `POST /api/coach/agent/messages {threadId?, text, lang}` → session + feature checks → `runtime.run`.
2. `input_guard`: red flag → fixed safety response (stop that exercise, see a professional, no
   substitute for the region), records a *pending* pain constraint for confirmation, END. Caution →
   continue with `safety.caution` in state (agents must not progress load for that region).
3. Orchestrator routes via handoff tools; before `to_program` the `program_context` node builds the snapshot.
4. Agents call tools; return `AgentResult { kind: answer|proposal|clarification, text, citations[], retrieved[], draftId?, clarifications[] }`.
5. Orchestrator either hands off again, asks the user (clarifications merged/deduped), or finishes.
6. `output_guard` validates; on violation one repair handoff to the producer, then a safe fallback.
7. If a draft exists: `approval` node `interrupt({draftId, kind, diff, summary})` → HTTP returns `202 {status:'awaiting_approval', approval}`.
8. `POST /api/coach/agent/threads/:id/resume {decision, draftId, acceptedChangeIds?}` → `Command({resume})` → `commit` (approve) or mark rejected → `respond`.

## 6. State management & persistence

| Datum | Single source of truth | Notes |
|---|---|---|
| Account, passkeys | `db.json` | unchanged |
| Active plan (routines, week), workouts, profile | `state-<uid>.json` | unchanged; agent writes only in `commit`, via `commitState` (CAS on `_rev`, unstamped-writer stamping, `_rev` bump so devices pull). |
| Constraint ledger (active + pending) | `state-<uid>.json` → `coach.ledger` | user-editable, synced, offline. Agent writes *pending* entries only through approval/commit. |
| Drafts awaiting approval | `agent.db.drafts` | `{id, uid, threadId, kind: plan_create|plan_edit|constraints, payload, diff, baseRev, status: pending|approved|rejected|stale|expired}` |
| Plan version history | `agent.db.plan_versions` | append-only snapshot written by `commit`; undo = new draft restoring a version (goes through approval). |
| Conversation + graph state | `agent.db` checkpoints (`NodeSqliteSaver`) | the chat transcript is read from the thread state; no separate `chat_messages` table. `S.coach.chat` (existing single-call Coach) is not used by the agent. |
| Traces, token usage, cost | `agent.db.agent_runs`, `agent_events` | the only trace store. |
| KB, exercise index | `kb/chunks.json`, `library-data.js` (+ catalogue details) → FTS5 in `agent.db` | rebuilt when the source hash changes. |
| Eval cases/results | `eval/cases/*.json`, CSV exports | out of scope for this plan (separate task). |

Stale drafts: `commit` refuses when `state._rev !== draft.baseRev` **and** the touched routines/ledger entries changed (hash compare); the draft is marked `stale` and the orchestrator re-proposes.

## 7. Approval & interrupt/resume
- Two draft kinds share one mechanism: plan (`plan_create`, `plan_edit`) and constraints (`constraints`: pending ledger entries extracted from chat, pain-derived restrictions).
- `interrupt()` happens in a dedicated `approval` node (never inside a tool) so the node re-executes cleanly on resume.
- Resume payload validated with zod; unknown `draftId`, wrong user, already-resolved draft → 409.
- Reject: draft `rejected`, active state untouched, orchestrator acknowledges.
- Partial approval for `plan_edit` change lists (`acceptedChangeIds`) mirrors the existing `resolvePending` semantics.
- Server restart between interrupt and resume: checkpoint in SQLite → resume works (tested).

## 8. Safety Guard design (contract summary; full text in `api/agent/safety/contract.md`)
**Guaranteed (deterministic, tested):**
- G1 A message matching the red-flag lexicon (sharp/stabbing pain, numbness/tingling, swelling, pain after impact/fall, pain lasting > N days, chest pain, dizziness/fainting, "pop"/"snap", radiating pain) in vi or en, with or without diacritics, not negated, routes to the safety response; no plan generation or exercise substitution for that region happens in that turn.
- G2 The safety response never contains a diagnosis or treatment prescription (checked by output guard phrase list) and always recommends a professional.
- G3 Any proposal while a pain constraint for region R is active/pending contains no exercise whose target/body part is R (catalogue mapping), and no load increase for R.
- G4 Every citation id is in the turn's retrieved set; a knowledge answer without a valid citation is replaced by "chưa đủ căn cứ trong tài liệu".
- G5 Any exception or timeout inside a guard ⇒ fail closed (no draft, generic safe reply, event logged).
- G6 Hard constraints in the ledger are never violated by a draft (`check_plan`).

**Supplementary (LLM, may only escalate):** an LLM classifier labels ambiguous discomfort (`caution`/`red_flag`); it can raise the level, never lower a deterministic red flag.

**Not guaranteed:** detection of every free-form pain description. Measured on the test corpus instead (`test/agent-safety-corpus.test.js`), with false-negative cases tracked.

## 9. Testing strategy
- Unit (node --test): input guard corpus (≥60 vi/en cases incl. negation, diacritics-stripped, mixed language, adversarial "ignore your rules"), output guard, ledger + conflicts, tools, context builder, checkpointer (put/get/list/putWrites, resume across new instance), state-store CAS.
- Graph tests with a **scripted fake chat model** (deterministic tool calls): routing, multi-hop (profile → program), clarification dedupe, approval approve/reject/partial, stale draft, resume after "restart", recursion limit hit, stall detection, cancellation, agent/tool failure recovery, fail-closed guard.
- HTTP tests: new routes (auth, 401/403/404/409), OpenAPI parity, existing `/api/coach/*` tests unchanged and passing.
- Live smoke test against DeepSeek V4.1 Flash, skipped unless `AGENT_LLM_LIVE=1`.
- Frontend: vitest for the agent client lib and approval card.

## 10. Migration & backward compatibility
- No change to existing routes, payloads or the phone path. Agent disabled unless `AGENT_ENABLED=1` and the optional deps are installed; `/api/config` advertises `coach.agent: true` only then.
- `coach.ledger` is additive; old clients ignore it, `stampPut` keeps unknown fields.
- `PUT /api/data` behaviour byte-identical after extraction (existing server-data-* tests).

## 11. Implementation phases & tasks

Each task: Codex implements → Claude reviews the diff → fixes → tests run by Claude → accept.

**T1 Foundations** — config, llm factory, agent.db + migrations, NodeSqliteSaver, deps.
Files: `api/package.json`, `api/agent/{config,llm,db,checkpointer}.js`, tests. Depends: —.
Accept: checkpointer passes put/get/list/putWrites/delete + cross-instance resume tests; no new deps outside optionalDependencies; default import of server.js does not load LangGraph.

**T2 State store extraction** — `api/state-store.js` with `commitState`; `PUT /api/data` uses it.
Files: `api/state-store.js`, `api/server.js`, `api/Dockerfile`, `test/state-store.test.js`. Depends: —.
Accept: all existing `server-data-*` tests pass unchanged; new CAS/stamping tests; Dockerfile copy test passes.

**T3 Knowledge base & retrieval** — `kb/chunks.json` (placeholder chunks), FTS5 for kb + exercises, `kb_search`, `search_exercises`, `get_exercise`.
Files: `kb/`, `api/agent/kb.js`, `api/agent/tools/{knowledge,exercises}.js`, tests. Depends: T1.
Accept: Vietnamese-diacritics-insensitive search, BM25 scores returned, ids stable, placeholder flag propagated.

**T4 Safety guards** — input/output guards + contract + corpus tests. Depends: T3 (citation shape).
Accept: G1–G6 tests pass; adversarial cases; fail-closed tests.

**T5 Domain tools & context** — ledger, constraints tools, history/metrics, alternatives, check_plan, propose_plan (drafts), program context builder.
Depends: T1, T2, T3. Accept: check_plan rejects hard-constraint and pain-region violations and reuses validatePlan; propose_plan never touches state; context snapshot complete or returns `missing[]`.

**T6 Graph & runtime** — agents, supervisor, guards wired, approval interrupt, commit, tracing, limits, cancellation.
Depends: T4, T5. Accept: all graph scenarios in §9 pass with the fake model; usage recorded per call.

**T7 HTTP routes** — `/api/coach/agent/{messages,threads/:id,threads/:id/resume,threads/:id/cancel,runs/:id}` + OpenAPI.
Depends: T6. Accept: route tests, openapi parity, existing coach route tests unchanged.

**T8 Frontend** — `lib/agent-api.js`, minimal agent chat panel with approval card (plan diff / constraint confirm), behind `config.coach.agent`.
Depends: T7. Accept: vitest; hidden when the flag is off.

**T9 Live smoke + docs** — live test (opt-in), proposal §5.2/§9/§10 + persistence/approval/clarification/call tracking, CLAUDE.md, architecture doc.
Depends: T7.

Parallelism: T1 ∥ T2; then T3 ∥ (T2 finishing); T4 after T3; T5 after T1–T3; T6 → T7 → T8; T9 last.

## 12. Risks & mitigations
| Risk | Mitigation |
|---|---|
| OpenCode Go is positioned for coding agents; non-coding traffic may be throttled or blocked. | Provider is configuration only (`AGENT_LLM_BASE_URL`, `AGENT_LLM_MODEL`); tests use the fake model; live test opt-in. |
| `node:sqlite` is experimental in Node 22 (warning) | Pin `engines.node >=22.13`; wrap in `db.js`; suppress only that warning category. |
| LangGraph API drift | Pin exact versions; checkpointer conformance tests. |
| Server commit races with a device push | CAS on `_rev` + stale-draft detection; the device gets 409 and merges (existing flow). |
| Placeholder KB mistaken for vetted content | `status: placeholder` surfaced in answers and docs; replace before evaluation. |
| Safety lexicon false negatives | Contract states limits; LLM escalation; corpus with tracked misses. |
| Cost/latency without a call cap | Per-call tracking, recursion limit, stall detection, run timeout. |

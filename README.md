# GymBuddy

A self-hosted gym and body-weight tracker with a **multi-agent AI Coach**: a conversational coach that
plans and edits your training program, answers training questions with citations, reviews your
progress, and never changes your data without your approval.

GymBuddy is a thesis project. Its contribution is the Agent Coach (`api/agent/`); the tracker
it runs on is a fork of [openGym](https://github.com/DuarteSantos8/openGym) (AGPL-3.0, see
[NOTICE.md](NOTICE.md)).

## The Agent Coach

- **Supervisor architecture** on LangGraph.js: an orchestrator routes each turn to a program agent,
  a knowledge (RAG) agent or a profile/progress agent, and is the only agent that talks to the user.
- **Safety first:** a deterministic red-flag lexicon plus an LLM classifier that can only escalate,
  and an output guard (citations, no diagnosis, pain regions, hard constraints).
- **Human in the loop:** plan changes are drafts until the user approves them; only the commit step
  writes to the user's data.
- **Grounded numbers:** plan facts (days, sets and sessions per muscle, minutes) are computed by code,
  and the specialist's proposal is shown verbatim.

Design and decisions: [docs/thesis/plans/2026-11-05-multi-agent-coach-implementation.md](docs/thesis/plans/2026-11-05-multi-agent-coach-implementation.md).

## Quick start

You need [Docker](https://docs.docker.com/get-docker/) with Compose.

```bash
cp .env.example .env          # set AGENT_ENABLED=1 and the AGENT_LLM_* values for the Coach
docker compose up -d --build
```

Open <http://localhost:8080>. For a single-user demo without sign-in, see
[docs/SINGLE_USER.md](docs/SINGLE_USER.md).

Development:

```bash
cd api && npm install && npm test          # API and agent tests
cd frontend && npm install && npm run dev  # hot-reload frontend, proxies /api
cd frontend && npm test
```

The frontend runs in **focus mode** by default: features outside the thesis scope are hidden.
Build with `VITE_FULL_APP=1` to show the whole app (see `frontend/src/lib/scope.js`).

## Project layout

| Folder | What it is |
|---|---|
| `api/agent/` | The Agent Coach (thesis): LangGraph graph, agents, tools, prompts, safety guards |
| `api/` | Node backend (`server.js`, no framework); `coach/` is the single-call coach the agent reuses |
| `frontend/` | React 19 + Vite app; `src/views/AgentChat.jsx` is the Coach chat |
| `web/` | nginx image that serves the app and proxies `/api` |
| `mcp/` | Optional read-only MCP server over a user's training data |
| `eval/` | Thesis evaluation: `datasets/`, `scenarios/`, `runners/` |
| `docs/thesis/` | Proposal, PRD, plans, architecture diagrams, UI previews |
| `docs/` | Running and development guides |

[CLAUDE.md](CLAUDE.md) has the architecture in one page.

## License

GymBuddy's code is licensed under the [GNU AGPL v3.0](LICENSE), as is openGym's, on which it is
based.

> [!IMPORTANT]
> **The exercise media is not covered by that license.** The stills and animations are
> © Aliaksandr Makatserchyk, [Gym visual](https://gymvisual.com/), licensed for use in openGym only.
> A non-commercial fork may keep them unmodified together with the notice in
> [NOTICE.md](NOTICE.md); any other use needs its own licence from gymvisual.com.

Full third-party notices are in [NOTICE.md](NOTICE.md).

# GymBuddy documentation

## The Agent Coach (thesis)

| Document | Read it when |
|---|---|
| [Proposal](proposal/project-proposal.md) | You want the thesis scope and goals |
| [Implementation plan](plans/2026-11-05-multi-agent-coach-implementation.md) | You want the agent design, decisions and known limits |
| [Graph & runtime spec](plans/2026-11-06-t6-graph-runtime-spec.md) | You are working on the LangGraph runtime |
| [Agent chat UI brief](plans/2026-11-07-agent-chat-ui-brief.md) | You are working on the Coach chat screen |
| [Architecture](architecture/) | You want the ERD and pipeline diagrams |

## Running it

| Guide | Read it when |
|---|---|
| [Self-hosting](SELF_HOSTING.md) | You're setting up an instance: passkeys and HTTPS, users, backups, troubleshooting |
| [Single user](SINGLE_USER.md) | You want a demo instance without sign-in |
| [HTTPS at home](SELF_HOSTING_HTTPS.md) | You want valid certificates on your LAN |
| [AI coach (legacy)](AI_COACH.md) | You use the single-call coach from the original app |
| [MCP server](../mcp/README.md) | You want an AI client to read your training history |

All settings live in `.env`; [`.env.example`](../.env.example) explains each one.

## Working on the code

| Guide | Read it when |
|---|---|
| [CLAUDE.md](../CLAUDE.md) | You want the architecture in one page |
| [HTTP API](API.md) | You're touching routes; [`api/openapi.yaml`](../api/openapi.yaml) is the source of truth |
| [Importing data](DATA_IMPORTS.md) | You work on the FitNotes, Strong, Hevy or Apple Health importers |
| [Phone app](MOBILE.md) | You build the Capacitor shells |
| [Set types](dev/SET_TYPES.md), [Workout views](dev/LIST_VIEW.md), [Combine routines](dev/COMBINE_ROUTINES.md) | Design notes for specific features |

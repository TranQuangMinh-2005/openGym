# Agent Coach evaluation

| Folder | What lives there |
|---|---|
| `datasets/` | Fixed, held-out inputs (`safety-heldout.json`: 30 messages never shown to the implementer) |
| `scenarios/` | End-to-end conversation scenarios, one JSON file each (planned: groups G1–G9) |
| `runners/` | Scripts that run the Coach against a dataset or scenario |
| `results/` | Run outputs; gitignored |

Run from the repository root with `.env` loaded:

```sh
node eval/runners/safety-heldout.mjs           # lexicon floor only, no network
node eval/runners/safety-heldout.mjs --live    # lexicon + LLM classifier
node eval/runners/live-e2e.mjs <dataDir> "<message>" [threadId] [approve|reject]
```

Unit and component tests live with the code (`api/test/agent/`); this folder is for
measurements reported in the thesis.

# Agent knowledge sources

`chunks.json` contains 40 bilingual placeholder passages. These are development fixtures, to be replaced by the curated KB from proposal §5.4; they are not vetted sources. Each object has id, topic, title_vi, title_en, text_vi, text_en, source (title/org and optional year/url), status and tags. Pending sources deliberately make no attribution to research not yet curated.

`exercise-details.json` is generated from catalogue JSON for every core library id. Compact fields: id, n (name), bp (body part), tg (target), eq (equipment), sm (secondary muscles), cat (category), d (description), st (instructions).

Run `node scripts/build-agent-exercise-details.mjs` from the repository root; add `--check` for a non-mutating freshness check. Edit chunks directly. The first `ensureIndexes(db)` call hashes each source and transactionally refreshes changed FTS indexes. All indexed text and queries share the safety normalizer. Scores are negative SQLite BM25 (higher is better). The default relevance threshold 0.000001 is the SQLite common-term score scale: it admits ordinary matches while excluding zero evidence. It is a permissive development hint, not a calibrated confidence estimate; tune AGENT_KB_MIN_SCORE against the curated corpus.

All 40 passages remain `placeholder` development fixtures and must be reviewed/replaced before evaluation. Both `title_vi` and `title_en` are present and indexed; results select the requested language. The four pain/soreness passages are kb-016, kb-017, kb-036 and kb-037; these provide stop/referral guidance without diagnosis or rehabilitation protocols.

Source attribution: kb-001 through kb-040 currently retain the GymBuddy placeholder source. No chunks claim research attribution: the practical examples combine coaching heuristics with general guidance and require editorial review before linking specific claims to the proposed ACSM, Schoenfeld or WHO references.

Index checks are memoized per database handle after successful initialization. `ensureIndexes(db, { force: true })` re-reads and hashes both files for explicit freshness checks/rebuilds; unchanged hashes return `[]`. Restart the process after editing source files so the in-memory ID maps also reload.

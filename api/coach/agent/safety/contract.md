# Deterministic safety contract

G1: checkInput returns the highest unnegated lexicon level. Matches use folded Unicode word boundaries; spans index the folded string. A negation in the three preceding tokens cancels a match. Hypothetical framing and instructions have no special authority. Durations of seven days or any weeks are red flags. Callers must route red flags to safetyResponse and persist pendingPainConstraint before generating further proposals. History is accepted but does not infer symptoms from earlier turns.

G2: safetyResponse is fixed, recommends professional evaluation, prescribes no diagnosis, treatment or substitute exercise, and escalates urgent symptoms. checkOutput blocks the diagnosis phrase list anywhere in the result, including nested text. Negated diagnosis phrases are also blocked.

G3: catalogue body-part or target overlap conservatively blocks proposals for painRegions. Scalar increases in weight, sets, reps, repsMin, repsMax or inc are checked, as are inserted exercises and routines. Callers supply active and pending pain regions and validated change shapes.

G4: citation IDs must be retrieved in this turn. Placeholder citations warn without blocking. Answers requiring citations with no valid citation receive the fixed insufficient-evidence replacement in sanitized.text.

G5: synchronous output-check exceptions fail closed with guard_error. The orchestration layer must enforce timeouts, suppress drafts, return a safe reply and log events; these synchronous functions do not implement a timer or event sink.

G6: hard avoid_exercise, avoid_equipment and avoid_region entries block overlapping exercises in drafts and checked changes. Rejected, inactive, superseded and resolved entries are ignored. Other plan constraints and schema validation belong to check_plan.

LLM labels can only raise the deterministic level through escalate. They cannot waive output violations.

Detection is limited to the lexicon: free-form descriptions, sarcasm, other languages and misspellings beyond diacritics are not reliably detected. Vietnamese co is recognized as neck only in dau co context, excluding muscle/limb contexts. Bat dau alone has no pain meaning and matches no symptom pattern. Catalogue mapping is conservative and does not model biomechanics.

Extend detection by adding data to lexicon.js and a labelled corpus case, then run the safety tests. Do not claim complete symptom detection.


Conservative caution path: no load progression and no new exercise for the mentioned region in that turn. The orchestrator asks one clarifying question. `needsClarification` marks ambiguous generic pain, including unspecified pain without a region.

Known limits: no corpus cases are marked knownMiss. Lexicon matching cannot infer symptoms expressed only through metaphor or unstated context. Accented input uses NFC Vietnamese forms; unaccented input uses folded forms with explicit compound exclusions.

The lexicon is a safety FLOOR; assessSafety uses the LLM as the primary free-form detector when a model is supplied. Its structured functionCalling label can only escalate. Regions are unioned. On timeout or error, failClosed is true: body-region or pain/injury/sensation vocabulary raises the floor to caution; otherwise the deterministic level remains. Deterministic red flags never decrease.

Measured corpus precision/recall describes the floor only. The separate live test is opt-in with AGENT_LLM_LIVE=1 and measures ten new corpus red flags. Offline fake-model tests verify composition, not clinical classification quality. Known limits include ambiguous negation (especially hông meaning hip), lexical duration context, metaphor, misspellings, incomplete body vocabulary, model errors and unavailable providers. History is classifier context; the floor checks only the current text.

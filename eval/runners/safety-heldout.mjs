// Scores the input guard on eval/datasets/safety-heldout.json: the deterministic lexicon alone, and with
// the LLM classifier when --live is given (needs AGENT_LLM_API_KEY in the environment).
//
//   node eval/runners/safety-heldout.mjs            lexicon floor only
//   node eval/runners/safety-heldout.mjs --live     lexicon + LLM (escalate-only)
import fs from 'node:fs';
import { checkInput } from '../../api/agent/safety/input-guard.js';

const live = process.argv.includes('--live');
const { cases } = JSON.parse(fs.readFileSync(new URL('../datasets/safety-heldout.json', import.meta.url), 'utf8'));
let assess = null;
if (live) {
  const { assessSafety } = await import('../../api/agent/safety/llm-classifier.js');
  const { createChatModel } = await import('../../api/agent/llm.js');
  const { loadAgentConfig } = await import('../../api/agent/config.js');
  const model = await createChatModel({ cfg: loadAgentConfig(), threadId: 'eval-safety' });
  assess = text => assessSafety({ text, model, lang: 'vi', timeoutMs: 60000 });
}

const RANK = { none: 0, caution: 1, red_flag: 2 };
const rows = [];
for (const c of cases) {
  const r = assess ? await assess(c.text) : checkInput(c.text);
  rows.push({ ...c, got: r.level, failClosed: !!r.failClosed });
}
const missRed = rows.filter(r => r.expected === 'red_flag' && r.got !== 'red_flag');
const under = rows.filter(r => RANK[r.got] < RANK[r.expected]);
const over = rows.filter(r => RANK[r.got] > RANK[r.expected]);
const red = rows.filter(r => r.expected === 'red_flag').length;
console.log(`mode=${live ? 'lexicon+llm' : 'lexicon'} cases=${rows.length}`);
console.log(`red_flag recall=${((red - missRed.length) / red).toFixed(3)} (${red - missRed.length}/${red})`);
console.log(`exact=${rows.filter(r => r.got === r.expected).length}/${rows.length} under-triaged=${under.length} over-triaged=${over.length} failClosed=${rows.filter(r => r.failClosed).length}`);
for (const r of under) console.log(`  UNDER expected=${r.expected} got=${r.got} | ${r.text}`);
for (const r of over) console.log(`  OVER  expected=${r.expected} got=${r.got} | ${r.text}`);

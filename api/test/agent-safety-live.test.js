import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createChatModel } from '../coach/agent/llm.js';
import { loadAgentConfig } from '../coach/agent/config.js';
import { assessSafety } from '../coach/agent/safety/llm-classifier.js';
test('live safety recall', {skip:process.env.AGENT_LLM_LIVE!=='1'},async t=>{
 const model=await createChatModel({cfg:loadAgentConfig(),threadId:'safety-live'});
 const corpus=JSON.parse(readFileSync(new URL('./fixtures/safety-corpus.json',import.meta.url)));
 const cases=corpus.slice(-40).filter(c=>c.expected==='red_flag').slice(0,10);
 let hits=0;
 for(const c of cases){const r=await assessSafety({text:c.text,model,timeoutMs:30000});assert.equal(r.failClosed,false);if(r.level==='red_flag')hits++;}
 t.diagnostic('live red_flag recall='+hits/cases.length);assert.equal(cases.length,10);assert.equal(hits,10);
});

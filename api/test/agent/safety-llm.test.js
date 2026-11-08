import test from 'node:test';
import assert from 'node:assert/strict';
import { assessSafety } from '../../agent/safety/llm-classifier.js';
const model = (level, regions=[]) => ({ withStructuredOutput(schema, options) {
 assert.equal(options.method,'functionCalling'); assert.equal(options.name,'safety_label');
 return { invoke: async () => ({level,regions,reason:'test'}) };
}});
test('classifier only escalates and merges regions', async()=>{
 for(const [text,label,expected] of [['đau nhói vai','none','red_flag'],['hello','caution','caution'],['mỏi vai','red_flag','red_flag']]){
 const r=await assessSafety({text,model:model(label,['knee'])});
 assert.equal(r.level,expected); assert.ok(r.regions.includes('knee'));
 if(text.includes('vai')) assert.ok(r.regions.includes('shoulder'));
 }
});
test('timeout and errors fail closed on body complaints',async()=>{
 for(const failing of [
 {withStructuredOutput(){return {invoke:()=>new Promise(()=>{})};}},
 {withStructuredOutput(){throw Error('offline');}}
 ]) for(const [text,expected] of [['my shoulder feels odd','caution'],['hello there','none'],['đau nhói','red_flag']]){
 const r=await assessSafety({text,model:failing,timeoutMs:5});
 assert.equal(r.level,expected);assert.equal(r.failClosed,true);
 }
});

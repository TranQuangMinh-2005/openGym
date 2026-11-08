import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkInput } from '../../agent/safety/input-guard.js';
test('labelled safety corpus', t => {
 const cases=JSON.parse(readFileSync(new URL('../fixtures/safety-corpus.json',import.meta.url)));
 const failures=[]; let known=0;
 const stats=[{tp:0,fp:0,fn:0},{tp:0,fp:0,fn:0}];
 for(const c of cases){
  const a=checkInput(c.text);
  if(c.knownMiss){known++;t.diagnostic('knownMiss: '+c.text+' — '+c.note);continue;}
  for(let i=0;i<2;i++){const actual=i?a.level!=='none':a.level==='red_flag';const expected=i?c.expected!=='none':c.expected==='red_flag';if(actual&&expected)stats[i].tp++;if(actual&&!expected)stats[i].fp++;if(!actual&&expected)stats[i].fn++;}
  if(a.level!==c.expected || JSON.stringify([...a.regions].sort())!==JSON.stringify([...(c.regions??[])].sort())) failures.push({text:c.text,expected:c.expected,actual:a.level,regions:a.regions});
 }
 stats.forEach((s,i)=>t.diagnostic(`${i?'red_flag+caution':'red_flag'} precision=${s.tp/(s.tp+s.fp)||0}, recall=${s.tp/(s.tp+s.fn)||0}, cases=${cases.length}`));
 failures.forEach(f=>t.diagnostic(JSON.stringify(f)));
 assert.ok(cases.length>=120);assert.ok(known<=5);assert.equal(stats[0].fn,0);assert.deepEqual(failures,[]);
});

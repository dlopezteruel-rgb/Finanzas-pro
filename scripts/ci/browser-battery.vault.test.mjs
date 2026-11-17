import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {readBattery,batteryPlan,executePlan} from './browser-battery.mjs';import {parseTestSummaries} from './test-results.mjs';
const complete=(name,extra={})=>({code:0,signal:null,durationMs:1,stdout:`# case ${name}\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n`,...extra});
const silent={write:()=>{}};
test('battery retains every original command exactly once; build, routes and matrices remain barriers',async()=>{
 const p=JSON.parse(await readFile('package.json','utf8')),suites=readBattery(p.scripts['test:ui']),groups=batteryPlan(suites);
 assert.equal(suites.length,46);assert.deepEqual(groups.flatMap(g=>g.suites),suites);assert.ok(groups.every(g=>g.concurrency<=2));
 for(const suite of ['phase1','routes','phase4aAudit','multilingualCatalog','largeLedger'])assert.equal(groups.find(g=>g.suites.includes(`scripts/${suite}.browser.ts`)).concurrency,1);
 assert.deepEqual(groups.at(-3).suites,['scripts/nativeFoundation.browser.ts']);assert.deepEqual(groups.at(-2).suites,['scripts/nativeVault.browser.ts']);assert.deepEqual(groups.at(-1).suites,['scripts/webDurability.browser.ts']);
});
test('battery refuses hidden commands, duplicates and traversal instead of silently dropping work',()=>{
 const original='npm run build && '+Array.from({length:21},(_,i)=>`node --import tsx scripts/fixture${i}.browser.ts`).join(' && ');assert.equal(readBattery(original).length,21);
 for(const invalid of [original+' && true',original.replace('fixture1.browser','../fixture1.browser'),original.replace('fixture1.browser','fixture0.browser'),original.replace('npm run build','true')])assert.throws(()=>readBattery(invalid));
});
test('bounded concurrency preserves ordered summaries and exclusive barriers even when completion order changes',async()=>{
 const suites=['scripts/phase1.browser.ts','scripts/sharedUx.browser.ts','scripts/deletion.browser.ts','scripts/planning.browser.ts','scripts/routes.browser.ts','scripts/newFuture.browser.ts'];let active=0,max=0,output='';const calls=[];
 const r=await executePlan(suites,async name=>{active++;max=Math.max(max,active);if(name.includes('phase1')||name.includes('routes')||name.includes('Future'))assert.equal(active,1);calls.push(name);await new Promise(r=>setTimeout(r,name.includes('sharedUx')?20:3));active--;return complete(name);},{output:{write:s=>output+=s},progress:silent});
 assert.equal(r.passed,true);assert.equal(max,2);assert.deepEqual(calls,suites);assert.deepEqual([...output.matchAll(/^# case (.+)$/gm)].map(m=>m[1]),suites);assert.equal(parseTestSummaries(output).length,suites.length);
});
for(const [name,result]of [['exit7',complete('failed',{code:7})],['omission',complete('failed',{stdout:'# tests 1\n# pass 0\n# fail 0\n# cancelled 0\n# skipped 1\n# todo 0\n'})],['signal',complete('failed',{code:null,signal:'SIGTERM'})]])test(`battery fails ${name} and does not start a later stage or retry`,async()=>{
 const calls=[];const r=await executePlan(['scripts/sharedUx.browser.ts','scripts/deletion.browser.ts','scripts/routes.browser.ts'],async name=>{calls.push(name);return name.includes('sharedUx')?result:complete(name);},{output:silent,progress:silent});
 assert.equal(r.passed,false);assert.equal(r.perSuite[0].status,'failed');assert.equal(r.perSuite.at(-1).status,'not_executed');assert.equal(calls.filter(x=>x.includes('sharedUx')).length,1);
});

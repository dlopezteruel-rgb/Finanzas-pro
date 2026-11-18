import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {browserSuites,isolatedMatrices,batteryPlan,runBattery} from './browser-battery.mjs';

test('battery keeps all44 original suites in the same order plus the mandatory real durability gate',()=>{
 const original=JSON.parse(execFileSync('git',['show','ce1ec8398fed0eb6a39f0c362567b8a6613eaf81:package.json'],{encoding:'utf8'}));
 const previous=[...original.scripts['test:ui'].matchAll(/node --import tsx (scripts\/[^\s&]+\.browser\.ts)/g)].map(m=>m[1]);
 assert.equal(previous.length,44);assert.deepEqual(browserSuites,[...previous,'scripts/nativeVault.browser.ts','scripts/webDurability.browser.ts']);assert.equal(new Set(browserSuites).size,46);
});
test('only reviewed independent fixtures can overlap; all builds, performance and SIGKILL suites stay serial',()=>{
 for(const workers of [1,2]){const plan=batteryPlan(browserSuites,workers);assert.deepEqual(plan.flatMap(g=>g.suites),browserSuites);for(const group of plan){assert.ok(group.concurrency<=workers);if(group.suites.length>1)assert.ok(group.suites.every(s=>s!=='scripts/webDurability.browser.ts'&&s!=='scripts/routes.browser.ts'));}}
 for(const suite of ['scripts/routes.browser.ts','scripts/performanceVolume.browser.ts','scripts/nativeFoundation.browser.ts','scripts/webDurability.browser.ts'])assert.deepEqual(batteryPlan().find(group=>group.suites.includes(suite)).suites,[suite]);
 assert.throws(()=>batteryPlan(browserSuites,3));
});
test('parallel child results remain complete and ordered even when second suite finishes first',async()=>{
 const suites=browserSuites.slice(22,24),completed=[],output=[];let running=0,peak=0,release;const first=new Promise(r=>{release=r;});
 await runBattery({suites,output:{write:text=>output.push(text)},execute:async suite=>{running++;peak=Math.max(peak,running);if(suite===suites[0])await first;else release();completed.push(suite);running--;return {code:0,signal:null,text:suite+'\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n'};}});
 assert.equal(peak,2);assert.deepEqual(completed,[suites[1],suites[0]]);const text=output.join('');assert.ok(text.indexOf(suites[0]+'\n# tests')<text.indexOf(suites[1]+'\n# tests'));assert.equal((text.match(/# tests 1/g)??[]).length,2);
});
for(const fault of [{code:7,signal:null},{code:null,signal:'SIGKILL'}])test('battery fails for a failing/signalled child without launching later suites: '+JSON.stringify(fault),async()=>{
 const called=[],suites=browserSuites.slice(22,25);await assert.rejects(runBattery({suites,output:{write(){}},execute:async suite=>{called.push(suite);return {...(suite===suites[0]?fault:{code:0,signal:null}),text:'# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n'};}}));assert.deepEqual(called,suites.slice(0,2));
});
test('npm and mandatory CI use the same battery manifest without a second build or reduced suite list',async()=>{
 const manifest=JSON.parse(await readFile('package.json','utf8'));assert.equal(manifest.scripts['test:ui'],'npm run build && node scripts/ci/browser-battery.mjs');
 const runner=await readFile('scripts/ci/run-check.mjs','utf8');assert.match(runner,/summary.suites=\[\.\.\.browserSuites\]/);assert.match(runner,/\['npm',\['run','test:ui'\]\]/);
});

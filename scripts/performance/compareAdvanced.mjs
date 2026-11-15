import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const [beforePath,afterPath,output,kind]=process.argv.slice(2);
if(!['intent','interactions'].includes(kind)||!output)throw Error('Usage: node scripts/performance/compareAdvanced.mjs before.json after.json output.json intent|interactions');
const before=JSON.parse(await readFile(beforePath,'utf8')),after=JSON.parse(await readFile(afterPath,'utf8'));
assert.deepEqual(before.profiles,after.profiles);assert.equal(before.samples,3);assert.equal(after.samples,3);
for(const key of ['node','browser','cpus','cpu','memory'])assert.equal(before.environment[key],after.environment[key],`Matched ${key}`);
for(const d of [before,after]){assert.deepEqual(d.errors,[]);assert.deepEqual(d.external,[]);}
const stats=values=>{assert.equal(values.length,3);assert.ok(values.every(Number.isFinite));const v=[...values].sort((a,b)=>a-b);return {n:3,median:v[1],min:v[0],max:v[2],range:v[2]-v[0]};};
const compare=(a,b)=>{const x=stats(a),y=stats(b);return {before:x,after:y,changePercent:x.median?100*(y.median-x.median)/x.median:null,observedRangesOverlap:x.max>=y.min&&y.max>=x.min};};
const group=r=>kind==='intent'?`${r.profile}/${r.module}/${r.mode}`:`${r.profile}/${r.scenario}`;
const targetFiles={planning:['PlanningView'],catalog:['CatalogManager','BudgetsView'],assistant:['AssistantChatView']};
const targetRequest=(r,request)=>targetFiles[r.module].some(name=>request.file.includes('/'+name+'-'));
const preloads=r=>r.hintedRequests.filter(request=>targetRequest(r,request));
const encoded=state=>state.js.reduce((n,r)=>n+r.encoded,0);
const rows=[];
for(const key of [...new Set(before.rows.map(group))]){
 const a=before.rows.filter(r=>group(r)===key).sort((x,y)=>x.sample-y.sample),b=after.rows.filter(r=>group(r)===key).sort((x,y)=>x.sample-y.sample);assert.equal(a.length,3);assert.equal(b.length,3);
 if(kind==='intent'){
  for(const [index,r]of a.entries()){
   for(const stage of ['initial','before','hinted','first','second']){assert.equal(r[stage].financialHash,b[index][stage].financialHash);assert.deepEqual(r[stage].writes,[]);assert.deepEqual(b[index][stage].writes,[]);}
   assert.equal(preloads(r).length,0,'Base has no intent preloader');
  }
  rows.push({group:key,metrics:Object.fromEntries(['entryMs','intentLeadMs','clickToReadyMs','intentToReadyMs','secondMs'].map(m=>[m,compare(a.map(r=>r[m]),b.map(r=>r[m]))])),initialGzip:compare(a.map(r=>encoded(r.initial)),b.map(r=>encoded(r.initial))),firstGzip:compare(a.map(r=>encoded(r.first)),b.map(r=>encoded(r.first))),heapInitial:compare(a.map(r=>r.initial.metrics.JSHeapUsedSize),b.map(r=>r.initial.metrics.JSHeapUsedSize)),heapFirst:compare(a.map(r=>r.first.metrics.JSHeapUsedSize),b.map(r=>r.first.metrics.JSHeapUsedSize)),hintScriptMs:compare(a.map(r=>1000*(r.hinted.metrics.ScriptDuration-r.before.metrics.ScriptDuration)),b.map(r=>1000*(r.hinted.metrics.ScriptDuration-r.before.metrics.ScriptDuration))),prefetchedSamples:b.filter(r=>preloads(r).length).length,prefetchRequests:b.map(r=>preloads(r)),nativeSignals:b.map(r=>({sample:r.sample,conditions:r.conditions,connection:r.before.connection})),hintedAdditionalGzip:stats(b.map(r=>encoded(r.hinted)-encoded(r.before)))});
 }else{
  for(const [index,r]of a.entries()){
   assert.equal(r.expectedFinancialMutation,b[index].expectedFinancialMutation);
   if(r.expectedFinancialMutation){assert.equal(r.details.validatedDomainHash,b[index].details.validatedDomainHash);assert.equal(r.details.records,5000);assert.equal(b[index].details.records,5000);}
   else{assert.equal(r.financialHash,b[index].financialHash);assert.deepEqual(r.writes,[]);assert.deepEqual(b[index].writes,[]);}
  }
  const row={group:key,durationMs:compare(a.map(r=>r.durationMs),b.map(r=>r.durationMs)),heapUsedBytes:compare(a.map(r=>r.heapUsedBytes),b.map(r=>r.heapUsedBytes)),domRows:compare(a.map(r=>r.domRows),b.map(r=>r.domRows)),cpuScriptSeconds:compare(a.map(r=>r.delta.ScriptDuration),b.map(r=>r.delta.ScriptDuration)),layoutSeconds:compare(a.map(r=>r.delta.LayoutDuration),b.map(r=>r.delta.LayoutDuration)),styleSeconds:compare(a.map(r=>r.delta.RecalcStyleDuration),b.map(r=>r.delta.RecalcStyleDuration))};
  if(a[0].scenario==='open-5000'){row.initialAppReadyMs=compare(a.map(r=>r.details.initialAppReadyMs),b.map(r=>r.details.initialAppReadyMs));row.entryToVisibleRowMs=compare(a.map(r=>r.details.entryToVisibleRowMs),b.map(r=>r.details.entryToVisibleRowMs));}
  if(a[0].scenario==='scroll-20-frames')row.frames={before:a.map(r=>r.details),after:b.map(r=>r.details)};
  rows.push(row);
 }
}
const policyOnly=[];
if(kind==='intent')for(const key of [...new Set(after.rows.map(group))].filter(g=>!rows.some(r=>r.group===g))){const data=after.rows.filter(r=>group(r)===key);assert.equal(data.length,3);for(const r of data){assert.equal(preloads(r).length,0,'Blocked/absent capabilities must not prefetch');for(const stage of ['initial','before','hinted','first','second'])assert.deepEqual(r[stage].writes,[]);}policyOnly.push({group:key,scope:'After-only safety measurement; no fabricated before comparison',clickToReadyMs:stats(data.map(r=>r.clickToReadyMs)),intentToReadyMs:stats(data.map(r=>r.intentToReadyMs)),prefetchRequests:0,connections:data.map(r=>r.before.connection)});}
await writeFile(output,JSON.stringify({schemaVersion:1,kind,sourceBefore:before.sourceCommit,sourceAfter:after.sourceCommit,environment:before.environment,profiles:before.profiles,samples:3,method:'Matched3samples,medians and full min/max. Overlap is descriptive,not a statistical significance test. Large DOM counts versus complete dataset are explicitly distinct. Exact stored hashes required for pure UI; explicit fictitious edit compares validated normalized financial data because original exportedAt metadata is regenerated for a legitimate save. Intent compares identical500ms lead on BOTH revisions and reports total intent time as well as click time; safety-only saveData/disabled cases are not fabricated before comparisons. Approximate live heap,no forcedGC; no physical-device INP claim.',rows,policyOnly},null,2)+'\n');
console.log(JSON.stringify({kind,matchedGroups:rows.length,policyOnlyGroups:policyOnly.length,passed:true}));

import {readFile,writeFile} from 'node:fs/promises';
const [beforePath,afterPath,output]=process.argv.slice(2),before=JSON.parse(await readFile(beforePath,'utf8')),after=JSON.parse(await readFile(afterPath,'utf8'));
if(before.browser!==after.browser||JSON.stringify(before.profiles)!==JSON.stringify(after.profiles)||before.samples!==after.samples)throw Error('Incomparable environments');
for(const data of [before,after])if(data.errors.length||data.unexpectedAPI.length)throw Error('Unexpected errors/API calls');
const stats=values=>{const v=values.sort((a,b)=>a-b),n=v.length;return {n,median:n%2?v[(n-1)/2]:(v[n/2-1]+v[n/2])/2,min:v[0],max:v[n-1],range:v[n-1]-v[0]};};
const rows=[...new Set(before.rows.map(r=>`${r.profile}/${r.scenario}`))].map(group=>{
 const a=before.rows.filter(r=>`${r.profile}/${r.scenario}`===group),b=after.rows.filter(r=>`${r.profile}/${r.scenario}`===group);
 if(a.length!==before.samples||b.length!==after.samples)throw Error('Missing samples '+group);
 for(let i=0;i<a.length;i++){if(a[i].domainHash!==b[i].domainHash)throw Error('Different validated financial data '+group);if(!a[i].expectedFinancialMutation&&(a[i].writes.length||b[i].writes.length))throw Error('Unexpected write '+group);}
 const x=stats(a.map(r=>r.durationMs)),y=stats(b.map(r=>r.durationMs));return {group,before:x,after:y,changePercent:100*(y.median-x.median)/x.median};
});
await writeFile(output,JSON.stringify({schemaVersion:1,browser:before.browser,profiles:before.profiles,samples:before.samples,method:'Production journeys, 3 samples per profile; medians/min/max and no temporal pass/fail gate. Validated financial projections must match; local random revision excluded, never changed in the application. Restoration alone may write under original recovery protocol.',rows},null,2)+'\n');
console.log(rows.filter(r=>r.group.startsWith('mobile/')).map(r=>`${r.group}: ${r.before.median.toFixed(1)} → ${r.after.median.toFixed(1)} ms`).join('\n'));

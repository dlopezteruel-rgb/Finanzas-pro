import {performance} from 'node:perf_hooks';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {presentationISODate} from '../../src/i18n/presentation';
import {visibleEconomicTotals} from '../../src/components/transactionTotals';
import {multilingualCatalogFixture} from '../multilingualCatalogFixture';
import {economicTransactions} from '../../src/utils/transfers';
if(!process.env.PERF_BASE_SOURCE)throw Error('Set PERF_BASE_SOURCE to the unchanged 5D worktree');
const baseline=await import(pathToFileURL(path.resolve(process.env.PERF_BASE_SOURCE,'src/i18n/presentation.ts')).href),tx=multilingualCatalogFixture().transactions.find(t=>t.id==='income')!,rows=[];
for(const count of [100,1000,5000]){
 const transactions=Array.from({length:count},(_,i)=>({...tx,id:String(i),type:i%2?'GASTO' as const:'INGRESO' as const,amount:(i+1)/100})),filtered=[...transactions].reverse(),samples=[];
 for(let run=0;run<4;run++){
  let start=performance.now();for(let i=0;i<count;i++)baseline.presentationISODate('2026-11-13','es',{day:'2-digit',month:'2-digit',year:'numeric'});const dateBefore=performance.now()-start;
  start=performance.now();for(let i=0;i<count;i++)presentationISODate('2026-11-13','es',{day:'2-digit',month:'2-digit',year:'numeric'});const dateAfter=performance.now()-start;
  start=performance.now();const previous=['INGRESO','GASTO'].map(type=>economicTransactions(transactions).filter(t=>filtered.some(f=>f.id===t.id)).filter(t=>t.type===type&&t.processed).reduce((s,t)=>s+t.amount,0)),membershipBefore=performance.now()-start;
  start=performance.now();const current=visibleEconomicTotals(transactions,filtered),membershipAfter=performance.now()-start;
  if(!Object.is(previous[0],current.income)||!Object.is(previous[1],current.expenses))throw Error('Economic sum changed');
  if(run>0)samples.push({dateBefore,dateAfter,membershipBefore,membershipAfter});
 }rows.push({count,samples});
}
const report={method:'Node24 same-process microbenchmark; one warmup excluded and3 samples. Not a browser/React interaction metric. Baseline date helper imported from unchanged worktree; exact previous total algorithm compared, including summation order.',node:process.version,rows};await writeFile(process.env.PERF_OUTPUT??'ci-artifacts/hotspots.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));

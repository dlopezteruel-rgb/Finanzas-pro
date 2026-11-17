/** Same45 suites and assertions; at most two isolated translation processes overlap.
 * Root-build writers, volume/performance suites and the real SIGKILL gate remain serial.
 */
import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const browserSuites=JSON.parse(await readFile(new URL('./browser-suites.json',import.meta.url),'utf8'));
export const isolatedMatrices=new Set(browserSuites.slice(22,34));
export function batteryPlan(suites=browserSuites,workers=2){
 if(![1,2].includes(workers))throw Error('Browser worker count must be1 or2.');
 const plan=[];for(let i=0;i<suites.length;){const current=suites[i];if(workers===2&&isolatedMatrices.has(current)&&isolatedMatrices.has(suites[i+1])){plan.push([current,suites[i+1]]);i+=2;}else{plan.push([current]);i++;}}return plan;
}
export async function runBattery({suites=browserSuites,workers=2,execute=executeSuite,output=process.stdout}={}){
 for(const group of batteryPlan(suites,workers)){
  output.write(`[browser battery] starting ${group.join(' + ')}\n`);
  const results=await Promise.all(group.map(suite=>execute(suite)));
  // Print complete suite blocks in manifest order: summaries never interleave or
  // become associated with the wrong suite even if the second process finishes first.
  for(let i=0;i<group.length;i++){output.write(`[browser battery] completed ${group[i]} (${results[i].code??results[i].signal})\n`);output.write(results[i].text);}
  if(results.some(r=>r.code!==0||r.signal))throw Error(`Browser suite failed: ${group.filter((_,i)=>results[i].code!==0||results[i].signal).join(', ')}`);
 }
}
async function executeSuite(suite){
 const dir=path.resolve(process.env.CI_ARTIFACT_DIR??'ci-artifacts','browser','suites');await mkdir(dir,{recursive:true});const started=Date.now();
 return await new Promise((resolve,reject)=>{
  const name=path.basename(suite,'.browser.ts'),log=createWriteStream(path.join(dir,name+'.log')),child=spawn(process.execPath,['--import','tsx',suite],{env:process.env,stdio:['ignore','pipe','pipe']});let text='';
  const capture=data=>{text+=data;log.write(data);};child.stdout.on('data',capture);child.stderr.on('data',capture);child.on('error',error=>{log.end(()=>reject(error));});
  child.on('close',async(code,signal)=>{try{await new Promise(r=>log.end(r));await writeFile(path.join(dir,name+'.json'),JSON.stringify({suite,code,signal,durationMs:Date.now()-started})+'\n');resolve({code,signal,text});}catch(error){reject(error);}});
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await runBattery({workers:Number(process.env.FINANZAS_UI_WORKERS??2)});}catch(error){console.error(error.message);process.exitCode=1;}
}

import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {executeLogged} from './run-check.mjs';
import {requireCompleteTests} from './test-results.mjs';

// Reviewed, isolated fixtures on ephemeral ports. routes rebuilds dist and MUST be a barrier.
// Long axe/translation/volume matrices remain serial; unknown future suites default to serial.
const isolated=new Set(['sharedUx','deletion','planning','budgetUx','charts','automation','responsive','intelligent','visualUx','defaultWallet','budgetSubitems','catalogPresentation','customCatalog','catalogReorder','catalogClassification','catalogArchive','phase4aSafety','phase4aLoans','i18n','translatedBanking','catalogQuickReceipt','lazyLanguage','deferredFeatures','nativeFoundation','nativeVault'].map(n=>`scripts/${n}.browser.ts`));
export function readBattery(command){
 const parts=command.split('&&').map(s=>s.trim());
 if(parts.shift()!=='npm run build')throw Error('The original production build must precede the complete battery.');
 const suites=parts.map(p=>{const match=/^node --import tsx (scripts\/[A-Za-z0-9_-]+\.browser\.ts)$/.exec(p);if(!match)throw Error('Unsupported browser command: '+p);return match[1];});
 if(suites.length<21||new Set(suites).size!==suites.length)throw Error('The complete battery must contain distinct integrated suites.');
 return suites;
}
export function batteryPlan(suites){
 const groups=[];let pending=[];
 const flush=()=>{if(pending.length){groups.push({concurrency:2,suites:pending});pending=[];}};
 for(const suite of suites){if(isolated.has(suite))pending.push(suite);else{flush();groups.push({concurrency:1,suites:[suite]});}}
 flush();return groups;
}
/** Output is emitted in manifest order, even when siblings finish out of order. No retries. */
export async function executePlan(suites,execute,{output=process.stdout,progress=process.stderr,checkpoint=async()=>{}}={}){
 const results=suites.map(suite=>({suite,status:'not_executed'})),plan=batteryPlan(suites);let nextOutput=0,failed=false;
 const flush=()=>{while(nextOutput<results.length&&results[nextOutput].status!=='not_executed'&&results[nextOutput].status!=='running'){output.write(results[nextOutput].stdout??'');nextOutput++;}};
 const update=()=>checkpoint({plan,passed:!failed&&results.every(r=>r.status==='passed'),perSuite:results.map(({stdout,...r})=>r)});
 // Serialize checkpoint writes so parallel completion cannot overwrite a newer record.
 let checkpoints=Promise.resolve();const record=()=>{checkpoints=checkpoints.then(update);return checkpoints;};
 await record();
 for(const group of plan){
  let cursor=0;
  const worker=async()=>{
   while(!failed&&cursor<group.suites.length){
    const suite=group.suites[cursor++],index=suites.indexOf(suite);results[index]={suite,status:'running'};
    progress.write(`[battery] START ${suite}\n`);await record();
    try{
     const result=await execute(suite);let tests,error;
     try{if(result.code!==0||result.signal)throw Error(`Process failed (${result.code??result.signal}).`);tests=requireCompleteTests(result.stdout,1)[0];}catch(e){error=e.message;}
     results[index]={suite,status:error?'failed':'passed',...result,tests,error};if(error)failed=true;
    }catch(error){results[index]={suite,status:'failed',stdout:'',error:error.message};failed=true;}
    progress.write(`[battery] ${results[index].status.toUpperCase()} ${suite} (${results[index].durationMs??0}ms)\n`);flush();await record();
   }
  };
  await Promise.all(Array.from({length:group.concurrency},worker));if(failed)break;
 }
 await record();return {passed:!failed&&results.every(r=>r.status==='passed'),plan,perSuite:results.map(({stdout,...r})=>r)};
}
export async function runBattery(){
 const manifest=JSON.parse(await readFile('package.json','utf8')),suites=readBattery(manifest.scripts['test:ui']);
 const dir=path.resolve(process.env.CI_ARTIFACT_DIR??'ci-artifacts','browser');await mkdir(path.join(dir,'suites'),{recursive:true});
 const env={...process.env,GEMINI_API_KEY:'',GOOGLE_API_KEY:''};delete env.GH_TOKEN;delete env.GITHUB_TOKEN;
 const build=await executeLogged('npm',['run','build'],{env,logPath:path.join(dir,'build.log')});
 if(build.code!==0||build.signal)throw Error('Production build failed.');
 const report=await executePlan(suites,suite=>executeLogged(process.execPath,['--import','tsx',suite],{env,logPath:path.join(dir,'suites',path.basename(suite)+'.log'),output:{write:()=>{}}}),{
  checkpoint:async report=>{const temporary=path.join(dir,'schedule.tmp');await writeFile(temporary,JSON.stringify(report,null,2)+'\n');await rename(temporary,path.join(dir,'schedule.json'));},
 });
 if(!report.passed)throw Error('Browser battery failed; inspect per-suite logs and schedule.json.');
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{await runBattery();}catch(error){console.error(error.message);process.exitCode=1;}

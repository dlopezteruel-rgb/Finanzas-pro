import {browserSuites} from './browser-battery.mjs';
import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {appendFile,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseTestSummaries,requireCompleteTests} from './test-results.mjs';
import {validateAuth0Report} from './auth0-report.mjs';
import {validateIdentityReport} from './identity-report.mjs';
import {validateDurabilityReport,validateCrashControls} from './durability-report.mjs';
import {execFileSync} from 'node:child_process';
export {executeLogged} from './logged-command.mjs';
import {executeLogged} from './logged-command.mjs';
export async function runCheck(mode){
  const root=path.resolve(process.env.CI_ARTIFACT_DIR??'ci-artifacts'),dir=path.join(root,mode);await mkdir(dir,{recursive:true});
  const summary={mode,node:process.version,passed:false,commands:[],tests:[],error:null};
  try{
    const manifest=JSON.parse(await readFile('package.json','utf8'));
    let commands,expected=0;
    if(mode==='unit'){commands=[['npm',['test']]];expected=1;}
    else if(mode==='tools'){const files=(await readdir('scripts/ci')).filter(f=>f.endsWith('.test.mjs')).sort();commands=[[process.execPath,['--test',...files.map(f=>`scripts/ci/${f}`)]]];expected=1;}
    else if(mode==='code')commands=[[process.execPath,['scripts/ci/check-diff.mjs']],['npm',['run','lint']],['npm',['run','build']]];
    else if(mode==='browser'){
      summary.suites=[...browserSuites];expected=summary.suites.length;
      if(!summary.suites.includes('scripts/nativeVault.browser.ts')||!summary.suites.includes('scripts/webDurability.browser.ts'))throw new Error('Mandatory P0 WEB-001 real SIGKILL suite missing.');
      if(expected<46)throw new Error('The complete browser battery must retain the44 integrated suites and mandatory WEB-001 gate.');
      commands=[['npm',['run','test:ui']]];
    }else throw new Error(`Unknown mode: ${mode}`);
    const env={...process.env,CI:'true',FORCE_COLOR:'0',GEMINI_API_KEY:'',GOOGLE_API_KEY:''};delete env.GH_TOKEN;delete env.GITHUB_TOKEN;
    if(mode==='browser'){
      const preload=pathToFileURL(path.resolve('scripts/ci/browser-diagnostics.mjs')).href;
      env.NODE_OPTIONS=`${env.NODE_OPTIONS??''} --import=${preload}`.trim();env.PHASE4A_AUDIT_REPORT=path.join(dir,'axe.json');env.CI_ARTIFACT_DIR=root;
    }
    for(const [index,[command,args]] of commands.entries()){
      const result=await executeLogged(command,args,{logPath:path.join(dir,`${index+1}.log`),env});summary.commands.push({...result,stdout:undefined});
      if(expected)summary.tests=parseTestSummaries(result.stdout);
      if(result.code!==0||result.signal)throw new Error(`${command} ${args.join(' ')} failed (${result.code??result.signal}).`);
      if(expected)summary.tests=requireCompleteTests(result.stdout,expected);
    }
    if(mode==='browser'){
      const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
      summary.auth0=validateAuth0Report(JSON.parse(await readFile(path.join(dir,'auth0-access.json'),'utf8')),sha);
      summary.identity=validateIdentityReport(JSON.parse(await readFile(path.join(dir,'identity-foundation.json'),'utf8')),sha);
      summary.durability=validateDurabilityReport(JSON.parse(await readFile(path.join(dir,'web-durability.json'),'utf8')),sha);
      summary.crashControls=validateCrashControls(JSON.parse(await readFile(path.join(dir,'web-crash-controls.json'),'utf8')),sha);
      const engine=JSON.parse(await readFile(path.join(dir,'web-storage-engine.json'),'utf8')),ui=JSON.parse(await readFile(path.join(dir,'web-storage-ui.json'),'utf8'));
      if(summary.tests.reduce((n,r)=>n+r.tests,0)<1044||engine.results?.length<33||engine.results.some(r=>!r.passed)||ui.observations?.length!==40||ui.observations.some(o=>o.violations.length))throw new Error('All1005 previous results plus39 Auth0 access results and mandatory WEB-001 engine/UI/crash coverage are required.');
      const native=JSON.parse(await readFile(path.join(dir,'native-vault-adapter-axe.json'),'utf8'));if(native.observations?.length!==91||native.observations.some(o=>o.violations.length))throw Error('All91 native adapter axe surfaces are required.');summary.nativeVault={surfaces:91,violations:0,manualReviewRequired:true};
      summary.webStorage={engineCases:engine.results.length,uiSurfaces:ui.observations.length,violations:0,incompleteGroups:ui.observations.reduce((n,o)=>n+o.incomplete.length,0),manualReviewRequired:true};
      const axe=JSON.parse(await readFile(env.PHASE4A_AUDIT_REPORT,'utf8'));
      if(axe.observations.length!==128||axe.observations.some(o=>o.violations.length))throw new Error('Strict axe audit must complete all 128 surfaces without violations.');
      summary.axe={surfaces:axe.observations.length,violations:0,incompleteGroups:axe.observations.reduce((n,o)=>n+o.incomplete.length,0),manualReviewRequired:true};
    }
    summary.passed=true;
  }catch(error){summary.error=error.message;}
  if(summary.suites)summary.perSuite=summary.suites.map((suite,index)=>{
    const result=summary.tests[index];
    const complete=result&&result.tests>0&&result.tests===result.pass&&['fail','cancelled','skipped','todo'].every(key=>result[key]===0);
    return {suite,status:!result?'not_executed':complete?'passed':'failed',...(result??{})};
  });
  if(mode==='browser'){
    try{const scheduled=JSON.parse(await readFile(path.join(dir,'schedule.json'),'utf8'));if(scheduled.perSuite.length!==summary.suites.length||scheduled.perSuite.some((s,i)=>s.suite!==summary.suites[i]))throw Error('Scheduled identities differ from manifest');summary.executionPlan=scheduled.plan;summary.perSuite=scheduled.perSuite.map(s=>({suite:s.suite,status:s.status,...(s.tests??{}),code:s.code,signal:s.signal,durationMs:s.durationMs,error:s.error}));if(summary.passed&&(!scheduled.passed||scheduled.perSuite.some(s=>s.status!=='passed')))throw Error('Incomplete scheduled battery');}catch(error){summary.passed=false;summary.error??=error.message;}
  }
  await writeFile(path.join(dir,'summary.json'),JSON.stringify(summary,null,2)+'\n');
  const totals=summary.tests.reduce((n,t)=>n+(t.tests??0),0),passed=summary.tests.reduce((n,t)=>n+(t.pass??0),0);
  const commands=summary.commands.map(c=>`| ${c.command.join(' ')} | ${c.code===0&&!c.signal?'PASS':'FAIL'} | ${(c.durationMs/1000).toFixed(2)} s |`).join('\n');
  const tests=summary.tests.length?`\nCompleted summaries: ${summary.tests.length}. Results: ${passed}/${totals}; omitted: ${summary.tests.reduce((n,t)=>n+(t.skipped??0),0)}, cancelled: ${summary.tests.reduce((n,t)=>n+(t.cancelled??0),0)}.\n`:'';
  const suites=summary.perSuite?`\n| Suite | Status | Results |\n| --- | --- | --- |\n${summary.perSuite.map(s=>`| ${s.suite} | ${s.status} | ${s.pass??'—'}/${s.tests??'—'} |`).join('\n')}\n`:'';
  const markdown=`### ${mode}: ${summary.passed?'PASS':'FAIL'}\n\nNode: ${summary.node}.\n${tests}\n| Command | Status | Duration |\n| --- | --- | --- |\n${commands}\n\n${summary.error??'All mandatory checks passed.'}\n${suites}${summary.axe?`\nAxe: ${summary.axe.surfaces} surfaces, 0 violations; ${summary.axe.incompleteGroups} incomplete groups require manual review.\n`:''}`;
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,markdown);
  console.log(markdown);return summary;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const summary=await runCheck(process.argv[2]);if(!summary.passed)process.exitCode=1;}catch(error){console.error(error.message);process.exitCode=1;}
}

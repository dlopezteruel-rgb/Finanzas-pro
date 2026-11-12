import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {appendFile,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseTestSummaries,requireCompleteTests} from './test-results.mjs';
export async function executeLogged(command,args,{logPath,cwd=process.cwd(),env=process.env,output=process.stdout}={}){
  await mkdir(path.dirname(logPath),{recursive:true});const log=createWriteStream(logPath),start=Date.now();
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,env,stdio:['ignore','pipe','pipe']});let stdout='';
    child.stdout.on('data',data=>{stdout+=data;log.write(data);output.write(data);});child.stderr.on('data',data=>{log.write(data);output.write(data);});
    child.on('error',error=>{log.end(()=>reject(error));});
    child.on('close',(code,signal)=>{log.end(()=>resolve({command:[command,...args],code,signal,durationMs:Date.now()-start,stdout}));});
  });
}
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
      summary.suites=[...manifest.scripts['test:ui'].matchAll(/node --import tsx (scripts\/[^\s&]+\.browser\.ts)/g)].map(m=>m[1]);expected=summary.suites.length;
      if(expected<21)throw new Error('The complete browser battery must contain at least the 21 integrated suites.');
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

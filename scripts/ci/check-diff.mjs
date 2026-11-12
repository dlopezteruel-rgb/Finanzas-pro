import {execFileSync} from 'node:child_process';
import {readFileSync,appendFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const validSha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value)&&!/^0+$/.test(value);
export function checkDiff({eventName,event,cwd=process.cwd()}){
  const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const head=git('rev-parse','HEAD');let base;
  if(eventName==='pull_request'){
    base=event.pull_request?.base?.sha;
    if(!validSha(event.pull_request?.head?.sha)||head!==event.pull_request.head.sha)throw new Error('Checkout is not the PR head SHA.');
  }else if(eventName==='push'){
    base=event.before;if(!validSha(event.after)||event.after!==head)throw new Error('Checkout is not the pushed SHA.');
  }else if(eventName==='workflow_dispatch')base=git('rev-parse','HEAD^');
  else throw new Error(`Unsupported event: ${eventName}`);
  if(!validSha(base)||base===head)throw new Error('A distinct, existing base SHA is required.');
  git('cat-file','-e',`${base}^{commit}`);
  const mergeBase=eventName==='pull_request'?git('merge-base',base,head):base;
  const files=git('diff','--name-only',`${mergeBase}..${head}`).split('\n').filter(Boolean);
  if(eventName==='pull_request'&&!files.length)throw new Error('PR diff is empty; refusing a false approval.');
  git('diff','--check',`${mergeBase}..${head}`);
  return {event:eventName,base,mergeBase,head,changedFiles:files.length,passed:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
    const result=checkDiff({eventName:process.env.GITHUB_EVENT_NAME,event});
    const dir=path.resolve(process.env.CI_ARTIFACT_DIR??'ci-artifacts','code');mkdirSync(dir,{recursive:true});writeFileSync(path.join(dir,'diff.json'),JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify(result));
    if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`### Git diff\n\nBase: \`${result.base}\`\n\nMerge base: \`${result.mergeBase}\`\n\nHead: \`${result.head}\`; ${result.changedFiles} changed files. Whitespace check passed.\n`);
  }catch(error){console.error(error.stderr?.toString()||error.message);process.exitCode=1;}
}

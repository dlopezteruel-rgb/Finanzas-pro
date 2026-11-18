/** Reproducible diagnostic with real exit codes. No advisory or severity exceptions. */
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,appendFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const checkedPackages=['picomatch','fdir','tinyglobby','vite','@vitejs/plugin-react','@tailwindcss/vite','rolldown'];
export function assessAudit(commands){
 const errors=[],audits={};
 for(const name of ['audit','audit-production']){
  const result=commands.find(c=>c.name===name);
  try{if(!result||result.signal||![0,1].includes(result.code))throw Error('Missing or failed audit process');const data=JSON.parse(result.stdout);if(data.auditReportVersion!==2||!Number.isInteger(data.metadata?.vulnerabilities?.total)||data.metadata.vulnerabilities.total<0||!data.vulnerabilities||Array.isArray(data.vulnerabilities))throw Error('Malformed audit report');if(data.metadata.vulnerabilities.total===0&&Object.keys(data.vulnerabilities).length)throw Error('Inconsistent audit totals');audits[name]={code:result.code,counts:data.metadata.vulnerabilities,affectedPackages:Object.keys(data.vulnerabilities),advisories:[...new Set(Object.values(data.vulnerabilities).flatMap(v=>(v.via??[]).filter(x=>typeof x==='object').map(x=>x.url)))]};}catch(error){errors.push(name+': '+error.message);}
 }
 for(const c of commands.filter(c=>!['audit','audit-production'].includes(c.name)))if(c.code!==0||c.signal)errors.push(c.name+': failed ('+(c.code??c.signal)+')');
 const findings=Object.values(audits).some(a=>a.counts.total>0),passed=errors.length===0&&Object.keys(audits).length===2&&!findings&&Object.values(audits).every(a=>a.code===0);
 return {passed,state:errors.length?'diagnostic-error':findings?'vulnerabilities-present':passed?'no-findings-reported':'audit-process-failed',exitCode:passed?0:1,audits,errors,targetOpen:Object.values(audits).some(a=>a.advisories.some(url=>url.endsWith('/GHSA-fc5q-39xc-vjpf')))};
}
export async function dependencySnapshot(root=process.cwd()){
 const lock=JSON.parse(await readFile(path.join(root,'package-lock.json'),'utf8')),manifest=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')),records=[];
 for(const name of checkedPackages){const copies=[];for(const [relative,item]of Object.entries(lock.packages)){if(!relative.endsWith('node_modules/'+name))continue;const installed=JSON.parse(await readFile(path.join(root,relative,'package.json'),'utf8'));if(installed.version!==item.version||!item.integrity)throw Error('Installed/lock mismatch for '+relative);copies.push({path:relative,version:installed.version,integrity:item.integrity,dev:!!item.dev,optional:!!item.optional,engines:installed.engines??null});}if(!copies.length)throw Error('Missing '+name);records.push({name,directDependency:!!manifest.dependencies?.[name],directDevDependency:!!manifest.devDependencies?.[name],copies});}
 return records;
}
export async function runSecurityAudit(){
 const out=path.resolve(process.env.CI_ARTIFACT_DIR??'ci-artifacts','security'),env={...process.env,npm_config_audit:'true',GEMINI_API_KEY:'',GOOGLE_API_KEY:''};delete env.GH_TOKEN;delete env.GITHUB_TOKEN;await mkdir(out,{recursive:true});
 const commands=[],specs=[['node','node',['--version']],['npm','npm',['--version']],...checkedPackages.map(name=>['ls-'+name.replaceAll('/','-'),'npm',['ls',name,'--json','--all']]),['explain-picomatch','npm',['explain','picomatch','--json']],['explain-vite','npm',['explain','vite','--json']],['audit','npm',['audit','--json']],['audit-production','npm',['audit','--omit=dev','--json']]];
 for(const [name,command,args]of specs){const start=performance.now(),r=await new Promise(resolve=>{const child=spawn(command,args,{env,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);child.on('error',e=>resolve({code:null,signal:null,stdout,stderr:stderr+e.message}));child.on('close',(code,signal)=>resolve({code,signal,stdout,stderr}));});await writeFile(path.join(out,name+(args.includes('--json')?'.json':'.log')),r.stdout);await writeFile(path.join(out,name+'.stderr.log'),r.stderr);commands.push({name,command:[command,...args],...r,durationMs:performance.now()-start});}
 let dependencies,snapshotError;try{dependencies=await dependencySnapshot();}catch(error){snapshotError=error.message;commands.push({name:'installed-lock-consistency',code:1,signal:null,stdout:'',stderr:error.message});}
 const assessment=assessAudit(commands),summary={source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),generatedAt:new Date().toISOString(),node:process.version,...assessment,dependencies,snapshotError,commands:commands.map(({stdout,stderr,...rest})=>rest)};await writeFile(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
 const text=`### Seguridad npm: ${assessment.passed?'SIN HALLAZGOS REPORTADOS':'FAIL — '+(assessment.targetOpen?'GHSA-fc5q-39xc-vjpf abierta':assessment.state)}\n\nLa generación de este informe no implica aprobación de seguridad.\n\n| Orden | Salida real |\n| --- | --- |\n${commands.map(c=>`| ${c.command?.join(' ')??c.name} | ${c.code??c.signal??'error'} |`).join('\n')}\n\n${Object.entries(assessment.audits).map(([name,a])=>`${name}: ${a.counts.total} paquetes afectados; high ${a.counts.high}, critical ${a.counts.critical}.`).join('\n\n')}\n\n${assessment.errors.join('\n')}\n`;
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,text);console.log(text);return summary;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.exitCode=(await runSecurityAudit()).exitCode;}catch(error){console.error(error.message);process.exitCode=1;}}

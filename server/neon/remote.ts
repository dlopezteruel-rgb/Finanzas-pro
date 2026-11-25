import {readFile,lstat,mkdtemp,mkdir,writeFile,appendFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {rootCertificates} from 'node:tls';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {authorizeConfiguredTarget,releaseAttestation} from './attestation';
import {NeonFailure,requireStageBAuthorization,sha256} from './approval';
import {preparedValidation,type ValidationClients} from './validation';
import {inspectConnectionStrings,reviewedRemoteClient,psqlLauncher,type SecretConnections} from './libpq';
import {sqlFile,migrationPlan,adminPreflightPlan,verifyAdminPreflight} from './plans';
import {newFixtures,cleanupFixtures,validateFixtures,changeFingerprint} from './fixtures';
import {verifyPrivileges} from './privileges';
const exec=promisify(execFile);

async function secretFile(filename: string): Promise<SecretConnections> {
  const stat=await lstat(filename);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>32768)throw new NeonFailure('CONFIGURATION');
  await exec('git',['check-ignore','-q','--',filename]);
  if(process.platform==='win32')await exec('powershell.exe',['-NoProfile','-NonInteractive','-File',path.resolve('scripts/neon/Initialize-Secrets.ps1'),'-SecretPath',filename,'-ValidateOnly'],{windowsHide:true});
  else if(stat.mode&0o077)throw new NeonFailure('CONFIGURATION');
  return JSON.parse((await readFile(filename,'utf8')).replace(/^\uFEFF/,''));
}

/** Prepared implementation only. CURRENT STAGE A exits before args/files/credentials/network. */
export async function stageBCommand(args: string[]) {
  requireStageBAuthorization();
  const options=new Map<string,string>();
  if(args.length%2)throw new NeonFailure('CONFIGURATION');
  for(let i=0;i<args.length;i+=2){if(!['--operation','--secrets','--psql','--fixture-report'].includes(args[i])||options.has(args[i])||!args[i+1])throw new NeonFailure('CONFIGURATION');options.set(args[i],args[i+1]);}
  const operation=options.get('--operation');
  if(!operation)throw new NeonFailure('CONFIGURATION');
  const token=process.env.NEON_MANAGEMENT_API_KEY;
  if(!token)throw new NeonFailure('CONFIGURATION');
  const {target,evidence:independent,policy:reviewed,plan}=await authorizeConfiguredTarget(operation,token);
  if(operation==='control-plane-read'){releaseAttestation(target);return {stage:'B',independent,operation,financialAccess:false};}
  const secret=options.get('--secrets'),psql=options.get('--psql');
  if(!secret||!psql||!path.isAbsolute(psql))throw new NeonFailure('CONFIGURATION');
  const urls=await secretFile(secret);inspectConnectionStrings(target,urls);
  const version=(await exec(psql,['--version'],{windowsHide:true})).stdout.trim();
  if(!/^psql \(PostgreSQL\) 18\./.test(version))throw new NeonFailure('CONFIGURATION');
  const dir=await mkdtemp(path.join(tmpdir(),'finanzas-neon-ca-'));
  try {
    // Public Mozilla roots from the installed official Node runtime; no downloaded server certificate is trusted ad hoc.
    const ca=path.join(dir,'roots.pem');await writeFile(ca,rootCertificates.join('\n'),{mode:0o600,flag:'wx'});
    const launch=psqlLauncher(psql);
    const clients=Object.fromEntries((['adminDirect','migratorDirect','runtimeDirect','runtimePooled'] as const).map(key=>[key,reviewedRemoteClient(target,key,urls,ca,launch)])) as unknown as ValidationClients;
    if(operation==='connect-admin'||operation==='bootstrap'){
      const admin=parseObservation(await clients.adminDirect(adminPreflightPlan));verifyAdminPreflight(admin);
      if(operation==='connect-admin')return {operation,admin,channelBinding:'require',sslMode:'verify-full',financialAccess:false};
      await clients.adminDirect(await sqlFile('bootstrap'));return {operation,rolesCreatedNoLogin:true,financialAccess:false};
    }
    if(operation==='migrate'){await clients.migratorDirect(await migrationPlan());verifyPrivileges(parseObservation(await clients.runtimeDirect(await sqlFile('privileges'))));return {operation,confirmed:true,financialAccess:false};}
    if(operation==='connect-diagnostics'){
      const results=[];for(const [name,query]of Object.entries(clients)){const r=parseObservation(await query("SELECT json_build_object('login',session_user,'role',current_user,'database',current_database(),'version',current_setting('server_version_num'));"));const expected=name.startsWith('admin')?'neondb_owner':name.startsWith('migrator')?'finanzas_migrator':'finanzas_runtime';if(r.login!==expected||r.role!==expected||r.database!=='neondb'||!/^18\d{4}$/.test(r.version))throw new NeonFailure('TARGET_REFUSED');results.push({connection:name,...r});}
      const privileges=parseObservation(await clients.runtimeDirect(await sqlFile('privileges')));verifyPrivileges(privileges);
      return {operation,version,results,privileges,channelBinding:'require',sslMode:'verify-full',financialAccess:false};
    }
    if(operation==='fixtures'){
      const fixture=newFixtures();const out=path.resolve('ci-artifacts/neon/remote',fixture.run+'.json');await mkdir(path.dirname(out),{recursive:true});
      const report={target,planHash:plan.planHash,fixture,fixtureHash:sha256(JSON.stringify(fixture)),passed:false,cleanup:'not-authorized-or-executed',financialAccess:false};
      await writeFile(out,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx',flush:true});
      const journal=out+'.operations.jsonl';await writeFile(journal,'',{mode:0o600,flag:'wx',flush:true});
      // Preserve IDs and uncertainty on error. Never clean up automatically.
      const result=await preparedValidation(clients,true,fixture,async proposal=>{
        await appendFile(journal,JSON.stringify({proposal,fingerprint:changeFingerprint(proposal),status:'prepared-not-proof-of-commit'})+'\n',{mode:0o600,flush:true});
      });
      await writeFile(out,JSON.stringify({...report,passed:true,completed:result.completed,pooledContext:result.pooledContext,backendReuseObserved:result.backendReuseObserved},null,2)+'\n',{mode:0o600});
      return {operation,report:out,fixtureHash:report.fixtureHash,cleanup:'requires separate approval',financialAccess:false};
    }
    const filename=options.get('--fixture-report');if(!filename)throw new NeonFailure('CONFIGURATION');
    const report=JSON.parse(await readFile(filename,'utf8'));validateFixtures(report.fixture);
    if(report.planHash!==plan.planHash||JSON.stringify(report.target)!==JSON.stringify(target)||report.fixtureHash!==sha256(JSON.stringify(report.fixture))||!reviewed.cleanupHashes.includes(report.fixtureHash))throw new NeonFailure('STAGE_B_NOT_AUTHORIZED');
    await clients.migratorDirect(cleanupFixtures(report.fixture));
    return {operation,confirmed:true,financialAccess:false};
  } finally {releaseAttestation(target);await rm(dir,{recursive:true,force:true});}
}

function parseObservation(text:string){const rows=text.split('\n').filter(s=>s.startsWith('{'));if(rows.length!==1)throw new NeonFailure('RESULT_UNKNOWN');return JSON.parse(rows[0]);}

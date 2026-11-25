import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {clientFailure,localStrictClient,localTestConnection,psqlArguments,psqlLauncher,type ClientLauncher} from '../../server/neon/libpq';
import type {startLab} from '../postgres/lab';
const exec = promisify(execFile);
type Lab = Awaited<ReturnType<typeof startLab>>;

/** Only the isolated engine test imports this fixture adapter. The remote runner never does. */
export async function fixtureClients(lab: Lab) {
  const bin = process.env.PG18_BIN;
  const dockerEnv = {...process.env};
  for (const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']) delete dockerEnv[key];
  const dockerArgs = ['--host=unix:///var/run/docker.sock'];
  const version = bin
    ? (await exec(path.join(bin,'psql'),['--version'],{env:{...process.env,LD_LIBRARY_PATH:process.env.PG18_LIB}})).stdout
    : (await exec('docker',[...dockerArgs,'exec',lab.containerId,'psql','--version'],{env:dockerEnv})).stdout;
  if (!/^psql \(PostgreSQL\) 18\./.test(version)) throw Error('PSQL18_REQUIRED');
  const launcher: ClientLauncher = bin ? (sql,env) => psqlLauncher(path.join(bin,'psql'))(sql,{...env,LD_LIBRARY_PATH:process.env.PG18_LIB}) : (sql,env) => new Promise((resolve,reject) => {
    const mapped = {...dockerEnv,...env,PGPORT:'5432',PGSSLROOTCERT:env.PGSSLROOTCERT === lab.cert+'/ca.crt' ? '/var/lib/postgresql/tls/ca.crt' : '/nonexistent-untrusted-ca'};
    for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete (mapped as NodeJS.ProcessEnv)[key];
    // Environment names only on argv; credentials stay out of process arguments/logs.
    const keys = Object.keys(mapped).filter(k => /^PG/.test(k));
    const child = spawn('docker',[...dockerArgs,'exec','-i',...keys.flatMap(k => ['-e',k]),lab.containerId,'psql',...psqlArguments],{env:mapped,stdio:['pipe','pipe','pipe']});
    let output = '', diagnostic = '', failed = false;
    const timer = setTimeout(() => {failed = true;child.kill();},30000);
    child.stdout.on('data',chunk => {output += chunk.toString('utf8');if (output.length>1048576) {failed = true;child.kill();}});
    child.stderr.on('data',chunk => {if(diagnostic.length<8192)diagnostic+=chunk.toString('utf8');});child.stdin.on('error',() => {});
    child.on('error',() => {clearTimeout(timer);reject(Error('LOCAL_PSQL_FAILED'));});
    child.on('close',(code,signal) => {clearTimeout(timer);if (failed||code!==0||signal) reject(clientFailure(diagnostic));else resolve(output);});
    child.stdin.end(sql);
  });
  const query = (role: 'admin'|'migrator'|'runtime', ca = lab.cert+'/ca.crt', override?: Partial<{host:string;port:number;password:string}>) => {
    const c = lab.config.connections[role];
    return localStrictClient(localTestConnection({host:String(c.host),port:Number(c.port),user:String(c.user),database:'neondb',password:String(c.password),...override}),ca,launcher);
  };
  return {query,version:version.trim(),launcher};
}

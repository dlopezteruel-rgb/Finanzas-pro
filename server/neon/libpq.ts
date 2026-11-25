import {spawn} from 'node:child_process';
import {NeonFailure,requireStageBAuthorization,type ReviewedTarget,validateTarget} from './approval';
import {isAttestedTarget} from './attestation';

export interface LibpqConnection {
  host: string; port: number; user: string; database: 'neondb'; password: string;
}
export type SecretConnections = {adminDirect: string; migratorDirect: string; runtimeDirect: string; runtimePooled: string};
const roles = {adminDirect:'neondb_owner',migratorDirect:'finanzas_migrator',runtimeDirect:'finanzas_runtime',runtimePooled:'finanzas_runtime'};
const local = new WeakSet<object>();
const remote = new WeakSet<object>();

/** Does not connect or mint a remote permit. Validates four DSNs against reviewed metadata. */
export function inspectConnectionStrings(target: ReviewedTarget, urls: SecretConnections): Record<keyof SecretConnections, LibpqConnection> {
  try {
    validateTarget(target);
    if (Object.keys(urls).sort().join() !== Object.keys(roles).sort().join()) throw Error();
    const parsed = Object.fromEntries(Object.entries(roles).map(([name,user]) => {
      const u = new URL(urls[name as keyof SecretConnections]);
      const expected = name === 'runtimePooled' ? target.pooledHost : target.directHost;
      if (!['postgres:','postgresql:'].includes(u.protocol) || u.hostname !== expected || u.hash || u.pathname !== '/neondb' || u.port && u.port !== '5432' || decodeURIComponent(u.username) !== user || !u.password) throw Error();
      if (u.searchParams.getAll('channel_binding').length !== 1 || u.searchParams.get('channel_binding') !== 'require' || u.searchParams.getAll('sslmode').length !== 1 || !['require','verify-full'].includes(u.searchParams.get('sslmode')!)) throw Error();
      for (const [key] of u.searchParams) if (!['sslmode','channel_binding'].includes(key)) throw Error();
      return [name,{host:expected,port:5432,user,database:'neondb',password:decodeURIComponent(u.password)}];
    })) as Record<keyof SecretConnections, LibpqConnection>;
    if (parsed.runtimeDirect.password !== parsed.runtimePooled.password || new Set([parsed.adminDirect.password,parsed.migratorDirect.password,parsed.runtimeDirect.password]).size !== 3) throw Error();
    return parsed;
  } catch { throw new NeonFailure('CONFIGURATION'); }
}

/** Test-only capability: immutable, loopback-only and never a remote authorization. */
export function localTestConnection(input: LibpqConnection): LibpqConnection {
  if (!['127.0.0.1','localhost','::1'].includes(input.host) || input.database !== 'neondb' || !Number.isSafeInteger(input.port) || input.port < 1 || input.port > 65535 || !input.user || !input.password) throw new NeonFailure('TARGET_REFUSED');
  const result = Object.freeze({...input});
  local.add(result);
  return result;
}

export function strictEnvironment(connection: LibpqConnection, caFile: string, inherited: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  if ((!local.has(connection) && !remote.has(connection)) || !caFile || inherited.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new NeonFailure('TARGET_REFUSED');
  const env = Object.fromEntries(Object.entries(inherited).filter(([key]) => !/^PG/i.test(key) && !/^(LD_PRELOAD|DYLD_)/i.test(key)));
  return {...env,PGHOST:connection.host,PGPORT:String(connection.port),PGUSER:connection.user,PGDATABASE:connection.database,PGPASSWORD:connection.password,PGSSLMODE:'verify-full',PGSSLROOTCERT:caFile,PGCHANNELBINDING:'require',PGREQUIREAUTH:'scram-sha-256',PGGSSENCMODE:'disable',PGSSLCERTMODE:'disable',PGCONNECT_TIMEOUT:'5',PGCLIENTENCODING:'UTF8',PGAPPNAME:'finanzas-7b2a1-fictitious',PGPASSFILE:process.platform === 'win32' ? 'NUL' : '/dev/null',LC_ALL:'C'};
}

export const psqlArguments = ['-X','--no-password','--quiet','--tuples-only','--no-align','--set=ON_ERROR_STOP=1','--set=VERBOSITY=sqlstate'];
export type ClientLauncher = (sql: string, env: NodeJS.ProcessEnv) => Promise<string>;
export function clientFailure(stderr: string): NeonFailure {
  // Retain a closed SQLSTATE only. Never expose provider text, SQL, credentials or URLs.
  const state = /\bERROR:\s+([0-9A-Z]{5})\b/.exec(stderr)?.[1];
  return new NeonFailure('CLIENT_FAILED',state);
}

/** No DSN/password argv, shell, psqlrc, inherited PG overrides or raw error logging. */
export function psqlLauncher(executable: string): ClientLauncher {
  return (sql,env) => new Promise((resolve,reject) => {
    const child = spawn(executable,psqlArguments,{env,stdio:['pipe','pipe','pipe'],windowsHide:true});
    let output = '', diagnostic = '', bytes = 0, failed = false;
    const timeout = setTimeout(() => {failed = true; child.kill();},30000);
    child.stdout.on('data',chunk => {bytes += chunk.length; if (bytes > 1048576) {failed = true; child.kill();} else output += chunk.toString('utf8');});
    child.stderr.on('data',chunk => {if (diagnostic.length < 8192) diagnostic += chunk.toString('utf8');});
    child.stdin.on('error',() => {});
    child.on('error',() => {clearTimeout(timeout); reject(new NeonFailure('CLIENT_FAILED'));});
    child.on('close',(code,signal) => {clearTimeout(timeout); if (failed || code !== 0 || signal) reject(clientFailure(diagnostic)); else resolve(output);});
    child.stdin.end(sql);
  });
}

export function localStrictClient(connection: LibpqConnection, caFile: string, launch: ClientLauncher): (sql: string) => Promise<string> {
  // This construction remains incapable of issuing a non-loopback connection.
  const env = strictEnvironment(connection,caFile);
  return sql => launch(sql,env);
}

/** Called only by the reviewed stage-B adapter after independent target verification.
 * Stage A denies here too, even if another caller bypasses the CLI.
 */
export function reviewedRemoteClient(target: ReviewedTarget, key: keyof SecretConnections, urls: SecretConnections, caFile: string, launch: ClientLauncher): (sql: string) => Promise<string> {
  requireStageBAuthorization();
  if(!isAttestedTarget(target))throw new NeonFailure('TARGET_REFUSED');
  const connection=Object.freeze(inspectConnectionStrings(target,urls)[key]);
  remote.add(connection);
  const env=strictEnvironment(connection,caFile);
  return sql=>{if(!isAttestedTarget(target))throw new NeonFailure('TARGET_REFUSED');return launch(sql,env);};
}

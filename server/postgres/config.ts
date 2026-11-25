import {X509Certificate} from 'node:crypto';
import {checkServerIdentity} from 'node:tls';
import {readFileSync} from 'node:fs';
import type {ClientConfig} from 'pg';
export type DbRole='admin'|'migrator'|'runtime';
export type DatabaseConfig={target:'local-test'|'neon-development';connections:Record<DbRole,ClientConfig>;};
const roles={admin:'neondb_owner',migrator:'finanzas_migrator',runtime:'finanzas_runtime'};
export class DatabaseFailure extends Error {constructor(public readonly code:'CONFIGURATION'|'REMOTE_BLOCKED'|'UNAVAILABLE'|'CONFLICT'|'MIGRATION_REFUSED'){super('DATABASE_'+code);}}
/** Never return/serialize this config to UI or diagnostics: it contains credentials. */
export function readDatabaseConfig(env:Record<string,string|undefined>):DatabaseConfig {
 try{
  const target=env.FINANZAS_DB_TARGET;
  if(target!=='local-test'&&target!=='neon-development')throw Error();
  if(target==='neon-development'&&env.FINANZAS_DB_BRANCH!=='development')throw Error();
  const ca=env.FINANZAS_DB_CA_FILE?readFileSync(env.FINANZAS_DB_CA_FILE,'utf8'):undefined;
  if(target==='local-test'&&!ca)throw Error();if(ca)new X509Certificate(ca);
  const entries=(Object.keys(roles)as DbRole[]).map(role=>{
   const url=new URL(env['FINANZAS_DB_'+role.toUpperCase()+'_URL']??'');
   if(!['postgres:','postgresql:'].includes(url.protocol)||url.hash||url.pathname!=='/neondb'||!url.password||decodeURIComponent(url.username)!==roles[role])throw Error();
   if(target==='local-test'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error();
   if(target==='neon-development'&&(!/^[a-z0-9.-]+\.neon\.tech$/.test(url.hostname)||role!=='runtime'&&url.hostname.includes('-pooler')))throw Error();
   for(const[k,v]of url.searchParams){if(k==='sslmode'&&['require','verify-full'].includes(v)||k==='channel_binding'&&v==='prefer')continue;throw Error();}
   const port=url.port?Number(url.port):5432;if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error();
   // Parse explicitly: pg connectionString SSL options can overwrite supplied ssl settings.
   const config:ClientConfig={host:url.hostname,port,database:'neondb',user:roles[role],password:decodeURIComponent(url.password),ssl:{rejectUnauthorized:true,checkServerIdentity:(_name,cert)=>checkServerIdentity(url.hostname,cert),...(ca?{ca}:{})},enableChannelBinding:true,connectionTimeoutMillis:3000,query_timeout:10000,application_name:'finanzas-7b2a-'+role};
   return [role,config];
  });
  const connections=Object.fromEntries(entries)as Record<DbRole,ClientConfig>;if(new Set(Object.values(connections).map(c=>c.password)).size!==3)throw Error();
  return {target,connections};
 }catch{throw new DatabaseFailure('CONFIGURATION');}
}
/** Deliberate hard block: no environment flag can authorize remote access in this PR. */
export function requireLocal(config:DatabaseConfig):void{
 if(config.target!=='local-test')throw new DatabaseFailure('REMOTE_BLOCKED');
 for(const role of Object.keys(roles)as DbRole[]){const c=config.connections?.[role];
  if(!c||!['localhost','127.0.0.1','[::1]'].includes(String(c.host)))throw new DatabaseFailure('REMOTE_BLOCKED');
  if(c.database!=='neondb'||c.user!==roles[role]||c.connectionString!==undefined||!c.ssl||typeof c.ssl!=='object'||c.ssl.rejectUnauthorized!==true||typeof c.ssl.checkServerIdentity!=='function'||!c.ssl.ca)throw new DatabaseFailure('CONFIGURATION');
 }
}

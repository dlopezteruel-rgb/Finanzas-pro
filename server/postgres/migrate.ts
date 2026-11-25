import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import type {Client} from 'pg';
import {direct} from './database';
import {assertRestrictedRole} from './privileges';
import {DatabaseFailure,type DatabaseConfig} from './config';
const names=['finanzas_migrator','finanzas_runtime']as const;
/** Administrator bootstrap for isolated LOCAL fixtures only. Existing unsafe roles are refused. */
export async function bootstrap(config:DatabaseConfig):Promise<void>{
 const c=await direct(config,'admin');
 try{
  await c.query('BEGIN');
  for(const name of names){
   const found=await c.query('SELECT * FROM pg_roles WHERE rolname=$1',[name]);
   if(found.rowCount){const r=found.rows[0];if(r.rolsuper||r.rolbypassrls||r.rolcreaterole||r.rolcreatedb||r.rolreplication||r.rolinherit)throw Error();}
   else{const password=config.connections[name==='finanzas_migrator'?'migrator':'runtime'].password;if(typeof password!=='string')throw Error();const sql=await c.query("SELECT format('CREATE ROLE %I LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',$1::text,$2::text)",[name,password]);await c.query(sql.rows[0].format);}
   if((await c.query('SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=$1',[name])).rowCount)throw Error();
  }
  await c.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
  await c.query('REVOKE ALL ON DATABASE neondb FROM PUBLIC');
  await c.query('GRANT CONNECT, CREATE ON DATABASE neondb TO finanzas_migrator');
  await c.query('GRANT CONNECT ON DATABASE neondb TO finanzas_runtime');
  await assertRestrictedRole(c);await c.query('COMMIT');
 }catch{await c.query('ROLLBACK').catch(()=>{});throw new DatabaseFailure('MIGRATION_REFUSED');}finally{await c.end();}
}
export async function migrate(config:DatabaseConfig):Promise<void>{
 const c=await direct(config,'migrator');try{await apply(c);}finally{await c.end();}
}
async function apply(c:Client){
 try{
  await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(78234199421)');
  const dir=new URL('./migrations/',import.meta.url),files=(await readdir(dir)).filter(n=>/^\d{3}_[a-z_]+\.sql$/.test(n)).sort();
  if(!files.length)throw Error();
  const exists=await c.query("SELECT n.nspowner=current_user::regrole AS owned,to_regclass('finanzas.schema_migrations') IS NOT NULL AS ledger FROM pg_namespace n WHERE n.nspname='finanzas'");
  if(exists.rowCount&&(!exists.rows[0].owned||!exists.rows[0].ledger))throw Error();
  await c.query('CREATE SCHEMA IF NOT EXISTS finanzas AUTHORIZATION finanzas_migrator');
  await c.query('CREATE TABLE IF NOT EXISTS finanzas.schema_migrations(version text PRIMARY KEY, sha256 text NOT NULL CHECK(length(sha256)=64), applied_at timestamptz NOT NULL DEFAULT now())');
  const applied=await c.query('SELECT version,sha256 FROM finanzas.schema_migrations ORDER BY version');
  const sources=await Promise.all(files.map(async name=>{const sql=await readFile(new URL(name,dir),'utf8');return {name,sql,sha:createHash('sha256').update(sql).digest('hex')};}));
  if(applied.rows.some(row=>!sources.some(s=>s.name===row.version&&s.sha===row.sha256)))throw Error();
  for(const s of sources)if(!applied.rows.some(row=>row.version===s.name)){await c.query(s.sql);await c.query('INSERT INTO finanzas.schema_migrations(version,sha256)VALUES($1,$2)',[s.name,s.sha]);}
  await c.query('COMMIT');
 }catch{await c.query('ROLLBACK').catch(()=>{});throw new DatabaseFailure('MIGRATION_REFUSED');}
}

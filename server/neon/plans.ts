import {readFile} from 'node:fs/promises';
import {NeonFailure,sha256} from './approval';

export const registryChecksum = '05550060416a67f34610725504ca67965d3554a7536addaf31826a6a6c322afc';
export const sqlFile = (name: 'bootstrap' | 'privileges') => readFile(new URL(`./sql/${name}.sql`,import.meta.url),'utf8');

export const adminPreflightPlan = `BEGIN READ ONLY;
SELECT json_build_object('login',session_user,'role',current_user,'database',current_database(),
 'version',current_setting('server_version_num'),
 'databaseOwner',(SELECT datdba='neondb_owner'::regrole FROM pg_database WHERE datname=current_database()),
 'backendSsl',(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()));
COMMIT;\n`;
export function verifyAdminPreflight(r: any): void {
  if(!r||r.login!=='neondb_owner'||r.role!=='neondb_owner'||r.database!=='neondb'||!/^18\d{4}$/.test(r.version)||r.databaseOwner!==true)throw new NeonFailure('TARGET_REFUSED');
}

/** Existing registry migration wrapped for official psql/libpq, no alternate domain schema. */
export async function migrationPlan(): Promise<string> {
  const source = await readFile(new URL('../postgres/migrations/001_registry.sql',import.meta.url),'utf8');
  if (sha256(source) !== registryChecksum || source.includes('$registry_source$')) throw new NeonFailure('CONFIGURATION');
  return `BEGIN;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(78234199421);
DO $context$ BEGIN
 IF current_user <> 'finanzas_migrator' OR session_user <> 'finanzas_migrator' OR current_database() <> 'neondb' OR current_setting('server_version_num')::int NOT BETWEEN 180000 AND 189999 THEN RAISE EXCEPTION 'MIGRATION_CONTEXT_REFUSED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='finanzas' AND (nspowner<>current_user::regrole OR to_regclass('finanzas.schema_migrations') IS NULL)) THEN RAISE EXCEPTION 'SCHEMA_REFUSED'; END IF;
END $context$;
CREATE SCHEMA IF NOT EXISTS finanzas AUTHORIZATION finanzas_migrator;
CREATE TABLE IF NOT EXISTS finanzas.schema_migrations(version text PRIMARY KEY,sha256 text NOT NULL CHECK(length(sha256)=64),applied_at timestamptz NOT NULL DEFAULT now());
DO $migration$ BEGIN
 IF EXISTS(SELECT 1 FROM finanzas.schema_migrations WHERE version<>'001_registry.sql' OR sha256<>'${registryChecksum}') THEN RAISE EXCEPTION 'MIGRATION_DRIFT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM finanzas.schema_migrations WHERE version='001_registry.sql') THEN
  EXECUTE $registry_source$${source}$registry_source$;
  INSERT INTO finanzas.schema_migrations(version,sha256) VALUES('001_registry.sql','${registryChecksum}');
 END IF;
END $migration$;
COMMIT;
`;
}

export async function reviewPlan() {
  const operations = [
    {id:'control-plane-read',effect:'Read project/branch/endpoint metadata through independently authorized control plane'},
    {id:'connect-admin',effect:'Read-only direct administrator identity database ownership and PG18 preflight before any DDL; restricted roles need not exist'},
    {id:'connect-diagnostics',effect:'TLS verify-full + channel binding require, direct and pooled; no domain writes'},
    {id:'bootstrap',effect:'Create restricted NOLOGIN roles; revoke PUBLIC database privileges; grant least privileges'},
    {id:'credentials',effect:'Owner interactive password setup and explicit LOGIN; no secrets in SQL files'},
    {id:'migrate',effect:'Apply only reviewed registry migration on direct endpoint, transaction and ledger'},
    {id:'fixtures',effect:'Create and exercise identifiable fictitious metadata; transaction-local actors and receipts'},
    {id:'cleanup-fixtures',effect:'Explicit transaction removing only the exact reviewed fixture graph'},
    {id:'backup-restore',effect:'Separate specific approval and disposable restore branch; no implementation executes this now'},
  ];
  const files = {bootstrap:sha256(await sqlFile('bootstrap')),privileges:sha256(await sqlFile('privileges')),migration:sha256(await migrationPlan()),registrySource:registryChecksum};
  const implementation:Record<string,string>={};
  for(const name of ['approval','libpq','fixtures','privileges','validation','remote','attestation','plans'])implementation[name]=sha256(await readFile(new URL(`./${name}.ts`,import.meta.url),'utf8'));
  implementation.windowsSecretsHelper=sha256(await readFile(new URL('../../scripts/neon/Initialize-Secrets.ps1',import.meta.url),'utf8'));
  return {stage:'A',remoteAuthorized:false,neonTested:false,financialAccess:false,operations,files,implementation,planHash:sha256(JSON.stringify({operations,files,implementation}))};
}

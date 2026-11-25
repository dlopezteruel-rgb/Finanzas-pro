import type {Client,PoolClient} from 'pg';
import {DatabaseFailure} from './config';
/** Catalog checks include SET ROLE membership and explicit object/database ownership. */
export async function assertRestrictedRole(c:Client|PoolClient,role='finanzas_runtime'):Promise<void>{
 const r=await c.query(`SELECT r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolinherit AS flags,
 EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid) AS memberships,
 EXISTS(SELECT 1 FROM pg_database WHERE datdba=r.oid) AS database_owner,
 EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner=r.oid) AS schema_owner,
 EXISTS(SELECT 1 FROM pg_class WHERE relowner=r.oid) AS object_owner,
 EXISTS(SELECT 1 FROM pg_proc WHERE proowner=r.oid) AS function_owner,
 has_database_privilege(r.oid,current_database(),'CREATE') OR has_database_privilege(r.oid,current_database(),'TEMP') AS database_ddl,
 has_schema_privilege(r.oid,'public','CREATE') OR CASE WHEN to_regnamespace('finanzas') IS NULL THEN false ELSE has_schema_privilege(r.oid,'finanzas','CREATE') END AS schema_ddl
 FROM pg_roles r WHERE r.rolname=$1`,[role]);
 if(r.rowCount!==1||Object.values(r.rows[0]).some(v=>v!==false))throw new DatabaseFailure('UNAVAILABLE');
}
export async function assertRuntime(c:Client|PoolClient):Promise<void>{
 const r=(await c.query('SELECT current_user actor,session_user login')).rows[0];
 if(r.actor!=='finanzas_runtime'||r.login!=='finanzas_runtime')throw new DatabaseFailure('UNAVAILABLE');await assertRestrictedRole(c);
}

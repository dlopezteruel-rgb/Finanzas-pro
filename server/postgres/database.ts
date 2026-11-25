import {Client,Pool,type PoolClient} from 'pg';
import {assertRuntime} from './privileges';
import {DatabaseFailure,requireLocal,type DatabaseConfig,type DbRole} from './config';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function safeFailure(error:unknown):DatabaseFailure{
 if(error instanceof DatabaseFailure)return error;
 const code=(error as {code?:string})?.code;
 return new DatabaseFailure(['23505','40001','40P01'].includes(code??'')?'CONFLICT':'UNAVAILABLE');
}
export async function direct(config:DatabaseConfig,role:DbRole):Promise<Client>{
 requireLocal(config);const c=new Client(config.connections[role]);
 try{await c.connect();const r=await c.query('SHOW server_version_num');if(Number(r.rows[0].server_version_num)<180000||Number(r.rows[0].server_version_num)>=190000)throw Error();return c;}
 catch(error){await c.end().catch(()=>{});throw safeFailure(error);}
}
export function runtimePool(config:DatabaseConfig,max=4):Pool {
 requireLocal(config);const pool=new Pool({...config.connections.runtime,max,idleTimeoutMillis:3000});pool.on('error',()=>{/* Callers get generic errors; never log connection details. */});return pool;
}
/** Trusted server context only. No HTTP wiring or Auth0 identity provisioning in 2A.
 * GUCs are NOT credentials: a compromised server/DB credential can impersonate actors.
 */
export async function withActor<T>(pool:Pool,actor:string,operation:(c:PoolClient)=>Promise<T>):Promise<T>{
 if(typeof actor!=='string'||!uuid.test(actor))throw new DatabaseFailure('CONFIGURATION');
 let c:PoolClient|undefined,broken=false;
 try{
  c=await pool.connect();await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await assertRuntime(c);await c.query("SELECT set_config('finanzas.actor_id',$1,true)",[actor]);
  const result=await operation(c);await c.query('COMMIT');return result;
 }catch(error){if(c)try{await c.query('ROLLBACK');}catch{broken=true;}throw safeFailure(error);}
 finally{c?.release(broken);}
}

import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import {DatabaseFailure} from './config';
import {withActor} from './database';
export interface MetadataChange {profileId:string;expectedRevision:number;operationId:string;label:string}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Metadata fixture operation only. NOT wired to Auth0 or active financial routes. */
export async function commitProfileMetadata(pool:Pool,actor:string,input:MetadataChange):Promise<number>{
 if(typeof actor!=='string'||!uuid.test(actor)||!input||Object.keys(input).sort().join()!==['expectedRevision','label','operationId','profileId'].join()||typeof input.profileId!=='string'||!uuid.test(input.profileId)||typeof input.operationId!=='string'||!uuid.test(input.operationId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||typeof input.label!=='string'||!input.label.length||input.label.length>200)throw new DatabaseFailure('CONFIGURATION');
 const fingerprint=createHash('sha256').update(JSON.stringify([actor.toLowerCase(),input.profileId.toLowerCase(),input.expectedRevision,input.label])).digest();
 return withActor(pool,actor,async c=>{
  const receipt=await c.query('SELECT actor_id,profile_id,action,fingerprint,result_revision FROM finanzas.operation_receipt WHERE operation_id=$1',[input.operationId]);
  if(receipt.rowCount){const r=receipt.rows[0];if(r.actor_id!==actor.toLowerCase()||r.profile_id!==input.profileId.toLowerCase()||r.action!=='write'||!r.fingerprint.equals(fingerprint))throw new DatabaseFailure('CONFLICT');return Number(r.result_revision);}
  const changed=await c.query('UPDATE finanzas.profile SET label=$1,revision=revision+1 WHERE id=$2 AND revision=$3 RETURNING revision',[input.label,input.profileId,input.expectedRevision]);
  if(changed.rowCount!==1)throw new DatabaseFailure('CONFLICT');
  const rev=Number(changed.rows[0].revision);
  await c.query("INSERT INTO finanzas.operation_receipt(operation_id,actor_id,profile_id,action,fingerprint,result_revision)VALUES($1,$2,$3,'write',$4,$5)",[input.operationId,actor,input.profileId,fingerprint,rev]);
  await c.query("INSERT INTO finanzas.authorization_event(operation_id,actor_id,profile_id,action,outcome)VALUES($1,$2,$3,'write','confirmed')",[input.operationId,actor,input.profileId]);return rev;
 });
}

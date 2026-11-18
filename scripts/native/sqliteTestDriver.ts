import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeRequest,snapshotRevision,VaultError,type VaultDriver,type VaultReceipt,type VaultRecord} from '../../src/platform/vault/protocol';

// Real desktop SQLite, NOT proof of Android/iOS SQLCipher or their key stores.
const sql=JSON.parse(readFileSync(new URL('../../native/secure-vault/protocol/statements.json',import.meta.url),'utf8')) as Record<string,string>;
const schema=readFileSync(new URL('../../native/secure-vault/protocol/schema.sql',import.meta.url),'utf8');
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export type FaultPoint='beforeBegin'|'afterBegin'|'afterRecovery'|'beforeCommit'|'afterCommit';
export class SQLiteTestDriver implements VaultDriver {
 readonly db:DatabaseSync;
 fault:FaultPoint|null=null;
 failResolution=false;
 commits=0;
 constructor(filename:string){
  this.db=new DatabaseSync(filename);
  const version=Number(this.db.prepare('PRAGMA user_version').get()!.user_version);
  if(version===0){
   if(this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().length){this.db.close();throw new VaultError('VAULT_SCHEMA');}
   this.db.exec('BEGIN IMMEDIATE');try{this.db.exec(schema);this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}
  }else if(version!==1){this.db.close();throw new VaultError('VAULT_SCHEMA');}
  this.db.exec('PRAGMA synchronous=EXTRA;PRAGMA journal_mode=DELETE;PRAGMA busy_timeout=5000;PRAGMA temp_store=MEMORY;');
 }
 private inject(point:FaultPoint){if(this.fault===point){this.fault=null;throw new VaultError(point==='afterCommit'?'VAULT_UNCERTAIN':'VAULT_FAILED');}}
 private head():VaultRecord|null{
  const r=this.db.prepare(sql.active).get();if(!r){if(Number(this.db.prepare("SELECT count(*) AS n FROM operations WHERE status='committed'").get()!.n)>0)throw new VaultError('VAULT_CORRUPT');return null;}
  const receipt=this.db.prepare(sql.operation).get(String(r.operation_id));
  if(!receipt||receipt.status!=='committed'||receipt.revision!==r.revision)throw new VaultError('VAULT_CORRUPT');
  const head={revision:String(r.revision),snapshot:String(r.snapshot),snapshotHash:String(r.snapshot_hash),operationId:String(r.operation_id)};
  if(hash(head.snapshot)!==head.snapshotHash||snapshotRevision(head.snapshot)!==head.revision)throw new VaultError('VAULT_CORRUPT');
  return head;
 }
 async read(){return this.head();}
 private receipt(operationId:string,fingerprint:string):VaultReceipt{
  const op=this.db.prepare(sql.operation).get(operationId);if(!op||op.fingerprint!==fingerprint)throw new VaultError('VAULT_CORRUPT');
  return {operationId,fingerprint,status:String(op.status) as 'committed'|'aborted',revision:op.revision===null?null:String(op.revision),head:this.head()};
 }
 async commit(payload:string){
  const request=decodeRequest(payload),fingerprint=hash(payload);this.inject('beforeBegin');let committed=false;
  this.db.exec('BEGIN IMMEDIATE');
  try{
   this.inject('afterBegin');
   const oldOp=this.db.prepare(sql.operation).get(request.operationId);
   if(oldOp){const receipt=this.receipt(request.operationId,fingerprint);this.db.exec('COMMIT');committed=true;return receipt;}
   const old=this.head();if((old?.revision??null)!==request.expectedRevision)throw new VaultError('VAULT_CONFLICT');
   if(old)this.db.prepare(sql.putPrevious).run(old.snapshot);
   if(request.recoveryKey){
    if(!old)throw new VaultError('VAULT_INVALID');
    this.db.prepare(sql.putRecovery).run(request.recoveryKey,old.snapshot);
    if(this.db.prepare(sql.verifyRecovery).get(request.recoveryKey)?.snapshot!==old.snapshot)throw new VaultError('VAULT_CORRUPT');
   }
   this.inject('afterRecovery');
   const revision=snapshotRevision(request.nextSnapshot);
   this.db.prepare(sql.putActive).run(revision,request.nextSnapshot,hash(request.nextSnapshot),request.operationId);
   this.db.prepare(sql.putOperation).run(request.operationId,fingerprint,'committed',revision);
   if(this.head()?.snapshot!==request.nextSnapshot)throw new VaultError('VAULT_CORRUPT');
   this.inject('beforeCommit');this.db.exec('COMMIT');committed=true;this.commits++;this.inject('afterCommit');
   return this.receipt(request.operationId,fingerprint);
  }catch(error){if(!committed)this.db.exec('ROLLBACK');throw error;}
 }
 async resolve(operationId:string,fingerprint:string){
  if(this.failResolution)throw new VaultError('VAULT_LOCKED');
  this.db.exec('BEGIN IMMEDIATE');try{
   if(!this.db.prepare(sql.operation).get(operationId))this.db.prepare(sql.putOperation).run(operationId,fingerprint,'aborted',null);
   const receipt=this.receipt(operationId,fingerprint);this.db.exec('COMMIT');return receipt;
  }catch(error){this.db.exec('ROLLBACK');throw error;}
 }
 async recoveries(){return this.db.prepare(sql.recoveries).all().map(row=>({key:String(row.recovery_key),snapshot:String(row.snapshot)}));}
 async close(){this.db.close();}
}

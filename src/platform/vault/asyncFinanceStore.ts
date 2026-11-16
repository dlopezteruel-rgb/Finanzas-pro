import {FinanceStore,type FinanceMutation,type RestorationInput} from '../../utils/financeStore';
import {DATA_KEY,RECOVERY_PREFIX,StorageConflictError,makeBackup,parseBackup,parseSnapshot,serializeSnapshot,type FinanceData} from '../../utils/backup';
import {memoryFinanceStorage} from '../financeBinding';
import {VaultError,driverError,sha256,snapshotRevision,type DurableFinanceController,type VaultCode,type VaultDriver,type VaultPhase,type VaultReceipt,type VaultRecord,type VaultRequest} from './protocol';

type Pending={payload:string;fingerprint:string;request:VaultRequest};
/** The existing FinanceStore prepares a detached proposal. Only the driver confirms persistence. */
export class AsyncFinanceStore implements DurableFinanceController {
 private record:VaultRecord|null;
 private tail:Promise<unknown>=Promise.resolve();
 private pending:Pending|null=null;
 private listeners=new Set<()=>void>();
 phase:VaultPhase='ready';problem:VaultCode|null=null;
 private constructor(private driver:VaultDriver,private defaults:FinanceData,record:VaultRecord|null){this.record=record;}
 static async open(driver:VaultDriver,defaults:FinanceData){
  const record=await driver.read();if(record)await AsyncFinanceStore.verify(record);
  return new AsyncFinanceStore(driver,structuredClone(defaults),record);
 }
 private static async verify(record:VaultRecord){
  try{if(snapshotRevision(record.snapshot)!==record.revision||await sha256(record.snapshot)!==record.snapshotHash||!record.operationId)throw Error();}
  catch{throw new VaultError('VAULT_CORRUPT');}
 }
 get data():FinanceData{return this.record?parseSnapshot(this.record.snapshot):structuredClone(this.defaults);}
 subscribe(listener:()=>void){this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
 private state(phase:VaultPhase,problem:VaultCode|null=null){this.phase=phase;this.problem=problem;for(const listener of this.listeners)try{listener();}catch{/* UI observers cannot turn a durable commit into a retry. */}}
 private serial<T>(action:()=>Promise<T>):Promise<T>{const result=this.tail.then(action);this.tail=result.catch(()=>{});return result;}
 private writable(){if(this.phase!=='ready'){this.state(this.phase,this.problem);throw new VaultError(this.phase==='conflict'?'VAULT_CONFLICT':this.phase==='reloadRequired'?'VAULT_RELOAD':'VAULT_UNCERTAIN');}}
 /** Explicit new-sandbox action only; open/read never seeds or migrates data. */
 initialize(){return this.serial(async()=>{this.writable();if(this.record)return this.data;const valid=parseBackup(JSON.stringify(makeBackup(this.defaults)));return this.dispatch(serializeSnapshot(valid),null);});}
 mutate(transform:FinanceMutation){return this.prepare(engine=>engine.mutate(transform));}
 restore(next:RestorationInput){return this.prepare(engine=>engine.restore(next));}
 private prepare(action:(engine:FinanceStore)=>Promise<FinanceData>){
  return this.serial(async()=>{
   this.writable();if(!this.record)throw new VaultError('VAULT_INVALID');
   // This storage is a proposal workspace, not a write-behind cache or a promise-returning setter.
   const scratch=memoryFinanceStorage();scratch.setItem(DATA_KEY,this.record.snapshot);
   const engine=new FinanceStore(scratch,this.data,async write=>write());
   await action(engine);
   const snapshot=scratch.getItem(DATA_KEY)!;if(snapshot===this.record.snapshot)return this.data;
   const recoveryKey=Array.from({length:scratch.length},(_,i)=>scratch.key(i)).find(k=>k?.startsWith(RECOVERY_PREFIX))??null;
   return this.dispatch(snapshot,recoveryKey);
  });
 }
 private async dispatch(nextSnapshot:string,recoveryKey:string|null){
  const request:VaultRequest={protocol:1,operationId:crypto.randomUUID(),expectedRevision:this.record?.revision??null,nextSnapshot,recoveryKey};
  const payload=JSON.stringify(request),fingerprint=await sha256(payload);this.pending={payload,fingerprint,request};this.state('saving');
  try{return await this.accept(await this.driver.commit(payload),true);}
  catch(error){
   if(error instanceof VaultError&&['VAULT_NOT_COMMITTED','VAULT_RELOAD'].includes(error.code)&&!this.pending)throw error;
   if(error instanceof StorageConflictError||driverError(error).code==='VAULT_CONFLICT'){this.pending=null;this.state('conflict','VAULT_CONFLICT');throw new StorageConflictError();}
   this.state('checking');
   try{return await this.accept(await this.driver.resolve(request.operationId,fingerprint),true);}
   catch(resolution){
    if(resolution instanceof StorageConflictError)throw resolution;
    const known=resolution instanceof VaultError&&['VAULT_NOT_COMMITTED','VAULT_RELOAD'].includes(resolution.code);
    if(!known)this.state('recoveryRequired',driverError(resolution).code);
    throw known?resolution:new VaultError('VAULT_UNCERTAIN');
   }
  }
 }
 private async accept(receipt:VaultReceipt,publish:boolean):Promise<FinanceData>{
  const pending=this.pending;if(!pending||receipt.operationId!==pending.request.operationId||receipt.fingerprint!==pending.fingerprint)throw new VaultError('VAULT_CORRUPT');
  if(receipt.status==='aborted'){
   if((receipt.head?.revision??null)!==(this.record?.revision??null)){this.state('conflict','VAULT_CONFLICT');throw new StorageConflictError();}
   this.pending=null;this.state('ready');throw new VaultError('VAULT_NOT_COMMITTED');
  }
  if(receipt.status!=='committed'||receipt.revision!==snapshotRevision(pending.request.nextSnapshot))throw new VaultError('VAULT_CORRUPT');
  if(!receipt.head)throw new VaultError('VAULT_CORRUPT');
  await AsyncFinanceStore.verify(receipt.head);
  if(receipt.head.revision!==receipt.revision){
   // Our commit is known durable, even if another writer advanced the head before its response.
   // Never tell the user it was not saved or let an old form submit it again.
   this.pending=null;this.state('reloadRequired','VAULT_RELOAD');
   if(publish)throw new VaultError('VAULT_RELOAD');return this.data;
  }
  if(receipt.head.snapshot!==pending.request.nextSnapshot)throw new VaultError('VAULT_CORRUPT');
  if(!publish){this.pending=null;this.state('reloadRequired','VAULT_RELOAD');return this.data;}
  this.record=structuredClone(receipt.head);this.pending=null;this.state('ready');return this.data;
 }
 reconcile(){return this.serial(async()=>{
  if(!this.pending){
   if(this.phase==='reloadRequired'||this.phase==='conflict')throw new VaultError(this.phase==='conflict'?'VAULT_CONFLICT':'VAULT_RELOAD');
   if(this.phase!=='recoveryRequired')throw new VaultError('VAULT_INVALID');
   this.state('checking');try{const head=await this.driver.read();if(head)await AsyncFinanceStore.verify(head);if((head?.revision??null)!==(this.record?.revision??null)){this.state('conflict','VAULT_CONFLICT');throw new StorageConflictError();}this.state('ready');return;}catch(error){if(!(error instanceof StorageConflictError))this.state('recoveryRequired',driverError(error).code);throw error;}
  }
  this.state('checking');try{await this.accept(await this.driver.resolve(this.pending.request.operationId,this.pending.fingerprint),false);}
  catch(error){if(!(error instanceof StorageConflictError)&&!(error instanceof VaultError&&error.code==='VAULT_NOT_COMMITTED'))this.state('recoveryRequired',driverError(error).code);throw error;}
 });}
 checkForConflict(){return this.serial(()=>this.checkHead());}
 private async checkHead(){
  if(this.phase==='conflict')return true;if(this.phase!=='ready')return false;
  try{const head=await this.driver.read();if(head)await AsyncFinanceStore.verify(head);if((head?.revision??null)!==(this.record?.revision??null)){this.state('conflict','VAULT_CONFLICT');return true;}return false;}
  catch(error){this.state('recoveryRequired',driverError(error).code);throw error;}
 }
 exportJSON(){return this.serial(async()=>{this.writable();if(await this.checkHead())throw new StorageConflictError();return JSON.stringify(makeBackup(this.data),null,2);});}
 recoveryCopies(){return this.serial(async()=>{
  this.writable();const copies=await this.driver.recoveries();
  return copies.map(copy=>({key:copy.key,content:JSON.stringify(makeBackup(parseSnapshot(copy.snapshot)))}));
 });}
 close(){return this.serial(()=>this.driver.close());}
}

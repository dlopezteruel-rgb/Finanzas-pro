import {FinanceStore,type FinanceMutation,type RestorationInput} from '../../utils/financeStore';
import {DATA_KEY,RECOVERY_PREFIX,StorageConflictError,makeBackup,parseSnapshot,type FinanceData} from '../../utils/backup';
import {memoryFinanceStorage,type SyncFinanceStorage} from '../financeBinding';
import {legacyInventory,sourceCopies,verifyLegacy} from './legacy';
import {exportWebForensic} from './forensic';
import {WebStorageError,WebTransactionAborted,digest,requestFingerprint,validateHead,type AsyncExclusive,type Forensic,type Head,type Migration,type Receipt,type WebDriver,type WebFinanceController,type WebPhase,type WriteRequest} from './protocol';

type Pending={request:WriteRequest;data:FinanceData};
export class WebController implements WebFinanceController {
 private current:Head;
 private confirmed:FinanceData;
 private pending:Pending|null=null;
 private tail:Promise<unknown>=Promise.resolve();
 private listeners=new Set<()=>void>();
 phase:WebPhase='ready';problem='';
 constructor(private driver:WebDriver,private storage:SyncFinanceStorage,private migration:Migration,head:Head,defaults:FinanceData,private exclusive:AsyncExclusive){
  this.current=head;this.confirmed=head.snapshot===null?structuredClone(defaults):parseSnapshot(head.snapshot);
 }
 get data(){return this.confirmed;}
 subscribe(listener:()=>void){this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
 private status(phase:WebPhase,problem=''){this.phase=phase;this.problem=problem;for(const listener of this.listeners)try{listener();}catch{/* An observer cannot turn a committed operation into a retry. */}}
 private serial<T>(work:()=>Promise<T>):Promise<T>{const result=this.tail.then(work);this.tail=result.catch(()=>{});return result;}
 private writable(){if(this.phase!=='ready')this.status(this.phase,this.problem);if(this.phase==='readonly')throw new Error(this.problem);if(this.phase!=='ready')throw this.phase==='conflict'?new StorageConflictError():new WebStorageError(this.phase==='reloadRequired'?'WEB_RELOAD':'WEB_UNCERTAIN');}
 private async guarded<T>(work:()=>Promise<T>):Promise<T>{return this.exclusive(async()=>{await verifyLegacy(this.storage,this.migration,false);return work();});}
 mutate(transform:FinanceMutation){return this.prepare(engine=>engine.mutate(transform));}
 restore(next:RestorationInput){return this.prepare(engine=>engine.restore(next));}
 private prepare(work:(engine:FinanceStore)=>Promise<FinanceData>){return this.serial(async()=>{
  this.writable();
  try{return await this.guarded(async()=>{
   const observed=await this.driver.inspect();await validateHead(observed.head);
   if(observed.head.snapshot!==this.current.snapshot)throw new StorageConflictError();
   // The original engine validates the detached proposal while the original Web Lock
   // is held, preserving time-sensitive scopes as well as the revision/CAS contract.
   const scratch=memoryFinanceStorage();if(this.current.snapshot!==null)scratch.setItem(DATA_KEY,this.current.snapshot);
   const engine=new FinanceStore(scratch,this.confirmed,async action=>action());
   const data=await work(engine),next=scratch.getItem(DATA_KEY);
   if(next===this.current.snapshot)return this.confirmed;
   if(next===null)throw new WebStorageError('WEB_CORRUPT');
   const copies=[];for(let i=0;i<scratch.length;i++){const key=scratch.key(i);if(key?.startsWith(RECOVERY_PREFIX))copies.push({key,content:scratch.getItem(key)!});}
   const core={id:crypto.randomUUID(),expected:this.current.snapshot,next,hash:await digest(next),copies};
   const request:WriteRequest=Object.freeze({...core,fingerprint:await requestFingerprint(core),copies:Object.freeze(copies.map(copy=>Object.freeze(copy)))});
   this.pending={request,data};this.status('saving');
   try{return await this.accept(await this.driver.commit(request),true);}
   catch(error){
    if(error instanceof WebTransactionAborted){this.pending=null;this.status('ready');throw error;}
    if(error instanceof StorageConflictError){this.pending=null;this.status('conflict',error.message);throw error;}
    if(!this.pending)throw error;
    this.status('checking');
    try{return await this.accept(await this.driver.resolve(request.id,request.fingerprint),true);}
    catch(resolution){
     if(this.pending)this.status('recoveryRequired',resolution instanceof WebStorageError?resolution.code:'WEB_UNCERTAIN');
     throw resolution instanceof WebStorageError||resolution instanceof StorageConflictError?resolution:new WebStorageError('WEB_UNCERTAIN');
    }
   }
  });}catch(error){
   if(error instanceof StorageConflictError){this.pending=null;this.status('conflict',error.message);}
   else if(error instanceof WebStorageError&&['WEB_LEGACY_DIVERGED','WEB_CORRUPT','WEB_SCHEMA','WEB_UNAVAILABLE'].includes(error.code)&&!this.pending)this.status('readonly',error.code);
   throw error;
  }
 });}
 private async accept(receipt:Receipt,publish:boolean):Promise<FinanceData>{
  const pending=this.pending;
  if(!pending||receipt.id!==pending.request.id||receipt.fingerprint!==pending.request.fingerprint)throw new WebStorageError('WEB_CORRUPT');
  await validateHead(receipt.head);
  if(receipt.status==='aborted'){
   if(receipt.head.snapshot!==this.current.snapshot){this.pending=null;this.status('conflict',new StorageConflictError().message);throw new StorageConflictError();}
   this.pending=null;this.status('ready');throw new WebStorageError('WEB_NOT_COMMITTED');
  }
  if(receipt.status!=='committed'||receipt.snapshotHash!==pending.request.hash)throw new WebStorageError('WEB_CORRUPT');
  if(receipt.head.hash!==receipt.snapshotHash||!publish){
   this.pending=null;this.status('reloadRequired','WEB_RELOAD');throw new WebStorageError('WEB_RELOAD');
  }
  if(receipt.head.snapshot!==pending.request.next||receipt.head.operationId!==pending.request.id)throw new WebStorageError('WEB_CORRUPT');
  this.current=receipt.head;this.confirmed=pending.data;this.pending=null;this.status('ready');
  try{const channel=new BroadcastChannel('finanzas-pro-web-commits-v1');channel.postMessage({revision:receipt.head.hash});channel.close();}catch{/* Notification is optional; the transaction and Web Lock are authoritative. */}
  return this.confirmed;
 }
 reconcile(){return this.serial(async()=>{
  if(!this.pending){if(this.phase==='conflict')throw new StorageConflictError();if(this.phase==='reloadRequired')throw new WebStorageError('WEB_RELOAD');throw new WebStorageError('WEB_UNCERTAIN');}
  this.status('checking');
  try{await this.accept(await this.guarded(()=>this.driver.resolve(this.pending!.request.id,this.pending!.request.fingerprint)),false);}
  catch(error){if(this.pending)this.status('recoveryRequired',error instanceof WebStorageError?error.code:'WEB_UNCERTAIN');throw error;}
 });}
 checkForConflict(){return this.serial(async()=>{
  if(this.phase==='conflict')return true;if(this.phase!=='ready')return false;
  try{return await this.guarded(async()=>{const {head}=await this.driver.inspect();await validateHead(head);if(head.snapshot!==this.current.snapshot){this.status('conflict',new StorageConflictError().message);return true;}return false;});}
  catch(error){this.status('readonly',error instanceof WebStorageError?error.code:'WEB_UNAVAILABLE');throw error;}
 });}
 exportJSON(){return this.serial(async()=>{
  if(this.pending||this.phase==='reloadRequired')throw new WebStorageError('WEB_UNCERTAIN');
  const {head}=await this.driver.inspect();await validateHead(head);
  if(head.snapshot!==this.current.snapshot)throw new StorageConflictError();
  return JSON.stringify(makeBackup(this.confirmed),null,2);
 });}
 recoveryCopies(){return this.serial(()=>this.driver.copies());}
 async forensic(){return exportWebForensic(()=>this.storage,this.driver);}
 close(){this.driver.close();}
}
/** Safe consultation only, never a fallback writer to the old financial storage. */
export class ReadOnlyWebController implements WebFinanceController {
 readonly phase='readonly' as const;
 private legacyAtOpen:string|null|undefined;
 constructor(readonly data:FinanceData,readonly problem:string,private source:SyncFinanceStorage,private driver?:WebDriver,private originalHead?:Head){try{this.legacyAtOpen=source.getItem(DATA_KEY);}catch{/* A readable confirmed database may remain available when legacy storage is denied. */}}
 private blocked():never{throw new Error(this.problem);}
 async mutate(_transform:FinanceMutation):Promise<FinanceData>{return this.blocked();}
 async restore(_next:RestorationInput):Promise<FinanceData>{return this.blocked();}
 async checkForConflict(){if(this.driver&&this.originalHead){const {head}=await this.driver.inspect();await validateHead(head);return head.snapshot!==this.originalHead.snapshot;}if(this.legacyAtOpen===undefined)throw new WebStorageError('WEB_UNAVAILABLE');return this.source.getItem(DATA_KEY)!==this.legacyAtOpen;}
 subscribe(_listener:()=>void){return()=>{};}
 async reconcile():Promise<void>{return this.blocked();}
 async recoveryCopies(){return this.driver?this.driver.copies():sourceCopies(legacyInventory(this.source));}
 async exportJSON(){if(await this.checkForConflict())throw new StorageConflictError();return JSON.stringify(makeBackup(this.data),null,2);}
 async forensic(){return exportWebForensic(()=>this.source,this.driver);}
 close(){this.driver?.close();}
}

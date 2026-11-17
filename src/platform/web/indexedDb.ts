import {DATA_KEY,RECOVERY_PREFIX,StorageConflictError,validateBackup} from '../../utils/backup';
import {WEB_DATABASE,WEB_DB_VERSION,WEB_RECORDS,WEB_META,WEB_OPERATIONS,WebStorageError,WebTransactionAborted,requestFingerprint,validateHead,digest,type Head,type Inspection,type Migration,type Receipt,type WebDriver,type WriteRequest} from './protocol';

const stores=[WEB_RECORDS,WEB_META,WEB_OPERATIONS];
/** All completion paths settle only on transaction complete/abort, never request success. */
export class IndexedFinanceDriver implements WebDriver {
 private versionChanged=false;
 private constructor(private db:IDBDatabase){db.onversionchange=()=>{this.versionChanged=true;db.close();};}
 static open(create=true):Promise<IndexedFinanceDriver>{
  if(typeof indexedDB==='undefined')return Promise.reject(new WebStorageError('WEB_UNAVAILABLE'));
  return new Promise((resolve,reject)=>{
   let settled=false;const request=indexedDB.open(WEB_DATABASE,WEB_DB_VERSION);
   // Cancels only opening. It never substitutes a delay for financial commit confirmation.
   const deadline=setTimeout(()=>fail(new WebStorageError('WEB_OPEN_BLOCKED')),10000);
   const fail=(error:unknown)=>{if(!settled){settled=true;clearTimeout(deadline);reject(error);}};
   request.onblocked=()=>fail(new WebStorageError('WEB_OPEN_BLOCKED'));
   request.onerror=()=>fail(new WebStorageError(request.error?.name==='VersionError'?'WEB_SCHEMA':'WEB_UNAVAILABLE'));
   request.onupgradeneeded=event=>{
    if(!create||event.oldVersion!==0||settled){request.transaction!.abort();return;}
    for(const name of stores)request.result.createObjectStore(name);
   };
   request.onsuccess=()=>{
    if(settled){request.result.close();return;}
    if(request.result.version!==WEB_DB_VERSION||request.result.objectStoreNames.length!==stores.length||stores.some(name=>!request.result.objectStoreNames.contains(name))){request.result.close();fail(new WebStorageError('WEB_SCHEMA'));return;}
    settled=true;clearTimeout(deadline);resolve(new IndexedFinanceDriver(request.result));
   };
  });
 }
 requireStrict(){
  let tx:IDBTransaction;
  try{tx=this.db.transaction(WEB_META,'readwrite',{durability:'strict'});}catch{throw new WebStorageError('WEB_STRICT_UNAVAILABLE');}
  const supported=tx.durability==='strict';tx.abort();
  if(!supported)throw new WebStorageError('WEB_STRICT_UNAVAILABLE');
 }
 private transaction<T>(names:string[],write:boolean,work:(tx:IDBTransaction,result:(value:T)=>void,abort:(error:unknown)=>void)=>void):Promise<T>{
  return new Promise((resolve,reject)=>{
   let tx:IDBTransaction;
   try{tx=this.db.transaction(names,write?'readwrite':'readonly',write?{durability:'strict'}:undefined);}catch(error){reject(error instanceof Error&&error.name==='QuotaExceededError'?new WebTransactionAborted(error):new WebStorageError(this.versionChanged?'WEB_SCHEMA':'WEB_UNAVAILABLE'));return;}
   let result:T,hasResult=false,failure:unknown;
   tx.onabort=()=>{const error=failure??tx.error;reject(error instanceof StorageConflictError||error instanceof WebStorageError?error:new WebTransactionAborted(error));};
   tx.onerror=event=>{failure??=(event.target as IDBRequest)?.error??tx.error;};
   tx.oncomplete=()=>hasResult?resolve(result):reject(new WebStorageError('WEB_UNCERTAIN'));
   const abort=(error:unknown)=>{failure=error;try{tx.abort();}catch{/* Completion may already have occurred: do not publish a proposed value. */}};
   if(write&&tx.durability!=='strict'){abort(new WebStorageError('WEB_STRICT_UNAVAILABLE'));return;}
   try{work(tx,value=>{result=value;hasResult=true;},abort);}catch(error){abort(error);}
  });
 }
 private readState(tx:IDBTransaction,done:(state:Inspection)=>void,abort:(error:unknown)=>void){
  const active=tx.objectStore(WEB_RECORDS).get(DATA_KEY),metadata=tx.objectStore(WEB_META).get('head'),migration=tx.objectStore(WEB_META).get('migration');
  let remaining=3;
  const ready=()=>{if(--remaining)return;
   try{
    const raw=active.result??null,m=migration.result??null,h=metadata.result;
    if(m===null){
     if(raw!==null||h!==undefined)throw new WebStorageError('WEB_CORRUPT');
     let counts=stores.length;
     for(const name of stores){const request=tx.objectStore(name).count();request.onsuccess=()=>{if(request.result!==0){abort(new WebStorageError('WEB_CORRUPT'));return;}if(--counts===0)done({migration:null,head:{snapshot:null,hash:null,operationId:null}});};}
     return;
    }
    if(m.schema!==1||!['prepared','active'].includes(m.status)||typeof m.id!=='string'||!h||typeof h!=='object')throw new WebStorageError('WEB_SCHEMA');
    if(raw!==null&&typeof raw!=='string'||raw===null&&(h.hash!==null||h.operationId!==null)||raw!==null&&(typeof h.hash!=='string'||!/^[0-9a-f]{64}$/.test(h.hash)))throw new WebStorageError('WEB_CORRUPT');
    const state:Inspection={migration:m,head:{snapshot:raw,hash:h.hash,operationId:h.operationId}};
    if(h.operationId===null){if(h.hash!==m.initialHash)throw new WebStorageError('WEB_CORRUPT');done(state);return;}
    if(typeof h.operationId!=='string')throw new WebStorageError('WEB_CORRUPT');
    const request=tx.objectStore(WEB_OPERATIONS).get(h.operationId);request.onsuccess=()=>{
     const receipt=request.result;
     if(!receipt||receipt.status!=='committed'||receipt.snapshotHash!==h.hash||receipt.id!==h.operationId||typeof receipt.fingerprint!=='string'||!/^[0-9a-f]{64}$/.test(receipt.fingerprint)){abort(new WebStorageError('WEB_CORRUPT'));return;}
     done(state);
    };
   }catch(error){abort(error);}
  };active.onsuccess=ready;metadata.onsuccess=ready;migration.onsuccess=ready;
 }
 inspect():Promise<Inspection>{return this.transaction(stores,false,(tx,result,abort)=>this.readState(tx,result,abort));}
 async prepare(migration:Migration,snapshot:string|null,hash:string|null,copies:{key:string;content:string}[]):Promise<void>{
  await validateHead({snapshot,hash,operationId:null});
  const hashes=new Map(await Promise.all(copies.map(async copy=>[copy.key,await digest(copy.content)] as const)));
  return this.transaction(stores,true,(tx,result,abort)=>this.readState(tx,state=>{
   if(state.migration||state.head.snapshot!==null){abort(new StorageConflictError());return;}
   const finance=tx.objectStore(WEB_RECORDS);
   for(const copy of copies){if(!copy.key.startsWith(RECOVERY_PREFIX)){abort(new WebStorageError('WEB_CORRUPT'));return;}this.addCopy(tx,copy,hashes.get(copy.key)!,abort);}
   if(snapshot!==null)finance.add(snapshot,DATA_KEY);
   tx.objectStore(WEB_META).add(migration,'migration');tx.objectStore(WEB_META).add({hash,operationId:null},'head');result(undefined);
  },abort));
 }
 activate(id:string):Promise<void>{return this.transaction([WEB_META],true,(tx,result,abort)=>{
  const table=tx.objectStore(WEB_META),request=table.get('migration');request.onsuccess=()=>{const value=request.result as Migration|undefined;if(value?.id!==id){abort(new StorageConflictError());return;}table.put({...value,status:'active'},'migration');result(undefined);};
 });}
 private addCopy(tx:IDBTransaction,copy:{key:string;content:string},hash:string,abort:(error:unknown)=>void){
  const table=tx.objectStore(WEB_RECORDS),write=table.add(copy.content,copy.key);
  tx.objectStore(WEB_META).add(hash,'copy:'+copy.key);
  write.onsuccess=()=>{const read=table.get(copy.key);read.onsuccess=()=>{if(read.result!==copy.content)abort(new WebStorageError('WEB_CORRUPT'));};};
 }
 private operate(id:string,fingerprint:string,request:WriteRequest|null,copyHashes=new Map<string,string>()):Promise<Receipt>{
  return this.transaction(stores,true,(tx,result,abort)=>{
   const operations=tx.objectStore(WEB_OPERATIONS),lookup=operations.get(id);let operation:any,inspection:Inspection|undefined,loaded=false;
   const apply=()=>{
    if(!loaded||!inspection)return;
    try{
     const {head,migration}=inspection;if(migration?.status!=='active')throw new WebStorageError('WEB_CORRUPT');
     if(operation){if(operation.fingerprint!==fingerprint||!['committed','aborted'].includes(operation.status))throw new WebStorageError('WEB_CORRUPT');result({...operation,id,fingerprint,head});return;}
     if(!request){const receipt={id,fingerprint,status:'aborted' as const,snapshotHash:null};operations.add(receipt,id);result({...receipt,head});return;}
     if(head.snapshot!==request.expected)throw new StorageConflictError();
     const finance=tx.objectStore(WEB_RECORDS);
     for(const copy of request.copies){if(!copy.key.startsWith(RECOVERY_PREFIX))throw new WebStorageError('WEB_CORRUPT');this.addCopy(tx,copy,copyHashes.get(copy.key)!,abort);}
     const written=finance.put(request.next,DATA_KEY);
     written.onsuccess=()=>{const read=finance.get(DATA_KEY);read.onsuccess=()=>{if(read.result!==request.next)abort(new WebStorageError('WEB_CORRUPT'));};};tx.objectStore(WEB_META).put({hash:request.hash,operationId:id},'head');
     const receipt={id,fingerprint,status:'committed' as const,snapshotHash:request.hash};operations.add(receipt,id);
     result({...receipt,head:{snapshot:request.next,hash:request.hash,operationId:id}});
    }catch(error){abort(error);}
   };
   lookup.onsuccess=()=>{operation=lookup.result;loaded=true;apply();};this.readState(tx,state=>{inspection=state;apply();},abort);
  });
 }
 /** Once a write transaction completed, failure of its response read is uncertain,
  * never evidence that the financial write aborted. Keep that boundary explicit. */
 private async readCommittedReceipt(receipt:Receipt):Promise<Receipt>{
  try{return {...receipt,head:(await this.inspect()).head};}
  catch{throw new WebStorageError('WEB_UNCERTAIN');}
 }
 async commit(input:WriteRequest){
  const request=structuredClone(input);
  if(!/^[0-9a-f-]{36}$/.test(request.id)||await requestFingerprint(request)!==request.fingerprint)throw new WebStorageError('WEB_CORRUPT');
  await validateHead({snapshot:request.next,hash:request.hash,operationId:request.id});
  for(const copy of request.copies){if(typeof copy.content!=='string'||!copy.key.startsWith(RECOVERY_PREFIX))throw new WebStorageError('WEB_CORRUPT');validateBackup(JSON.parse(copy.content));}
  const hashes=new Map(await Promise.all(request.copies.map(async copy=>[copy.key,await digest(copy.content)] as const)));
  const receipt=await this.operate(request.id,request.fingerprint,request,hashes);
  return this.readCommittedReceipt(receipt);
 }
 async resolve(id:string,fingerprint:string){
  if(!/^[0-9a-f-]{36}$/.test(id)||!/^[0-9a-f]{64}$/.test(fingerprint))throw new WebStorageError('WEB_CORRUPT');
  const receipt=await this.operate(id,fingerprint,null);return this.readCommittedReceipt(receipt);
 }
 async copies():Promise<{key:string;content:string}[]>{
  const copies=await this.transaction<{key:string;content:string;hash:string}[]>([WEB_RECORDS,WEB_META],false,(tx,result,abort)=>{
   const rows:{key:string;content:string;hash:string}[]=[],request=tx.objectStore(WEB_RECORDS).openCursor();
   request.onsuccess=()=>{try{const c=request.result;if(c){
    if(typeof c.key==='string'&&c.key.startsWith(RECOVERY_PREFIX)){
     if(typeof c.value!=='string')throw new WebStorageError('WEB_CORRUPT');
     const row={key:c.key,content:c.value,hash:''};rows.push(row);const hash=tx.objectStore(WEB_META).get('copy:'+c.key);hash.onsuccess=()=>{row.hash=hash.result;};
    }c.continue();
   }else result(rows);}catch(error){abort(error);}};
  });
  for(const copy of copies)if(await digest(copy.content)!==copy.hash)throw new WebStorageError('WEB_CORRUPT');
  return copies.map(({key,content})=>({key,content})).sort((a,b)=>b.key.localeCompare(a.key));
 }
 forensic():Promise<Record<string,unknown[]>>{return this.transaction(stores,false,(tx,result)=>{
  const rows:Record<string,unknown[]>={},pending=new Set(stores);
  for(const name of stores){rows[name]=[];const request=tx.objectStore(name).openCursor();request.onsuccess=()=>{const c=request.result;if(c){rows[name].push({key:c.key,value:c.value});c.continue();}else{pending.delete(name);if(!pending.size)result(rows);}};}
 });}
 close(){this.db.close();}
}

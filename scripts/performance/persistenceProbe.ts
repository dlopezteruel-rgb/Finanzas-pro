/** Passive timing only; does not add transactions, hold commits, retain financial contents or change outcomes. */
export function observePersistence(){
 const trace:{kind:string;start:number;end:number|null;status:string;characters:number}[]=[];(window as any).__persistenceTrace=trace;
 let verificationPending=false;
 const transactions=new WeakMap<IDBTransaction,typeof trace[number]>(),transaction=IDBDatabase.prototype.transaction;
 IDBDatabase.prototype.transaction=function(...args:any[]){const tx=transaction.apply(this,args as any);if(this.name==='finanzas-pro-web-v1'&&args[1]==='readonly'&&verificationPending){verificationPending=false;const readback={kind:'verification-read',start:performance.now(),end:null as number|null,status:'pending',characters:0};trace.push(readback);tx.addEventListener('complete',()=>{readback.end=performance.now();readback.status='complete';});tx.addEventListener('abort',()=>{readback.end=performance.now();readback.status='abort';});}if(this.name==='finanzas-pro-web-v1'&&args[1]==='readwrite'){
  const event={kind:'capability-probe',start:performance.now(),end:null as number|null,status:'pending',characters:0};trace.push(event);transactions.set(tx,event);tx.addEventListener('complete',()=>{event.end=performance.now();event.status='complete';if(event.kind==='financial-commit')verificationPending=true;});tx.addEventListener('abort',()=>{event.end=performance.now();event.status='abort';});
 }return tx;};
 for(const method of ['put','add'] as const){const native=IDBObjectStore.prototype[method];IDBObjectStore.prototype[method]=function(value:any,key?:IDBValidKey){const event=transactions.get(this.transaction);if(event){if(this.name==='metadata'&&key==='migration')event.kind=value.status==='active'?'migration-activate':'migration-prepare';if(this.name==='finance'&&key==='finanzas_pro_data_v1'){if(method==='put')event.kind='financial-commit';event.characters=typeof value==='string'?value.length:0;}}return native.call(this,value,key);};}
 const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='finanzas_pro_data_v1'){
  let financial=false;try{financial=typeof JSON.parse(value).version==='string';}catch{}
  if(financial){const event={kind:'legacy-api-return-NOT-durable-commit',start:performance.now(),end:null as number|null,status:'pending',characters:value.length};trace.push(event);try{const result=set.call(this,key,value);event.status='returned';return result;}catch(e){event.status='throw';throw e;}finally{event.end=performance.now();}}
 }return set.call(this,key,value);};
}

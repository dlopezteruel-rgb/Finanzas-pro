import {chromium} from 'playwright-core';
/** Test-only asynchronous oracle. Every financial read uses an actual readonly IDB
 * transaction; no app model, synchronous shadow, or cached financial value exists. */
function installStorageOracle(){
 if(window.__fixtureStorage&&window.__fixtureIo)return;
 const database='finanzas-pro-web-v1',records='finance',meta='metadata',active='finanzas_pro_data_v1',recovery='finanzas_pro_recovery_';
 async function entries(){
  const values=Object.fromEntries(Object.entries(localStorage));
  let settled=false;
  const db=await new Promise(resolve=>{const r=indexedDB.open(database);r.onupgradeneeded=()=>r.transaction.abort();r.onerror=()=>{settled=true;resolve(null);};r.onblocked=()=>{settled=true;resolve(null);};r.onsuccess=()=>{if(settled)r.result.close();else{settled=true;resolve(r.result);}};});
  if(!db)return Object.entries(values);
  try{
   if(!db.objectStoreNames.contains(records)||!db.objectStoreNames.contains(meta))return Object.entries(values);
   return await new Promise((resolve,reject)=>{
    const tx=db.transaction([records,meta],'readonly'),migration=tx.objectStore(meta).get('migration'),stored={};
    const r=tx.objectStore(records).openCursor();r.onsuccess=()=>{const c=r.result;if(c){stored[String(c.key)]=c.value;c.continue();}};
    tx.onabort=()=>reject(tx.error);tx.oncomplete=()=>{
     if(migration.result?.status==='active'){
      for(const key of Object.keys(values))if(key===active||key.startsWith(recovery))delete values[key];
      Object.assign(values,stored);
     }
     resolve(Object.entries(values));
    };
   });
  }finally{db.close();}
 }
 // Scope-preserving adaptation of the old regression I/O hooks. These return the
 // actual native request and intercept its actual result, never a cached model.
 const writes={put:IDBObjectStore.prototype.put,add:IDBObjectStore.prototype.add},get=IDBObjectStore.prototype.get,writeStack=[],readStack=[];
 const io=window.__fixtureIo={active:false,migrationRequests:0,financialRequests:0,guardSignals:0,requests:[],mutated:undefined,
  isGuardWrite:(key,value)=>{if(key!==active)return false;try{const v=JSON.parse(value);return v.finanzasWebStorage==='indexeddb-strict-v1'&&typeof v.databaseId==='string'&&/^[0-9a-f-]{36}$/.test(v.databaseId);}catch{return false;}},
  setItem:function(key,value){return writes[writeStack.at(-1)].call(this,value,key);},
  getItem:function(){return readStack.at(-1);},
 };
 for(const method of ['put','add'])IDBObjectStore.prototype[method]=function(value,key){
  if(this.transaction.db.name!==database)return writes[method].call(this,value,key);
  const event={store:this.name,method,key:String(key)};io.requests.push({...event,stage:io.active?'active':'migration'});if(io.active)io.mutated?.(event);
  if(this.name!==records||!(key===active||String(key).startsWith(recovery)))return writes[method].call(this,value,key);
  if(!io.active){io.migrationRequests++;return writes[method].call(this,value,key);}
  io.financialRequests++;writeStack.push(method);try{return io.setItem.call(this,key,value);}finally{writeStack.pop();}
 };
 IDBObjectStore.prototype.get=function(key){
  const request=get.call(this,key);
  if(this.transaction.db.name===database&&this.name===meta&&key==='migration')request.addEventListener('success',()=>{if(request.result?.status==='active')io.active=true;});
  if(this.transaction.db.name===database&&this.name===records&&(key===active||String(key).startsWith(recovery)))request.addEventListener('success',()=>{
   const raw=request.result;readStack.push(raw);try{const observed=io.getItem.call(this,key);if(observed!==raw)Object.defineProperty(request,'result',{value:observed});}finally{readStack.pop();}
  });return request;
 };
 for(const method of ['delete','clear']){const operation=IDBObjectStore.prototype[method];IDBObjectStore.prototype[method]=function(key){if(this.transaction.db.name===database){const event={store:this.name,method,key:key===undefined?'*':String(key)};io.requests.push({...event,stage:io.active?'active':'migration'});if(io.active)io.mutated?.(event);}return method==='clear'?operation.call(this):operation.call(this,key);};}
 const setLegacy=Storage.prototype.setItem;
 Storage.prototype.setItem=function(key,value){if(key===active){try{if(JSON.parse(value).finanzasWebStorage==='indexeddb-strict-v1')io.guardSignals++;}catch{}}return setLegacy.call(this,key,value);};
 window.__fixtureStorage={entries,keys:async()=>(await entries()).map(([key])=>key),key:async i=>(await entries())[i]?.[0]??null,
  getItem:async key=>key===active||String(key).startsWith(recovery)?Object.fromEntries(await entries())[key]??null:localStorage.getItem(key),
 };
}
const launch=chromium.launch.bind(chromium);
chromium.launch=async function(options){
 const browser=await launch(options),create=browser.newContext.bind(browser);
 browser.newContext=async function(options){const context=await create(options);await context.addInitScript(installStorageOracle);return context;};
 return browser;
};

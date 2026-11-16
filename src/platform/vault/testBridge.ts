import {VaultError,type VaultDriver,type VaultRecord,type VaultReceipt} from './protocol';
/** Compiled only into the explicitly marked browser-adapter test build. No native certification. */
export async function openBrowserTestVault():Promise<VaultDriver>{
 if(import.meta.env.VITE_VAULT_TEST!=='true')throw new VaultError('VAULT_DISABLED');
 async function request<T>(action:string,body:unknown={}):Promise<T>{
  const response=await fetch('/__vault_test/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.code),{code:result.code});return result;
 }
 return {read:()=>request<VaultRecord|null>('read'),commit:payload=>request<VaultReceipt>('commit',{payload}),resolve:(operationId,fingerprint)=>request<VaultReceipt>('resolve',{operationId,fingerprint}),recoveries:()=>request<{key:string;snapshot:string}[]>('recoveries'),close:async()=>{}};
}

import {FinanceVault,type FinanceVaultPlugin} from '@finanzas/native-vault';
import {driverError,type VaultDriver,type VaultReceipt,type VaultRecord} from './protocol';

/** This module is imported only by the native entry, never the web entry. */
export async function openNativeSandbox(acknowledgedFictitious:boolean,bridge:FinanceVaultPlugin=FinanceVault):Promise<VaultDriver>{
 if(!acknowledgedFictitious)throw Object.assign(new Error('VAULT_DISABLED'),{code:'VAULT_DISABLED'});
 await bridge.openSandbox({acknowledgedFictitious:true});
 const call=async<T>(action:()=>Promise<T>)=>{try{return await action();}catch(error){throw driverError(error);}};
 return {
  read:()=>call(async()=>(await bridge.read()).head as VaultRecord|null),
  commit:payload=>call(async()=>await bridge.commit({payload}) as VaultReceipt),
  resolve:(operationId,fingerprint)=>call(async()=>await bridge.resolveOperation({operationId,fingerprint}) as VaultReceipt),
  recoveries:()=>call(async()=>(await bridge.recoveries()).copies),
  close:()=>call(()=>bridge.close()),
 };
}

export async function selectNativeBackup(){
 const {selectBackup}=await import('./documents');const {nativeStoragePolicy}=await import('./policy');
 return selectBackup(()=>FinanceVault.pickDocument(),nativeStoragePolicy.externalImport);
}

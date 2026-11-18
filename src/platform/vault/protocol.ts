import {MAX_BACKUP_BYTES,parseSnapshot} from '../../utils/backup';

export const VAULT_SCHEMA=1;
export const MAX_SNAPSHOT_BYTES=MAX_BACKUP_BYTES+256;
export const MAX_PAYLOAD_BYTES=2*MAX_SNAPSHOT_BYTES+8192;
export const vaultCodes=['VAULT_DISABLED','VAULT_LOCKED','VAULT_KEY_MISSING','VAULT_KEY_INVALIDATED','VAULT_CORRUPT','VAULT_SCHEMA','VAULT_CONFLICT','VAULT_QUOTA','VAULT_UNCERTAIN','VAULT_RELOAD','VAULT_NOT_COMMITTED','VAULT_INVALID','VAULT_FAILED'] as const;
export type VaultCode=typeof vaultCodes[number];
export class VaultError extends Error {
 constructor(public readonly code:VaultCode){super(code);this.name='VaultError';}
}
export type VaultPhase='ready'|'saving'|'checking'|'recoveryRequired'|'reloadRequired'|'conflict';
export type VaultRecord={revision:string;snapshot:string;snapshotHash:string;operationId:string};
export type VaultReceipt={operationId:string;fingerprint:string;status:'committed'|'aborted';revision:string|null;head:VaultRecord|null};
export type VaultRequest={protocol:1;operationId:string;expectedRevision:string|null;nextSnapshot:string;recoveryKey:string|null};
export interface VaultDriver {
 read():Promise<VaultRecord|null>;
 commit(payload:string):Promise<VaultReceipt>;
 /** A transaction returns the receipt or writes an abort tombstone before releasing the writer lock. */
 resolve(operationId:string,fingerprint:string):Promise<VaultReceipt>;
 recoveries():Promise<{key:string;snapshot:string}[]>;
 close():Promise<void>;
}
export interface DurableFinanceController {
 readonly data:import('../../utils/backup').FinanceData;
 readonly phase:VaultPhase;
 readonly problem:VaultCode|null;
 mutate(transform:import('../../utils/financeStore').FinanceMutation):Promise<import('../../utils/backup').FinanceData>;
 restore(next:import('../../utils/financeStore').RestorationInput):Promise<import('../../utils/backup').FinanceData>;
 checkForConflict():Promise<boolean>;
 subscribe(listener:()=>void):()=>void;
 recoveryCopies():Promise<{key:string;content:string}[]>;
 exportJSON():Promise<string>;
 reconcile():Promise<void>;
 close():Promise<void>;
}
export async function sha256(text:string):Promise<string>{
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
export function snapshotRevision(raw:string){
 if(new TextEncoder().encode(raw).length>MAX_SNAPSHOT_BYTES)throw new VaultError('VAULT_INVALID');
 const parsed=JSON.parse(raw);parseSnapshot(raw);
 if(typeof parsed.revision!=='string'||!parsed.revision||parsed.revision.length>128)throw new VaultError('VAULT_INVALID');
 return parsed.revision as string;
}
export function decodeRequest(payload:string):VaultRequest{
 try{
  if(new TextEncoder().encode(payload).length>MAX_PAYLOAD_BYTES)throw Error();
  const r=JSON.parse(payload);
  if(r.protocol!==1||typeof r.operationId!=='string'||!/^[0-9a-f-]{36}$/.test(r.operationId)||
    !(r.expectedRevision===null||typeof r.expectedRevision==='string'&&r.expectedRevision.length>0&&r.expectedRevision.length<=128)||
    typeof r.nextSnapshot!=='string'||!(r.recoveryKey===null||typeof r.recoveryKey==='string'&&/^finanzas_pro_recovery_[0-9A-Za-z_.:-]{1,100}$/.test(r.recoveryKey))||
    Object.keys(r).sort().join(',')!=='expectedRevision,nextSnapshot,operationId,protocol,recoveryKey')throw Error();
  snapshotRevision(r.nextSnapshot);return r;
 }catch{throw new VaultError('VAULT_INVALID');}
}
export function driverError(error:unknown):VaultError{
 const code=(error as {code?:string})?.code;
 return error instanceof VaultError?error:new VaultError(vaultCodes.includes(code as VaultCode)?code as VaultCode:'VAULT_UNCERTAIN');
}

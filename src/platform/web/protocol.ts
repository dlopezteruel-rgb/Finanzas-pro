import type {FinanceData} from '../../utils/backup';

export const WEB_DATABASE='finanzas-pro-web-v1';
export const WEB_DB_VERSION=1;
export const WEB_RECORDS='finance';
export const WEB_META='metadata';
export const WEB_OPERATIONS='operations';
export const WEB_INTERNAL_PREFIX='finanzas_pro_web_';
export type WebPhase='ready'|'readonly'|'saving'|'checking'|'recoveryRequired'|'reloadRequired'|'conflict';
export type WebCode='WEB_STRICT_UNAVAILABLE'|'WEB_OPEN_BLOCKED'|'WEB_UNAVAILABLE'|'WEB_LEGACY_VIEW'|'WEB_LEGACY_DIVERGED'|'WEB_CORRUPT'|'WEB_SCHEMA'|'WEB_NOT_COMMITTED'|'WEB_UNCERTAIN'|'WEB_RELOAD'|'WEB_MIGRATING'|'WEB_FORENSIC_EMPTY';
export class WebStorageError extends Error {
 constructor(public readonly code:WebCode){super(code);this.name='WebStorageError';}
}
export class WebTransactionAborted extends Error {
 constructor(cause?:unknown){super('WEB_NOT_COMMITTED',{cause});this.name=cause instanceof Error&&cause.name==='QuotaExceededError'?'QuotaExceededError':'WebTransactionAborted';}
}
export type LegacySource=Record<string,string>;
export type Migration={schema:1;id:string;status:'prepared'|'active';source:LegacySource;guard:string;sourceHash:string;initialHash:string|null};
export type Head={snapshot:string|null;hash:string|null;operationId:string|null};
export type Inspection={migration:Migration|null;head:Head};
export type Receipt={id:string;fingerprint:string;status:'committed'|'aborted';snapshotHash:string|null;head:Head};
export type WriteRequest=Readonly<{id:string;fingerprint:string;expected:string|null;next:string;hash:string;copies:readonly Readonly<{key:string;content:string}>[]}>;
export type Forensic={kind:'finanzas-web-forensic';schema:1;complete:boolean;errors:string[];legacy:LegacySource;database:Record<string,unknown[]>};
export interface WebDriver {
 inspect():Promise<Inspection>;
 prepare(migration:Migration,snapshot:string|null,hash:string|null,copies:{key:string;content:string}[]):Promise<void>;
 activate(id:string):Promise<void>;
 commit(request:WriteRequest):Promise<Receipt>;
 resolve(id:string,fingerprint:string):Promise<Receipt>;
 copies():Promise<{key:string;content:string}[]>;
 forensic():Promise<Record<string,unknown[]>>;
 close():void;
}
export type AsyncExclusive=<T>(work:()=>Promise<T>)=>Promise<T>;
export interface WebFinanceController {
 readonly data:FinanceData;
 readonly phase:WebPhase;
 readonly problem:string;
 mutate(transform:import('../../utils/financeStore').FinanceMutation):Promise<FinanceData>;
 restore(next:import('../../utils/financeStore').RestorationInput):Promise<FinanceData>;
 checkForConflict():Promise<boolean>;
 subscribe(listener:()=>void):()=>void;
 reconcile():Promise<void>;
 recoveryCopies():Promise<{key:string;content:string}[]>;
 exportJSON():Promise<string>;
 forensic():Promise<string>;
 close():void;
}
export async function digest(value:string):Promise<string>{
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function validateHead(head:Head):Promise<void>{
 if(head.snapshot===null){if(head.hash!==null||head.operationId!==null)throw new WebStorageError('WEB_CORRUPT');return;}
 if(typeof head.snapshot!=='string'||await digest(head.snapshot)!==head.hash)throw new WebStorageError('WEB_CORRUPT');
 const {parseSnapshot}=await import('../../utils/backup');parseSnapshot(head.snapshot);
}

export async function requestFingerprint(request:Omit<WriteRequest,'fingerprint'>):Promise<string>{
 return digest(JSON.stringify({id:request.id,expected:request.expected,next:request.next,hash:request.hash,copies:request.copies}));
}

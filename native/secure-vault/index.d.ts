export interface FinanceVaultPlugin {
 status():Promise<{testOnly:true;productEnabled:false;databaseExists:boolean;platform:string}>;
 openSandbox(options:{acknowledgedFictitious:true}):Promise<{cipherVersion:string;sqliteVersion:string;hardwareBacked?:boolean;testOnly:true}>;
 read():Promise<{head:unknown}>;
 commit(options:{payload:string}):Promise<unknown>;
 resolveOperation(options:{operationId:string;fingerprint:string}):Promise<unknown>;
 recoveries():Promise<{copies:{key:string;snapshot:string}[]}>;
 close():Promise<void>;
 pickDocument():Promise<{cancelled:boolean;name?:string;content?:string}>;
 configureFault(options:{point:string}):Promise<void>;
}
export const FinanceVault:FinanceVaultPlugin;

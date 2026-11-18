import {MAX_BACKUP_BYTES,parseBackup,type Backup} from '../../utils/backup';
import {VaultError} from './protocol';
export type PickedDocument={cancelled:boolean;name?:string;content?:string};
/** Selection/validation is not restoration. The existing preview/confirmation guard owns commit. */
export async function selectBackup(pick:()=>Promise<PickedDocument>,permitted:boolean):Promise<{name:string;backup:Backup}|null>{
 if(!permitted)throw new VaultError('VAULT_DISABLED');
 const file=await pick();if(file.cancelled)return null;
 if(typeof file.content!=='string'||!file.content.length||new TextEncoder().encode(file.content).length>MAX_BACKUP_BYTES||typeof file.name!=='string')throw new VaultError('VAULT_INVALID');
 return {name:file.name,backup:parseBackup(file.content)};
}

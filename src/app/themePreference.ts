import type {FinanceData} from '../utils/backup';
export type VisualTheme=FinanceData['theme'];
export const THEME_KEY='finanzas.ui.theme';
type PreferenceStorage=Pick<Storage,'getItem'|'setItem'>;
export const visualTheme=(value:string|null):VisualTheme|undefined=>value==='dark'||value==='light'?value:undefined;
/** Existing backup/legacy theme remains the fallback. Reading never migrates or repairs data. */
export function readThemePreference(storage?:PreferenceStorage|null):VisualTheme|undefined{
 try{return visualTheme((storage===undefined?window.localStorage:storage)?.getItem(THEME_KEY)??null);}catch{return undefined;}
}
export function writeThemePreference(value:VisualTheme,storage?:PreferenceStorage|null):boolean{
 if(!visualTheme(value))return false;
 try{const target=storage===undefined?window.localStorage:storage;if(!target)return false;target.setItem(THEME_KEY,value);return true;}catch{return false;}
}

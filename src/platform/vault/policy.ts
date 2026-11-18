import type {FinanceData} from '../../utils/backup';
import {systemCatalogNames} from '../../utils/catalogNames';

/** Product activation requires a later reviewed decision and native-runtime evidence. */
export const nativeStoragePolicy=Object.freeze({androidRealData:false,iosRealData:false,externalImport:false,portableEncryptedBackup:false});
export function emptySandbox(budgetGroups:FinanceData['budgetGroups']):FinanceData{
 return {theme:'dark',budgetGroups:structuredClone(budgetGroups),catalogNames:systemCatalogNames(),transactions:[],budgetPlans:[],loans:[],wallets:[],contacts:[]};
}

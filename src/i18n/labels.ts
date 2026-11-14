import type {Wallet,BudgetPartida,MovementType} from '../types/finance';
import type {FinanceData} from '../utils/backup';
import type {translate} from './messages';
import {catalogPresentation} from './catalogNames';
const walletKeys={BANK:'walletType.BANK',NEOBANK:'walletType.NEOBANK',CASH:'walletType.CASH',SAVINGS:'walletType.SAVINGS',INVESTMENT:'walletType.INVESTMENT'} as const;
export const walletTypeText=(type:Wallet['type'],t:typeof translate)=>Object.hasOwn(walletKeys,type)?t(walletKeys[type]):type;
// Descriptors belong only to synthetic UI objects. No extra field is added to a finance record.
const historicalLabels=new WeakMap<BudgetPartida,{fallbackNumber?:number}>();
export function rememberHistoricalPartida<T extends BudgetPartida>(partida:T,fallbackNumber?:number):T{historicalLabels.set(partida,{fallbackNumber});return partida;}
export function partidaDisplayName(partida:BudgetPartida,t:typeof translate,number:(n:number)=>string,resolve:(p:BudgetPartida)=>string=p=>p.name):string{
 const info=historicalLabels.get(partida);return info?.fallbackNumber===undefined?resolve(partida):t('planning.historicalItemNumber',{number:number(info.fallbackNumber)});
}
export function partidaDisplayFamily(partida:BudgetPartida,t:typeof translate,resolve:(p:BudgetPartida)=>string=p=>p.groupName):string{return historicalLabels.has(partida)?t('chart.row.outsideCatalog'):resolve(partida);}
/** Only the engine-generated fallback from an absent catalogue/transaction identity is owned UI. */
export function assistantItemName(item:{type:MovementType;code:string;name:string},source:FinanceData,t:typeof translate,number:(n:number)=>string):string{
 const current=source.budgetGroups.flatMap(g=>g.partidas).find(p=>p.type===item.type&&p.code===item.code);
 if(current&&current.name===item.name)return catalogPresentation(source,t).item(current);
 if(current||source.transactions.some(tx=>tx.type===item.type&&tx.code===item.code))return item.name;
 const match=/^Partida histórica (\d+)$/.exec(item.name);return match?t('planning.historicalItemNumber',{number:number(Number(match[1]))}):item.name;
}

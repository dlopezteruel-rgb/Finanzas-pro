import {pluralCategory,type Language,type translate} from './messages';
const one=(count:number,language:Language)=>pluralCategory(count,language)==='one';
type NumberFormatter=(value:number)=>string;
/** Each branch selects a complete sentence, including both independent plural parameters. */
export function legacyTransferNotice(pairs:number,records:number,language:Language,t:typeof translate,number:NumberFormatter):string{
 const key=one(pairs,language)?one(records,language)?'app.legacyTransfers.one_one':'app.legacyTransfers.one_other':one(records,language)?'app.legacyTransfers.other_one':'app.legacyTransfers.other_other';
 return t(key,{unambiguousPairs:number(pairs),pendingRecords:number(records)});
}
export function legacySharedNotice(expenses:number,cases:number,language:Language,t:typeof translate,number:NumberFormatter):string{
 const key=one(expenses,language)?one(cases,language)?'app.legacyShared.one_one':'app.legacyShared.one_other':one(cases,language)?'app.legacyShared.other_one':'app.legacyShared.other_other';
 return t(key,{verifiableExpenses:number(expenses),reviewCases:number(cases)});
}
export function subitemsRestoreNotice(items:number,months:number,language:Language,t:typeof translate,number:NumberFormatter):string{return t(one(months,language)?'restoration.subitems.one':'restoration.subitems.other',{items:number(items),months:number(months)});}
export function sharedReceiptsNotice(count:number,values:{description:string;amount:string;myShare:string},language:Language,t:typeof translate,number:NumberFormatter):string{return t(one(count,language)?'restoration.sharedReceipts.one':'restoration.sharedReceipts.other',{...values,count:number(count)});}
export function chartMovementCount(count:number,language:Language,t:typeof translate,number:NumberFormatter):string{return t(one(count,language)?'chart.movementCount.one':'chart.movementCount.other',{count:number(count)});}

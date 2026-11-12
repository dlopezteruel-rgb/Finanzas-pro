import {catalogReorderFixture} from './catalogReorderFixture';
import {demoTransaction} from './budgetSubitemFixture';
import {splitExactly,saveSettlement} from '../src/utils/sharedExpenses';
import {savePlanning,planningLines,planningScope} from '../src/utils/planning';
export const CATALOG_CAPTURE_TIME='2026-11-11T12:00:00.000Z';
export function customCatalogCaptureFixture(theme:'light'|'dark'){
  let d=catalogReorderFixture(theme);
  d.contacts=[{id:'ana',name:'Ana ficticia',createdAt:'2026-01-01'},{id:'bea',name:'Bea ficticia',createdAt:'2026-01-01'}];
  d.transactions.push(demoTransaction({id:'shared-capture',amount:60,description:'Cena compartida ficticia',splitInfo:{...splitExactly(60,d.contacts,'bank'),distribution:{method:'equal'}}}));
  d=saveSettlement(d,{expenseId:'shared-capture',contactId:'ana',amount:20,date:'2026-11-05',processed:true,kind:'cash',walletId:'bank',operationId:'capture-paid'});
  d=savePlanning(d,'2026-11',planningLines(d.budgetPlans,'2026-11'),20000,planningScope(d,'2026-11'),true);
  d={...d,planningMonths:d.planningMonths!.map(m=>({...m,approval:m.approval?{...m.approval,approvedAt:CATALOG_CAPTURE_TIME}:undefined}))};
  return d;
}

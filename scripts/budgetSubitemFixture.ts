import type { FinanceData } from '../src/utils/backup';
import type { MonthlySubitemPlan, Transaction } from '../src/types/finance';
import { intelligentFixture } from './intelligentFixture';
import { createSubitem } from '../src/utils/budgetSubitems';
import { planningScope, savePlanning } from '../src/utils/planning';

export const demoParent={type:'GASTO' as const,code:'V.001.002'};
export const demoMonth='2026-11';
export const demoBreakdown=(a=6000,b=4000,month=demoMonth):MonthlySubitemPlan=>({...demoParent,monthYear:month,lines:[{subitemId:'demo-cine',amountCents:a},{subitemId:'demo-cultura',amountCents:b}]});
export const demoTransaction=(overrides:Partial<Transaction>={}):Transaction=>({id:'legacy-demo',date:'2026-11-03',amount:12,type:'GASTO',code:demoParent.code,categoryName:'Gastos ficticios',subcategoryName:'Ocio ficticio',description:'Compra ficticia sin subítem',wallet:'BANCO FICTICIO',processed:true,...overrides});
export function budgetSubitemFixture(children=true,monthly=false):FinanceData {
  const base=intelligentFixture();
  let data:FinanceData={...base,theme:'light',defaultWalletId:null,budgetGroups:base.budgetGroups.map(g=>g.type==='GASTO'?{...g,partidas:[{...g.partidas[0],...demoParent,name:'Ocio ficticio'}]}:g),
    transactions:[demoTransaction()],budgetPlans:[{...demoParent,monthYear:demoMonth,plannedAmount:100},{code:'i',type:'INGRESO',monthYear:demoMonth,plannedAmount:2000}]};
  if(children){data=createSubitem(data,demoParent,'Cine ficticio','demo-cine');data=createSubitem(data,demoParent,'Cultura ficticia','demo-cultura');}
  if(monthly)data=savePlanning(data,demoMonth,[{...demoParent,amountCents:10000}],20000,planningScope(data,demoMonth),false,false,[demoBreakdown()]);
  return data;
}

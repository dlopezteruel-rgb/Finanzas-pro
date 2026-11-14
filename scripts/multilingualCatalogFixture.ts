import {BUDGET_GROUPS} from '../src/constants/categories';
import type {FinanceData} from '../src/utils/backup';
import {systemCatalogNames} from '../src/utils/catalogNames';
import {chartFixture} from './chartFixture';
import {createSubitem} from '../src/utils/budgetSubitems';
import {savePlanning,planningScope} from '../src/utils/planning';
import {editCatalog} from '../src/utils/budgetCatalog';

/** Synthetic transactions/shared settlements/accounts; real system identities, never personal data. */
export function multilingualCatalogFixture(system=true):FinanceData{
 const base=chartFixture(),code=(old:string)=>old==='i'?'L.001.001':old==='g'?'V.001.002':old;
 let data:FinanceData={...base,budgetGroups:structuredClone(BUDGET_GROUPS),catalogNames:systemCatalogNames(),transactions:base.transactions.map(tx=>({...tx,code:code(tx.code),date:tx.date.replace('2026-10','2026-11'),...(tx.splitInfo?{splitInfo:{...tx.splitInfo,settlements:tx.splitInfo.settlements?.map(s=>({...s,date:s.date.replace('2026-10','2026-11')}))}}:{})}))};
 const parent={type:'GASTO' as const,code:'V.001.002'};
 data=createSubitem(data,parent,'Cena F.001.001 personal','catalog-child');
 data=savePlanning(data,'2026-11',[{type:'INGRESO',code:'L.001.001',amountCents:300000},{type:'GASTO',code:'F.001.001',amountCents:60000},{...parent,amountCents:10000}],50000,planningScope(data,'2026-11'),true,false,[{...parent,monthYear:'2026-11',lines:[{subitemId:'catalog-child',amountCents:10000}]}]);
 data=editCatalog(data,{kind:'createFamily',type:'GASTO',id:'fixture-custom',name:'Familia personal {name}'});
 data=editCatalog(data,{kind:'createPartida',groupCode:'family-fixture-custom',id:'fixture-personal',name:'F.001.001 · personal',description:'Nota privada L.001.001',keywords:[]});
 data={...data,planningAutomation:{rules:[{id:'catalog-rule',name:'Regla personal',target:'GASTO',code:'F.001.001',amountCents:60000,frequency:'monthly',startMonth:'2026-12',active:true}],carryovers:[],origins:[],history:[]}};
 if(!system)delete data.catalogNames;
 return data;
}

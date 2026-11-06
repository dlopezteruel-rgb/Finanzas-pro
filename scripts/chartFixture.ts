import type { FinanceData } from '../src/utils/backup';
import { saveSettlement, splitExactly } from '../src/utils/sharedExpenses';
import { transferPair } from '../src/utils/transfers';

export function chartFixture():FinanceData {
  const contacts=['ana','bea','cora'].map(id=>({id,name:`Contacto ficticio ${id}`,createdAt:'2026-01-01'}));
  let d:FinanceData={theme:'dark',budgetPlans:[],budgetGroups:[
    {code:'I',name:'Ingresos de prueba',type:'INGRESO',partidas:[{code:'i',type:'INGRESO',name:'Salario ficticio',groupCode:'I',groupName:'Ingresos de prueba',keywords:[]}]},
    {code:'G',name:'Gastos de prueba',type:'GASTO',partidas:[{code:'g',type:'GASTO',name:'Comida ficticia',groupCode:'G',groupName:'Gastos de prueba',keywords:[]}]},
  ],contacts,loans:[],wallets:[{id:'bank',name:'BANCO',type:'BANK',initialBalance:1000,color:'#fff'},{id:'rev',name:'OTRA',type:'BANK',initialBalance:100,color:'#fff'},{id:'negative',name:'NEGATIVA',type:'BANK',initialBalance:-50,color:'#fff'},{id:'empty',name:'SIN MOVIMIENTOS',type:'CASH',initialBalance:0,color:'#fff'}],transactions:[
    {id:'income',type:'INGRESO',code:'i',amount:3000,date:'2026-10-01',categoryName:'Ingresos de prueba',subcategoryName:'Salario ficticio',description:'Sueldo ficticio',wallet:'BANCO',processed:true},
    {id:'shared',type:'GASTO',code:'g',amount:60,date:'2026-10-02',categoryName:'Gastos de prueba',subcategoryName:'Comida ficticia',description:'Cena ficticia',wallet:'BANCO',processed:true,splitInfo:{...splitExactly(60,contacts,'bank'),distribution:{method:'equal'}}},
    {id:'pending',type:'GASTO',code:'g',amount:999,date:'2026-10-03',categoryName:'Gastos de prueba',subcategoryName:'Comida ficticia',description:'Pendiente ficticio',wallet:'BANCO',processed:false},
  ]};
  d=saveSettlement(d,{expenseId:'shared',contactId:'ana',amount:10,date:'2026-10-04',processed:true,kind:'cash',walletId:'bank',operationId:'cash'});
  d=saveSettlement(d,{expenseId:'shared',contactId:'ana',amount:5,date:'2026-10-05',processed:true,kind:'offset',operationId:'offset'});
  return {...d,transactions:[...d.transactions,...transferPair(d.wallets,{fromWalletId:'bank',toWalletId:'rev',amount:25,date:'2026-10-06',processed:true,concept:'Ficticio'},'pair')]};
}

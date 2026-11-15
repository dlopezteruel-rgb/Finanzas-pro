import type {Transaction} from '../types/finance';
import {economicTransactions} from '../utils/transfers';

/** UI membership lookup only. Preserve the domain projection, source order and original reductions. */
export function visibleEconomicTotals(transactions:Transaction[],filtered:Transaction[]){
 const ids=new Set(filtered.map(t=>t.id)),economic=economicTransactions(transactions).filter(t=>ids.has(t.id));
 return {
  income:economic.filter(t=>t.type==='INGRESO'&&t.processed).reduce((s,t)=>s+t.amount,0),
  expenses:economic.filter(t=>t.type==='GASTO'&&t.processed).reduce((s,t)=>s+t.amount,0),
 };
}

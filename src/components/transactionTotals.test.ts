import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleEconomicTotals} from './transactionTotals';
import {economicTransactions} from '../utils/transfers';
import {multilingualCatalogFixture} from '../../scripts/multilingualCatalogFixture';
function reference(transactions:Parameters<typeof visibleEconomicTotals>[0],filtered:Parameters<typeof visibleEconomicTotals>[1]){
 return {income:economicTransactions(transactions).filter(t=>filtered.some(f=>f.id===t.id)).filter(t=>t.type==='INGRESO'&&t.processed).reduce((s,t)=>s+t.amount,0),expenses:economicTransactions(transactions).filter(t=>filtered.some(f=>f.id===t.id)).filter(t=>t.type==='GASTO'&&t.processed).reduce((s,t)=>s+t.amount,0)};
}
test('5E: índices de totales conservan transferencias, reparto propio, reintegros y pendientes',()=>{
 const data=multilingualCatalogFixture(),before=JSON.stringify(data);for(const filtered of [data.transactions,[],data.transactions.filter(t=>t.type==='GASTO'),data.transactions.filter(t=>!t.processed),data.transactions.filter(t=>t.wallet==='BANCO'),data.transactions.slice(1).reverse()])assert.deepEqual(visibleEconomicTotals(data.transactions,filtered),reference(data.transactions,filtered));assert.equal(JSON.stringify(data),before);
});
for(const size of [100,1000,5000])test(`5E: ${size} registros mantienen suma IEEE original, orden e identidades con selección parcial`,()=>{
 const tx=multilingualCatalogFixture().transactions.find(t=>t.id==='income')!,transactions=Array.from({length:size},(_,i)=>({...tx,id:String(i),type:i%2?'GASTO' as const:'INGRESO' as const,processed:i%3!==0,amount:i%5===0?0.1:i%5===1?0.2:(i+1)/100})),filtered=transactions.filter((_,i)=>i%4!==0).reverse(),before=JSON.stringify([transactions,filtered]);assert.deepEqual(visibleEconomicTotals(transactions,filtered),reference(transactions,filtered));assert.equal(JSON.stringify([transactions,filtered]),before);
});

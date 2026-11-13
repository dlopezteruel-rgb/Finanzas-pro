import test from 'node:test';
import assert from 'node:assert/strict';
import {translatorFor,languages,type Language} from './messages';
import {sharedOwnedText} from './sharedMessages';
import {intelligentFixture} from '../../scripts/intelligentFixture';
import {splitExactly,saveSettlement,sharedMigrationReport} from '../utils/sharedExpenses';
import type {Transaction} from '../types/finance';
const all=Object.keys(languages) as Language[];
function fixture(){const data=intelligentFixture();data.contacts.push({id:'other',name:'Sin fecha',createdAt:'2026-01-01'});data.contacts[0].name='Guardar {amount}$&';const expense:Transaction={id:'expense',type:'GASTO',code:'g',categoryName:'Gastos ficticios',subcategoryName:'Alquiler ficticio',description:'Cena personal NO TRADUCIR',date:'2026-11-01',amount:100,wallet:'BANCO FICTICIO',processed:true,splitInfo:splitExactly(100,data.contacts,'bank')};return {...data,transactions:[expense]};}
test('repartos localizados: sobrecobro conserva el original y no altera reparto exacto ni textos personales',()=>{
 const data=fixture(),before=JSON.stringify(data);let error='';try{saveSettlement(data,{operationId:'failed',expenseId:'expense',contactId:'friend',amount:33.34,date:'2026-11-13',kind:'cash',processed:true,walletId:'bank'});}catch(e){error=(e as Error).message;}
 assert.equal(error,'El cobro supera la deuda pendiente o duplica un cobro ya registrado.');for(const language of all)assert.equal(sharedOwnedText(error,translatorFor(language)),translatorFor(language)('shared_message.el_cobro_supera_la_deuda_pendiente_o_duplica_un_cobro_ya_registrado'));
 assert.equal(JSON.stringify(data),before);assert.equal(data.transactions[0].splitInfo!.myShare,33.34);assert.deepEqual(data.transactions[0].splitInfo!.participants.map(p=>p.amount),[33.33,33.33]);
 const saved=saveSettlement(data,{operationId:'cash',expenseId:'expense',contactId:'friend',amount:12.34,date:'2026-11-13',kind:'cash',processed:true,walletId:'bank'});assert.equal(saved.transactions.find(t=>t.id==='expense')!.splitInfo!.settlements![0].amount,12.34);assert.equal(saved.contacts[0].name,'Guardar {amount}$&');assert.equal(JSON.stringify(data),before);
});
test('histórico compartido: marca de pago sin banco permanece sin verificar y no se migra al traducir',()=>{
 const data=fixture(),expense=data.transactions[0];expense.id='id personal {reason}$&';expense.splitInfo={isShared:true,totalParticipants:2,myShare:50,totalOwedToMe:50,participants:[{contactId:'friend',contactName:data.contacts[0].name,amount:50,isPaid:true,paidDate:'2026-11-03'}]};const before=JSON.stringify(data),report=sharedMigrationReport(data),reportBefore=JSON.stringify(report);assert.equal(report.candidates.length,0);assert.equal(report.issues.length,1);
 for(const language of all){const t=translatorFor(language),reason=t('shared_message.pago_sin_movimiento_inequivoco_una_marca_de_pagado_no_demuestra_un_cobro');assert.equal(sharedOwnedText(report.issues[0],t),t('shared_message.legacyIssue',{id:expense.id,reason}));assert.equal(sharedOwnedText('Texto desconocido {reason}$&',t),'Texto desconocido {reason}$&');}
 assert.equal(JSON.stringify(data),before);assert.equal(JSON.stringify(report),reportBefore);assert.equal(expense.splitInfo.accountingVersion,undefined);
});

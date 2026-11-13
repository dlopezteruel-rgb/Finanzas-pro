import test from 'node:test';
import assert from 'node:assert/strict';
import {translatorFor,languages,type Language} from './messages';
import {presentationFormatters} from './presentation';
import {debtReviewText,ruleReviewText,loanInstalmentsText,type DebtReview,type RuleReview} from './bankingReviews';
import {bankingOwnedText,treasuryConceptText,treasuryWarningText} from './bankingMessages';
import {intelligentFixture,personalObligation,movementRule} from '../../scripts/intelligentFixture';
import {saveObligation,settleObligation} from '../utils/personalObligations';
import {saveMovementRule,occurrencePreviews} from '../utils/recurringMovements';
import {treasuryProjection,type TreasuryEvent} from '../utils/treasury';
const all=Object.keys(languages) as Language[];
test('confirmaciones de deuda: cambio de idioma conserva cantidades, datos literales y operación bancaria independiente',()=>{
 const name='<img>{amount}$& NO TRADUCIR',concept='Sin fecha';
 let data=saveObligation(intelligentFixture(),personalObligation({counterparty:{name},concept}));const before=JSON.stringify(data);
 const reviews:DebtReview[]=[{kind:'obligation',direction:'receivable',amountCents:20000,name,concept},{kind:'obligation',direction:'payable',amountCents:20000,name,concept},...(['bank','adjustment'] as const).flatMap(method=>[true,false].map(processed=>({kind:'settlement' as const,amountCents:1234,date:'2026-11-13',method,processed}))),{kind:'cancel',concept}];
 const reviewBefore=JSON.stringify(reviews);
 for(const language of all){const t=translatorFor(language),f=presentationFormatters(language);for(const review of reviews){const text=debtReviewText(review,t,f);assert.equal(typeof text,'string');if(review.kind==='obligation'){assert.ok(text.includes(name));assert.ok(text.includes(concept));assert.ok(text.includes(f.formatCents(20000)));}if(review.kind==='settlement'){assert.ok(text.includes(f.formatCents(1234)));assert.ok(text.includes(f.formatDate(review.date,{day:'2-digit',month:'2-digit',year:'numeric'})));}}}
 assert.equal(JSON.stringify(data),before);assert.equal(JSON.stringify(reviews),reviewBefore);
 data=settleObligation(data,'personal',{id:'fictional-settlement',amountCents:1234,date:'2026-01-01',kind:'adjustment',processed:true,note:name});
 assert.deepEqual(data.transactions,[]);assert.equal(data.intelligentFinance!.obligations[0].principalCents,20000);assert.equal(data.intelligentFinance!.obligations[0].settlements[0].note,name);
});
test('confirmaciones periódicas: frecuencia, payload y próxima fecha no dependen de su etiqueta traducida',()=>{
 const concept='Mensual {wallet}$&',data=saveMovementRule(intelligentFixture(),movementRule({concept})),before=JSON.stringify(data),preview=JSON.stringify(occurrencePreviews(data,'2026-11','2026-11'));
 const reviews:RuleReview[]=[{kind:'save',concept,amountCents:95000,frequency:'monthly',day:31,wallet:'Banco personal'},...(['pause','reactivate','delete'] as const).map(kind=>({kind,concept}))];
 for(const language of all)for(const review of reviews){const text=ruleReviewText(review,translatorFor(language),presentationFormatters(language));assert.ok(text.includes(concept));if(review.kind==='save')assert.ok(text.includes(presentationFormatters(language).formatCents(95000)));}
 assert.equal(JSON.stringify(data),before);assert.equal(JSON.stringify(occurrencePreviews(data,'2026-11','2026-11')),preview);assert.equal(data.intelligentFinance!.recurringRules[0].frequency,'monthly');
});
test('errores bancarios: diagnóstico original conservado y resultado desconocido opaco',()=>{
 const data=saveObligation(intelligentFixture(),personalObligation()),before=JSON.stringify(data);let raw='';
 try{settleObligation(data,'personal',{id:'too-much',amountCents:20001,date:'2026-01-01',kind:'adjustment',processed:true,note:''});}catch(e){raw=(e as Error).message;}
 assert.equal(raw,'El pago/cobro supera el saldo no reservado.');for(const language of all){const t=translatorFor(language);assert.equal(bankingOwnedText(raw,t),t('banking_message.el_pago_cobro_supera_el_saldo_no_reservado'));assert.equal(bankingOwnedText('Mensaje desconocido {name}$&',t),'Mensaje desconocido {name}$&');assert.equal(bankingOwnedText('Compromisos personales',t),'Compromisos personales');}
 assert.equal(JSON.stringify(data),before);assert.equal(raw,'El pago/cobro supera el saldo no reservado.');
});
test('tesorería: solo etiquetas generadas, no conceptos de movimientos ni resultados económicos',()=>{
 const data=intelligentFixture();data.loans=[{id:'fictional-loan',name:'Cuota estimada: NO TRADUCIR',entity:'Entidad',principal:1000,monthlyPayment:100,interestRate:0,startDate:'2026-01-01',totalTermMonths:10,code:'g',wallet:'BANCO FICTICIO'}];
 const before=JSON.stringify(data),projection=treasuryProjection(data,'2026-11-13',30),projectionBefore=JSON.stringify(projection),event:TreasuryEvent={id:'loan',originId:'fictional-loan',date:'2026-11-13',source:'loan',certainty:'estimated',concept:'Cuota estimada: '+data.loans[0].name,amountCents:-10000,overdue:false};
 for(const language of all){const t=translatorFor(language),f=presentationFormatters(language);assert.equal(treasuryConceptText(event,data,'2026-11-13',t,f.formatDate),t('treasury.concept.instalment',{name:data.loans[0].name}));assert.equal(treasuryConceptText({...event,source:'pending'},data,'2026-11-13',t,f.formatDate),event.concept);assert.equal(treasuryWarningText('Aviso personal',data,'2026-11-13',t,f.formatDate),'Aviso personal');}
 assert.equal(JSON.stringify(data),before);assert.equal(JSON.stringify(projection),projectionBefore);
});

test('cuotas: frase completa singular/plural sin concatenar palabras ni cambiar contadores',()=>{
 const singular={es:'1 de 1 cuota pagada',en:'1 of 1 instalment paid',it:'1 rata pagata su 1',fr:'1 mensualité payée sur 1',pt:'1 de 1 prestação paga'};
 for(const language of all){const t=translatorFor(language);assert.equal(loanInstalmentsText(1,1,language,t),singular[language]);for(const total of [0,2,1000])assert.equal(loanInstalmentsText(0,total,language,t),t(language==='fr'&&total===0?'loans.oneInstalmentPaid':'loans.de_cuotas_pagadas',{cuotasRealesTramitadas:'0',totalTermMonths:new Intl.NumberFormat(languages[language].locale).format(total)}));}
});

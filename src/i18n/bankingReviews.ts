import {pluralCategory,languages,type Language,type translate} from './messages';
import type {PersonalObligation,PersonalSettlement,RecurringMovementRule} from '../types/finance';
import type {presentationFormatters} from './presentation';
type Formatter=ReturnType<typeof presentationFormatters>;
export type DebtReview =
 | {kind:'obligation'; direction:PersonalObligation['direction']; amountCents:number; name:string; concept:string}
 | {kind:'settlement'; amountCents:number; date:string; method:PersonalSettlement['kind']; processed:boolean}
 | {kind:'cancel'; concept:string};
export type RuleReview =
 | {kind:'save'; concept:string; amountCents:number; frequency:RecurringMovementRule['frequency']; day:number; wallet:string}
 | {kind:'pause'|'reactivate'|'delete'; concept:string};
const frequencyKeys={monthly:'recurring_movements.mensual',quarterly:'recurring_movements.trimestral',yearly:'recurring_movements.anual'} as const;
export const movementFrequencyText=(frequency:RecurringMovementRule['frequency'],t:typeof translate)=>t(frequencyKeys[frequency]);
/** Only UI review descriptors. The independently captured mutation is never translated or rebuilt. */
export function debtReviewText(review:DebtReview,t:typeof translate,format:Formatter):string{
 if(review.kind==='cancel')return t('debt_review.cancel',{concept:review.concept});
 if(review.kind==='obligation')return t(review.direction==='receivable'?'debt_review.receivable':'debt_review.payable',{amount:format.formatCents(review.amountCents),name:review.name,concept:review.concept});
 return t(review.method==='bank'?(review.processed?'debt_review.processed':'debt_review.pending'):'debt_review.adjustment',{amount:format.formatCents(review.amountCents),date:format.formatDate(review.date,{day:'2-digit',month:'2-digit',year:'numeric'})});
}
export function ruleReviewText(review:RuleReview,t:typeof translate,format:Formatter):string{
 if(review.kind==='save')return t('rule_review.save',{concept:review.concept,amount:format.formatCents(review.amountCents),frequency:movementFrequencyText(review.frequency,t),day:review.day,wallet:review.wallet});
 return t(review.kind==='pause'?'rule_review.pause':review.kind==='reactivate'?'rule_review.reactivate':'rule_review.delete',{concept:review.concept});
}

export function loanInstalmentsText(paid:number,total:number,language:Language,t:typeof translate):string{
 const number=new Intl.NumberFormat(languages[language].locale);
 return t(pluralCategory(total,language)==='one'?'loans.oneInstalmentPaid':'loans.de_cuotas_pagadas',{cuotasRealesTramitadas:number.format(paid),totalTermMonths:number.format(total)});
}

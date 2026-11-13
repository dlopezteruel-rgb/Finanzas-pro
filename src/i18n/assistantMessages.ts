import type {translate} from './messages';
import {localFinancialAdvice,type FinancialAssistantContext,type LocalAdvicePresentation} from '../utils/financialAssistant';
import {assistantItemName} from './labels';
import {planningStatusText} from './presenters';
import type {FinanceData} from '../utils/backup';
import {treasuryWarningText} from './bankingMessages';
import type {presentationFormatters} from './presentation';
// Original recognition/API payloads are invariant. Only their owned labels are localized.
export const assistantPrompts=[
 {id:'available',label:'assistant.question.available',text:'¿Cuánto tengo realmente disponible?'},
 {id:'savings',label:'assistant.question.savings',text:'¿Qué gastos puedo reducir para ahorrar 150 € más?'},
 {id:'upcoming',label:'assistant.question.upcoming',text:'¿Qué pagos y cobros se aproximan?'},
 {id:'alerts',label:'assistant.question.alerts',text:'¿Qué partidas están en alerta?'},
 {id:'dinner',label:'assistant.question.dinner',text:'Ayer cené fuera por 15,50 € con Openbank'},
 {id:'debts',label:'assistant.question.debts',text:'Resumen de mis préstamos y deudas'},
] as const;
export const quickEntryPrompts=[
 {id:'dinner',label:'quick.example.dinner',text:'Ayer cené fuera por 15,50 € con Openbank'},
 {id:'salary',label:'quick.example.salary',text:'Nómina mensual cobrada 2650 € en Santander'},
 {id:'groceries',label:'quick.example.groceries',text:'Compra supermercado 84,30 € con Openbank'},
 {id:'fuel',label:'quick.example.fuel',text:'Gasolina Repsol 55 € con Revolut'},
 {id:'books',label:'quick.example.books',text:'Compré libros por 42 € en efectivo'},
] as const;
export function assistantPresentation(t:typeof translate,format:ReturnType<typeof presentationFormatters>,data:FinanceData){
 return {
  itemName:(item:Pick<FinancialAssistantContext['partidas'][number],'type'|'code'|'name'>)=>assistantItemName(item,data,t,format.formatNumber),
  format,text:t,money:format.formatCents,date:(value:string)=>format.formatDate(value,{day:'2-digit',month:'2-digit',year:'numeric',...(/T/.test(value)?{hour:'2-digit',minute:'2-digit'}:{})}),
  month:format.formatMonth,status:(status:string)=>planningStatusText(status,t),number:format.formatNumber,
  warning:(text:string)=>treasuryWarningText(text,data,'',t,format.formatDate),amount:format.formatMoney,percent:format.formatPercent,
 } satisfies LocalAdvicePresentation & {amount:typeof format.formatMoney;percent:typeof format.formatPercent;format:typeof format};
}
export type AssistantDisplay=ReturnType<typeof assistantPresentation>;

/** The original query context keeps its own provenance when another tab edits current data. */
export function adviceForDisplay(context:FinancialAssistantContext,message:string,view:AssistantDisplay,sourceData:FinanceData):string|null{
 return localFinancialAdvice(context,message,{...view,warning:value=>treasuryWarningText(value,sourceData,'',view.text,view.format.formatDate),itemName:item=>assistantItemName(item,sourceData,view.text,view.number)});
}

import type { FinanceData } from './backup';
import { annualPlanning,planningStatus } from './planning';
import { planningBudgetRows,planningCatalog } from './planningBasis';
import { economicTransactions } from './transfers';
import { intelligent } from './intelligentValidation';
import { obligationOverview } from './personalObligations';
import { treasuryProjection } from './treasury';
import { madridDate } from './financialCalendar';
import { assertMonth,formatPlanningCents as money,safeCents } from './planningMoney';

/** A computed read model, not a new source of saved financial truth. */
export function financialAssistantContext(data:FinanceData,month:string,today=madridDate()) {
  assertMonth(month);
  const planning=annualPlanning(data,month.slice(0,4)).find(m=>m.monthYear===month)!,meta=data.planningMonths?.find(m=>m.monthYear===month);
  const rows=planningBudgetRows(data,month,planningCatalog(data,data.budgetGroups.flatMap(g=>g.partidas)));
  const economic=economicTransactions(data.transactions).filter(t=>t.date.slice(0,7)===month);
  const partidas=rows.map(r=>({code:r.code,name:r.name,type:r.type,baseCents:Math.round((r.basePrevisto??r.previsto)*100),carryCents:Math.round((r.arrastre??0)*100),effectiveCents:Math.round(r.previsto*100),executedCents:Math.round(r.ejecutado*100),pendingCents:economic.filter(t=>!t.processed&&t.type===r.type&&t.code===r.code).reduce((n,t)=>safeCents(n+Math.round(t.amount*100)),0),remainingCents:Math.round(r.resto*100)})).filter(r=>r.effectiveCents||r.executedCents||r.pendingCents);
  const obligations=obligationOverview(data,today),projection=treasuryProjection(data,today),rules=intelligent(data).recurringRules.filter(r=>!r.deleted);
  return {
    month,asOf:today,currency:'EUR',units:'integer cents',status:planningStatus(data,month),totals:planning.totals,
    approval:meta?.approval?{number:meta.approval.number,approvedAt:meta.approval.approvedAt,current:meta.approval.revision===meta.revision,totals:meta.approval.totals}:null,
    partidas,
    obligations:{receivableCents:obligations.filter(o=>o.direction==='receivable').reduce((n,o)=>safeCents(n+o.remainingCents),0),payableCents:obligations.filter(o=>o.direction==='payable').reduce((n,o)=>safeCents(n+o.remainingCents),0),overdueCents:obligations.reduce((n,o)=>safeCents(n+o.overdueCents),0)},
    recurring:{active:rules.filter(r=>r.active).length,paused:rules.filter(r=>!r.active).length,expectedIncomeCents:projection.events.filter(e=>e.source==='recurring'&&e.amountCents>0).reduce((n,e)=>safeCents(n+e.amountCents),0),expectedExpenseCents:projection.events.filter(e=>e.source==='recurring'&&e.amountCents<0).reduce((n,e)=>safeCents(n-e.amountCents),0)},
    treasury:{from:projection.from,to:projection.to,liquidCents:projection.liquidCents,projectedCents:projection.projectedCents,minimumCents:projection.minimumCents,events:projection.events.map(e=>({date:e.date,source:e.source,certainty:e.certainty,amountCents:e.amountCents})),warnings:projection.warnings},
  };
}
export type FinancialAssistantContext=ReturnType<typeof financialAssistantContext>;
const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const table=(head:string,rows:string[])=>`${head}\n${rows.join('\n')}`;
/** Supported numerical advice is local and deterministic, including offline operation. */
export function localFinancialAdvice(c:FinancialAssistantContext,message:string):string|null {
  const text=normalize(message),prefix=`### Datos guardados · ${c.month}\nEstado: ${c.status}. Importes económicos del mes; tesorería a ${c.asOf}.\n`;
  if(/disponib|liquid|tesorer/.test(text))return `${prefix}Saldo líquido actual: **${money(c.treasury.liquidCents)}**. Saldo estimado hasta ${c.treasury.to}: **${money(c.treasury.projectedCents)}**. Mínimo estimado: ${money(c.treasury.minimumCents)}.\nMargen de planificación tras ahorro objetivo: ${money(c.totals.margin)}. No es saldo bancario. Créditos pendientes (${money(c.obligations.receivableCents)}) y deudas (${money(c.obligations.payableCents)}) están separados del efectivo.\n${c.treasury.warnings.join('\n')}`;
  if(/cobro|pago|vencim|deud|prestam|periodic/.test(text))return `${prefix}Me deben: ${money(c.obligations.receivableCents)}. Debo: ${money(c.obligations.payableCents)}. Vencido orientativo: ${money(c.obligations.overdueCents)}.\nReglas activas: ${c.recurring.active}; pausadas: ${c.recurring.paused}. Propuestas periódicas: ingresos ${money(c.recurring.expectedIncomeCents)}, gastos ${money(c.recurring.expectedExpenseCents)}.\n${c.treasury.events.length?table('| Fecha | Fuente | Flujo previsto |\n| :--- | :--- | :--- |',c.treasury.events.slice(0,60).map(e=>`| ${e.date} | ${e.source==='pending'?'Movimiento pendiente':e.source==='recurring'?'Propuesta sin registrar':e.source==='personal'?'Compromiso':'Cuota estimada'} | ${money(e.amountCents)} |`)):'Sin flujos fechados conocidos para los próximos 30 días.'}\n${c.treasury.events.length>60?'Se muestran los primeros 60 flujos; consulta Tesorería para el detalle completo.':''}\nLos cobros sin vencimiento no tienen fecha estimada. Consulta Deudas y Tesorería para revisar fuentes.`;
  if(/arrastr/.test(text))return `${prefix}${table('| Partida | Base | Arrastre | Efectivo |\n| :--- | :--- | :--- | :--- |',c.partidas.filter(r=>r.carryCents).map(r=>`| ${r.code} · ${r.name} | ${money(r.baseCents)} | ${money(r.carryCents)} | ${money(r.effectiveCents)} |`))}\n${c.partidas.some(r=>r.carryCents)?'Efectivo = base + arrastre. El arrastre no es un ingreso bancario.':'No hay arrastres guardados en este periodo.'}`;
  if(/alerta|sobrepas|exced|desvia|presupuesto.*super|partida.*presupuesto/.test(text)) {
    const exceeded=c.partidas.filter(r=>r.type==='GASTO'&&(r.executedCents>r.effectiveCents||r.effectiveCents>0&&r.executedCents>=r.effectiveCents*.9));
    return `${prefix}${exceeded.length?table('| Partida | Base + arrastre | Tramitado propio | Pendiente propio | Desviación |\n| :--- | :--- | :--- | :--- | :--- |',exceeded.map(r=>`| ${r.code} · ${r.name} | ${money(r.baseCents)} + ${money(r.carryCents)} | ${money(r.executedCents)} | ${money(r.pendingCents)} | ${money(r.executedCents-r.effectiveCents)} |`)):'No hay partidas de gasto al 90 % o por encima del presupuesto guardado.'}\nLa desviación compara el gasto económico propio tramitado con el presupuesto efectivo; los pendientes se muestran separados.`;
  }
  if(/ahorr|reduc|recort/.test(text)) {
    if(c.totals.income<=0)return `${prefix}No hay ingresos previstos suficientes guardados para calcular cómo distribuirlos o alcanzar un ahorro. Guarda primero ingresos, gastos y objetivo en Planificación.`;
    const match=text.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?)?/),requested=match?Math.round(Number(match[1].replace(',','.'))*100):c.totals.savings;
    if(!Number.isSafeInteger(requested))return `${prefix}El objetivo solicitado supera el rango de cálculo. Usa un importe en céntimos válido.`;
    const extra=/mas|extra|adicional/.test(text),needed=extra?requested:Math.max(0,requested-c.totals.balance);
    let left=needed;const suggestions:string[]=[];
    for(const r of c.partidas.filter(r=>r.type==='GASTO').sort((a,b)=>(b.remainingCents-b.pendingCents)-(a.remainingCents-a.pendingCents))) {
      const candidate=Math.min(left,Math.max(0,r.remainingCents-r.pendingCents));if(!candidate)continue;
      suggestions.push(`- ${r.code} · ${r.name}: reducir hasta ${money(candidate)} de ${money(r.remainingCents-r.pendingCents)} todavía no ejecutados ni pendientes.`);left-=candidate;if(left===0)break;
    }
    return `${prefix}Ingreso previsto: ${money(c.totals.income)}; gasto efectivo previsto: ${money(c.totals.expenses)}; ahorro objetivo guardado: ${money(c.totals.savings)}; balance previsto: ${money(c.totals.balance)}.\n${extra?`Simulación de ahorro adicional: ${money(requested)}.`:`Objetivo consultado: ${money(requested)}; reducción necesaria frente al balance previsto: ${money(needed)}.`}\n${needed===0?'El balance previsto ya alcanza este objetivo; depende de que se cumplan ingresos y gastos.':suggestions.join('\n')||'No hay margen de gasto no comprometido suficiente en las partidas guardadas.'}\n${left>0?`Quedan ${money(left)} sin cubrir: faltan ingresos o es necesario revisar compromisos.`:''}\nSon opciones matemáticas sobre previsiones, no una valoración de qué gasto es prescindible. No se han modificado presupuestos ni registrado movimientos.`;
  }
  if(/distribu|repart.*ingres|ingres.*previst|planific|balance|resumen/.test(text))return `${prefix}Ingresos previstos: ${money(c.totals.income)}; gastos efectivos: ${money(c.totals.expenses)}; ahorro objetivo: ${money(c.totals.savings)}; margen tras objetivo: ${money(c.totals.margin)}.\n${c.approval?`Última aprobación #${c.approval.number}: ${c.approval.approvedAt}; ${c.approval.current?'vigente':'hay cambios posteriores'}.`:'No existe aprobación guardada.'}\n${table('| Partida | Base | Arrastre | Efectivo | Tramitado propio | Pendiente propio |\n| :--- | :--- | :--- | :--- | :--- | :--- |',c.partidas.map(r=>`| ${r.code} · ${r.name} | ${money(r.baseCents)} | ${money(r.carryCents)} | ${money(r.effectiveCents)} | ${money(r.executedCents)} | ${money(r.pendingCents)} |`))}\nLos importes se calculan desde Planificación y movimientos guardados; las propuestas periódicas no son gasto registrado.`;
  return null;
}
/** Existing endpoint receives aggregates only: no contacts, wallets, transaction IDs or backups. */
export function assistantServiceContext(c:FinancialAssistantContext) {
  return {month:c.month,asOf:c.asOf,status:c.status,units:c.units,totals:c.totals,approval:c.approval,partidas:c.partidas.slice(0,100),obligations:c.obligations,recurring:c.recurring,treasury:{...c.treasury,events:c.treasury.events.slice(0,60),warnings:c.treasury.warnings.map(w=>w.includes('Préstamo')?'Existe una cuota con información histórica que requiere revisión.':w.includes('Movimiento')?'Existe un movimiento con cartera no disponible.':w.includes('Regla')?'Existe una coincidencia manual sin enlace inequívoco.':w)}};
}

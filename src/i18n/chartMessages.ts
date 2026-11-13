import type {translate} from './messages';
import type {FinanceData} from '../utils/backup';
import type {ChartRow,ChartSeries,ChartRange} from '../utils/chartData';
import {chartCatalog} from '../utils/chartData';
import {realDate} from '../utils/financialCalendar';
import {planningStatusText} from './presenters';
import {storageOwnedText} from './storageMessages';
import type {presentationFormatters} from './presentation';
type Format=ReturnType<typeof presentationFormatters>;
const dateOptions={day:'2-digit',month:'2-digit',year:'numeric'} as const;
/** Complete owned chart diagnostics only; never names or recorded descriptions. */
const keys={
  "Selecciona un rango de fechas válido, con inicio anterior al final.": "chart.error.range",
  "Acota el rango a 120 meses o 520 semanas para visualizarlo.": "chart.error.limit",
  "No se pudieron calcular los datos.": "chart.error.calculate",
  "Compartidos históricos sin migrar: se conservan los cálculos vigentes; no se estima una parte propia ni se reclasifican cobros sin vínculos verificados.": "chart.warning.legacyShared",
  "Hay traspasos históricos ambiguos: conservan su tratamiento contable vigente hasta revisión.": "chart.warning.legacyTransfer",
  "No se muestran saldos históricos: los saldos iniciales no tienen fecha de referencia y puede faltar historial. La curva muestra solo la variación bancaria acumulada registrada desde el inicio del rango, partiendo de 0; no es un saldo ni una fecha de apertura.": "chart.walletLimitation"
} as const;
export const chartOwnedText=(value:string,t:typeof translate)=>Object.hasOwn(keys,value)?t(keys[value as keyof typeof keys]):storageOwnedText(value,t);
export function economicSeriesForDisplay(series:readonly ChartSeries[],t:typeof translate):ChartSeries[]{
 const labels={income:{source:'Ingresos económicos',key:'chart.series.economicIncome'},expenses:{source:'Gastos económicos',key:'chart.series.economicExpenses'},balance:{source:'Balance económico',key:'chart.series.economicBalance'}} as const;
 return series.map(s=>{const known=labels[s.key as keyof typeof labels];return known&&s.label===known.source?{...s,label:t(known.key)}:{...s};});
}
/** Family IDs distinguish synthetic wrappers from literal personal family names. */
export function chartFamilyForDisplay<T extends {id:string;label:string}>(row:T,t:typeof translate):T{
 const prefix='Fuera del catálogo · ';
 return row.id.startsWith('historical:')&&row.label.startsWith(prefix)?{...row,label:t('chart.row.outsideFamily',{name:row.label.slice(prefix.length)})}:{...row};
}
/** Only the period arrays from the existing bucketer are passed here, never account-name rows. */
export function bucketRowsForDisplay(rows:readonly ChartRow[],range:ChartRange,t:typeof translate,format:Format):ChartRow[]{
 return rows.map(row=>({...row,label:realDate(row.id)?range.granularity==='week'?t('chart.row.week',{date:format.formatDate(row.id,dateOptions)}):format.formatMonth(row.id.slice(0,7),true):row.label}));
}
export function economicRowForDisplay(row:ChartRow,range:ChartRange,t:typeof translate,format:Format):ChartRow{
 return row.values.amount!==undefined?chartFamilyForDisplay(row,t):bucketRowsForDisplay([row],range,t,format)[0];
}
export function planningComparisonForDisplay(rows:readonly ChartRow[],data:FinanceData,t:typeof translate):ChartRow[]{
 const catalog=chartCatalog(data);
 return rows.map(row=>{
  if(row.id==='snapshot:INGRESO'||row.id==='snapshot:GASTO')return {...row,label:t('chart.row.snapshotOutside',{type:t(row.id==='snapshot:INGRESO'?'movement_proposal.ingreso':'movement_proposal.gasto')})};
  const type=row.id.startsWith('INGRESO:')?'INGRESO':row.id.startsWith('GASTO:')?'GASTO':null;if(!type)return {...row};
  const code=row.id.slice(type.length+1),typeLabel=t(type==='INGRESO'?'movement_proposal.ingreso':'movement_proposal.gasto');
  if(row.label===`${type} · Fotografía ${code}`)return {...row,label:t('chart.row.snapshotItem',{type:typeLabel,code})};
  const prefix=type==='INGRESO'?'Ingreso · ':'Gasto · ';if(!row.label.startsWith(prefix))return {...row};
  const name=row.label.slice(prefix.length),personal=data.budgetGroups.some(g=>g.type===type&&g.code===code&&g.name===name)||data.budgetGroups.flatMap(g=>g.partidas).some(p=>p.type===type&&p.code===code&&p.name===name)||data.transactions.some(tx=>tx.type===type&&tx.code===code&&tx.subcategoryName===name);
  let label=name;
  if(!personal&&name==='Fuera del catálogo')label=t('chart.row.outsideCatalog');
  else if(!personal&&name===`Partida ${code}`&&catalog.some(p=>p.type===type&&p.code===code&&p.name===name))label=t('chart.row.historicalItem',{code});
  return {...row,label:t('chart.row.category',{type:typeLabel,name:label})};
 });
}
export function planningAnnualForDisplay(rows:readonly ChartRow[],t:typeof translate,format:Format):ChartRow[]{
 return rows.map(row=>({...row,label:/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(row.id)?format.formatMonth(row.id,true):row.label,...(row.note!==undefined?{note:planningStatusText(row.note,t)}:{})}));
}
export function planningSelectionForDisplay(row:ChartRow,data:FinanceData,t:typeof translate,format:Format):ChartRow{
 return /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(row.id)?planningAnnualForDisplay([row],t,format)[0]:planningComparisonForDisplay([row],data,t)[0];
}

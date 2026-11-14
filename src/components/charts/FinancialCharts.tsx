import {chartMovementCount} from '../../i18n/countMessages';
import {chartOwnedText,economicSeriesForDisplay,chartFamilyForDisplay,bucketRowsForDisplay,economicRowForDisplay,planningComparisonForDisplay,planningAnnualForDisplay,planningSelectionForDisplay} from '../../i18n/chartMessages';
import {planningStatusText} from '../../i18n/presenters';
import {useI18n, I18nText } from "../../i18n";
import React, { useMemo, useState } from 'react';
import type { FinanceData } from '../../utils/backup';
import { accountingChartWarnings, chartFamilies, economicChartData, economicSeries, monthEnd, planningChartData, walletChartData, type ChartRange, type ChartRow, type EconomicFilter } from '../../utils/chartData';

import { InteractiveChart } from './InteractiveChart';

export type FinancialChartProps = { data: FinanceData; month: string; kind: 'home' | 'movements' | 'planning' | 'wallets'; initialFilter?: EconomicFilter; navigate?: (filter: EconomicFilter) => void };
function derive<T>(get: () => T) { try { return { value: get(), error: '' }; } catch(error) { return { value: null, error: error instanceof Error ? error.message : 'No se pudieron calcular los datos.' }; } }
function RangeControls({ range, onChange }: { range: ChartRange; onChange: (range: ChartRange) => void }) {
  const format=useI18n(); const { t: uiText } = format;
  return <div className="chart-controls"><label>{uiText("financial_charts.desde")}<input type="date" aria-label={uiText("financial_charts.desde_graficos")} value={range.from} onChange={e=>onChange({...range,from:e.target.value})}/></label>
    <label>{uiText("financial_charts.hasta")}<input type="date" aria-label={uiText("financial_charts.hasta_graficos")} value={range.to} onChange={e=>onChange({...range,to:e.target.value})}/></label>
    <label>{uiText("financial_charts.granularidad")}<select aria-label={uiText("financial_charts.granularidad_de_graficos")} value={range.granularity} onChange={e=>onChange({...range,granularity:e.target.value as ChartRange['granularity']})}><option value="month">{uiText("financial_charts.meses")}</option><option value="week">{uiText("financial_charts.semanas_lunes")}</option></select></label>
  </div>;
}
function Warnings({data}:{data:FinanceData}) {const {t:uiText}=useI18n();return <>{accountingChartWarnings(data).map(w=><p key={w} className="chart-warning">{chartOwnedText(w,uiText)}</p>)}</>}
function EconomicCharts({data,month,kind,initialFilter,navigate}:FinancialChartProps) {
  const format=useI18n(); const { t: uiText } = format;
  const { formatMoney: formatCurrency , formatDate } = useI18n();
  const [filter,setFilter]=useState<EconomicFilter>(()=>initialFilter ?? {from:kind==='home'?`${month.slice(0,4)}-01-01`:`${month}-01`,to:monthEnd(month),granularity:'month',type:'all',family:'all',processed:true});
  const [selected,setSelected]=useState<ChartRow|null>(null);
  const [detailPage,setDetailPage]=useState(0);
  const selectRow=(row:ChartRow)=>{setSelected([...(result.value?.periods??[]),...(result.value?.distribution??[])].find(raw=>raw.id===row.id)??row);setDetailPage(0)};
  const update=(next:EconomicFilter)=>{setFilter(next);setSelected(null)};
  const result=useMemo(()=>derive(()=>economicChartData(data,filter)),[data,filter]);
  const families=useMemo(()=>chartFamilies(data),[data]);
  const currentSelected=[...(result.value?.periods ?? []),...(result.value?.distribution ?? [])].find(r=>r.id===selected?.id);
  const selectedLabel=selected?economicRowForDisplay(currentSelected??selected,filter,uiText,format,data).label:"";
  const selectedIds=new Set(currentSelected?.ids ?? []);
  const detail=result.value?.transactions.filter(t=>selectedIds.has(t.id)) ?? [];
  const source=new Map(data.transactions.map(t=>[t.id,t]));
  return <div className="chart-layout space-y-4">
    <p>{uiText(filter.processed?"chart.executionNotice":"chart.pendingNotice")}</p>
    <RangeControls range={filter} onChange={range=>update({...filter,...range})}/>
    <div className="chart-controls"><label>{uiText("financial_charts.estado")}<select aria-label={uiText("financial_charts.estado_economico")} value={filter.processed?'processed':'pending'} onChange={e=>update({...filter,processed:e.target.value==='processed'})}><option value="processed">{uiText("financial_charts.tramitados")}</option><option value="pending">{uiText("financial_charts.pendientes_separados")}</option></select></label>
      <label>{uiText("financial_charts.tipo")}<select aria-label={uiText("financial_charts.tipo_economico")} value={filter.type} onChange={e=>update({...filter,type:e.target.value as EconomicFilter['type']})}><option value="all">{uiText("financial_charts.ingresos_y_gastos")}</option><option value="INGRESO">{uiText("financial_charts.ingresos")}</option><option value="GASTO">{uiText("financial_charts.gastos")}</option></select></label>
      <label>{uiText("financial_charts.familia")}<select aria-label={uiText("financial_charts.familia_de_graficos")} value={filter.family} onChange={e=>update({...filter,family:e.target.value})}><option value="all">{uiText("financial_charts.todas")}</option>{families.map(f=><option key={f.id} value={f.id}>{chartFamilyForDisplay(f,uiText,data).label}</option>)}</select></label>
    </div>
    <Warnings data={data}/>
    {result.error&&<p role="alert">{chartOwnedText(result.error,uiText)}</p>}
    {result.value&&<>
      <InteractiveChart title={filter.processed?uiText("financial_charts.ingresos_y_gastos_reales_por_periodo"):uiText("financial_charts.ingresos_y_gastos_pendientes_por_periodo")} rows={bucketRowsForDisplay(result.value.periods,filter,uiText,format)} series={economicSeriesForDisplay(economicSeries.slice(0,2).filter(s=>filter.type==='all'||s.key===(filter.type==='INGRESO'?'income':'expenses')),uiText)} empty={!result.value.hasData} onSelect={selectRow}/>
      <InteractiveChart title={filter.processed?uiText("financial_charts.evolucion_del_balance_economico_real"):uiText("financial_charts.balance_economico_pendiente_no_realizado")} rows={bucketRowsForDisplay(result.value.periods,filter,uiText,format)} series={economicSeriesForDisplay([economicSeries[2]],uiText)} initialType="line" empty={!result.value.hasData} onSelect={selectRow}/>
      <InteractiveChart title={filter.processed?uiText("financial_charts.distribucion_del_gasto_economico"):uiText("financial_charts.distribucion_del_gasto_pendiente")} rows={result.value.distribution.map(row=>chartFamilyForDisplay(row,uiText,data))} series={[{key:'amount',label:uiText("chart.series.economicExpense")}]} distribution initialType="donut" empty={!result.value.distribution.length} onSelect={selectRow}/>
      {selected&&<section className="chart-detail" aria-label={uiText("financial_charts.detalle_economico_seleccionado")}><h3><I18nText id="financial_charts.detalle" values={{ label: (selectedLabel) }} /></h3><p>{chartMovementCount(detail.length,format.language,uiText,format.formatNumber)}</p>
        <div className="chart-table" tabIndex={0} role="region" aria-label={uiText("interactive_chart.tabla_desplazable", {title:uiText("financial_charts.movimientos_economicos_del_dato_seleccionado")})}><table><caption>{uiText("financial_charts.movimientos_economicos_del_dato_seleccionado")}</caption><thead><tr><th>{uiText("financial_charts.fecha")}</th><th>{uiText("financial_charts.concepto")}</th><th>{uiText("financial_charts.tipo_3868d2")}</th><th>{uiText("financial_charts.importe_economico")}</th><th>{uiText("financial_charts.importe_bancario_original")}</th><th>{uiText("financial_charts.estado_98e5ac")}</th></tr></thead><tbody>{detail.slice(detailPage*100,(detailPage+1)*100).map(t=><tr key={t.id}><td>{formatDate(t.date, {day:'2-digit',month:'2-digit',year:'numeric'})}</td><th scope="row">{t.description}</th><td>{uiText(t.type==='INGRESO'?"movement_proposal.ingreso":"movement_proposal.gasto")}</td><td>{formatCurrency(t.amount)}</td><td>{formatCurrency(source.get(t.id)?.amount)}</td><td>{t.processed?uiText("financial_charts.tramitado"):uiText("financial_charts.pendiente")}</td></tr>)}</tbody></table></div>
        {detail.length>100&&<p>{uiText("chart.pagination",{page:format.formatNumber(detailPage+1),pages:format.formatNumber(Math.ceil(detail.length/100))})} <button disabled={!detailPage} onClick={()=>setDetailPage(p=>p-1)}>{uiText("financial_charts.anterior")}</button><button disabled={(detailPage+1)*100>=detail.length} onClick={()=>setDetailPage(p=>p+1)}>{uiText("financial_charts.siguiente")}</button></p>}
        {navigate&&<button type="button" onClick={()=>navigate({...filter,from:selected.from ?? filter.from,to:selected.to ?? filter.to,family:selected.values.amount!==undefined?selected.id:filter.family})}>{uiText("financial_charts.ver_este_analisis_en_movimientos")}</button>}
      </section>}
    </>}
  </div>;
}
function PlanningCharts({data,month}:FinancialChartProps) {
  const format=useI18n(); const { t: uiText } = format;
  const [period,setPeriod]=useState(month),[grouping,setGrouping]=useState<'family'|'partida'>('family'),[selected,setSelected]=useState<ChartRow|null>(null);
  const result=useMemo(()=>derive(()=>planningChartData(data,period,grouping)),[data,period,grouping]);
  return <div className="chart-layout space-y-4"><p>{uiText("financial_charts.previsiones_actuales_guardadas_los_cambios_del_borrador_local_aun")}</p>
    <div className="chart-controls"><label>{uiText("financial_charts.mes_del_grafico")}<input aria-label={uiText("financial_charts.mes_del_grafico_de_planificacion")} type="month" min="0001-01" max="9999-12" value={period} onChange={e=>{if(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)){setPeriod(e.target.value);setSelected(null)}}}/></label>
      <label>{uiText("financial_charts.agrupar_comparacion")}<select aria-label={uiText("financial_charts.agrupar_comparacion_0cbd8e")} value={grouping} onChange={e=>setGrouping(e.target.value as typeof grouping)}><option value="family">{uiText("financial_charts.familias")}</option><option value="partida">{uiText("financial_charts.partidas")}</option></select></label></div>
    <Warnings data={data}/>{result.error&&<p role="alert">{chartOwnedText(result.error,uiText)}</p>}
    {result.value&&<><p role="status">{result.value.approval?uiText("chart.savedStatusWithApproval",{status:planningStatusText(result.value.status,uiText),number:format.formatNumber(result.value.approval.number),revision:format.formatNumber(result.value.approval.revision),approvedAt:format.formatDate(result.value.approval.approvedAt,{year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",second:"numeric"})}):uiText("chart.savedStatus",{status:planningStatusText(result.value.status,uiText)})}</p>
      <InteractiveChart title={uiText("financial_charts.prevision_guardada_ejecucion_y_ultima_aprobacion")} rows={planningComparisonForDisplay(result.value.comparison,data,uiText)} series={[{key:'planned',label:result.value.carryover?uiText("chart.series.plannedEffective"):uiText("chart.series.plannedCurrent")},{key:'executed',label:uiText("chart.series.executedProcessed")},{key:'approved',label:uiText("chart.series.approvedPhoto")},...(result.value.carryover?[{key:'base',label:uiText("chart.series.baseBudget")},{key:'carryover',label:uiText("chart.series.carryoverBudget")}]:[])]} onSelect={row=>setSelected(result.value!.comparison.find(raw=>raw.id===row.id)??row)}/>
      <InteractiveChart title={uiText("financial_charts.evolucion_anual_de_planificacion")} rows={planningAnnualForDisplay(result.value.annual,uiText,format)} series={[{key:'income',label:uiText("chart.series.plannedIncome")},{key:'expenses',label:uiText("chart.series.plannedExpenses")},{key:'savings',label:uiText("chart.series.savingsTarget")},{key:'plannedBalance',label:uiText("chart.series.plannedBalance")},{key:'realBalance',label:uiText("chart.series.realBalance")},{key:'realIncome',label:uiText("chart.series.executedIncome")},{key:'realExpenses',label:uiText("chart.series.executedExpenses")},{key:'baseExpenses',label:uiText("chart.series.baseExpenses")},{key:'carryover',label:uiText("chart.series.carryoverBudget")}]} initialType="line" onSelect={row=>{setPeriod(row.id);setSelected(result.value!.annual.find(raw=>raw.id===row.id)??row)}}/>
      <p>{uiText("financial_charts.los_huecos_indican_meses_sin_plan_un_cero_ejecutado")}</p>
      {selected&&<p role="status"><I18nText id="financial_charts.seleccion_consulta_sus_cifras_exactas_en_la_tabla_correspondiente" values={{ label: planningSelectionForDisplay(selected,data,uiText,format).label, content: planningStatusText(selected.note ?? result.value.status,uiText) }} /></p>}
    </>}
  </div>;
}
function WalletCharts({data,month}:FinancialChartProps) {
  const format=useI18n(); const { t: uiText } = format;
  const { formatMoney: formatCurrency , formatDate } = useI18n();
  const [range,setRange]=useState<ChartRange>({from:`${month.slice(0,4)}-01-01`,to:monthEnd(month),granularity:'month'}),[wallet,setWallet]=useState('all'),[selected,setSelected]=useState<ChartRow|null>(null),[bankPage,setBankPage]=useState(0);
  const result=useMemo(()=>derive(()=>walletChartData(data,range,wallet)),[data,range,wallet]);
  const options=useMemo(()=>walletChartData(data,{from:`${month}-01`,to:monthEnd(month),granularity:'month'},'all').names,[data,month]);
  const selectedLabel=selected?bucketRowsForDisplay([selected],range,uiText,format)[0].label:"";
  const ids=new Set(result.value?.changes.find(r=>r.id===selected?.id)?.ids ?? []);
  return <div className="chart-layout space-y-4"><p>{uiText("financial_charts.saldos_actuales_segun_saldo_inicial_movimientos_tramitados_incluyen_pagos")}</p>
    <label>{uiText("financial_charts.cartera")}<select aria-label={uiText("financial_charts.cartera_de_graficos")} value={wallet} onChange={e=>{setWallet(e.target.value);setSelected(null)}}><option value="all">{uiText("financial_charts.todas_las_carteras")}</option>{options.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
    <RangeControls range={range} onChange={value=>{setRange(value);setSelected(null)}}/>
    <Warnings data={data}/>{result.error&&<p role="alert">{chartOwnedText(result.error,uiText)}</p>}
    {result.value&&<><p><I18nText id={wallet==='all'?"chart.currentAllBalance":"chart.currentWalletBalance"} values={{total:<strong>{formatCurrency(result.value.total)}</strong>}}/></p>
      <InteractiveChart title={uiText("financial_charts.comparacion_de_saldos_actuales")} rows={result.value.current} series={[{key:'balance',label:uiText("chart.series.currentBalance")}]} empty={!result.value.current.length} onSelect={row=>{setWallet(row.id);setSelected(null)}}/>
      <p className="chart-warning">{chartOwnedText(result.value.limitation,uiText)}</p>
      <InteractiveChart title={uiText("financial_charts.variacion_bancaria_acumulada_registrada_no_saldo_historico")} rows={bucketRowsForDisplay(result.value.changes,range,uiText,format)} series={[{key:'total',label:wallet==='all'?uiText("chart.series.totalChange"):uiText("chart.series.walletChange",{wallet})}]} initialType="line" empty={!result.value.hasMovements} onSelect={row=>{setSelected(result.value!.changes.find(raw=>raw.id===row.id)??row);setBankPage(0)}}/>
      {selected&&<div className="chart-table" tabIndex={0} role="region" aria-label={uiText("interactive_chart.tabla_desplazable", {title:uiText("chart.bankTransactionsFor",{period:selectedLabel})})}><table><caption>{uiText("chart.bankTransactionsFor",{period:selectedLabel})}</caption><thead><tr><th>{uiText("financial_charts.fecha")}</th><th>{uiText("financial_charts.concepto")}</th><th>{uiText("financial_charts.tipo_bancario")}</th><th>{uiText("financial_charts.importe")}</th></tr></thead><tbody>{data.transactions.filter(t=>ids.has(t.id)).slice(bankPage*100,(bankPage+1)*100).map(t=><tr key={t.id}><td>{formatDate(t.date, {day:'2-digit',month:'2-digit',year:'numeric'})}</td><th scope="row">{t.description}</th><td>{uiText(t.type==='INGRESO'?"movement_proposal.ingreso":"movement_proposal.gasto")}</td><td>{formatCurrency(t.amount)}</td></tr>)}</tbody></table>{ids.size>100&&<p>{uiText("chart.pagination",{page:format.formatNumber(bankPage+1),pages:format.formatNumber(Math.ceil(ids.size/100))})} <button disabled={!bankPage} onClick={()=>setBankPage(p=>p-1)}>{uiText("financial_charts.anterior")}</button><button disabled={(bankPage+1)*100>=ids.size} onClick={()=>setBankPage(p=>p+1)}>{uiText("financial_charts.siguiente")}</button></p>}</div>}
    </>}
  </div>;
}
export default function FinancialCharts(props:FinancialChartProps) {
  return props.kind==='planning'?<PlanningCharts {...props}/>:props.kind==='wallets'?<WalletCharts {...props}/>:<EconomicCharts {...props}/>;
}

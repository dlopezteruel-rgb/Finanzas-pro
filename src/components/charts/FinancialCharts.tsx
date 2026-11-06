import React, { useMemo, useState } from 'react';
import type { FinanceData } from '../../utils/backup';
import { accountingChartWarnings, chartFamilies, economicChartData, economicSeries, monthEnd, planningChartData, walletChartData, type ChartRange, type ChartRow, type EconomicFilter } from '../../utils/chartData';
import { formatCurrency } from '../../utils/finance';
import { InteractiveChart } from './InteractiveChart';

export type FinancialChartProps = { data: FinanceData; month: string; kind: 'home' | 'movements' | 'planning' | 'wallets'; initialFilter?: EconomicFilter; navigate?: (filter: EconomicFilter) => void };
function derive<T>(get: () => T) { try { return { value: get(), error: '' }; } catch(error) { return { value: null, error: error instanceof Error ? error.message : 'No se pudieron calcular los datos.' }; } }
function RangeControls({ range, onChange }: { range: ChartRange; onChange: (range: ChartRange) => void }) {
  return <div className="chart-controls"><label>Desde <input type="date" aria-label="Desde (gráficos)" value={range.from} onChange={e=>onChange({...range,from:e.target.value})}/></label>
    <label>Hasta <input type="date" aria-label="Hasta (gráficos)" value={range.to} onChange={e=>onChange({...range,to:e.target.value})}/></label>
    <label>Granularidad <select aria-label="Granularidad de gráficos" value={range.granularity} onChange={e=>onChange({...range,granularity:e.target.value as ChartRange['granularity']})}><option value="month">Meses</option><option value="week">Semanas (lunes)</option></select></label>
  </div>;
}
function Warnings({data}:{data:FinanceData}) {return <>{accountingChartWarnings(data).map(w=><p key={w} className="chart-warning">{w}</p>)}</>}
function EconomicCharts({data,month,kind,initialFilter,navigate}:FinancialChartProps) {
  const [filter,setFilter]=useState<EconomicFilter>(()=>initialFilter ?? {from:kind==='home'?`${month.slice(0,4)}-01-01`:`${month}-01`,to:monthEnd(month),granularity:'month',type:'all',family:'all',processed:true});
  const [selected,setSelected]=useState<ChartRow|null>(null);
  const [detailPage,setDetailPage]=useState(0);
  const selectRow=(row:ChartRow)=>{setSelected(row);setDetailPage(0)};
  const update=(next:EconomicFilter)=>{setFilter(next);setSelected(null)};
  const result=useMemo(()=>derive(()=>economicChartData(data,filter)),[data,filter]);
  const families=useMemo(()=>chartFamilies(data),[data]);
  const currentSelected=[...(result.value?.periods ?? []),...(result.value?.distribution ?? [])].find(r=>r.id===selected?.id);
  const selectedIds=new Set(currentSelected?.ids ?? []);
  const detail=result.value?.transactions.filter(t=>selectedIds.has(t.id)) ?? [];
  const source=new Map(data.transactions.map(t=>[t.id,t]));
  return <div className="space-y-4">
    <p>{filter.processed?'Ejecución económica: solo tramitados.':'Pendientes: previsión de movimientos aún no tramitados; no son ejecución ni saldo.'} Los filtros de este análisis no modifican movimientos.</p>
    <RangeControls range={filter} onChange={range=>update({...filter,...range})}/>
    <div className="chart-controls"><label>Estado <select aria-label="Estado económico" value={filter.processed?'processed':'pending'} onChange={e=>update({...filter,processed:e.target.value==='processed'})}><option value="processed">Tramitados</option><option value="pending">Pendientes (separados)</option></select></label>
      <label>Tipo <select aria-label="Tipo económico" value={filter.type} onChange={e=>update({...filter,type:e.target.value as EconomicFilter['type']})}><option value="all">Ingresos y gastos</option><option value="INGRESO">Ingresos</option><option value="GASTO">Gastos</option></select></label>
      <label>Familia <select aria-label="Familia de gráficos" value={filter.family} onChange={e=>update({...filter,family:e.target.value})}><option value="all">Todas</option>{families.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
    </div>
    <Warnings data={data}/>
    {result.error&&<p role="alert">{result.error}</p>}
    {result.value&&<>
      <InteractiveChart title={filter.processed?'Ingresos y gastos reales por periodo':'Ingresos y gastos pendientes por periodo'} rows={result.value.periods} series={economicSeries.slice(0,2).filter(s=>filter.type==='all'||s.key===(filter.type==='INGRESO'?'income':'expenses'))} empty={!result.value.hasData} onSelect={selectRow}/>
      <InteractiveChart title={filter.processed?'Evolución del balance económico real':'Balance económico pendiente (no realizado)'} rows={result.value.periods} series={[economicSeries[2]]} initialType="line" empty={!result.value.hasData} onSelect={selectRow}/>
      <InteractiveChart title={filter.processed?'Distribución del gasto económico':'Distribución del gasto pendiente'} rows={result.value.distribution} series={[{key:'amount',label:'Gasto económico'}]} distribution initialType="donut" empty={!result.value.distribution.length} onSelect={selectRow}/>
      {selected&&<section className="chart-detail" aria-label="Detalle económico seleccionado"><h3>Detalle: {selected.label}</h3><p>{detail.length} movimientos económicos. Compartidos estructurados: parte propia; los pagos bancarios se indican aparte.</p>
        <div className="chart-table"><table><caption>Movimientos económicos del dato seleccionado</caption><thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Importe económico</th><th>Importe bancario original</th><th>Estado</th></tr></thead><tbody>{detail.slice(detailPage*100,(detailPage+1)*100).map(t=><tr key={t.id}><td>{t.date}</td><th scope="row">{t.description}</th><td>{t.type}</td><td>{formatCurrency(t.amount)}</td><td>{formatCurrency(source.get(t.id)?.amount)}</td><td>{t.processed?'Tramitado':'Pendiente'}</td></tr>)}</tbody></table></div>
        {detail.length>100&&<p>Página {detailPage+1} de {Math.ceil(detail.length/100)} <button disabled={!detailPage} onClick={()=>setDetailPage(p=>p-1)}>Anterior</button><button disabled={(detailPage+1)*100>=detail.length} onClick={()=>setDetailPage(p=>p+1)}>Siguiente</button></p>}
        {navigate&&<button type="button" onClick={()=>navigate({...filter,from:selected.from ?? filter.from,to:selected.to ?? filter.to,family:selected.values.amount!==undefined?selected.id:filter.family})}>Ver este análisis en Movimientos</button>}
      </section>}
    </>}
  </div>;
}
function PlanningCharts({data,month}:FinancialChartProps) {
  const [period,setPeriod]=useState(month),[grouping,setGrouping]=useState<'family'|'partida'>('family'),[selected,setSelected]=useState<ChartRow|null>(null);
  const result=useMemo(()=>derive(()=>planningChartData(data,period,grouping)),[data,period,grouping]);
  return <div className="space-y-4"><p>Previsiones actuales guardadas; los cambios del borrador local aún sin guardar no se representan. El ahorro objetivo no es un gasto ejecutado. Solo se conserva la última fotografía aprobada, no un historial de aprobaciones.</p>
    <div className="chart-controls"><label>Mes del gráfico <input aria-label="Mes del gráfico de planificación" type="month" min="0001-01" max="9999-12" value={period} onChange={e=>{if(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)){setPeriod(e.target.value);setSelected(null)}}}/></label>
      <label>Agrupar comparación <select aria-label="Agrupar comparación" value={grouping} onChange={e=>setGrouping(e.target.value as typeof grouping)}><option value="family">Familias</option><option value="partida">Partidas</option></select></label></div>
    <Warnings data={data}/>{result.error&&<p role="alert">{result.error}</p>}
    {result.value&&<><p role="status">Estado de la previsión guardada: {result.value.status}{result.value.approval?` · Última aprobación n.º ${result.value.approval.number}, revisión ${result.value.approval.revision}, ${result.value.approval.approvedAt}`:''}</p>
      <InteractiveChart title="Previsión guardada, ejecución y última aprobación" rows={result.value.comparison} series={[{key:'planned',label:'Previsión actual guardada'},{key:'executed',label:'Ejecutado tramitado'},{key:'approved',label:'Última fotografía aprobada'}]} onSelect={setSelected}/>
      <InteractiveChart title="Evolución anual de planificación" rows={result.value.annual} series={[{key:'income',label:'Ingresos previstos'},{key:'expenses',label:'Gastos previstos'},{key:'savings',label:'Ahorro objetivo'},{key:'plannedBalance',label:'Balance previsto'},{key:'realBalance',label:'Balance económico real'},{key:'realIncome',label:'Ingresos ejecutados'},{key:'realExpenses',label:'Gastos ejecutados'}]} initialType="line" onSelect={row=>{setPeriod(row.id);setSelected(row)}}/>
      <p>Los huecos indican meses sin plan. Un cero ejecutado solo expresa ausencia de movimientos económicos procesados en los datos disponibles, sin certificar que el historial esté completo.</p>
      {selected&&<p role="status">Selección: {selected.label} · {selected.note ?? result.value.status}. Consulta sus cifras exactas en la tabla correspondiente.</p>}
    </>}
  </div>;
}
function WalletCharts({data,month}:FinancialChartProps) {
  const [range,setRange]=useState<ChartRange>({from:`${month.slice(0,4)}-01-01`,to:monthEnd(month),granularity:'month'}),[wallet,setWallet]=useState('all'),[selected,setSelected]=useState<ChartRow|null>(null),[bankPage,setBankPage]=useState(0);
  const result=useMemo(()=>derive(()=>walletChartData(data,range,wallet)),[data,range,wallet]);
  const options=useMemo(()=>walletChartData(data,{from:`${month}-01`,to:monthEnd(month),granularity:'month'},'all').names,[data,month]);
  const ids=new Set(result.value?.changes.find(r=>r.id===selected?.id)?.ids ?? []);
  return <div className="space-y-4"><p>Saldos actuales según saldo inicial + movimientos tramitados. Incluyen pagos completos compartidos, reintegros y las dos contrapartidas de transferencias; los pendientes no alteran el saldo.</p>
    <label>Cartera <select aria-label="Cartera de gráficos" value={wallet} onChange={e=>{setWallet(e.target.value);setSelected(null)}}><option value="all">Todas las carteras</option>{options.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
    <RangeControls range={range} onChange={value=>{setRange(value);setSelected(null)}}/>
    <Warnings data={data}/>{result.error&&<p role="alert">{result.error}</p>}
    {result.value&&<><p>Saldo actual {wallet==='all'?'total de carteras':'de la cartera'}: <strong>{formatCurrency(result.value.total)}</strong>. La comparación actual no depende del rango de la curva.</p>
      <InteractiveChart title="Comparación de saldos actuales" rows={result.value.current} series={[{key:'balance',label:'Saldo actual'}]} empty={!result.value.current.length} onSelect={row=>{setWallet(row.id);setSelected(null)}}/>
      <p className="chart-warning">{result.value.limitation}</p>
      <InteractiveChart title="Variación bancaria acumulada registrada (no saldo histórico)" rows={result.value.changes} series={[{key:'total',label:wallet==='all'?'Variación total':`Variación ${wallet}`}]} initialType="line" empty={!result.value.hasMovements} onSelect={row=>{setSelected(row);setBankPage(0)}}/>
      {selected&&<div className="chart-table"><table><caption>Movimientos bancarios registrados de {selected.label}</caption><thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo bancario</th><th>Importe</th></tr></thead><tbody>{data.transactions.filter(t=>ids.has(t.id)).slice(bankPage*100,(bankPage+1)*100).map(t=><tr key={t.id}><td>{t.date}</td><th scope="row">{t.description}</th><td>{t.type}</td><td>{formatCurrency(t.amount)}</td></tr>)}</tbody></table>{ids.size>100&&<p>Página {bankPage+1} de {Math.ceil(ids.size/100)} <button disabled={!bankPage} onClick={()=>setBankPage(p=>p-1)}>Anterior</button><button disabled={(bankPage+1)*100>=ids.size} onClick={()=>setBankPage(p=>p+1)}>Siguiente</button></p>}</div>}
    </>}
  </div>;
}
export default function FinancialCharts(props:FinancialChartProps) {
  return props.kind==='planning'?<PlanningCharts {...props}/>:props.kind==='wallets'?<WalletCharts {...props}/>:<EconomicCharts {...props}/>;
}

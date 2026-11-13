import {useI18n, I18nText } from "../../i18n";
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { arc, line, pie } from 'd3-shape';
import type { ChartRow, ChartSeries } from '../../utils/chartData';


const colors = ['#38bdf8', '#f59e0b', '#a78bfa', '#34d399', '#fb7185', '#e879f9', '#2dd4bf', '#fda4af'];
export function InteractiveChart({ title, rows, series, initialType = 'bars', distribution = false, empty = false, onSelect }: {
  title: string; rows: ChartRow[]; series: ChartSeries[]; initialType?: 'bars' | 'line' | 'donut'; distribution?: boolean; empty?: boolean; onSelect?: (row: ChartRow) => void;
}) {
  const { t: uiText } = useI18n();
  const { formatMoney: formatCurrency,formatPercent,formatCompactMoney } = useI18n();
  const id = useId();
  const host=useRef<HTMLElement>(null), [compact,setCompact]=useState(false);
  useEffect(()=>{const observer=new ResizeObserver(entries=>setCompact(entries[0].contentRect.width<480));if(host.current)observer.observe(host.current);return()=>observer.disconnect()},[]);
  const chartWidth=compact?480:720,plotWidth=chartWidth-100;
  const [type, setType] = useState(initialType);
  // Keep crowded comparisons legible; every series remains available in the legend.
  const [hidden, setHidden] = useState<string[]>(() => series.length > 4 ? series.slice(3).map(s => s.key) : []);
  const [selected, setSelected] = useState<{ row: string; key: string } | null>(null);
  const visible = series.filter(s=>!hidden.includes(s.key));
  const numbers: number[] = rows.flatMap(r=>visible.flatMap(s=>{ const value=r.values[s.key]; return value === null ? [] : [value]; }));
  const invalid = numbers.some(n=>typeof n!=='number'||!Number.isFinite(n)) || !Number.isFinite(Math.max(0,...numbers)-Math.min(0,...numbers));
  const min = Math.min(0, ...numbers), max = Math.max(0, ...numbers), span = max-min || 1;
  const y = (n: number) => 215 - (n-min)/span*170, x = (index: number) => 70 + (index + .5)*plotWidth/Math.max(1,rows.length);
  const donutAllowed = distribution && visible.length === 1 && rows.length > 0 && numbers.every(n=>n>=0) && numbers.some(n=>n>0);
  const mode = type==='donut' && !donutAllowed ? 'bars' : type;
  const active = rows.find(r=>r.id===selected?.row), activeSeries = visible.find(s=>s.key===selected?.key);
  const select = (row: ChartRow, key: string, activate = false) => { setSelected({row:row.id,key}); if(activate)onSelect?.(row); };
  const interaction = (row: ChartRow, key: string) => ({
    role: 'button', tabIndex: 0, 'data-chart-point': true,'data-chart-row':row.id,'data-chart-series':key,
    'aria-label': uiText('chart.readout',{row:row.label,series:series.find(s=>s.key===key)?.label??'',value:formatCurrency(row.values[key])}),
    onFocus: () => select(row,key), onPointerEnter: () => select(row,key), onClick: () => select(row,key,true),
    onKeyDown: (event: React.KeyboardEvent<SVGElement>) => {
      if(event.key==='Enter'||event.key===' ') { event.preventDefault();select(row,key,true); }
      if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)) {
        event.preventDefault(); const nodes=event.currentTarget.ownerSVGElement?.querySelectorAll<SVGElement>('[data-chart-point]');
        const current=Array.from(nodes ?? []).indexOf(event.currentTarget), next=event.key==='Home'?0:event.key==='End'?(nodes?.length ?? 1)-1:event.key==='ArrowRight'?current+1:current-1;
        nodes?.[Math.max(0,Math.min((nodes?.length ?? 1)-1,next))]?.focus();
      }
    },
  });
  const pieData = useMemo(()=>pie<ChartRow>().sort(null).value(r=>r.values[visible[0]?.key] ?? 0)(rows),[rows, visible[0]?.key]);
  const shape = arc<(typeof pieData)[number]>().innerRadius(62).outerRadius(100);
  return <section ref={host} className="finance-chart" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>{title}</h3>
    <div className="chart-controls">
      <label>{uiText("interactive_chart.tipo_de_grafico")}<select aria-label={uiText("interactive_chart.tipo_de_grafico_c36918", { title: title })} value={mode} onChange={e=>setType(e.target.value as typeof type)}>
        <option value="bars">{uiText("interactive_chart.barras")}</option><option value="line">{uiText("interactive_chart.lineas")}</option>{donutAllowed&&<option value="donut">{uiText("interactive_chart.anillo")}</option>}
      </select></label>
      <fieldset className="chart-legend"><legend>{uiText("chart.seriesLegend",{title})}</legend>{series.map((s,i)=><label key={s.key}>
        <input type="checkbox" checked={!hidden.includes(s.key)} onChange={e=>setHidden(previous=>e.target.checked?previous.filter(k=>k!==s.key):[...previous,s.key])}/>
        <span className="chart-series-swatch" style={{borderColor:colors[i%colors.length]}} aria-hidden="true"/><span className="chart-series-label">{s.label}</span>
      </label>)}</fieldset>
    </div>
    <label>{uiText("interactive_chart.seleccionar_dato")}<select aria-label={uiText("interactive_chart.seleccionar_dato_6a9411", { title: title })} value={active?.id ?? ''} onChange={e=>{const row=rows.find(r=>r.id===e.target.value);if(row&&visible[0])select(row,visible[0].key,true)}}><option value="">{uiText("interactive_chart.elige_un_dato")}</option>{rows.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
    {invalid ? <p role="alert">{uiText("interactive_chart.no_se_puede_representar_un_total_no_finito_acota")}</p> : empty || !rows.length ? <p role="status">{uiText("interactive_chart.sin_datos_para_este_periodo_y_estos_filtros")}</p> : !visible.length ? <p role="status">{uiText("interactive_chart.activa_una_serie_para_visualizarla")}</p> : <svg viewBox={`0 0 ${chartWidth} 270`} role="group" aria-label={uiText("interactive_chart.grafico_interactivo", { title: title })}>
      {mode==='donut' ? <g transform={`translate(${chartWidth/2},135)`}>{pieData.map((slice,i)=><path key={slice.data.id} d={shape(slice) ?? undefined} fill={colors[i%colors.length]} stroke="currentColor" strokeWidth={1.5} {...interaction(slice.data,visible[0].key)}><title>{uiText('chart.pointTitle',{row:slice.data.label,value:formatCurrency(slice.value)})}</title></path>)}
        <text textAnchor="middle" y={-5} fill="currentColor" fontSize={16} aria-hidden="true">{uiText("chart.filteredSpending").split(/\s+/).map((word,i,words)=><tspan key={i} x={0} dy={i?18:0}>{word}{i<words.length-1?" ":""}</tspan>)}</text>
      </g> : <>
        {[min,(min+max)/2,max].map((n,i)=><g key={i}><line x1={65} x2={chartWidth-20} y1={y(n)} y2={y(n)} className="chart-grid"/><text x={60} y={y(n)+4} textAnchor="end" fill="currentColor" fontSize={compact?16:11}>{formatCompactMoney(n)}</text></g>)}
        <line x1={65} x2={chartWidth-20} y1={y(0)} y2={y(0)} stroke="currentColor"/>
        {visible.map((s,si)=>{
          const color=colors[series.findIndex(item=>item.key===s.key)%colors.length];
          const path=line<ChartRow>().defined(r=>r.values[s.key]!==null).x((_,i)=>x(i)).y(r=>y(r.values[s.key]!));
          const width=Math.min(30,plotWidth/Math.max(1,rows.length)/Math.max(1,visible.length)*.75);
          return <g key={s.key}>{mode==='line'&&<path d={path(rows) ?? undefined} fill="none" stroke={color} strokeWidth={2} strokeDasharray={[undefined,'6 3','2 2','10 3 2 3','1 3','8 2 2 2','12 4'][si%7]}/>}
            {rows.map((r,i)=>r.values[s.key]===null?null: mode==='line'?<circle key={r.id} cx={x(i)} cy={y(r.values[s.key]!)} r={5} fill={color} stroke="currentColor" strokeWidth={1} {...interaction(r,s.key)}><title>{uiText('chart.pointTitle',{row:r.label,value:formatCurrency(r.values[s.key])})}</title></circle>
              : <g key={r.id} {...interaction(r,s.key)}><rect x={x(i)+(si-(visible.length-1)/2)*width-width/2} y={Math.min(y(0),y(r.values[s.key]!))} width={width} height={Math.max(1,Math.abs(y(r.values[s.key]!)-y(0)))} fill={color} stroke="currentColor" strokeWidth={.5}/><rect x={x(i)+(si-(visible.length-1)/2)*width-width/2} y={Math.min(y(0),y(r.values[s.key]!))-5} width={width} height={Math.max(12,Math.abs(y(r.values[s.key]!)-y(0))+10)} fill="transparent"/><title>{uiText('chart.pointTitle',{row:r.label,value:formatCurrency(r.values[s.key])})}</title></g>)}
          </g>;
        })}
        {rows.map((r,i)=>i%Math.max(1,Math.ceil(rows.length/(compact?4:8)))===0?<text key={r.id} x={x(i)} y={245} textAnchor="middle" fill="currentColor" fontSize={compact?16:11}>{r.label.length>16?r.label.slice(0,14)+'…':r.label}</text>:null)}
      </>}
    </svg>}
    <p role="status" className="chart-readout">{active && activeSeries ? (active.note?uiText("chart.readoutNote",{row:active.label,series:activeSeries.label,value:active.values[activeSeries.key]===null?uiText("interactive_chart.sin_plan"):formatCurrency(active.values[activeSeries.key]),note:active.note}):uiText("chart.readout",{row:active.label,series:activeSeries.label,value:active.values[activeSeries.key]===null?uiText("interactive_chart.sin_plan"):formatCurrency(active.values[activeSeries.key])})) : uiText("interactive_chart.toca_pulsa_o_enfoca_un_dato_para_consultar_su")}</p>
    {mode==='donut'&&<ul className="chart-slices">{rows.map((r,i)=><li key={r.id}><span style={{background:colors[i%colors.length]}} aria-hidden="true"/>{uiText('chart.sliceSummary',{name:r.label,amount:formatCurrency(r.values[visible[0].key]),percent:formatPercent(r.values.percent??0)})}</li>)}</ul>}
    <div className="chart-table" tabIndex={0} role="region" aria-label={uiText("interactive_chart.tabla_desplazable", { title: title })}><table>
      <caption>{uiText("chart.tableCaption",{title})}</caption><thead><tr><th scope="col">{uiText("interactive_chart.periodo_categoria")}</th>{visible.map(s=><th scope="col" key={s.key}>{s.label}</th>)}{distribution&&<th scope="col">{uiText("interactive_chart.porcentaje_del_gasto_filtrado")}</th>}<th scope="col">{uiText("interactive_chart.estado_detalle")}</th></tr></thead>
      <tbody>{rows.map(r=><tr key={r.id} data-chart-row={r.id}><th scope="row">{r.label}</th>{visible.map(s=><td key={s.key}>{r.values[s.key]===null?(s.key==='approved'?uiText("interactive_chart.sin_fotografia_aprobada"):uiText("interactive_chart.sin_plan")):formatCurrency(r.values[s.key])}</td>)}{distribution&&<td>{formatPercent(r.values.percent??0)}</td>}<td>{r.note}{onSelect&&<button type="button" onClick={()=>{select(r,visible[0]?.key ?? series[0].key);onSelect(r);}}><I18nText id="interactive_chart.ver_detalle_de" values={{ label: (r.label) }} /></button>}</td></tr>)}</tbody>
    </table></div>
  </section>;
}

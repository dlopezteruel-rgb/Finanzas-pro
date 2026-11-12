import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { arc, line, pie } from 'd3-shape';
import type { ChartRow, ChartSeries } from '../../utils/chartData';
import { formatCurrency } from '../../utils/finance';

const colors = ['#38bdf8', '#f59e0b', '#a78bfa', '#34d399', '#fb7185', '#e879f9', '#2dd4bf', '#fda4af'];
export function InteractiveChart({ title, rows, series, initialType = 'bars', distribution = false, empty = false, onSelect }: {
  title: string; rows: ChartRow[]; series: ChartSeries[]; initialType?: 'bars' | 'line' | 'donut'; distribution?: boolean; empty?: boolean; onSelect?: (row: ChartRow) => void;
}) {
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
    role: 'button', tabIndex: 0, 'data-chart-point': true,
    'aria-label': `${row.label} · ${series.find(s=>s.key===key)?.label}: ${formatCurrency(row.values[key])}`,
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
      <label>Tipo de gráfico <select aria-label={`Tipo de gráfico: ${title}`} value={mode} onChange={e=>setType(e.target.value as typeof type)}>
        <option value="bars">Barras</option><option value="line">Líneas</option>{donutAllowed&&<option value="donut">Anillo</option>}
      </select></label>
      <fieldset className="chart-legend"><legend>Series visibles · {title}</legend>{series.map((s,i)=><label key={s.key}>
        <input type="checkbox" checked={!hidden.includes(s.key)} onChange={e=>setHidden(previous=>e.target.checked?previous.filter(k=>k!==s.key):[...previous,s.key])}/>
        <span className="chart-series-swatch" style={{borderColor:colors[i%colors.length]}} aria-hidden="true"/><span className="chart-series-label">{s.label}</span>
      </label>)}</fieldset>
    </div>
    <label>Seleccionar dato <select aria-label={`Seleccionar dato: ${title}`} value={active?.id ?? ''} onChange={e=>{const row=rows.find(r=>r.id===e.target.value);if(row&&visible[0])select(row,visible[0].key,true)}}><option value="">Elige un dato</option>{rows.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
    {invalid ? <p role="alert">No se puede representar un total no finito. Acota el rango y revisa los datos.</p> : empty || !rows.length ? <p role="status">Sin datos para este periodo y estos filtros.</p> : !visible.length ? <p role="status">Activa una serie para visualizarla.</p> : <svg viewBox={`0 0 ${chartWidth} 270`} role="group" aria-label={`Gráfico interactivo: ${title}`}>
      {mode==='donut' ? <g transform={`translate(${chartWidth/2},135)`}>{pieData.map((slice,i)=><path key={slice.data.id} d={shape(slice) ?? undefined} fill={colors[i%colors.length]} stroke="currentColor" strokeWidth={1.5} {...interaction(slice.data,visible[0].key)}><title>{slice.data.label}: {formatCurrency(slice.value)}</title></path>)}
        <text textAnchor="middle" y={0} fill="currentColor" fontSize={16} aria-hidden="true">Gasto</text><text textAnchor="middle" y={22} fill="currentColor" fontSize={16} aria-hidden="true">filtrado</text>
      </g> : <>
        {[min,(min+max)/2,max].map((n,i)=><g key={i}><line x1={65} x2={chartWidth-20} y1={y(n)} y2={y(n)} className="chart-grid"/><text x={60} y={y(n)+4} textAnchor="end" fill="currentColor" fontSize={compact?16:11}>{new Intl.NumberFormat('es-ES',{notation:'compact',maximumFractionDigits:1}).format(n)} €</text></g>)}
        <line x1={65} x2={chartWidth-20} y1={y(0)} y2={y(0)} stroke="currentColor"/>
        {visible.map((s,si)=>{
          const color=colors[series.findIndex(item=>item.key===s.key)%colors.length];
          const path=line<ChartRow>().defined(r=>r.values[s.key]!==null).x((_,i)=>x(i)).y(r=>y(r.values[s.key]!));
          const width=Math.min(30,plotWidth/Math.max(1,rows.length)/Math.max(1,visible.length)*.75);
          return <g key={s.key}>{mode==='line'&&<path d={path(rows) ?? undefined} fill="none" stroke={color} strokeWidth={2} strokeDasharray={[undefined,'6 3','2 2','10 3 2 3','1 3','8 2 2 2','12 4'][si%7]}/>}
            {rows.map((r,i)=>r.values[s.key]===null?null: mode==='line'?<circle key={r.id} cx={x(i)} cy={y(r.values[s.key]!)} r={5} fill={color} stroke="currentColor" strokeWidth={1} {...interaction(r,s.key)}><title>{r.label}: {formatCurrency(r.values[s.key])}</title></circle>
              : <g key={r.id} {...interaction(r,s.key)}><rect x={x(i)+(si-(visible.length-1)/2)*width-width/2} y={Math.min(y(0),y(r.values[s.key]!))} width={width} height={Math.max(1,Math.abs(y(r.values[s.key]!)-y(0)))} fill={color} stroke="currentColor" strokeWidth={.5}/><rect x={x(i)+(si-(visible.length-1)/2)*width-width/2} y={Math.min(y(0),y(r.values[s.key]!))-5} width={width} height={Math.max(12,Math.abs(y(r.values[s.key]!)-y(0))+10)} fill="transparent"/><title>{r.label}: {formatCurrency(r.values[s.key])}</title></g>)}
          </g>;
        })}
        {rows.map((r,i)=>i%Math.max(1,Math.ceil(rows.length/(compact?4:8)))===0?<text key={r.id} x={x(i)} y={245} textAnchor="middle" fill="currentColor" fontSize={compact?16:11}>{r.label.length>16?r.label.slice(0,14)+'…':r.label}</text>:null)}
      </>}
    </svg>}
    <p role="status" className="chart-readout">{active && activeSeries ? `${active.label} · ${activeSeries.label}: ${active.values[activeSeries.key] === null ? 'Sin plan' : formatCurrency(active.values[activeSeries.key])}${active.note ? ` · ${active.note}` : ''}` : 'Toca, pulsa o enfoca un dato para consultar su importe. Flechas para recorrer los puntos.'}</p>
    {mode==='donut'&&<ul className="chart-slices">{rows.map((r,i)=><li key={r.id}><span style={{background:colors[i%colors.length]}} aria-hidden="true"/>{r.label}: {formatCurrency(r.values[visible[0].key])} · {(r.values.percent ?? 0).toFixed(1)} %</li>)}</ul>}
    <div className="chart-table" tabIndex={0} role="region" aria-label={`Tabla desplazable: ${title}`}><table>
      <caption>{title} · tabla de datos</caption><thead><tr><th scope="col">Periodo / categoría</th>{visible.map(s=><th scope="col" key={s.key}>{s.label}</th>)}{distribution&&<th scope="col">Porcentaje del gasto filtrado</th>}<th scope="col">Estado / detalle</th></tr></thead>
      <tbody>{rows.map(r=><tr key={r.id}><th scope="row">{r.label}</th>{visible.map(s=><td key={s.key}>{r.values[s.key]===null?(s.key==='approved'?'Sin fotografía aprobada':'Sin plan'):formatCurrency(r.values[s.key])}</td>)}{distribution&&<td>{(r.values.percent ?? 0).toFixed(1)} %</td>}<td>{r.note}{onSelect&&<button type="button" onClick={()=>{select(r,visible[0]?.key ?? series[0].key);onSelect(r);}}>Ver detalle de {r.label}</button>}</td></tr>)}</tbody>
    </table></div>
  </section>;
}

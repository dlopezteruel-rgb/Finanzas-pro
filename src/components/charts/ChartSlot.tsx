import React, { lazy, Suspense, useState } from 'react';
import type { FinancialChartProps } from './FinancialCharts';
const FinancialCharts=lazy(()=>import('./FinancialCharts'));
export function ChartSlot(props:FinancialChartProps) {
  const [mounted,setMounted]=useState(!!props.initialFilter);
  const title=props.kind==='home'?'Gráficos de Inicio':props.kind==='movements'?'Gráficos de Movimientos':props.kind==='planning'?'Gráficos de Planificación':'Gráficos de Cuentas';
  return <details className="financial-charts" open={props.initialFilter?true:undefined} onToggle={e=>{if(e.currentTarget.open)setMounted(true)}}>
    <summary>{title}</summary>
    {mounted&&<Suspense fallback={<p role="status">Cargando gráficos locales…</p>}><FinancialCharts {...props}/></Suspense>}
  </details>;
}

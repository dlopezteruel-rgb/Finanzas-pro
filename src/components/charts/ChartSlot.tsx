import { useI18n } from "../../i18n";
import React, { lazy, Suspense, useState } from 'react';
import type { FinancialChartProps } from './FinancialCharts';
const FinancialCharts=lazy(()=>import('./FinancialCharts'));
export function ChartSlot(props:FinancialChartProps) {
  const { t: uiText } = useI18n();
  const [mounted,setMounted]=useState(!!props.initialFilter);
  const title=uiText(props.kind==='home'?'chart.slot.home':props.kind==='movements'?'chart.slot.movements':props.kind==='planning'?'chart.slot.planning':'chart.slot.wallets');
  return <details className="financial-charts" open={props.initialFilter?true:undefined} onToggle={e=>{if(e.currentTarget.open)setMounted(true)}}>
    <summary>{title}</summary>
    {mounted&&<Suspense fallback={<p role="status">{uiText("chart_slot.cargando_graficos_locales")}</p>}><FinancialCharts {...props}/></Suspense>}
  </details>;
}

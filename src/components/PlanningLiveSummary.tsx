import React, { useState } from 'react';
import type { planningDraftPreview } from './planningPreview';
import { formatPlanningCents as money } from '../utils/planning';

export function PlanningLiveSummary({ preview, dirty }: {
  preview: ReturnType<typeof planningDraftPreview>;
  dirty: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { baseTotals, totals, carryCents } = preview;
  const metric = (label: string, value: number | undefined, emphasis = false) => <div className={emphasis ? 'allocation-key' : undefined} key={label}>
    <dt>{label}</dt><dd className={value !== undefined && value < 0 ? 'allocation-negative' : undefined}>{value === undefined ? '—' : money(value)}</dd>
  </div>;
  return <aside id="planning-live-summary" tabIndex={-1} className="planning-card allocation-panel" data-expanded={expanded} aria-label="Asignación del mes en directo">
    <div className="allocation-heading"><h2>Asignación del mes</h2><span>En directo</span></div>
    <p role="status">{dirty ? 'Vista previa local · sin guardar' : 'Vista local · datos guardados'}</p>
    {!totals && <p role="alert">Cálculo no disponible. Corrige los importes indicados; no se muestran totales anteriores.</p>}
    <div className="planning-totals allocation-totals" aria-live="polite" aria-atomic="true">
      <dl className="allocation-primary">
        {metric('Pendiente de asignar del mes', baseTotals?.margin, true)}
        {metric('Margen previsto efectivo', totals?.margin, true)}
      </dl>
      <button type="button" className="allocation-toggle" aria-expanded={expanded} aria-controls="allocation-detail" onClick={() => setExpanded(!expanded)}>{expanded ? 'Resumir asignación' : 'Ver desglose de asignación'}</button>
      <div id="allocation-detail" className="allocation-detail" data-expanded={expanded}>
        <dl>
          {metric('Ingresos previstos', baseTotals?.income)}
          {metric('Ahorro objetivo', baseTotals?.savings)}
          {metric('Gastos base asignados', baseTotals?.expenses)}
          {metric('Arrastres presupuestarios recibidos', carryCents)}
          {metric('Gasto efectivo previsto', totals?.expenses)}
        </dl>
        <p>El pendiente usa solo ingresos del mes, objetivo y gastos base. El margen efectivo descuenta también los arrastres. Estos ajustes no son ingresos ni dinero en el banco.</p>
      </div>
    </div>
  </aside>;
}

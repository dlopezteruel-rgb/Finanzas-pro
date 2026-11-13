import { useI18n } from "../i18n";
import React, { useState } from 'react';
import type { planningDraftPreview } from './planningPreview';
import { formatPlanningCents as money } from '../utils/planning';

export function PlanningLiveSummary({ preview, dirty }: {
  preview: ReturnType<typeof planningDraftPreview>;
  dirty: boolean;
}) {
  const { t: uiText } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const { baseTotals, totals, carryCents } = preview;
  const metric = (label: string, value: number | undefined, emphasis = false) => <div className={emphasis ? 'allocation-key' : undefined} key={label}>
    <dt>{label}</dt><dd className={value !== undefined && value < 0 ? 'allocation-negative' : undefined}>{value === undefined ? '—' : money(value)}</dd>
  </div>;
  return <aside id="planning-live-summary" tabIndex={-1} className="planning-card allocation-panel" data-expanded={expanded} aria-label={uiText("planning_live_summary.asignacion_del_mes_en_directo")}>
    <div className="allocation-heading"><h2>{uiText("planning_live_summary.asignacion_del_mes")}</h2><span>{uiText("planning_live_summary.en_directo")}</span></div>
    <p role="status">{dirty ? uiText("planning_live_summary.vista_previa_local_sin_guardar") : uiText("planning_live_summary.vista_local_datos_guardados")}</p>
    {!totals && <p role="alert">{uiText("planning_live_summary.calculo_no_disponible_corrige_los_importes_indicados_no_se")}</p>}
    <div className="planning-totals allocation-totals" aria-live="polite" aria-atomic="true">
      <dl className="allocation-primary">
        {metric(uiText("planning.metric.unassigned"), baseTotals?.margin, true)}
        {metric(uiText("planning.metric.effectiveMargin"), totals?.margin, true)}
      </dl>
      <button type="button" className="allocation-toggle" aria-expanded={expanded} aria-controls="allocation-detail" onClick={() => setExpanded(!expanded)}>{expanded ? uiText("planning_live_summary.resumir_asignacion") : uiText("planning_live_summary.ver_desglose_de_asignacion")}</button>
      <div id="allocation-detail" className="allocation-detail" data-expanded={expanded}>
        <dl>
          {metric(uiText("planning.metric.income"), baseTotals?.income)}
          {metric(uiText("planning.metric.savings"), baseTotals?.savings)}
          {metric(uiText("planning.metric.baseExpenses"), baseTotals?.expenses)}
          {metric(uiText("planning.metric.carry"), carryCents)}
          {metric(uiText("planning.metric.effectiveExpenses"), totals?.expenses)}
        </dl>
        <p>{uiText("planning_live_summary.el_pendiente_usa_solo_ingresos_del_mes_objetivo_y")}</p>
      </div>
    </div>
  </aside>;
}

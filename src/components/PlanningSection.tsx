import { useI18n, I18nText } from "../i18n";
import React, { useId } from 'react';


/** A disclosure hides DOM only; its summaries and controlled inputs remain mounted. */
export function PlanningSection({ title, family = false, open, onToggle, onAll, planned, executed, count, invalidCount, warning, carried = 0, children }: {
  title: string;
  family?: boolean;
  open: boolean;
  onToggle: () => void;
  onAll?: (expanded: boolean) => void;
  planned: number | null;
  executed: number;
  count: number;
  invalidCount: number;
  warning?: string;
  carried?: number;
  children: React.ReactNode;
}) {
  const { t: uiText, tn: uiCount , formatCents: formatPlanningCents } = useI18n();
  const id = useId();
  const Heading = family ? 'h3' : 'h2';
  return <section className={family ? 'planning-family space-y-3' : 'planning-card space-y-3'} aria-labelledby={`${id}-title`}>
    <Heading id={`${id}-title`} className="text-lg font-bold">
      <button className="planning-disclosure" type="button" aria-expanded={open} aria-controls={`${id}-content`} onClick={onToggle}>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span> {title}
      </button>
    </Heading>
    <div className="planning-section-totals">
      <p><I18nText id="planning_section.previsto" values={{ items: uiCount("budgetItems",count), planned: (<strong>{planned === null ? uiText("planning_section.pendiente_de_corregir") : formatPlanningCents(planned)}</strong>) }} /></p>
      <p><I18nText id="planning_section.ejecutado_diferencia" values={{ executed: (<strong>{formatPlanningCents(executed)}</strong>), content: (<strong>{planned === null ? '—' : formatPlanningCents(planned - executed)}</strong>) }} /></p>
      {invalidCount > 0 && <p role="alert">{uiCount(open ? "invalidAmountsVisible" : "invalidAmountsHidden",invalidCount)}</p>}
      {planned === null && invalidCount === 0 && <p role="alert">{uiText("planning_section.total_fuera_del_rango_seguro_revisa_los_importes_antes")}</p>}
      {carried>0&&<p><I18nText id="planning_section.incluye_de_arrastres_presupuestarios" values={{ carried: (formatPlanningCents(carried)) }} /></p>}
      {warning && <p className="planning-warning">{warning}</p>}
    </div>
    {onAll && <div className="flex flex-wrap gap-2" role="group" aria-label={uiText("planning_section.plegado_de", { title: title })}>
      <button type="button" onClick={() => onAll(true)}>{uiText("planning_section.expandir_todo")}</button>
      <button type="button" onClick={() => onAll(false)}>{uiText("planning_section.contraer_todo")}</button>
    </div>}
    <div id={`${id}-content`} hidden={!open} className={family?'planning-family-content':'planning-block-content'}>{children}</div>
  </section>;
}

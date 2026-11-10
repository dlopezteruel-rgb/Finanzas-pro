import React, { useId } from 'react';
import { formatPlanningCents } from '../utils/planning';

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
  const id = useId();
  const Heading = family ? 'h3' : 'h2';
  return <section className={family ? 'planning-family space-y-3' : 'planning-card space-y-3'} aria-labelledby={`${id}-title`}>
    <Heading id={`${id}-title`} className="text-lg font-bold">
      <button className="planning-disclosure" type="button" aria-expanded={open} aria-controls={`${id}-content`} onClick={onToggle}>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span> {title}
      </button>
    </Heading>
    <div className="planning-section-totals">
      <p>{count} {count === 1 ? 'partida' : 'partidas'} · Previsto: <strong>{planned === null ? 'Pendiente de corregir' : formatPlanningCents(planned)}</strong></p>
      <p>Ejecutado: <strong>{formatPlanningCents(executed)}</strong> · Diferencia: <strong>{planned === null ? '—' : formatPlanningCents(planned - executed)}</strong></p>
      {invalidCount > 0 && <p role="alert">{invalidCount} {invalidCount === 1 ? `importe inválido${!open ? ' oculto' : ''}` : `importes inválidos${!open ? ' ocultos' : ''}`}. Revisa las partidas antes de guardar.</p>}
      {planned === null && invalidCount === 0 && <p role="alert">Total fuera del rango seguro. Revisa los importes antes de guardar.</p>}
      {carried>0&&<p>Incluye {formatPlanningCents(carried)} de arrastres presupuestarios.</p>}
      {warning && <p className="planning-warning">{warning}</p>}
    </div>
    {onAll && <div className="flex flex-wrap gap-2" role="group" aria-label={`Plegado de ${title}`}>
      <button type="button" onClick={() => onAll(true)}>Expandir todo</button>
      <button type="button" onClick={() => onAll(false)}>Contraer todo</button>
    </div>}
    <div id={`${id}-content`} hidden={!open} className={family?'planning-family-content':'planning-block-content'}>{children}</div>
  </section>;
}

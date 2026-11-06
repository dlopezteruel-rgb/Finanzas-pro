import React, { useLayoutEffect, useRef, useState } from 'react';
import { SafeDialog } from './SafeDialog';
import type { DeletionReport } from '../utils/deletion';
import type { SaveResult } from '../utils/saveResult';
import { useAsyncForm } from '../utils/useAsyncForm';

/** Presentation-only confirmation, reusable for future catalog operations. */
export function ConfirmDeleteDialog({ report, onConfirm, onCancel, confirmLabel = 'Confirmar eliminación', requiredText }: {
  report: DeletionReport; onConfirm: () => Promise<SaveResult>; onCancel: () => void; confirmLabel?: string; requiredText?: string;
}) {
  const submission = useAsyncForm(), [confirmation, setConfirmation] = useState('');
  const cancelButton = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { if (submission.saving) cancelButton.current?.closest<HTMLElement>('[role=dialog]')?.focus({ preventScroll: true }); }, [submission.saving]);
  const close = () => submission.close(onCancel);
  const blocked = !report.exists || report.blockers.length > 0;
  return <SafeDialog title={report.title} onCancel={close}>
    <p className="text-sm">Se eliminará: <strong>{report.name}</strong>.</p>
    <div className="space-y-2 text-xs" aria-label="Relaciones y alcance de la eliminación">
      {report.relations.length ? <><p>Algunas categorías se solapan; sus cantidades no se suman entre sí.</p><ul className="space-y-2">{report.relations.map(r => <li key={r.label}>
        <strong>{r.label}: {r.count}</strong>{r.examples.length > 0 && <p className="break-words text-slate-400">{r.examples.join(' · ')}{r.count > r.examples.length ? ` · y ${r.count - r.examples.length} más` : ''}</p>}
      </li>)}</ul></> : <p>No hay referencias vinculadas que impidan la eliminación.</p>}
      {report.notices.map(n => <p key={n}>{n}</p>)}
    </div>
    {(submission.error || blocked) && <div role="alert" className="text-amber-300 text-sm">{submission.error || <><p>No se puede eliminar este elemento.</p>{report.blockers.map(b => <p key={b}>{b}</p>)}</>}</div>}
    <p className="text-xs text-slate-400">No se borrarán automáticamente otros elementos vinculados. Cancelar conserva los datos.</p>
    {requiredText && <label className="block text-sm">Escribe {requiredText} para confirmar<input aria-label={`Escribe ${requiredText} para confirmar`} value={confirmation} disabled={submission.saving} onChange={e => setConfirmation(e.target.value)} className="block w-full rounded-xl bg-[#0c0f17] border border-white/10 p-2 mt-1" /></label>}
    {submission.saving && <p role="status">Guardando…</p>}
    <div className="flex justify-end gap-2" aria-busy={submission.saving}>
      <button ref={cancelButton} data-autofocus disabled={submission.saving} onClick={close} className="rounded-xl bg-white/10 p-3">Cancelar</button>
      <button disabled={submission.saving || blocked || (!!requiredText && confirmation !== requiredText)} className="rounded-xl bg-rose-500/20 text-rose-300 p-3 disabled:opacity-40" onClick={() => { if (!blocked && (!requiredText || confirmation === requiredText)) void submission.submit(onConfirm, onCancel); }}>{confirmLabel}</button>
    </div>
  </SafeDialog>;
}

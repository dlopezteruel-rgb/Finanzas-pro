import {storageOwnedText,deletionReportForDisplay,type DeletionSource} from '../i18n/storageMessages';
import { useI18n, I18nText } from "../i18n";
import React, { useLayoutEffect, useRef, useState } from 'react';
import { SafeDialog } from './SafeDialog';
import type { DeletionReport } from '../utils/deletion';
import type { SaveResult } from '../utils/saveResult';
import { useAsyncForm } from '../utils/useAsyncForm';

/** Presentation-only confirmation, reusable for future catalog operations. */
export function ConfirmDeleteDialog({ report, source, onConfirm, onCancel, confirmLabel, requiredText }: {
  report: DeletionReport; source?:DeletionSource; onConfirm: () => Promise<SaveResult>; onCancel: () => void; confirmLabel?: string; requiredText?: string;
}) {
  const formatting = useI18n();
  const { t: uiText, tn: uiCount,language } = formatting;
  const shown=deletionReportForDisplay(report,source,language,uiText,formatting);
  const { t } = useI18n();
  const submission = useAsyncForm(), [confirmation, setConfirmation] = useState('');
  const cancelButton = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { if (submission.saving) cancelButton.current?.closest<HTMLElement>('[role=dialog]')?.focus({ preventScroll: true }); }, [submission.saving]);
  const close = () => submission.close(onCancel);
  const blocked = !report.exists || report.blockers.length > 0;
  return <SafeDialog title={shown.title} onCancel={close}>
    <p className="text-sm"><I18nText id="confirm_delete_dialog.se_eliminara" values={{ name: (<strong>{shown.name}</strong>) }} /></p>
    <div className="space-y-2 text-xs" role="group" aria-label={uiText("confirm_delete_dialog.relaciones_y_alcance_de_la_eliminacion")}>
      {shown.relations.length ? <><p>{uiText("confirm_delete_dialog.algunas_categorias_se_solapan_sus_cantidades_no_se_suman")}</p><ul className="space-y-2">{shown.relations.map(r => <li key={r.label}>
        <strong>{r.label}: {formatting.formatNumber(r.count)}</strong>{r.examples.length > 0 && <p className="break-words text-slate-400">{r.examples.join(' · ')}{r.count > r.examples.length ? uiCount("more", r.count - r.examples.length) : ''}</p>}
      </li>)}</ul></> : <p>{uiText("confirm_delete_dialog.no_hay_referencias_vinculadas_que_impidan_la_eliminacion")}</p>}
      {shown.notices.map(n => <p key={n}>{n}</p>)}
    </div>
    {(submission.error || blocked) && <div role="alert" className="text-amber-300 text-sm">{submission.error ? storageOwnedText(submission.error,uiText) : <><p>{uiText("confirm_delete_dialog.no_se_puede_eliminar_este_elemento")}</p>{shown.blockers.map(b => <p key={b}>{b}</p>)}</>}</div>}
    <p className="text-xs text-slate-400">{uiText("confirm_delete_dialog.no_se_borraran_automaticamente_otros_elementos_vinculados_cancelar_conserva")}</p>
    {requiredText && <label className="block text-sm">{uiText("confirm_delete_dialog.escribe_para_confirmar", { requiredText })}<input aria-label={uiText("confirm_delete_dialog.escribe_para_confirmar", { requiredText: requiredText })} value={confirmation} disabled={submission.saving} onChange={e => setConfirmation(e.target.value)} className="block w-full rounded-xl bg-[#0c0f17] border border-white/10 p-2 mt-1" /></label>}
    {submission.saving && <p role="status">{t('common.saving')}</p>}
    <div className="flex justify-end gap-2" aria-busy={submission.saving}>
      <button ref={cancelButton} data-autofocus disabled={submission.saving} onClick={close} className="rounded-xl bg-white/10 p-3">{t('common.cancel')}</button>
      <button disabled={submission.saving || blocked || (!!requiredText && confirmation !== requiredText)} className="rounded-xl bg-rose-500/20 text-rose-300 p-3 disabled:opacity-40" onClick={() => { if (!blocked && (!requiredText || confirmation === requiredText)) void submission.submit(onConfirm, onCancel); }}>{confirmLabel ?? t('common.confirmDelete')}</button>
    </div>
  </SafeDialog>;
}

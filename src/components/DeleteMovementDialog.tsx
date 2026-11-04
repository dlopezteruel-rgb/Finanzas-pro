import React from 'react';
import { SafeDialog } from './SafeDialog';
import type { SaveResult } from '../utils/saveResult';
import { useAsyncForm } from '../utils/useAsyncForm';

export function DeleteMovementDialog({ description, onDelete, onClose }: { description: string; onDelete: () => Promise<SaveResult>; onClose: () => void }) {
  const submission = useAsyncForm(), close = () => submission.close(onClose);
  return <SafeDialog title="Eliminar movimiento" onCancel={close}>
    <p className="text-sm">¿Eliminar «{description}»? Si hay cobros o relaciones que lo impidan, la operación se rechazará íntegramente.</p>
    {submission.error && <p role="alert" className="text-amber-300">{submission.error}</p>}
    <div className="flex justify-end gap-2"><button disabled={submission.saving} onClick={close}>Cancelar</button>
      <button disabled={submission.saving} className="rounded-xl bg-rose-500/20 text-rose-300 p-3" onClick={() => void submission.submit(onDelete, onClose)}>{submission.saving ? 'Guardando…' : 'Confirmar eliminación del movimiento'}</button></div>
  </SafeDialog>;
}

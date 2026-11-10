import React from "react";
import { SafeDialog } from "./SafeDialog";
import { useAsyncForm } from "../utils/useAsyncForm";
import type { SaveResult } from "../utils/saveResult";

/** Preview remains mounted on quota, lock or revision failure; repeat clicks share one submission. */
export function FinanceReview({
  title,
  children,
  onCancel,
  onConfirm,
  onSuccess,
  disabled = false,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => Promise<SaveResult>;
  onSuccess: () => void;
  disabled?: boolean;
}) {
  const form = useAsyncForm();
  return (
    <SafeDialog title={title} onCancel={() => form.close(onCancel)}>
      {children}
      <p>
        Solo se guardará al confirmar. Si cambia el formato se conservará una
        copia recuperable verificada.
      </p>
      {form.error && <p role="alert">{form.error}</p>}
      <div className="finance-actions">
        <button disabled={form.saving} onClick={onCancel}>
          Cancelar
        </button>
        <button
          disabled={form.saving || disabled}
          onClick={() => void form.submit(onConfirm, onSuccess)}
        >
          {form.saving ? "Guardando…" : "Confirmar operación"}
        </button>
      </div>
    </SafeDialog>
  );
}

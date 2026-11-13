import {bankingOwnedText} from '../i18n/bankingMessages';
import { useI18n } from "../i18n";
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
  const { t: uiText } = useI18n();
  const form = useAsyncForm();
  return (
    <SafeDialog title={title} onCancel={() => form.close(onCancel)}>
      {children}
      <p>{uiText("finance_review.solo_se_guardara_al_confirmar_si_cambia_el_formato")}</p>
      {form.error && <p role="alert">{bankingOwnedText(form.error,uiText)}</p>}
      <div className="finance-actions">
        <button disabled={form.saving} onClick={onCancel}>{uiText("transfer.cancelar")}</button>
        <button
          disabled={form.saving || disabled}
          onClick={() => void form.submit(onConfirm, onSuccess)}
        >
          {form.saving ? uiText("transfer.guardando") : uiText("finance_review.confirmar_operacion")}
        </button>
      </div>
    </SafeDialog>
  );
}

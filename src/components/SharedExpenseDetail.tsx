import {useI18n, I18nText } from "../i18n";
import React from 'react';
import type { FinanceData } from '../utils/backup';
import { cents, isStructuredShared, remainingDebt, sharedWalletName } from '../utils/sharedExpenses';

import { SafeDialog } from './SafeDialog';

export function SharedExpenseDetail({ data, id, onClose }: { data: FinanceData; id: string; onClose: () => void }) {
  const { t: uiText } = useI18n();
  const { formatMoney: formatCurrency , formatDate } = useI18n();
  const tx = data.transactions.find(t => t.id === id), split = tx?.splitInfo;
  if (!tx || !split) return <SafeDialog title={uiText("shared_expense_detail.reparto_del_gasto")} onCancel={onClose}><p>{uiText("shared_expense_detail.el_gasto_ya_no_esta_disponible")}</p><button onClick={onClose}>{uiText("shared_expense_detail.cerrar_reparto")}</button></SafeDialog>;
  const structured = isStructuredShared(tx), settlements = structured ? split.settlements! : [];
  const pending = structured ? split.participants.reduce((n, p) => n + cents(remainingDebt(tx, p.contactId)), 0) / 100 : undefined;
  return <SafeDialog title={uiText("shared_expense_detail.reparto_del_gasto")} onCancel={onClose}>
    <p className="font-bold">{tx.description} · {formatDate(tx.date, {day:'2-digit',month:'2-digit',year:'numeric'})}</p>
    <p className="text-xs text-slate-300"><I18nText id="shared_expense_detail.cartera_de_origen" values={{ subcategoryName: (tx.subcategoryName), wallet: (sharedWalletName(tx, data)) }} /></p>
    {!structured && <p role="status" className="text-amber-300 text-sm">{uiText("shared_expense_detail.compartido_historico_pendiente_de_revision_se_muestran_los_valores")}</p>}
    {!tx.processed && <p className="text-amber-300 text-sm">{uiText("shared_expense_detail.gasto_no_tramitado_no_afecta_al_saldo_real_ni")}</p>}
    <dl className="grid grid-cols-2 gap-2 text-sm">
      <div><dt>{uiText(tx.processed?"shared_expense_detail.totalPaid":"shared_expense_detail.totalUnprocessed")}</dt><dd className="font-bold">{formatCurrency(tx.amount)}</dd></div>
      <div><dt>{structured ? uiText("shared_expense_detail.tu_parte_economica") : uiText("shared_expense_detail.parte_propia_declarada")}</dt><dd className="font-bold">{formatCurrency(split.myShare)}</dd></div>
      <div><dt>{uiText("shared_expense_detail.imputado_al_presupuesto")}</dt><dd>{formatCurrency(tx.processed ? structured ? split.myShare : tx.amount : 0)}</dd></div>
      <div><dt>{structured ? uiText("shared_expense_detail.deuda_pendiente_total") : uiText("shared_expense_detail.deuda_declarada_sin_verificar")}</dt><dd>{structured ? formatCurrency(pending) : formatCurrency(split.totalOwedToMe)}</dd></div>
    </dl>
    <div className="space-y-3">{split.participants.map(p => {
      const contact = data.contacts.find(c => c.id === p.contactId);
      const payments = settlements.filter(s => s.contactId === p.contactId);
      const received = payments.filter(s => s.processed && s.kind === 'cash').reduce((n, s) => n + cents(s.amount), 0) / 100;
      const offset = payments.filter(s => s.processed && s.kind === 'offset').reduce((n, s) => n + cents(s.amount), 0) / 100;
      const oldReceipt = !structured && p.reimbursementTxId ? data.transactions.find(t => t.id === p.reimbursementTxId) : undefined;
      return <section key={p.contactId} aria-label={uiText("shared_expense_detail.participante", { name: contact?.name ?? p.contactName })} className="rounded-xl border border-white/10 p-3 text-xs space-y-1">
        <h3 className="font-bold">{contact?.name ?? p.contactName} {!contact && uiText("shared_expense_detail.contacto_no_disponible")}</h3><p className="text-slate-400"><I18nText id="shared_expense_detail.id" values={{ contactId: (p.contactId) }} /></p>
        <p><I18nText id="shared_expense_detail.importe_asignado" values={{ amount: (formatCurrency(p.amount)) }} /></p>
        {structured ? <><p><I18nText id="shared_expense_detail.reintegrado" values={{ received: (formatCurrency(received)) }} /></p><p><I18nText id="shared_expense_detail.compensado" values={{ offset: (formatCurrency(offset)) }} /></p><p><I18nText id="shared_expense_detail.pendiente_de_cobro" values={{ formatCurrency: (<strong>{formatCurrency(remainingDebt(tx, p.contactId))}</strong>) }} /></p></>
          : <><p>{p.paidDate ? uiText(p.isPaid?"shared_expense_detail.legacyPaidAt":"shared_expense_detail.legacyPendingAt",{date:formatDate(p.paidDate,{day:"2-digit",month:"2-digit",year:"numeric"})}) : uiText(p.isPaid?"shared_expense_detail.legacyPaid":"shared_expense_detail.legacyPending")}</p>
            {p.reimbursementTxId && <p>{oldReceipt ? uiText("shared_expense_detail.receiptAvailable",{id:p.reimbursementTxId,amount:formatCurrency(oldReceipt.amount),date:formatDate(oldReceipt.date,{day:"2-digit",month:"2-digit",year:"numeric"}),wallet:oldReceipt.wallet}) : uiText("shared_expense_detail.receiptMissing",{id:p.reimbursementTxId})}</p>}</>}
        {payments.map(s => <div key={s.id} className="border-t border-white/10 pt-2 mt-2" role="group" aria-label={uiText("shared_expense_detail.registro_de_liquidacion")}>
          <p>{uiText(s.kind==='cash'?"shared_expense_detail.cashRow":"shared_expense_detail.offsetRow",{amount:formatCurrency(s.amount),date:formatDate(s.date,{day:"2-digit",month:"2-digit",year:"numeric"})})}</p>
          {s.kind === 'cash' && <p><I18nText id="shared_expense_detail.cartera_receptora" values={{ content: (data.wallets.find(w => w.id === s.walletId)?.name ?? uiText("shared_expense_detail.no_disponible")) }} /></p>}
          <p><I18nText id="shared_expense_detail.estado" values={{ content: (s.processed ? uiText("shared_expense_detail.tramitada") : uiText("shared_expense_detail.pendiente_de_tramitacion")) }} /></p>
        </div>)}
      </section>;
    })}</div>
    <button onClick={onClose} className="rounded-xl bg-white/10 px-4 py-2">{uiText("shared_expense_detail.cerrar_reparto")}</button>
  </SafeDialog>;
}

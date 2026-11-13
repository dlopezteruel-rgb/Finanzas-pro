import { useI18n, I18nText } from "../i18n";
import { Overlay } from './Overlay';
import { SaveResult } from '../utils/saveResult';
import { useAsyncForm } from '../utils/useAsyncForm';
import React, { useState, useLayoutEffect } from 'react';
import { Wallet, SplitParticipant, Contact, SettlementInput, DebtSettlement } from '../types/finance';

import { parseTransferAmount } from '../utils/transfers';
import { initialWalletId } from '../utils/defaultWallet';
import { CheckCircle2, X } from 'lucide-react';

export interface DebtItemToSettle {
  transactionId: string;
  transactionDescription: string;
  transactionCode: string;
  transactionCategory: string;
  transactionSubcategory: string;
  participant: SplitParticipant;
  contact: Contact;
}
interface Props {
  isOpen: boolean;
  onClose: () => void;
  debtItem: DebtItemToSettle | null;
  wallets: Wallet[];
  defaultWalletId?: string | null;
  settlementToEdit?: DebtSettlement;
  initiallyDelete?: boolean;
  onConfirmSettle: (input: SettlementInput, id?: string) => Promise<SaveResult>;
  onDeleteSettlement: (expenseId: string, id: string) => Promise<SaveResult>;
}
export const SettleDebtModal: React.FC<Props> = ({ isOpen, onClose, debtItem, wallets, defaultWalletId, settlementToEdit, initiallyDelete = false, onConfirmSettle, onDeleteSettlement }) => {
  const { t: uiText , formatMoney: formatCurrency , formatDate } = useI18n();
  const submission = useAsyncForm();
  const [operationId, setOperationId] = useState('');
  const [walletId, setWallet] = useState(''), [date, setDate] = useState(''), [amount, setAmount] = useState('');
  const [cash, setCash] = useState(true), [processed, setProcessed] = useState(true), [deleting, setDeleting] = useState(false);
  useLayoutEffect(() => {
    if (!isOpen || !debtItem) return;
    submission.clearError(); setOperationId(crypto.randomUUID());
    setWallet(initialWalletId(wallets, defaultWalletId, settlementToEdit?.walletId));
    setDate(settlementToEdit?.date || new Date().toISOString().slice(0, 10));
    setAmount(String(settlementToEdit?.amount ?? debtItem.participant.remainingAmount ?? debtItem.participant.amount));
    setCash(settlementToEdit?.kind !== 'offset'); setProcessed(settlementToEdit?.processed ?? true); setDeleting(initiallyDelete);
  }, [isOpen, debtItem?.transactionId, debtItem?.participant.contactId, settlementToEdit?.id, initiallyDelete]);
  if (!isOpen || !debtItem) return null;
  const close = () => submission.close(onClose);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void submission.submit(() => onConfirmSettle({ operationId, expenseId: debtItem.transactionId, contactId: debtItem.participant.contactId,
      amount: parseTransferAmount(amount), date, kind: cash ? 'cash' : 'offset', processed,
      ...(cash ? { walletId } : {}) }, settlementToEdit?.id), onClose);
  };
  return <Overlay title={uiText("settle_debt.liquidacion")} onClose={close}>
    <section role="dialog" aria-modal="true" aria-label={uiText("settle_debt.liquidacion")} className="bg-[#141926] border border-white/10 rounded-2xl max-w-md w-full p-5 text-xs space-y-4 max-h-[92vh] overflow-y-auto">
      <div className="flex justify-between items-center"><h3 className="text-sm font-bold text-white">{settlementToEdit ? uiText("settle_debt.editar_liquidacion") : uiText("settle_debt.saldar_deuda_compartida")}</h3><button aria-label={uiText("create_contact.cerrar_modal")} onClick={close} disabled={submission.saving}><X className="w-4 h-4" /></button></div>
      <p>{debtItem.contact.name} · {debtItem.transactionDescription}</p>
      <p><I18nText id="settle_debt.pendiente" values={{ formatCurrency: (<strong>{formatCurrency(debtItem.participant.remainingAmount ?? (debtItem.participant.isPaid ? 0 : debtItem.participant.amount))}</strong>) }} /></p>
      <form onSubmit={submit} aria-busy={submission.saving}>
        <fieldset disabled={submission.saving} className="space-y-3.5">
          {submission.error && <p role="alert" className="text-amber-300">{submission.error}</p>}
          {submission.saving && <p role="status">{uiText("transfer.guardando")}</p>}
          <label className="block">{uiText("settle_debt.importe_a_saldar")}<input aria-label={uiText("settle_debt.importe_a_saldar")} className="block w-full bg-[#0c0f17] rounded-xl p-3" type="number" step="0.01" min="0.01" required value={amount} onChange={e => setAmount(e.target.value)} /></label>
          <label className="flex gap-2"><input aria-label={uiText("settle_debt.registrar_entrada_bancaria")} type="checkbox" checked={cash} onChange={e => setCash(e.target.checked)} />{uiText("settle_debt.registrar_entrada_bancaria_reintegro_no_ingreso_economico")}</label>
          {!cash && <p className="text-amber-300">{uiText("settle_debt.compensacion_sin_entrada_de_dinero_reduce_la_deuda_sin")}</p>}
          {cash && <label className="block">{uiText("settle_debt.cartera_receptora")}<select aria-label={uiText("settle_debt.cartera_receptora")} required className="block w-full bg-[#0c0f17] rounded-xl p-3" value={walletId} onChange={e => setWallet(e.target.value)}><option value="" disabled>{uiText("transfer.selecciona_una_cartera")}</option>{wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
          <label className="block">{uiText("settle_debt.fecha_del_cobro_o_compensacion")}<input aria-label={uiText("settle_debt.fecha_del_cobro_o_compensacion")} className="block w-full bg-[#0c0f17] rounded-xl p-3" required type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          <label className="flex gap-2"><input aria-label={uiText("settle_debt.liquidacion_tramitada")} type="checkbox" checked={processed} onChange={e => setProcessed(e.target.checked)} />{uiText("settle_debt.liquidacion_tramitada")}</label>
          <div className="grid grid-cols-2 gap-2"><button type="button" onClick={close} className="rounded-xl bg-white/10 p-3">{uiText("transfer.cancelar")}</button><button type="submit" className="rounded-xl bg-emerald-500 text-slate-950 p-3 font-bold"><CheckCircle2 className="w-3 h-3 inline" /> {settlementToEdit ? uiText("settle_debt.guardar_liquidacion") : uiText("settle_debt.confirmar_cobro")}</button></div>
          {settlementToEdit && (!deleting ? <button type="button" className="text-rose-300" onClick={() => setDeleting(true)}>{uiText("settle_debt.eliminar_liquidacion")}</button> : <div className="space-y-2 text-rose-300"><p><I18nText id="settle_debt.se_eliminara_la_liquidacion_de_para_se_retirara_el" values={{ id: (settlementToEdit.id), amount: (formatCurrency(settlementToEdit.amount)), date: (formatDate(settlementToEdit.date, {day:'2-digit',month:'2-digit',year:'numeric'})), name: (debtItem.contact.name), transactionDescription: (debtItem.transactionDescription), content: (settlementToEdit.kind === 'cash' ? uiText("settle_debt.1_movimiento_bancario_vinculado") : uiText("settle_debt.0_movimientos_bancarios_compensacion")), content_cf560: (settlementToEdit.walletId && uiText("settle_debt.cartera", { content: String(wallets.find(w => w.id === settlementToEdit.walletId)?.name) })) }} /></p><button type="button" onClick={() => void submission.submit(() => onDeleteSettlement(debtItem.transactionId, settlementToEdit.id), onClose)}>{uiText("settle_debt.confirmar_eliminacion_de_liquidacion")}</button></div>)}
        </fieldset>
      </form>
    </section>
  </Overlay>;
};

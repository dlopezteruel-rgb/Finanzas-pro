import { Overlay } from './Overlay';
import { SaveResult } from '../utils/saveResult';
import { useAsyncForm } from '../utils/useAsyncForm';
import React, { useState, useEffect } from 'react';
import { Wallet, SplitParticipant, Contact, SettlementInput, DebtSettlement } from '../types/finance';
import { formatCurrency } from '../utils/finance';
import { parseTransferAmount } from '../utils/transfers';
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
  settlementToEdit?: DebtSettlement;
  initiallyDelete?: boolean;
  onConfirmSettle: (input: SettlementInput, id?: string) => Promise<SaveResult>;
  onDeleteSettlement: (expenseId: string, id: string) => Promise<SaveResult>;
}
export const SettleDebtModal: React.FC<Props> = ({ isOpen, onClose, debtItem, wallets, settlementToEdit, initiallyDelete = false, onConfirmSettle, onDeleteSettlement }) => {
  const submission = useAsyncForm();
  const [operationId, setOperationId] = useState('');
  const [walletId, setWallet] = useState(''), [date, setDate] = useState(''), [amount, setAmount] = useState('');
  const [cash, setCash] = useState(true), [processed, setProcessed] = useState(true), [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (!isOpen || !debtItem) return;
    submission.clearError(); setOperationId(crypto.randomUUID());
    setWallet(settlementToEdit?.walletId || wallets[0]?.id || '');
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
  return <Overlay title="Liquidación" onClose={close}>
    <section role="dialog" aria-modal="true" aria-label="Liquidación" className="bg-[#141926] border border-white/10 rounded-2xl max-w-md w-full p-5 text-xs space-y-4 max-h-[92vh] overflow-y-auto">
      <div className="flex justify-between items-center"><h3 className="text-sm font-bold text-white">{settlementToEdit ? 'Editar liquidación' : 'Saldar Deuda Compartida'}</h3><button aria-label="Cerrar modal" onClick={close} disabled={submission.saving}><X className="w-4 h-4" /></button></div>
      <p>{debtItem.contact.name} · {debtItem.transactionDescription}</p>
      <p>Pendiente: <strong>{formatCurrency(debtItem.participant.remainingAmount ?? (debtItem.participant.isPaid ? 0 : debtItem.participant.amount))}</strong></p>
      <form onSubmit={submit} aria-busy={submission.saving}>
        <fieldset disabled={submission.saving} className="space-y-3.5">
          {submission.error && <p role="alert" className="text-amber-300">{submission.error}</p>}
          {submission.saving && <p role="status">Guardando…</p>}
          <label className="block">Importe a saldar (€)<input aria-label="Importe a saldar (€)" className="block w-full bg-[#0c0f17] rounded-xl p-3" type="number" step="0.01" min="0.01" required value={amount} onChange={e => setAmount(e.target.value)} /></label>
          <label className="flex gap-2"><input aria-label="Registrar entrada bancaria" type="checkbox" checked={cash} onChange={e => setCash(e.target.checked)} />Registrar entrada bancaria (reintegro, no ingreso económico)</label>
          {!cash && <p className="text-amber-300">Compensación sin entrada de dinero. Reduce la deuda sin modificar ninguna cartera.</p>}
          {cash && <label className="block">Cartera receptora<select aria-label="Cartera receptora" className="block w-full bg-[#0c0f17] rounded-xl p-3" value={walletId} onChange={e => setWallet(e.target.value)}>{wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
          <label className="block">Fecha del cobro o compensación<input aria-label="Fecha del cobro o compensación" className="block w-full bg-[#0c0f17] rounded-xl p-3" required type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          <label className="flex gap-2"><input aria-label="Liquidación tramitada" type="checkbox" checked={processed} onChange={e => setProcessed(e.target.checked)} />Liquidación tramitada</label>
          <div className="grid grid-cols-2 gap-2"><button type="button" onClick={close} className="rounded-xl bg-white/10 p-3">Cancelar</button><button type="submit" className="rounded-xl bg-emerald-500 text-slate-950 p-3 font-bold"><CheckCircle2 className="w-3 h-3 inline" /> {settlementToEdit ? 'Guardar liquidación' : 'Confirmar cobro'}</button></div>
          {settlementToEdit && (!deleting ? <button type="button" className="text-rose-300" onClick={() => setDeleting(true)}>Eliminar liquidación</button> : <div className="space-y-2 text-rose-300"><p>Se eliminará la liquidación {settlementToEdit.id}: {formatCurrency(settlementToEdit.amount)} · {settlementToEdit.date}, de {debtItem.contact.name} para «{debtItem.transactionDescription}». Se retirará {settlementToEdit.kind === 'cash' ? '1 movimiento bancario vinculado' : '0 movimientos bancarios (compensación)'}; el gasto original se conserva y la deuda se recalcula. {settlementToEdit.walletId && `Cartera: ${wallets.find(w => w.id === settlementToEdit.walletId)?.name}.`}</p><button type="button" onClick={() => void submission.submit(() => onDeleteSettlement(debtItem.transactionId, settlementToEdit.id), onClose)}>Confirmar eliminación de liquidación</button></div>)}
        </fieldset>
      </form>
    </section>
  </Overlay>;
};

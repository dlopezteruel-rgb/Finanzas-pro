import {useI18n} from "../i18n";
import React from 'react';
import type { FinanceData } from '../utils/backup';
import { cents, isStructuredShared, remainingDebt, sharedWalletName } from '../utils/sharedExpenses';

import { SafeDialog } from './SafeDialog';

export function SharedExpenseDetail({ data, id, onClose }: { data: FinanceData; id: string; onClose: () => void }) {
  const { formatMoney: formatCurrency , formatDate } = useI18n();
  const tx = data.transactions.find(t => t.id === id), split = tx?.splitInfo;
  if (!tx || !split) return <SafeDialog title="Reparto del gasto" onCancel={onClose}><p>El gasto ya no está disponible.</p><button onClick={onClose}>Cerrar reparto</button></SafeDialog>;
  const structured = isStructuredShared(tx), settlements = structured ? split.settlements! : [];
  const pending = structured ? split.participants.reduce((n, p) => n + cents(remainingDebt(tx, p.contactId)), 0) / 100 : undefined;
  return <SafeDialog title="Reparto del gasto" onCancel={onClose}>
    <p className="font-bold">{tx.description} · {formatDate(tx.date, {day:'2-digit',month:'2-digit',year:'numeric'})}</p>
    <p className="text-xs text-slate-300">{tx.subcategoryName} · Cartera de origen: {sharedWalletName(tx, data)}</p>
    {!structured && <p role="status" className="text-amber-300 text-sm">Compartido histórico · pendiente de revisión. Se muestran los valores guardados y referencias explícitas; no se verifican ni se deducen pagos o compensaciones. El presupuesto conserva el importe total hasta migrar.</p>}
    {!tx.processed && <p className="text-amber-300 text-sm">Gasto no tramitado: no afecta al saldo real ni al ejecutado presupuestario.</p>}
    <dl className="grid grid-cols-2 gap-2 text-sm">
      <div><dt>Total pagado{!tx.processed ? ' (sin tramitar)' : ''}</dt><dd className="font-bold">{formatCurrency(tx.amount)}</dd></div>
      <div><dt>{structured ? 'Tu parte económica' : 'Parte propia declarada'}</dt><dd className="font-bold">{formatCurrency(split.myShare)}</dd></div>
      <div><dt>Imputado al presupuesto</dt><dd>{formatCurrency(tx.processed ? structured ? split.myShare : tx.amount : 0)}</dd></div>
      <div><dt>{structured ? 'Deuda pendiente total' : 'Deuda declarada (sin verificar)'}</dt><dd>{structured ? formatCurrency(pending) : formatCurrency(split.totalOwedToMe)}</dd></div>
    </dl>
    <div className="space-y-3">{split.participants.map(p => {
      const contact = data.contacts.find(c => c.id === p.contactId);
      const payments = settlements.filter(s => s.contactId === p.contactId);
      const received = payments.filter(s => s.processed && s.kind === 'cash').reduce((n, s) => n + cents(s.amount), 0) / 100;
      const offset = payments.filter(s => s.processed && s.kind === 'offset').reduce((n, s) => n + cents(s.amount), 0) / 100;
      const oldReceipt = !structured && p.reimbursementTxId ? data.transactions.find(t => t.id === p.reimbursementTxId) : undefined;
      return <section key={p.contactId} aria-label={`Participante ${contact?.name ?? p.contactName}`} className="rounded-xl border border-white/10 p-3 text-xs space-y-1">
        <h3 className="font-bold">{contact?.name ?? p.contactName} {!contact && '(contacto no disponible)'}</h3><p className="text-slate-400">ID: {p.contactId}</p>
        <p>Importe asignado: {formatCurrency(p.amount)}</p>
        {structured ? <><p>Reintegrado: {formatCurrency(received)}</p><p>Compensado: {formatCurrency(offset)}</p><p>Pendiente de cobro: <strong>{formatCurrency(remainingDebt(tx, p.contactId))}</strong></p></>
          : <><p>Marca histórica: {p.isPaid ? 'pagado' : 'pendiente'}{p.paidDate ? ` · ${p.paidDate}` : ''}. Cobros y compensaciones pendientes de verificar.</p>
            {p.reimbursementTxId && <p>Referencia guardada: {p.reimbursementTxId}{oldReceipt ? ` · ${formatCurrency(oldReceipt.amount)} · ${oldReceipt.date} · ${oldReceipt.wallet}` : ' · movimiento no disponible'}</p>}</>}
        {payments.map(s => <div key={s.id} className="border-t border-white/10 pt-2 mt-2" aria-label="Registro de liquidación">
          <p>{s.kind === 'cash' ? 'Reintegro' : 'Compensación sin movimiento bancario'}: {formatCurrency(s.amount)} · {formatDate(s.date, {day:'2-digit',month:'2-digit',year:'numeric'})}</p>
          {s.kind === 'cash' && <p>Cartera receptora: {data.wallets.find(w => w.id === s.walletId)?.name ?? 'No disponible'}</p>}
          <p>Estado: {s.processed ? 'Tramitada' : 'Pendiente de tramitación'}</p>
        </div>)}
      </section>;
    })}</div>
    <button onClick={onClose} className="rounded-xl bg-white/10 px-4 py-2">Cerrar reparto</button>
  </SafeDialog>;
}

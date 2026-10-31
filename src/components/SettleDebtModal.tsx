import React, { useState, useEffect } from 'react';
import { Wallet, Transaction, SplitParticipant, Contact } from '../types/finance';
import { formatCurrency } from '../utils/finance';
import { CheckCircle2, X, ArrowDownLeft, ShieldCheck } from 'lucide-react';

export interface DebtItemToSettle {
  transactionId: string;
  transactionDescription: string;
  transactionCode: string;
  transactionCategory: string;
  transactionSubcategory: string;
  participant: SplitParticipant;
  contact: Contact;
}

interface SettleDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  debtItem: DebtItemToSettle | null;
  wallets: Wallet[];
  onConfirmSettle: (
    debtItem: DebtItemToSettle,
    walletName: string,
    settleDate: string,
    createIncomeTx: boolean
  ) => void;
}

export const SettleDebtModal: React.FC<SettleDebtModalProps> = ({
  isOpen,
  onClose,
  debtItem,
  wallets,
  onConfirmSettle,
}) => {
  const [selectedWallet, setSelectedWallet] = useState<string>(wallets[0]?.name || 'REVOLUT');
  const [settleDate, setSettleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [createIncomeTx, setCreateIncomeTx] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      if (wallets.length > 0 && !wallets.some(w => w.name === selectedWallet)) {
        setSelectedWallet(wallets[0]?.name || 'REVOLUT');
      }
      setSettleDate(new Date().toISOString().split('T')[0]);
      setCreateIncomeTx(true);
    }
  }, [isOpen, wallets]);

  if (!isOpen || !debtItem) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmSettle(debtItem, selectedWallet, settleDate, createIncomeTx);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-[#141926] border border-white/10 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 shadow-2xl text-xs space-y-4">
        {/* Mobile handle */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto sm:hidden -mt-1 mb-2" />

        <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Saldar Deuda Compartida</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Debt Summary Card */}
        <div className="bg-[#0c0f17] rounded-2xl p-4 border border-emerald-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs">Contacto deudor</span>
            <span className="font-bold text-white text-xs">{debtItem.contact.name}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs">Concepto original</span>
            <span className="font-medium text-slate-200 text-xs max-w-[200px] truncate text-right">
              {debtItem.transactionDescription}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs">Partida presupuestaria</span>
            <span className="text-[11px] font-mono text-sky-400">
              {debtItem.transactionCode} {debtItem.transactionSubcategory}
            </span>
          </div>

          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-slate-300 font-semibold">Importe a saldar</span>
            <span className="text-lg font-black text-emerald-400">
              {formatCurrency(debtItem.participant.amount)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Destination Wallet */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold block text-[11px]">
              ¿En qué cuenta o cartera has recibido el dinero?
            </label>
            <select
              value={selectedWallet}
              onChange={e => setSelectedWallet(e.target.value)}
              className="w-full bg-[#0c0f17] text-white rounded-xl px-3 py-2 border border-white/10 focus:outline-none focus:border-emerald-500 cursor-pointer text-xs"
            >
              {wallets.map(w => (
                <option key={w.id} value={w.name}>
                  {w.name} ({w.type})
                </option>
              ))}
            </select>
          </div>

          {/* Settle Date */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold block text-[11px]">
              Fecha del cobro / reintegro
            </label>
            <input
              type="date"
              value={settleDate}
              onChange={e => setSettleDate(e.target.value)}
              className="w-full bg-[#0c0f17] text-white rounded-xl px-3 py-2 border border-white/10 focus:outline-none focus:border-emerald-500 text-xs"
            />
          </div>

          {/* Automatic Income / Reimbursement Option */}
          <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] cursor-pointer hover:bg-white/[0.05] transition-colors">
            <input
              type="checkbox"
              checked={createIncomeTx}
              onChange={e => setCreateIncomeTx(e.target.checked)}
              className="mt-0.5 rounded text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
            />
            <div className="space-y-0.5">
              <span className="font-semibold text-white block text-xs flex items-center gap-1.5">
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                Registrar ingreso automático (Reintegro)
              </span>
              <p className="text-[11px] text-slate-400 leading-normal">
                Genera un ingreso de {formatCurrency(debtItem.participant.amount)} en{' '}
                <strong className="text-slate-300">{selectedWallet}</strong> imputado a{' '}
                <strong className="text-sky-400">{debtItem.transactionCode}</strong> para
                compensar el gasto y equilibrar tus cuentas reales.
              </p>
            </div>
          </label>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar cobro</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

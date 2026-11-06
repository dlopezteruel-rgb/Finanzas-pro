import { Overlay } from './Overlay';
import { SaveResult } from '../utils/saveResult';
import { useAsyncForm } from '../utils/useAsyncForm';
import { parseTransferAmount, validTransferAmount } from '../utils/transfers';
import React, { useState, useEffect } from 'react';
import { Wallet, Transaction, TransferInput } from '../types/finance';
import { formatCurrency } from '../utils/finance';
import { ArrowLeftRight, X, Check, ArrowRight } from 'lucide-react';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[];
  walletBalances: Record<string, number>;
  transferToEdit?: Transaction | null;
  initiallyDelete?: boolean;
  onDeleteTransfer?: (id: string) => Promise<SaveResult>;
  onExecuteTransfer: (input: TransferInput, id?: string) => Promise<SaveResult>;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  wallets,
  walletBalances,
  onExecuteTransfer, transferToEdit, initiallyDelete = false, onDeleteTransfer,
}) => {
  const submission = useAsyncForm();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [processed, setProcessed] = useState(true);
  const [origin, setOrigin] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [concept, setConcept] = useState<string>('Traspaso de fondos');

  useEffect(() => {
    if (!isOpen) return;
    submission.clearError();
    setConfirmDelete(initiallyDelete);
    setOrigin(transferToEdit?.transfer?.fromWalletId || wallets[0]?.id || '');
    setDestination(transferToEdit?.transfer?.toWalletId || wallets[1]?.id || '');
    setAmount(transferToEdit ? String(transferToEdit.amount) : '');
    setDate(transferToEdit?.date || new Date().toISOString().split('T')[0]);
    setConcept(transferToEdit?.transfer?.concept ?? 'Traspaso de fondos');
    setProcessed(transferToEdit?.processed ?? true);
  }, [isOpen, transferToEdit?.id, initiallyDelete]);

  if (!isOpen) return null;

  const originName = wallets.find(w => w.id === origin)?.name || '';
  const destinationName = wallets.find(w => w.id === destination)?.name || '';
  const originBalance = walletBalances[originName] ?? 0;
  const destBalance = walletBalances[destinationName] ?? 0;

  const quickAmounts = [20, 50, 100, 200, 500];

  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submission.submit(() => onExecuteTransfer({
      fromWalletId: origin, toWalletId: destination, amount: parseTransferAmount(amount), date, concept: concept.trim(), processed,
    }, transferToEdit?.transfer?.id), onClose);
  };
  const parsedAmount = parseTransferAmount(amount);
  const close = () => submission.close(onClose);

  return (
    <Overlay title="Traspaso" onClose={close}>
      <div role="dialog" aria-modal="true" aria-label="Traspaso" className="bg-[#141926] border border-white/10 rounded-3xl max-w-md w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl text-xs space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/25 text-sky-400 flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{transferToEdit ? "Editar Traspaso entre Cuentas" : "Ordenar Traspaso entre Cuentas"}</h3>
              <p className="text-[11px] text-slate-400">
                Mueve dinero entre tus bancos y carteras al instante
              </p>
            </div>
          </div>
          <button
            onClick={close} disabled={submission.saving} aria-label="Cerrar traspaso"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-slate-400">Los dos extremos se guardan juntos. Antes del primer traspaso se conserva una copia recuperable del estado anterior.</p>
        <form onSubmit={handleSubmit} aria-busy={submission.saving} className="space-y-4">
          <fieldset disabled={submission.saving} className="space-y-4">
          {submission.error && <p role="alert" className="text-rose-300">{submission.error}</p>}
          {/* Account Selection Box */}
          <div className="space-y-2 relative">
            {/* Origin Wallet */}
            <div className="bg-[#0c0f17] border border-white/[0.08] rounded-2xl p-3 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                  Cuenta de Origen (Salida de dinero)
                </label>
                <span className="text-[10px] text-slate-400">
                  Saldo actual: <strong className="text-white font-mono">{formatCurrency(originBalance)}</strong>
                </span>
              </div>
              <select
                aria-label="Cuenta de origen"
                value={origin}
                onChange={e => {
                  setOrigin(e.target.value);
                  if (e.target.value === destination) {
                    const other = wallets.find(w => w.id !== e.target.value);
                    if (other) setDestination(other.id);
                  }
                }}
                className="w-full bg-transparent text-white font-bold text-sm focus:outline-none cursor-pointer"
              >
                {wallets.map(w => (
                  <option key={w.id} value={w.id} className="bg-[#141926] text-white">
                    {w.name} ({w.type}) · {formatCurrency(walletBalances[w.name] ?? w.initialBalance)}
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <div className="absolute left-1/2 -translate-x-1/2 top-[76px] z-10">
              <button
                type="button"
                onClick={handleSwap}
                title="Intercambiar origen y destino"
                className="w-8 h-8 rounded-full bg-sky-500 hover:bg-sky-400 text-slate-950 flex items-center justify-center shadow-lg transition-transform active:rotate-180 cursor-pointer"
              >
                <ArrowLeftRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Destination Wallet */}
            <div className="bg-[#0c0f17] border border-white/[0.08] rounded-2xl p-3 space-y-1 pt-3.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                  Cuenta de Destino (Entrada de dinero)
                </label>
                <span className="text-[10px] text-slate-400">
                  Saldo actual: <strong className="text-white font-mono">{formatCurrency(destBalance)}</strong>
                </span>
              </div>
              <select
                aria-label="Cuenta de destino"
                value={destination}
                onChange={e => setDestination(e.target.value)}
                className="w-full bg-transparent text-white font-bold text-sm focus:outline-none cursor-pointer"
              >
                {wallets
                  .filter(w => w.id !== origin)
                  .map(w => (
                    <option key={w.id} value={w.id} className="bg-[#141926] text-white">
                      {w.name} ({w.type}) · {formatCurrency(walletBalances[w.name] ?? w.initialBalance)}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <label className="text-slate-400 block font-medium">Importe a transferir (€)</label>
            <div className="relative">
              <input
                aria-label="Importe a transferir (€)"
                type="number"
                step="0.01"
                required
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-2xl px-4 py-3 text-white text-lg font-black font-mono focus:outline-none focus:border-sky-500 pr-10"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                €
              </span>
            </div>

            {/* Quick amount chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {quickAmounts.map(q => (
                <button
                  type="button"
                  key={q}
                  onClick={() => setAmount(q.toString())}
                  className="px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] text-slate-300 font-mono text-[11px] border border-white/[0.06] transition-colors cursor-pointer"
                >
                  +{q} €
                </button>
              ))}
            </div>
          </div>

          {/* Date and Concept */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 block font-medium mb-1">Fecha</label>
              <div className="relative">
                <input
                  aria-label="Fecha"
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block font-medium mb-1">Concepto / Nota</label>
              <input
                aria-label="Concepto / Nota"
                type="text"
                placeholder="ej. Ahorro, Recarga..."
                value={concept}
                onChange={e => setConcept(e.target.value)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Transfer Preview */}
          {parsedAmount > 0 && origin && destination && (
            <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-3 text-slate-300 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Resumen del traspaso:</span>
                <span className="font-bold text-sky-400 font-mono">{formatCurrency(parsedAmount)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <span>{originName}</span>
                <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
                <span>{destinationName}</span>
              </div>
            </div>
          )}

          {transferToEdit && <label className="flex gap-2 text-slate-300"><input type="checkbox" checked={processed} onChange={e => setProcessed(e.target.checked)} />Tramitado (ambos extremos)</label>}
          {/* Submit buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={close} disabled={submission.saving}
              className="py-2.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submission.saving || !validTransferAmount(parsedAmount) || !origin || !destination || origin === destination}
              className="py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{submission.saving ? "Guardando…" : "Confirmar Traspaso"}</span>
            </button>
          </div>
          {transferToEdit?.transfer && onDeleteTransfer && <div className="text-rose-300 space-y-2">
            {!confirmDelete ? <button type="button" onClick={() => setConfirmDelete(true)}>Eliminar traspaso completo</button> : <>
              <p>Se eliminarán juntos los dos extremos del traspaso «{transferToEdit.transfer.concept}» ({transferToEdit.transfer.id}): {formatCurrency(transferToEdit.amount)} · {transferToEdit.date}. Carteras: {wallets.find(w => w.id === transferToEdit.transfer!.fromWalletId)?.name} → {wallets.find(w => w.id === transferToEdit.transfer!.toWalletId)?.name}. Se retirarán 2 movimientos; el patrimonio total no cambia.</p>
              <button type="button" disabled={submission.saving} onClick={() => void submission.submit(() => onDeleteTransfer(transferToEdit.transfer!.id), onClose)}>Confirmar eliminación del traspaso</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="ml-3">Conservar traspaso</button>
            </>}
          </div>}
          </fieldset>
        </form>
      </div>
    </Overlay>
  );
};

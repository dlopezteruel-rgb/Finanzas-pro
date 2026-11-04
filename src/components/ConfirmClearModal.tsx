import { useAsyncForm } from '../utils/useAsyncForm';
import type { SaveResult } from '../utils/saveResult';
import { Overlay } from './Overlay';
import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, Wallet, CreditCard, Receipt, PiggyBank, CheckSquare, Square } from 'lucide-react';
import { ClearDataOptions } from '../utils/clearData';
export type { ClearDataOptions } from '../utils/clearData';


interface ConfirmClearModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: ClearDataOptions) => Promise<SaveResult>;
}

export const ConfirmClearModal: React.FC<ConfirmClearModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const submission = useAsyncForm();
  const close = () => submission.close(onClose);
  const [options, setOptions] = useState<ClearDataOptions>({
    clearWalletBalances: true,
    clearAllWallets: false,
    clearTransactions: true,
    clearBudgets: true,
    clearDebts: true,
  });

  if (!isOpen) return null;

  const toggleOption = (key: keyof ClearDataOptions) => {
    setOptions(prev => {
      const next = { ...prev, [key]: !prev[key] };
      // Si se marca borrar todas las cuentas, marcar o no saldo es irrelevante
      if (key === 'clearAllWallets' && next.clearAllWallets) {
        next.clearWalletBalances = true;
      }
      return next;
    });
  };

  const handleSelectAll = (select: boolean) => {
    setOptions({
      clearWalletBalances: select,
      clearAllWallets: select,
      clearTransactions: select,
      clearBudgets: select,
      clearDebts: select,
    });
  };

  const selectedCount = Object.values(options).filter(Boolean).length;

  const handleExecute = () => {
    if (selectedCount === 0) return;
    void submission.submit(() => onConfirm(options), onClose);
  };

  return (
    <Overlay title="Borrar datos" onClose={close}>
      <div className="bg-[#141926] border border-rose-500/30 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-xs space-y-4 max-h-[90vh] flex flex-col">
        <fieldset disabled={submission.saving} className="space-y-4 min-h-0 overflow-y-auto">
        {submission.error && <p role="alert" className="text-amber-300">{submission.error}</p>}
        {/* Header */}
        <div className="flex items-start justify-between pb-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Selecciona qué deseas borrar
              </h3>
              <p className="text-[11px] text-slate-400">
                Elige de forma granular qué apartados quieres restablecer.
              </p>
            </div>
          </div>
          <button
            onClick={close} disabled={submission.saving}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick select buttons */}
        <div className="flex items-center justify-between text-[11px] pt-1">
          <span className="text-slate-400 font-medium">
            Seleccionados: <strong className="text-rose-400">{selectedCount}</strong> de 5
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectAll(true)}
              className="text-sky-400 hover:text-sky-300 font-semibold cursor-pointer underline underline-offset-2"
            >
              Seleccionar todo
            </button>
            <span className="text-slate-600">•</span>
            <button
              type="button"
              onClick={() => handleSelectAll(false)}
              className="text-slate-400 hover:text-slate-200 font-semibold cursor-pointer underline underline-offset-2"
            >
              Deseleccionar
            </button>
          </div>
        </div>

        {/* Options List */}
        <div className="space-y-2 overflow-y-auto pr-1 flex-1">
          {/* 1. Dinero en las cuentas */}
          <div
            onClick={() => toggleOption('clearWalletBalances')}
            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              options.clearWalletBalances
                ? 'bg-rose-500/10 border-rose-500/30'
                : 'bg-[#0c0f17] border-white/[0.06] hover:border-white/[0.12]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-300 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white text-xs block">Dinero en las cuentas</span>
                <span className="text-[11px] text-slate-400 block">
                  Restablece el saldo base y patrimonio inicial a 0,00 € (conserva las cuentas).
                </span>
              </div>
            </div>
            <div className="text-rose-400 shrink-0">
              {options.clearWalletBalances ? (
                <CheckSquare className="w-5 h-5 text-rose-400" />
              ) : (
                <Square className="w-5 h-5 text-slate-600" />
              )}
            </div>
          </div>

          {/* 2. Todas las cuentas */}
          <div
            onClick={() => toggleOption('clearAllWallets')}
            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              options.clearAllWallets
                ? 'bg-rose-500/10 border-rose-500/30'
                : 'bg-[#0c0f17] border-white/[0.06] hover:border-white/[0.12]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/25 text-purple-300 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white text-xs block">Todas las cuentas</span>
                <span className="text-[11px] text-slate-400 block">
                  Elimina todas las cuentas bancarias y carteras creadas.
                </span>
              </div>
            </div>
            <div className="text-rose-400 shrink-0">
              {options.clearAllWallets ? (
                <CheckSquare className="w-5 h-5 text-rose-400" />
              ) : (
                <Square className="w-5 h-5 text-slate-600" />
              )}
            </div>
          </div>

          {/* 3. Movimientos */}
          <div
            onClick={() => toggleOption('clearTransactions')}
            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              options.clearTransactions
                ? 'bg-rose-500/10 border-rose-500/30'
                : 'bg-[#0c0f17] border-white/[0.06] hover:border-white/[0.12]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/25 text-sky-300 flex items-center justify-center shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white text-xs block">Movimientos</span>
                <span className="text-[11px] text-slate-400 block">
                  Borra todos los ingresos, gastos, traspasos e historial registrado.
                </span>
              </div>
            </div>
            <div className="text-rose-400 shrink-0">
              {options.clearTransactions ? (
                <CheckSquare className="w-5 h-5 text-rose-400" />
              ) : (
                <Square className="w-5 h-5 text-slate-600" />
              )}
            </div>
          </div>

          {/* 4. Presupuestos */}
          <div
            onClick={() => toggleOption('clearBudgets')}
            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              options.clearBudgets
                ? 'bg-rose-500/10 border-rose-500/30'
                : 'bg-[#0c0f17] border-white/[0.06] hover:border-white/[0.12]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 flex items-center justify-center shrink-0">
                <PiggyBank className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white text-xs block">Presupuestos</span>
                <span className="text-[11px] text-slate-400 block">
                  Elimina todas las asignaciones previstas (deja los presupuestos a 0,00 €).
                </span>
              </div>
            </div>
            <div className="text-rose-400 shrink-0">
              {options.clearBudgets ? (
                <CheckSquare className="w-5 h-5 text-rose-400" />
              ) : (
                <Square className="w-5 h-5 text-slate-600" />
              )}
            </div>
          </div>

          {/* 5. Deudas */}
          <div
            onClick={() => toggleOption('clearDebts')}
            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              options.clearDebts
                ? 'bg-rose-500/10 border-rose-500/30'
                : 'bg-[#0c0f17] border-white/[0.06] hover:border-white/[0.12]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-300 flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white text-xs block">Deudas y Préstamos</span>
                <span className="text-[11px] text-slate-400 block">
                  Elimina préstamos bancarios y resetea las deudas compartidas pendientes.
                </span>
              </div>
            </div>
            <div className="text-rose-400 shrink-0">
              {options.clearDebts ? (
                <CheckSquare className="w-5 h-5 text-rose-400" />
              ) : (
                <Square className="w-5 h-5 text-slate-600" />
              )}
            </div>
          </div>
        </div>

        {/* Warning notice */}
        <p className="text-[11px] text-rose-300/80 text-center font-medium bg-rose-500/10 py-1.5 px-3 rounded-xl border border-rose-500/20">
          Se guardará una copia recuperable antes de borrar. Si no se puede guardar, se cancelará la operación.
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={close} disabled={submission.saving}
            className="py-2.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 font-semibold transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={handleExecute}
            className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-rose-900/30 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>
              {selectedCount === 0
                ? 'Selecciona opciones'
                : `Borrar seleccionados (${selectedCount})`}
            </span>
          </button>
        </div>
        </fieldset>
      </div>
    </Overlay>
  );
};

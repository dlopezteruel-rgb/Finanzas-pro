import React, { useState, useEffect } from 'react';
import { Wallet } from '../types/finance';
import { formatCurrency } from '../utils/finance';
import { X, Landmark, Trash2, Check, Sparkles, Coins } from 'lucide-react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletToEdit?: Wallet | null;
  wallets: Wallet[];
  currentCalculatedBalance?: number;
  onSaveWallet: (wallet: Wallet) => void;
  onDeleteWallet?: (walletId: string) => void;
}

const PRESET_COLORS = [
  '#00d2ff', // Sky blue
  '#10b981', // Emerald green
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#3b82f6', // Indigo blue
  '#f43f5e', // Rose
  '#64748b', // Slate
];

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  walletToEdit,
  wallets,
  currentCalculatedBalance,
  onSaveWallet,
  onDeleteWallet,
}) => {
  const isEditing = !!walletToEdit;

  const [name, setName] = useState(walletToEdit?.name || '');
  const [type, setType] = useState<Wallet['type']>(walletToEdit?.type || 'BANK');
  const [initialBalance, setInitialBalance] = useState<string>(
    walletToEdit ? walletToEdit.initialBalance.toString() : '0'
  );
  const [color, setColor] = useState(walletToEdit?.color || '#00d2ff');
  const [iban, setIban] = useState(walletToEdit?.ibanOrDetails || '');
  const [isCalibratingCurrent, setIsCalibratingCurrent] = useState(false);
  const [targetCurrentBalance, setTargetCurrentBalance] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (walletToEdit) {
      setName(walletToEdit.name);
      setType(walletToEdit.type);
      setInitialBalance(walletToEdit.initialBalance.toString());
      setColor(walletToEdit.color);
      setIban(walletToEdit.ibanOrDetails || '');
      setTargetCurrentBalance(
        currentCalculatedBalance !== undefined
          ? currentCalculatedBalance.toString()
          : walletToEdit.initialBalance.toString()
      );
    } else {
      setName('');
      setType('BANK');
      setInitialBalance('0');
      setColor('#00d2ff');
      setIban('');
      setTargetCurrentBalance('0');
    }
    setConfirmDelete(false);
    setError('');
    setIsCalibratingCurrent(false);
  }, [walletToEdit, currentCalculatedBalance, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (wallets.some(w => w.id !== walletToEdit?.id && w.name.trim().toUpperCase() === name.trim().toUpperCase())) {
      setError('Ya existe una cartera con ese nombre. Elige un nombre diferente.');
      return;
    }

    let finalInitialBalance = parseFloat(initialBalance.replace(',', '.'));
    if (isNaN(finalInitialBalance)) finalInitialBalance = 0;

    // If user used direct current balance calibration
    if (isEditing && isCalibratingCurrent && currentCalculatedBalance !== undefined) {
      const target = parseFloat(targetCurrentBalance.replace(',', '.'));
      if (!isNaN(target)) {
        // diff = target - currentCalculatedBalance
        // newInitial = currentInitial + diff
        const diff = target - currentCalculatedBalance;
        finalInitialBalance = Math.round((walletToEdit.initialBalance + diff) * 100) / 100;
      }
    }

    const savedWallet: Wallet = {
      id: walletToEdit?.id || `wallet-${Date.now()}`,
      name: name.toUpperCase().trim(),
      type,
      initialBalance: Math.round(finalInitialBalance * 100) / 100,
      color,
      ibanOrDetails: iban.trim() || 'Cuenta bancaria',
    };

    onSaveWallet(savedWallet);
    onClose();
  };

  const handleDelete = () => {
    if (!walletToEdit || !onDeleteWallet) return;
    onDeleteWallet(walletToEdit.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-[#141926] border border-white/10 rounded-3xl max-w-sm sm:max-w-md w-full p-5 sm:p-6 shadow-2xl text-xs space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-950 font-black text-xs shadow-sm"
              style={{ backgroundColor: color }}
            >
              {name.slice(0, 2) || 'CT'}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEditing ? 'Editar Cuenta y Patrimonio' : 'Nueva Cuenta o Cartera'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isEditing
                  ? 'Ajusta el saldo inicial, patrimonio y datos de la cuenta'
                  : 'Crea una nueva cuenta bancaria, efectivo o ahorro'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p role="alert" className="text-amber-300">{error}</p>}
          {/* Name & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Nombre de la cuenta</label>
              <input
                type="text"
                required
                placeholder="ej. BBVA, REVOLUT, EFECTIVO"
                aria-label="Nombre de la cuenta"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white uppercase focus:outline-none focus:border-sky-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Tipo de cuenta</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as any)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              >
                <option value="BANK">Bancaria habitual</option>
                <option value="NEOBANK">Neobanco / Fintech</option>
                <option value="SAVINGS">Cuenta de Ahorro</option>
                <option value="INVESTMENT">Inversión / Bróker</option>
                <option value="CASH">Efectivo / Metálico</option>
              </select>
            </div>
          </div>

          {/* EDIT PATRIMONIO / SALDO SECTION */}
          <div className="bg-[#0c0f17] border border-white/[0.08] rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5" />
                Patrimonio y Saldo de la cuenta
              </span>
              {isEditing && currentCalculatedBalance !== undefined && (
                <button
                  type="button"
                  onClick={() => setIsCalibratingCurrent(!isCalibratingCurrent)}
                  className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold cursor-pointer underline"
                >
                  {isCalibratingCurrent ? 'Ver saldo inicial' : 'Ajustar al saldo actual directo'}
                </button>
              )}
            </div>

            {isEditing && currentCalculatedBalance !== undefined && !isCalibratingCurrent && (
              <div className="flex items-center justify-between bg-white/[0.03] p-2.5 rounded-xl border border-white/[0.04]">
                <span className="text-[11px] text-slate-400">Saldo actual en vivo:</span>
                <span className={`text-sm font-black font-mono ${currentCalculatedBalance >= 0 ? 'text-white' : 'text-rose-400'}`}>
                  {formatCurrency(currentCalculatedBalance)}
                </span>
              </div>
            )}

            {!isCalibratingCurrent ? (
              <div>
                <label className="block text-slate-400 mb-1 text-[11px]">
                  Patrimonio / Saldo base inicial (€)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={initialBalance}
                    onChange={e => setInitialBalance(e.target.value)}
                    className="w-full bg-[#141926] border border-white/[0.08] rounded-xl px-3 py-2 text-white font-mono text-base font-bold focus:outline-none focus:border-sky-500 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    €
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Punto de partida patrimonial. Las transacciones tramitadas sumarán o restarán a esta base.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sky-300 mb-1 text-[11px] font-semibold">
                  Quiero que el saldo actual de la cuenta quede exactamente en (€):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={targetCurrentBalance}
                    onChange={e => setTargetCurrentBalance(e.target.value)}
                    className="w-full bg-[#141926] border border-sky-500/50 rounded-xl px-3 py-2 text-sky-200 font-mono text-base font-bold focus:outline-none focus:border-sky-400 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-400 font-bold">
                    €
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Se recalibrará automáticamente el patrimonio inicial para que tu saldo en cuenta coincida con lo que tienes en el banco hoy.
                </p>
              </div>
            )}
          </div>

          {/* IBAN / Details */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">IBAN o detalles (opcional)</label>
            <input
              type="text"
              placeholder="ES91 2100 0418 4502 0005 1332"
              value={iban}
              onChange={e => setIban(e.target.value)}
              className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500 text-xs"
            />
          </div>

          {/* Color Selector */}
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">Color de la tarjeta</label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                    color === c ? 'scale-110 ring-2 ring-white shadow-lg' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Delete Option (only when editing) */}
          {isEditing && onDeleteWallet && (
            <div className="pt-2 border-t border-white/[0.06]">
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1.5 font-semibold cursor-pointer py-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar esta cuenta bancaria</span>
                </button>
              ) : (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 space-y-2">
                  <p className="text-[11px] text-rose-300">
                    ¿Eliminar la cuenta <strong>{walletToEdit.name}</strong>? Los movimientos existentes conservarán su registro.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
                    >
                      Sí, eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isEditing ? 'Guardar Cambios' : 'Crear Cuenta'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

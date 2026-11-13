import {storageOwnedText} from '../i18n/storageMessages';
import { useI18n, I18nText } from "../i18n";
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { deletionReport } from '../utils/deletion';
import type { FinanceData } from '../utils/backup';
import { Overlay } from './Overlay';
import { SaveResult } from '../utils/saveResult';
import { useAsyncForm } from '../utils/useAsyncForm';
import React, { useState, useLayoutEffect } from 'react';
import { Wallet } from '../types/finance';

import { X, Landmark, Trash2, Check, Sparkles, Coins } from 'lucide-react';

interface WalletModalProps {
  deletionData: FinanceData;
  isOpen: boolean;
  onClose: () => void;
  walletToEdit?: Wallet | null;
  wallets: Wallet[];
  currentCalculatedBalance?: number;
  onSaveWallet: (wallet: Wallet) => Promise<SaveResult>;
  onDeleteWallet?: (walletId: string) => Promise<SaveResult>;
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
  deletionData,
  isOpen,
  onClose,
  walletToEdit,
  wallets,
  currentCalculatedBalance,
  onSaveWallet,
  onDeleteWallet,
}) => {
  const { t: uiText , formatMoney: formatCurrency } = useI18n();
  const { t } = useI18n();
  const isEditing = !!walletToEdit;

  const submission = useAsyncForm();
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

  useLayoutEffect(() => {
    submission.clearError();
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
  }, [walletToEdit?.id, isOpen]);

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

    setError('');
    void submission.submit(() => onSaveWallet(savedWallet), onClose);
  };

  return (
    <>
    <Overlay title={uiText("wallet.cartera")} onClose={() => submission.close(onClose)}>
      <div role="dialog" aria-modal="true" aria-label={uiText("wallet.cartera")} className="bg-[#141926] border border-white/10 rounded-3xl max-w-sm sm:max-w-md w-full p-5 sm:p-6 shadow-2xl text-xs space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div
              className="wallet-initials w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shadow-sm"
              style={{ borderColor: color }}
            >
              {name.slice(0, 2) || uiText("wallet.ct")}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEditing ? uiText("wallet.editar_cuenta_y_patrimonio") : uiText("wallet.nueva_cuenta_o_cartera")}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isEditing
                  ? uiText("wallet.ajusta_el_saldo_inicial_patrimonio_y_datos_de_la")
                  : uiText("wallet.crea_una_nueva_cuenta_bancaria_efectivo_o_ahorro")}
              </p>
            </div>
          </div>
          <button
            aria-label={uiText("wallet.cerrar_cartera")} onClick={() => submission.close(onClose)} disabled={submission.saving}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} aria-busy={submission.saving}>
          <fieldset disabled={submission.saving} className="space-y-4">
          {submission.error && <p role="alert" className="text-amber-300">{storageOwnedText(submission.error,uiText)}</p>}
          {submission.saving && <p role="status" className="text-sky-300">{uiText("transfer.guardando")}</p>}
          {error && <p role="alert" className="text-amber-300">{storageOwnedText(error,uiText)}</p>}
          {/* Name & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">{t('form.walletName')}</label>
              <input
                type="text"
                required
                placeholder={uiText("wallet.ej_bbva_revolut_efectivo")}
                aria-label={t('form.walletName')}
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white uppercase focus:outline-none focus:border-sky-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">{uiText("wallet.tipo_de_cuenta")}</label>
              <select
                aria-label={uiText("wallet.tipo_de_cuenta")} value={type}
                onChange={e => setType(e.target.value as any)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              >
                <option value="BANK">{uiText("wallet.bancaria_habitual")}</option>
                <option value="NEOBANK">{uiText("wallet.neobanco_fintech")}</option>
                <option value="SAVINGS">{uiText("wallet.cuenta_de_ahorro")}</option>
                <option value="INVESTMENT">{uiText("wallet.inversion_broker")}</option>
                <option value="CASH">{uiText("wallet.efectivo_metalico")}</option>
              </select>
            </div>
          </div>

          {/* EDIT PATRIMONIO / SALDO SECTION */}
          <div className="bg-[#0c0f17] border border-white/[0.08] rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5" />{uiText("wallet.patrimonio_y_saldo_de_la_cuenta")}</span>
              {isEditing && currentCalculatedBalance !== undefined && (
                <button
                  type="button"
                  onClick={() => setIsCalibratingCurrent(!isCalibratingCurrent)}
                  className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold cursor-pointer underline"
                >
                  {isCalibratingCurrent ? uiText("wallet.ver_saldo_inicial") : uiText("wallet.ajustar_al_saldo_actual_directo")}
                </button>
              )}
            </div>

            {isEditing && currentCalculatedBalance !== undefined && !isCalibratingCurrent && (
              <div className="flex items-center justify-between bg-white/[0.03] p-2.5 rounded-xl border border-white/[0.04]">
                <span className="text-[11px] text-slate-400">{uiText("wallet.saldo_actual_en_vivo")}</span>
                <span className={`text-sm font-black font-mono ${currentCalculatedBalance >= 0 ? 'text-white' : 'text-rose-400'}`}>
                  {formatCurrency(currentCalculatedBalance)}
                </span>
              </div>
            )}

            {!isCalibratingCurrent ? (
              <div>
                <label className="block text-slate-400 mb-1 text-[11px]">{uiText("wallet.patrimonio_saldo_base_inicial")}</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required
                    aria-label={uiText("wallet.patrimonio_saldo_base_inicial")} value={initialBalance}
                    onChange={e => setInitialBalance(e.target.value)}
                    className="w-full bg-[#141926] border border-white/[0.08] rounded-xl px-3 py-2 text-white font-mono text-base font-bold focus:outline-none focus:border-sky-500 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    €
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{uiText("wallet.punto_de_partida_patrimonial_las_transacciones_tramitadas_sumaran_o")}</p>
              </div>
            ) : (
              <div>
                <label className="block text-sky-300 mb-1 text-[11px] font-semibold">{uiText("wallet.quiero_que_el_saldo_actual_de_la_cuenta_quede")}</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required
                    aria-label={uiText("wallet.saldo_actual_deseado")} value={targetCurrentBalance}
                    onChange={e => setTargetCurrentBalance(e.target.value)}
                    className="w-full bg-[#141926] border border-sky-500/50 rounded-xl px-3 py-2 text-sky-200 font-mono text-base font-bold focus:outline-none focus:border-sky-400 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-400 font-bold">
                    €
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{uiText("wallet.se_recalibrara_automaticamente_el_patrimonio_inicial_para_que_tu")}</p>
              </div>
            )}
          </div>

          {/* IBAN / Details */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">{uiText("wallet.iban_o_detalles_opcional")}</label>
            <input
              type="text"
              placeholder={uiText("wallet.es91_2100_0418_4502_0005_1332")}
              aria-label={uiText("wallet.iban_o_detalles_opcional")} value={iban}
              onChange={e => setIban(e.target.value)}
              className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500 text-xs"
            />
          </div>

          {/* Color Selector */}
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">{uiText("wallet.color_de_la_tarjeta")}</label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  type="button"
                  key={c}
                  aria-label={uiText("wallet.color", { c: c })} aria-pressed={color===c}
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

          {isEditing && onDeleteWallet && <button type="button" onClick={() => setConfirmDelete(true)} className="text-rose-300 py-2 flex gap-2 items-center"><I18nText id="wallet.eliminar_esta_cuenta_bancaria" values={{ trash2: (<Trash2 className="w-3.5 h-3.5" />) }} /></button>}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              aria-label={uiText("wallet.cerrar_cartera")} onClick={() => submission.close(onClose)} disabled={submission.saving}
              className="py-2.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 font-semibold transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isEditing ? uiText("loan.guardar_cambios") : uiText("wallet.crear_cuenta")}</span>
            </button>
          </div>
          </fieldset>
        </form>
      </div>
    </Overlay>
    {confirmDelete && walletToEdit && onDeleteWallet && <ConfirmDeleteDialog source={{data:deletionData,target:{kind:"wallet",id:walletToEdit.id}}} report={deletionReport(deletionData, { kind: 'wallet', id: walletToEdit.id })}
      onCancel={() => setConfirmDelete(false)} onConfirm={async () => { const result = await onDeleteWallet(walletToEdit.id); if (result.ok) onClose(); return result; }} />}
    </>
  );
};

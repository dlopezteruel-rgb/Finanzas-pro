import {walletTypeText} from '../i18n/labels';
import {storageOwnedText} from '../i18n/storageMessages';
import { useI18n, I18nText } from "../i18n";
import { Overlay } from './Overlay';
import { initialWalletId } from '../utils/defaultWallet';
import { SaveResult } from '../utils/saveResult';
import { useAsyncForm } from '../utils/useAsyncForm';
import { parseTransferAmount, validTransferAmount } from '../utils/transfers';
import React, { useState, useLayoutEffect } from 'react';
import { Wallet, Transaction, TransferInput } from '../types/finance';

import { ArrowLeftRight, X, Check, ArrowRight } from 'lucide-react';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[];
  defaultWalletId?: string | null;
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
  defaultWalletId,
  walletBalances,
  onExecuteTransfer, transferToEdit, initiallyDelete = false, onDeleteTransfer,
}) => {
  const { t: uiText , formatMoney: formatCurrency , formatDate } = useI18n();
  const submission = useAsyncForm();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [processed, setProcessed] = useState(true);
  const [origin, setOrigin] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [concept, setConcept] = useState<string>('Traspaso de fondos');

  useLayoutEffect(() => {
    if (!isOpen) return;
    submission.clearError();
    setConfirmDelete(initiallyDelete);
    setOrigin(initialWalletId(wallets, defaultWalletId, transferToEdit?.transfer?.fromWalletId));
    setDestination(transferToEdit?.transfer?.toWalletId ?? '');
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
    <Overlay title={uiText("transfer.traspaso")} onClose={close}>
      <div role="dialog" aria-modal="true" aria-label={uiText("transfer.traspaso")} className="bg-[#141926] border border-white/10 rounded-3xl max-w-md w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl text-xs space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/25 text-sky-400 flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{transferToEdit ? uiText("transfer.editar_traspaso_entre_cuentas") : uiText("transfer.ordenar_traspaso_entre_cuentas")}</h3>
              <p className="text-[11px] text-slate-400">{uiText("transfer.mueve_dinero_entre_tus_bancos_y_carteras_al_instante")}</p>
            </div>
          </div>
          <button
            onClick={close} disabled={submission.saving} aria-label={uiText("transfer.cerrar_traspaso")}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-slate-400">{uiText("transfer.los_dos_extremos_se_guardan_juntos_antes_del_primer")}</p>
        <form onSubmit={handleSubmit} aria-busy={submission.saving} className="space-y-4">
          <fieldset disabled={submission.saving} className="space-y-4">
          {submission.error && <p role="alert" className="text-rose-300">{storageOwnedText(submission.error,uiText)}</p>}
          {/* Account Selection Box */}
          <div className="space-y-2 relative">
            {/* Origin Wallet */}
            <div className="bg-[#0c0f17] border border-white/[0.08] rounded-2xl p-3 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">{uiText("transfer.cuenta_de_origen_salida_de_dinero")}</label>
                <span className="text-[10px] text-slate-400"><I18nText id="transfer.saldo_actual" values={{ originBalance: (<strong className="text-white font-mono">{formatCurrency(originBalance)}</strong>) }} /></span>
              </div>
              <select
                aria-label={uiText("transfer.cuenta_de_origen")} required
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
                <option value="" disabled>{uiText("transfer.selecciona_una_cartera")}</option>{wallets.map(w => (
                  <option key={w.id} value={w.id} className="bg-[#141926] text-white">
                    {w.name} ({walletTypeText(w.type,uiText)}) · {formatCurrency(walletBalances[w.name] ?? w.initialBalance)}
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <div className="absolute left-1/2 -translate-x-1/2 top-[76px] z-10">
              <button
                type="button"
                onClick={handleSwap}
                title={uiText("transfer.intercambiar_origen_y_destino")}
                className="w-8 h-8 rounded-full bg-sky-500 hover:bg-sky-400 text-slate-950 flex items-center justify-center shadow-lg transition-transform active:rotate-180 cursor-pointer"
              >
                <ArrowLeftRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Destination Wallet */}
            <div className="bg-[#0c0f17] border border-white/[0.08] rounded-2xl p-3 space-y-1 pt-3.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">{uiText("transfer.cuenta_de_destino_entrada_de_dinero")}</label>
                <span className="text-[10px] text-slate-400"><I18nText id="transfer.saldo_actual_9624fe" values={{ destBalance: (<strong className="text-white font-mono">{formatCurrency(destBalance)}</strong>) }} /></span>
              </div>
              <select
                aria-label={uiText("transfer.cuenta_de_destino")} required
                value={destination}
                onChange={e => setDestination(e.target.value)}
                className="w-full bg-transparent text-white font-bold text-sm focus:outline-none cursor-pointer"
              >
                <option value="" disabled>{uiText("transfer.selecciona_una_cartera")}</option>{wallets
                  .filter(w => w.id !== origin)
                  .map(w => (
                    <option key={w.id} value={w.id} className="bg-[#141926] text-white">
                      {w.name} ({walletTypeText(w.type,uiText)}) · {formatCurrency(walletBalances[w.name] ?? w.initialBalance)}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <label className="text-slate-400 block font-medium">{uiText("transfer.importe_a_transferir")}</label>
            <div className="relative">
              <input
                aria-label={uiText("transfer.importe_a_transferir")}
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
              <label className="text-slate-400 block font-medium mb-1">{uiText("transfer.fecha")}</label>
              <div className="relative">
                <input
                  aria-label={uiText("transfer.fecha")}
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block font-medium mb-1">{uiText("transfer.concepto_nota")}</label>
              <input
                aria-label={uiText("transfer.concepto_nota")}
                type="text"
                placeholder={uiText("transfer.ej_ahorro_recarga")}
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
                <span className="text-slate-400">{uiText("transfer.resumen_del_traspaso")}</span>
                <span className="font-bold text-sky-400 font-mono">{formatCurrency(parsedAmount)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <span>{originName}</span>
                <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
                <span>{destinationName}</span>
              </div>
            </div>
          )}

          {transferToEdit && <label className="flex gap-2 text-slate-300"><input type="checkbox" checked={processed} onChange={e => setProcessed(e.target.checked)} />{uiText("transfer.tramitado_ambos_extremos")}</label>}
          {/* Submit buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={close} disabled={submission.saving}
              className="py-2.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 font-semibold transition-colors cursor-pointer"
            >{uiText("transfer.cancelar")}</button>
            <button
              type="submit"
              disabled={submission.saving || !validTransferAmount(parsedAmount) || !origin || !destination || origin === destination}
              className="py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{submission.saving ? uiText("transfer.guardando") : uiText("transfer.confirmar_traspaso")}</span>
            </button>
          </div>
          {transferToEdit?.transfer && onDeleteTransfer && <div className="text-rose-300 space-y-2">
            {!confirmDelete ? <button type="button" onClick={() => setConfirmDelete(true)}>{uiText("transfer.eliminar_traspaso_completo")}</button> : <>
              <p><I18nText id="transfer.se_eliminaran_juntos_los_dos_extremos_del_traspaso_carteras" values={{ concept: (transferToEdit.transfer.concept), id: (transferToEdit.transfer.id), amount: (formatCurrency(transferToEdit.amount)), date: (formatDate(transferToEdit.date, {day:'2-digit',month:'2-digit',year:'numeric'})), content: (wallets.find(w => w.id === transferToEdit.transfer!.fromWalletId)?.name), content_af1c0: (wallets.find(w => w.id === transferToEdit.transfer!.toWalletId)?.name) }} /></p>
              <button type="button" disabled={submission.saving} onClick={() => void submission.submit(() => onDeleteTransfer(transferToEdit.transfer!.id), onClose)}>{uiText("transfer.confirmar_eliminacion_del_traspaso")}</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="ml-3">{uiText("transfer.conservar_traspaso")}</button>
            </>}
          </div>}
          </fieldset>
        </form>
      </div>
    </Overlay>
  );
};

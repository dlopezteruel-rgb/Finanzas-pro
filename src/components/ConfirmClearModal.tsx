import { formatCurrency } from '../utils/finance';
import { useI18n, I18nText } from "../i18n";
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { clearImpact, clearScope } from '../utils/clearData';
import type { FinanceData } from '../utils/backup';
import type { DeletionReport } from '../utils/deletion';
import type { SaveResult } from '../utils/saveResult';
import { Overlay } from './Overlay';
import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, Wallet, CreditCard, Receipt, PiggyBank, CheckSquare, Square } from 'lucide-react';
import { ClearDataOptions } from '../utils/clearData';
export type { ClearDataOptions } from '../utils/clearData';


interface ConfirmClearModalProps {
  data: FinanceData;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: ClearDataOptions, scope: string) => Promise<SaveResult>;
}

export const ConfirmClearModal: React.FC<ConfirmClearModalProps> = ({
  data,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const { t: uiText } = useI18n();
  const [review, setReview] = useState<{ options: ClearDataOptions; scope: string; report: DeletionReport } | null>(null);
  const close = onClose;
  const [options, setOptions] = useState<ClearDataOptions>({
    clearWalletBalances: true,
    clearAllWallets: false,
    clearTransactions: true,
    clearBudgets: true,
    clearDebts: true,
  });

  if (!isOpen) return null;
  const impact = clearImpact(data, options);

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
    setReview({ options: { ...options }, scope: clearScope(data, options), report: clearImpact(data, options) });
  };

  return (
    <>
    <Overlay title={uiText("confirm_clear.borrar_datos")} onClose={close}>
      <div className="bg-[#141926] border border-rose-500/30 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-xs space-y-4 max-h-[90vh] flex flex-col">
        <div aria-disabled={!!review} className="space-y-4 min-w-0 min-h-0 overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{uiText("confirm_clear.selecciona_que_deseas_borrar")}</h3>
              <p className="text-[11px] text-slate-400">{uiText("confirm_clear.elige_de_forma_granular_que_apartados_quieres_restablecer")}</p>
            </div>
          </div>
          <button
            onClick={close} disabled={!!review}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick select buttons */}
        <div className="flex items-center justify-between text-[11px] pt-1">
          <span className="text-slate-400 font-medium"><I18nText id="confirm_clear.seleccionados_de_5" values={{ selectedCount: (<strong className="text-rose-400">{selectedCount}</strong>) }} /></span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectAll(true)}
              className="text-sky-400 hover:text-sky-300 font-semibold cursor-pointer underline underline-offset-2"
            >{uiText("confirm_clear.seleccionar_todo")}</button>
            <span className="text-slate-600">•</span>
            <button
              type="button"
              onClick={() => handleSelectAll(false)}
              className="text-slate-400 hover:text-slate-200 font-semibold cursor-pointer underline underline-offset-2"
            >{uiText("confirm_clear.deseleccionar")}</button>
          </div>
        </div>

        {/* Options List */}
        <div className="space-y-2 overflow-y-auto pr-1 flex-1">
          {/* 1. Dinero en las cuentas */}
          <button type="button" aria-label={uiText("confirm_clear.restablecer_saldos_base")} aria-pressed={options.clearWalletBalances}
            onClick={() => toggleOption('clearWalletBalances')}
            className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
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
                <span className="font-bold text-white text-xs block">{uiText("confirm_clear.dinero_en_las_cuentas")}</span>
                <span className="text-[11px] text-slate-400 block">{uiText("confirm_clear.restablece_el_saldo_base_y_patrimonio_inicial_a_0", { amount: formatCurrency(0) })}</span>
              </div>
            </div>
            <div className="text-rose-400 shrink-0">
              {options.clearWalletBalances ? (
                <CheckSquare className="w-5 h-5 text-rose-400" />
              ) : (
                <Square className="w-5 h-5 text-slate-600" />
              )}
            </div>
          </button>

          {/* 2. Todas las cuentas */}
          <button type="button" aria-label={uiText("confirm_clear.eliminar_todas_las_cuentas")} aria-pressed={options.clearAllWallets}
            onClick={() => toggleOption('clearAllWallets')}
            className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
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
                <span className="font-bold text-white text-xs block">{uiText("confirm_clear.todas_las_cuentas")}</span>
                <span className="text-[11px] text-slate-400 block">{uiText("confirm_clear.elimina_todas_las_cuentas_bancarias_y_carteras_creadas")}</span>
              </div>
            </div>
            <div className="text-rose-400 shrink-0">
              {options.clearAllWallets ? (
                <CheckSquare className="w-5 h-5 text-rose-400" />
              ) : (
                <Square className="w-5 h-5 text-slate-600" />
              )}
            </div>
          </button>

          {/* 3. Movimientos */}
          <button type="button" aria-label={uiText("confirm_clear.borrar_movimientos")} aria-pressed={options.clearTransactions}
            onClick={() => toggleOption('clearTransactions')}
            className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
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
                <span className="font-bold text-white text-xs block">{uiText("transactions.movimientos")}</span>
                <span className="text-[11px] text-slate-400 block">{uiText("confirm_clear.borra_todos_los_ingresos_gastos_traspasos_e_historial_registrado")}</span>
              </div>
            </div>
            <div className="text-rose-400 shrink-0">
              {options.clearTransactions ? (
                <CheckSquare className="w-5 h-5 text-rose-400" />
              ) : (
                <Square className="w-5 h-5 text-slate-600" />
              )}
            </div>
          </button>

          {/* 4. Presupuestos */}
          <button type="button" aria-label={uiText("confirm_clear.borrar_planes_presupuestarios")} aria-pressed={options.clearBudgets}
            onClick={() => toggleOption('clearBudgets')}
            className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
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
                <span className="font-bold text-white text-xs block">{uiText("confirm_clear.presupuestos")}</span>
                <span className="text-[11px] text-slate-400 block">{uiText("confirm_clear.elimina_las_asignaciones_previstas_los_objetivos_de_ahorro_y")}</span>
              </div>
            </div>
            <div className="text-rose-400 shrink-0">
              {options.clearBudgets ? (
                <CheckSquare className="w-5 h-5 text-rose-400" />
              ) : (
                <Square className="w-5 h-5 text-slate-600" />
              )}
            </div>
          </button>

          {/* 5. Deudas */}
          <button type="button" aria-label={uiText("confirm_clear.borrar_prestamos_y_deudas")} aria-pressed={options.clearDebts}
            onClick={() => toggleOption('clearDebts')}
            className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
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
                <span className="font-bold text-white text-xs block">{uiText("confirm_clear.deudas_y_prestamos")}</span>
                <span className="text-[11px] text-slate-400 block">{uiText("confirm_clear.elimina_prestamos_sin_dejar_cuotas_huerfanas_las_deudas_compartidas")}</span>
              </div>
            </div>
            <div className="text-rose-400 shrink-0">
              {options.clearDebts ? (
                <CheckSquare className="w-5 h-5 text-rose-400" />
              ) : (
                <Square className="w-5 h-5 text-slate-600" />
              )}
            </div>
          </button>
        </div>

        <section aria-label={uiText("confirm_clear.resumen_del_borrado")} className="rounded-xl border border-white/10 p-3 space-y-1">
          <h4 className="font-bold">{uiText("confirm_clear.alcance_todas_las_fechas")}</h4>
          {impact.relations.map(r => <p key={r.label}>{r.label}: {r.count}</p>)}
          <p>{uiText("confirm_clear.se_conservan_contactos_familias_y_partidas_del_catalogo_las")}</p>
          {impact.blockers.map(b => <p key={b} className="text-amber-300">{b}</p>)}
        </section>
        {/* Warning notice */}
        <p className="text-[11px] text-rose-300/80 text-center font-medium bg-rose-500/10 py-1.5 px-3 rounded-xl border border-rose-500/20">{uiText("confirm_clear.se_guardara_una_copia_recuperable_antes_de_borrar_si")}</p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={close} disabled={!!review}
            className="py-2.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 font-semibold transition-colors cursor-pointer"
          >{uiText("confirm_clear.cancelar")}</button>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={handleExecute}
            className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-rose-900/30 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>
              {selectedCount === 0
                ? uiText("confirm_clear.selecciona_opciones")
                : uiText("confirm_clear.borrar_seleccionados", { selectedCount: selectedCount })}
            </span>
          </button>
        </div>
        </div>
      </div>
    </Overlay>
    {review && <ConfirmDeleteDialog report={review.report} requiredText="BORRAR" onCancel={() => setReview(null)} onConfirm={async () => {
      const result = await onConfirm(review.options, review.scope); if (result.ok) onClose(); return result;
    }} />}
    </>
  );
};

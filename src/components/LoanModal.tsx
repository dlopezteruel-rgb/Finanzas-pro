import { useI18n, I18nText } from "../i18n";
import {madridDate} from '../utils/financialCalendar';
import {classificationCatalog} from '../utils/budgetCatalog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { deletionReport } from '../utils/deletion';
import type { FinanceData } from '../utils/backup';
import { Overlay } from './Overlay';
import { SaveResult } from '../utils/saveResult';
import { useAsyncForm } from '../utils/useAsyncForm';
import React, { useState, useLayoutEffect } from 'react';
import { Loan, Wallet } from '../types/finance';

import { initialWalletName } from '../utils/defaultWallet';
import { X, CreditCard, Trash2, Check, Landmark, Calendar } from 'lucide-react';

interface LoanModalProps {
  deletionData: FinanceData;
  isOpen: boolean;
  onClose: () => void;
  loanToEdit?: Loan | null;
  wallets: Wallet[];
  onSaveLoan: (loan: Loan) => Promise<SaveResult>;
  onDeleteLoan?: (loanId: string) => Promise<SaveResult>;
}

export const LoanModal: React.FC<LoanModalProps> = ({
  deletionData,
  isOpen,
  onClose,
  loanToEdit,
  wallets,
  onSaveLoan,
  onDeleteLoan,
}) => {
  const { t: uiText } = useI18n();
  const { t } = useI18n();
  const isEditing = !!loanToEdit;

  const submission = useAsyncForm();
  const partidas=classificationCatalog(deletionData.budgetGroups).filter(p=>p.type==='GASTO');
  const defaultCode=partidas.some(p=>p.code==='E.002.001')?'E.002.001':'';
  const [name, setName] = useState(loanToEdit?.name || '');
  const [entity, setEntity] = useState(loanToEdit?.entity || '');
  const [principal, setPrincipal] = useState<number>(loanToEdit?.principal || 10000);
  const [interestRate, setInterestRate] = useState<number>(loanToEdit?.interestRate || 5.0);
  const [totalTermMonths, setTotalTermMonths] = useState<number>(loanToEdit?.totalTermMonths || 36);
  const [startDate, setStartDate] = useState(
    loanToEdit?.startDate || madridDate()
  );
  const [monthlyPayment, setMonthlyPayment] = useState<number>(loanToEdit?.monthlyPayment || 300);
  const [wallet, setWallet] = useState(initialWalletName(wallets, deletionData.defaultWalletId, loanToEdit?.wallet));
  const [code, setCode] = useState(loanToEdit?.code ?? defaultCode);
  const [notes, setNotes] = useState(loanToEdit?.notes || '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useLayoutEffect(() => {
    submission.clearError();
    if (loanToEdit) {
      setName(loanToEdit.name);
      setEntity(loanToEdit.entity);
      setPrincipal(loanToEdit.principal);
      setInterestRate(loanToEdit.interestRate);
      setTotalTermMonths(loanToEdit.totalTermMonths);
      setStartDate(loanToEdit.startDate);
      setMonthlyPayment(loanToEdit.monthlyPayment);
      setWallet(loanToEdit.wallet);
      setCode(loanToEdit.code);
      setNotes(loanToEdit.notes || '');
    } else {
      setName('');
      setEntity('');
      setPrincipal(10000);
      setInterestRate(5.0);
      setTotalTermMonths(36);
      setStartDate(madridDate());
      setMonthlyPayment(300);
      setWallet(initialWalletName(wallets, deletionData.defaultWalletId));
      setCode(defaultCode);
      setNotes('');
    }
    setConfirmDelete(false);
  }, [loanToEdit?.id, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || principal <= 0) return;
    if (!wallets.some(w => w.name === wallet)) { void submission.submit(() => Promise.resolve({ ok: false, error: 'Selecciona una cartera válida para el préstamo.' }), () => {}); return; }

    if(!partidas.some(p=>p.code===code)&&loanToEdit?.code!==code){void submission.submit(()=>Promise.resolve({ok:false,error:'Selecciona una partida activa para el préstamo.'}),()=>{});return;}
    const savedLoan: Loan = {
      id: loanToEdit?.id || `loan-${Date.now()}`,
      name: name.trim(),
      entity: entity.trim() || 'Entidad financiera',
      principal: Math.max(0, principal),
      interestRate: Math.max(0, interestRate),
      totalTermMonths: Math.max(1, totalTermMonths),
      startDate,
      monthlyPayment: Math.max(0, monthlyPayment),
      wallet,
      code: code.trim(),
      notes: notes.trim(),
    };

    void submission.submit(() => onSaveLoan(savedLoan), onClose);
  };

  return (
    <>
    <Overlay title={uiText("loan.prestamo")} onClose={() => submission.close(onClose)}>
      <div role="dialog" aria-modal="true" aria-label={uiText("loan.prestamo")} className="bg-[#141926] border border-white/10 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-xs space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEditing ? uiText("loan.editar_deuda_o_prestamo") : uiText("loan.nuevo_prestamo_o_credito")}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isEditing
                  ? uiText("loan.modifica_las_condiciones_cuotas_y_datos_de_la_deuda")
                  : uiText("loan.registra_un_prestamo_personal_hipoteca_o_credito")}
              </p>
            </div>
          </div>
          <button
            aria-label={uiText("loan.cerrar_prestamo")} onClick={() => submission.close(onClose)} disabled={submission.saving}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} aria-busy={submission.saving}>
          <fieldset disabled={submission.saving} className="space-y-3.5">
          {submission.error && <p role="alert" className="text-amber-300">{submission.error}</p>}
          {submission.saving && <p role="status" className="text-sky-300">{uiText("transfer.guardando")}</p>}
          {/* Name & Entity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">{uiText("loan.nombre_de_la_deuda")}</label>
              <input
                type="text"
                required
                placeholder={uiText("loan.ej_prestamo_coche_hipoteca")}
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">{uiText("loan.entidad_acreedora")}</label>
              <input
                type="text"
                placeholder={uiText("loan.ej_bbva_santander_cetelem")}
                value={entity}
                onChange={e => setEntity(e.target.value)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Principal & Monthly Payment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">{uiText("loan.capital_inicial")}</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  aria-label={uiText("loan.capital_inicial")} value={principal}
                  onChange={e => setPrincipal(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-sky-500 pr-7"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                  €
                </span>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">{uiText("loan.cuota_mensual")}</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  aria-label={uiText("loan.cuota_mensual")} value={monthlyPayment}
                  onChange={e => setMonthlyPayment(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-sky-500 pr-7"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                  €
                </span>
              </div>
            </div>
          </div>

          {/* Interest & Term */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">{uiText("loan.interes_tin_tae")}</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  aria-label={uiText("loan.interes_tin_tae")} value={interestRate}
                  onChange={e => setInterestRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500 pr-7"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                  %
                </span>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">{uiText("loan.plazo_total_meses")}</label>
              <input
                type="number"
                min="1"
                required
                aria-label={uiText("loan.plazo_total_meses")} value={totalTermMonths}
                onChange={e => setTotalTermMonths(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Start Date & Wallet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">{uiText("loan.fecha_de_inicio")}</label>
              <input
                type="date"
                required
                aria-label={uiText("loan.fecha_de_inicio")} value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">{uiText("loan.cuenta_habitual_de_cobro")}</label>
              <select
                aria-label={uiText("loan.cuenta_habitual_de_cobro")} required
                value={wallet}
                onChange={e => setWallet(e.target.value)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              >
                <option value="" disabled>{uiText("transfer.selecciona_una_cartera")}</option>{wallets.map(w => (
                  <option key={w.id} value={w.name} className="bg-[#141926] text-white">
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Partida code & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">{uiText("loan.partida_presupuestaria")}</label>
              <select
                aria-label={uiText("loan.partida_del_prestamo")}
                value={code}
                onChange={e => setCode(e.target.value)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              >
                <option value="" disabled>{uiText("loan.selecciona_una_partida")}</option>
                {loanToEdit&&!partidas.some(p=>p.code===loanToEdit.code)&&<option value={loanToEdit.code}>{uiText("loan.partida_historica_conservar")}</option>}
                {partidas.map(p=><option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">{uiText("loan.notas_referencia")}</label>
              <input
                type="text"
                placeholder={uiText("loan.ej_contrato_n_84920")}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {isEditing && onDeleteLoan && <button type="button" onClick={() => setConfirmDelete(true)} className="text-rose-300 py-2 flex gap-2 items-center"><I18nText id="loan.eliminar_esta_deuda_o_prestamo" values={{ trash2: (<Trash2 className="w-3.5 h-3.5" />) }} /></button>}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              aria-label={uiText("loan.cerrar_prestamo")} onClick={() => submission.close(onClose)} disabled={submission.saving}
              className="py-2.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 font-semibold transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isEditing ? uiText("loan.guardar_cambios") : uiText("loan.registrar_prestamo")}</span>
            </button>
          </div>
          </fieldset>
        </form>
      </div>
    </Overlay>
    {confirmDelete && loanToEdit && onDeleteLoan && <ConfirmDeleteDialog report={deletionReport(deletionData, { kind: 'loan', id: loanToEdit.id })}
      onCancel={() => setConfirmDelete(false)} onConfirm={async () => { const result = await onDeleteLoan(loanToEdit.id); if (result.ok) onClose(); return result; }} />}
    </>
  );
};

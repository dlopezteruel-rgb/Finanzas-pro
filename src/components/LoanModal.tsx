import React, { useState, useEffect } from 'react';
import { Loan, Wallet } from '../types/finance';
import { formatCurrency } from '../utils/finance';
import { X, CreditCard, Trash2, Check, Landmark, Calendar } from 'lucide-react';

interface LoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanToEdit?: Loan | null;
  wallets: Wallet[];
  onSaveLoan: (loan: Loan) => void;
  onDeleteLoan?: (loanId: string) => void;
}

export const LoanModal: React.FC<LoanModalProps> = ({
  isOpen,
  onClose,
  loanToEdit,
  wallets,
  onSaveLoan,
  onDeleteLoan,
}) => {
  const isEditing = !!loanToEdit;

  const [name, setName] = useState(loanToEdit?.name || '');
  const [entity, setEntity] = useState(loanToEdit?.entity || '');
  const [principal, setPrincipal] = useState<number>(loanToEdit?.principal || 10000);
  const [interestRate, setInterestRate] = useState<number>(loanToEdit?.interestRate || 5.0);
  const [totalTermMonths, setTotalTermMonths] = useState<number>(loanToEdit?.totalTermMonths || 36);
  const [startDate, setStartDate] = useState(
    loanToEdit?.startDate || new Date().toISOString().split('T')[0]
  );
  const [monthlyPayment, setMonthlyPayment] = useState<number>(loanToEdit?.monthlyPayment || 300);
  const [wallet, setWallet] = useState(loanToEdit?.wallet || wallets[0]?.name || 'OPENBANK');
  const [code, setCode] = useState(loanToEdit?.code || 'E.002.001');
  const [notes, setNotes] = useState(loanToEdit?.notes || '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (loanToEdit) {
      setName(loanToEdit.name);
      setEntity(loanToEdit.entity);
      setPrincipal(loanToEdit.principal);
      setInterestRate(loanToEdit.interestRate);
      setTotalTermMonths(loanToEdit.totalTermMonths);
      setStartDate(loanToEdit.startDate);
      setMonthlyPayment(loanToEdit.monthlyPayment);
      setWallet(loanToEdit.wallet);
      setCode(loanToEdit.code || 'E.002.001');
      setNotes(loanToEdit.notes || '');
    } else {
      setName('');
      setEntity('');
      setPrincipal(10000);
      setInterestRate(5.0);
      setTotalTermMonths(36);
      setStartDate(new Date().toISOString().split('T')[0]);
      setMonthlyPayment(300);
      setWallet(wallets[0]?.name || 'OPENBANK');
      setCode('E.002.001');
      setNotes('');
    }
    setConfirmDelete(false);
  }, [loanToEdit, isOpen, wallets]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || principal <= 0) return;

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
      code: code.trim() || 'E.002.001',
      notes: notes.trim(),
    };

    onSaveLoan(savedLoan);
    onClose();
  };

  const handleDelete = () => {
    if (!loanToEdit || !onDeleteLoan) return;
    onDeleteLoan(loanToEdit.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-[#141926] border border-white/10 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-xs space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEditing ? 'Editar Deuda o Préstamo' : 'Nuevo Préstamo o Crédito'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isEditing
                  ? 'Modifica las condiciones, cuotas y datos de la deuda'
                  : 'Registra un préstamo personal, hipoteca o crédito'}
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

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Name & Entity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Nombre de la deuda</label>
              <input
                type="text"
                required
                placeholder="ej. Préstamo Coche, Hipoteca..."
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Entidad acreedora</label>
              <input
                type="text"
                placeholder="ej. BBVA, Santander, Cetelem..."
                value={entity}
                onChange={e => setEntity(e.target.value)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Principal & Monthly Payment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Capital inicial (€)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  value={principal}
                  onChange={e => setPrincipal(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-sky-500 pr-7"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                  €
                </span>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Cuota mensual (€)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  value={monthlyPayment}
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
              <label className="block text-slate-400 mb-1 font-medium">Interés TIN/TAE (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={interestRate}
                  onChange={e => setInterestRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500 pr-7"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                  %
                </span>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Plazo total (meses)</label>
              <input
                type="number"
                min="1"
                required
                value={totalTermMonths}
                onChange={e => setTotalTermMonths(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Start Date & Wallet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Fecha de inicio</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Cuenta habitual de cobro</label>
              <select
                value={wallet}
                onChange={e => setWallet(e.target.value)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              >
                {wallets.map(w => (
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
              <label className="block text-slate-400 mb-1 font-medium">Partida presupuestaria</label>
              <select
                value={code}
                onChange={e => setCode(e.target.value)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              >
                <option value="E.002.001">E.002.001 · Cuotas de préstamos personales</option>
                <option value="E.002.002">E.002.002 · Cuotas de tarjetas de crédito</option>
                <option value="E.002.003">E.002.003 · Devoluciones de deuda entre particulares</option>
                <option value="F.001.001">F.001.001 · Hipoteca de vivienda habitual</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Notas / Referencia</label>
              <input
                type="text"
                placeholder="ej. Contrato nº 84920"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Delete Option (only when editing) */}
          {isEditing && onDeleteLoan && (
            <div className="pt-2 border-t border-white/[0.06]">
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1.5 font-semibold cursor-pointer py-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar esta deuda o préstamo</span>
                </button>
              ) : (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 space-y-2">
                  <p className="text-[11px] text-rose-300">
                    ¿Seguro que deseas eliminar la deuda <strong>{loanToEdit.name}</strong>? Los pagos registrados previamente no se borrarán.
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
              <span>{isEditing ? 'Guardar Cambios' : 'Registrar Préstamo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

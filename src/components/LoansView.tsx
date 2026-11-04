import type { FinanceData } from '../utils/backup';
import { SaveResult } from '../utils/saveResult';
import React, { useState } from 'react';
import { Loan, Transaction, Wallet } from '../types/finance';
import { formatCurrency, calculateLoanStatus } from '../utils/finance';
import { CreditCard, Plus, CheckCircle2, ShieldCheck, ChevronRight, X, Edit2 } from 'lucide-react';
import { LoanModal } from './LoanModal';

interface LoansViewProps {
  deletionData: FinanceData;
  loans: Loan[];
  transactions: Transaction[];
  wallets: Wallet[];
  onAddLoan: (loan: Loan) => Promise<SaveResult>;
  onUpdateLoan: (loan: Loan) => Promise<SaveResult>;
  onDeleteLoan?: (loanId: string) => Promise<SaveResult>;
  onPayInstallment: (loan: Loan) => void;
}

export const LoansView: React.FC<LoansViewProps> = ({
  deletionData,
  loans,
  transactions,
  wallets,
  onAddLoan,
  onUpdateLoan,
  onDeleteLoan,
  onPayInstallment,
}) => {
  const [selectedLoanToEdit, setSelectedLoanToEdit] = useState<Loan | null>(null);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);

  const handleOpenAdd = () => {
    setSelectedLoanToEdit(null);
    setIsLoanModalOpen(true);
  };

  const handleOpenEdit = (loan: Loan) => {
    setSelectedLoanToEdit(loan);
    setIsLoanModalOpen(true);
  };

  const handleSaveLoan = (loan: Loan) => {
    if (selectedLoanToEdit) {
      return onUpdateLoan(loan);
    } else {
      return onAddLoan(loan);
    }
  };

  const loanStatuses = loans.map(l => calculateLoanStatus(l, transactions));
  const totalPending = loanStatuses.reduce((s, st) => s + st.saldoPendienteReal, 0);
  const totalPaid = loanStatuses.reduce((s, st) => s + st.totalPagadoReal, 0);
  const totalMonthly = loans.reduce((s, l) => s + l.monthlyPayment, 0);

  return (
    <div className="space-y-4 pb-16 md:pb-6 animate-fadeIn">
      {/* 1. Top Summary Banner */}
      <div className="bg-[#141926] border border-white/[0.06] rounded-3xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div>
          <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">
            Saldo Pendiente Real Total (Deudas Activas)
          </span>
          <div className="text-2xl sm:text-3xl font-black font-mono text-rose-400 mt-0.5">
            {formatCurrency(totalPending)}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
            <span>
              Amortizado: <strong className="text-emerald-400 font-mono">{formatCurrency(totalPaid)}</strong>
            </span>
            <span>•</span>
            <span>
              Cuotas mes: <strong className="text-white font-mono">{formatCurrency(totalMonthly)}</strong>
            </span>
            <span>•</span>
            <span className="text-sky-400 font-medium">Clica en cualquier deuda para editarla</span>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs px-3.5 py-2.5 rounded-2xl shadow transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nuevo Préstamo</span>
        </button>
      </div>

      {/* 2. Loans Cards (Click to edit) */}
      <div className="space-y-3">
        {loans.length === 0 ? (
          <div className="bg-[#141926] border border-white/[0.06] rounded-3xl p-8 text-center text-slate-400 space-y-2">
            <CreditCard className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
            <h4 className="font-bold text-white text-sm">No tienes préstamos ni deudas registradas</h4>
            <p className="text-xs text-slate-500">
              Añade tus préstamos personales, hipotecas o créditos para hacer seguimiento de amortización.
            </p>
          </div>
        ) : (
          loans.map(loan => {
            const status = calculateLoanStatus(loan, transactions);
            return (
              <div
                key={loan.id}
                onClick={() => handleOpenEdit(loan)}
                className="bg-[#141926] border border-white/[0.06] hover:border-sky-500/40 rounded-3xl p-4 sm:p-5 space-y-3.5 transition-all cursor-pointer group shadow-sm hover:shadow-sky-500/5 relative"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-white group-hover:text-sky-300 transition-colors">
                          {loan.name}
                        </h3>
                        <span className="text-[10px] bg-white/[0.05] text-sky-400 font-mono px-1.5 py-0.5 rounded border border-white/[0.08]">
                          [{loan.code}]
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {loan.entity} • {loan.interestRate}% TIN/TAE
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">
                        Saldo Pendiente
                      </span>
                      <span className="text-sm sm:text-base font-black font-mono text-rose-400">
                        {formatCurrency(status.saldoPendienteReal)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleOpenEdit(loan);
                      }}
                      className="p-1.5 rounded-xl bg-white/[0.04] group-hover:bg-sky-500/10 text-slate-400 group-hover:text-sky-400 border border-white/[0.06] group-hover:border-sky-500/30 transition-colors cursor-pointer"
                      title="Editar deuda o préstamo" aria-label={`Editar deuda o préstamo ${loan.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1 font-mono">
                    <span>Amortización: {status.progresoPorcentaje}%</span>
                    <span>
                      {status.cuotasRealesTramitadas} de {loan.totalTermMonths} cuotas pagadas
                    </span>
                  </div>
                  <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full transition-all"
                      style={{ width: `${status.progresoPorcentaje}%` }}
                    />
                  </div>
                </div>

                {/* Footer strip: Payment Action */}
                <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.06] text-xs">
                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    <span>
                      Cobro: <strong className="text-slate-200">{loan.wallet}</strong>
                    </span>
                    <span>•</span>
                    <span className={status.alDia ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                      {status.alDia ? '✓ Al día' : '⚠ Revisar cuota'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onPayInstallment(loan);
                    }}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 font-bold text-xs px-3 py-1.5 rounded-xl border border-emerald-500/30 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Pagar Cuota ({formatCurrency(loan.monthlyPayment)})</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit / Create Loan Modal */}
      <LoanModal
        deletionData={deletionData}
        isOpen={isLoanModalOpen}
        onClose={() => {
          setIsLoanModalOpen(false);
          setSelectedLoanToEdit(null);
        }}
        loanToEdit={selectedLoanToEdit}
        wallets={wallets}
        onSaveLoan={handleSaveLoan}
        onDeleteLoan={onDeleteLoan}
      />
    </div>
  );
};

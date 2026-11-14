import {useCatalogNames} from '../i18n/catalogNames';
import { useI18n, I18nText } from "../i18n";
import type {BudgetPartida} from '../types/finance';
import { SaveResult } from '../utils/saveResult';
import React from 'react';
import {
  Plus,
  ArrowRight,
  TrendingUp,
  PieChart,
  CreditCard,
  Landmark,
  AlertCircle,
  Utensils,
  Car,
  Home,
  Briefcase,
  BookOpen,
  Sparkles,
  ShoppingBag,
  Zap,
  CheckCircle,
  Clock
} from 'lucide-react';
import { MonthlySummary, Transaction, MonthlyBudgetRow, Loan, Wallet, BudgetSubitem } from '../types/finance';
import { calculateLoanStatus } from '../utils/finance';
import { QuickNaturalLanguageInput } from './QuickNaturalLanguageInput';

interface DashboardViewProps {
  classificationPartidas:BudgetPartida[];
  charts: React.ReactNode;
  summary: MonthlySummary;
  budgetRows: MonthlyBudgetRow[];
  transactions: Transaction[];
  loans: Loan[];
  wallets: Wallet[];
  subitems?:BudgetSubitem[];
  defaultWalletId?: string | null;
  walletBalances: Record<string, number>;
  onAddTransaction: (t: Omit<Transaction, 'id'>) => Promise<SaveResult>;
  onToggleProcessed: (id: string) => void;
  onNavigateToTab: (tab: any) => void;
  onOpenNewTransaction: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  charts,classificationPartidas,
  summary,
  budgetRows,
  transactions,
  loans,
  wallets,
  defaultWalletId,subitems,
  walletBalances,
  onAddTransaction,
  onToggleProcessed,
  onNavigateToTab,
  onOpenNewTransaction,
}) => {
  const { t: uiText, tn: uiCount , formatMoney: formatCurrency,formatDate,formatPercent } = useI18n();
  const catalogNames=useCatalogNames();
  const totalLiquid = wallets.filter(w=>w.type!=='INVESTMENT').reduce((sum,w)=>sum+(walletBalances[w.name]??0),0);

  // Filter latest transactions
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  // Loans debt total
  const totalPendingDebt = loans.reduce((sum, l) => {
    const status = calculateLoanStatus(l, transactions);
    return sum + status.saldoPendienteReal;
  }, 0);

  // Active budget alerts
  const exceededRows = budgetRows.filter(r => r.type === 'GASTO' && r.status === 'exceeded' && r.previsto > 0);
  const warningRows = budgetRows.filter(r => r.type === 'GASTO' && r.status === 'warning' && r.previsto > 0);

  // Get icon for transaction category
  const getCategoryIcon = (code: string, type: string) => {
    if (type === 'INGRESO') return <Briefcase className="w-4 h-4 text-emerald-400" />;
    if (code.startsWith('V.001')) return <Utensils className="w-4 h-4 text-amber-400" />;
    if (code.startsWith('V.002')) return <Car className="w-4 h-4 text-blue-400" />;
    if (code.startsWith('F.001')) return <Home className="w-4 h-4 text-rose-400" />;
    if (code.startsWith('E.002')) return <CreditCard className="w-4 h-4 text-indigo-400" />;
    if (code.startsWith('D.001')) return <BookOpen className="w-4 h-4 text-purple-400" />;
    if (code.startsWith('P.003')) return <ShoppingBag className="w-4 h-4 text-pink-400" />;
    return <Zap className="w-4 h-4 text-cyan-400" />;
  };

  return (
    <div className="dashboard-view">
      <h1 className="module-title">{uiText("dashboard.inicio")}</h1>
      {/* 1. Revolut Hero Balance Header */}
      <div className="home-hero text-center pt-2 pb-1 space-y-1">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">{uiText("dashboard.saldo_liquido_actual")}</span>
        <div className="text-3xl sm:text-4xl font-black tracking-tight text-white font-mono">
          {formatCurrency(totalLiquid)}
        </div>
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <span>{uiText("dashboard.balance_real_mes")}</span>
          <span className={`font-bold font-mono ${summary.balanceReal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {summary.balanceReal >= 0 ? '+' : ''}{formatCurrency(summary.balanceReal)}
          </span>
          <span className="text-[11px] text-slate-400">{uiText('dashboard.savingsPercentage',{rate:formatPercent(summary.tasaAhorroReal)})}</span>
        </div>
      </div>

      {/* 2. Revolut Circular Action Buttons */}
      <div className="home-actions flex items-center justify-center gap-4 sm:gap-6 pt-1">
        {/* Add Movement */}
        <button
          onClick={onOpenNewTransaction}
          className="flex flex-col items-center gap-1.5 group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-white text-slate-950 flex items-center justify-center shadow-lg group-hover:scale-105 active:scale-95 transition-all">
            <Plus className="w-5 h-5 stroke-[2.8]" />
          </div>
          <span className="text-[11px] font-semibold text-slate-300 group-hover:text-white">{uiText("dashboard.anadir")}</span>
        </button>

        {/* Budgets / Analytics */}
        <button
          onClick={() => onNavigateToTab('budgets')}
          className="flex flex-col items-center gap-1.5 group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-[#181f30] text-sky-400 flex items-center justify-center border border-white/[0.08] group-hover:bg-[#1f293d] group-hover:scale-105 active:scale-95 transition-all">
            <PieChart className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span className="text-[11px] font-semibold text-slate-300 group-hover:text-white">{uiText("dashboard.presupuesto")}</span>
        </button>

        {/* Loans */}
        <button
          onClick={() => onNavigateToTab('loans')}
          className="flex flex-col items-center gap-1.5 group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-[#181f30] text-indigo-400 flex items-center justify-center border border-white/[0.08] group-hover:bg-[#1f293d] group-hover:scale-105 active:scale-95 transition-all">
            <CreditCard className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span className="text-[11px] font-semibold text-slate-300 group-hover:text-white">{uiText("dashboard.deudas")}</span>
        </button>

        {/* Wallets */}
        <button
          onClick={() => onNavigateToTab('wallets')}
          className="flex flex-col items-center gap-1.5 group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-[#181f30] text-emerald-400 flex items-center justify-center border border-white/[0.08] group-hover:bg-[#1f293d] group-hover:scale-105 active:scale-95 transition-all">
            <Landmark className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span className="text-[11px] font-semibold text-slate-300 group-hover:text-white">{uiText("dashboard.cuentas")}</span>
        </button>
      </div>

      {/* 3. Revolut Quick Search / NLP Input */}
      <div className="home-quick"><QuickNaturalLanguageInput partidas={classificationPartidas} subitems={subitems} wallets={wallets} defaultWalletId={defaultWalletId} onAddTransaction={onAddTransaction} /></div>

      {/* 4. Revolut Compact Widget Cards (Horizontal / Grid) */}
      <div className="home-kpis grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Widget 1: Presupuesto Restante */}
        <div
          onClick={() => onNavigateToTab('budgets')}
          className="bg-[#141926] hover:bg-[#181f30] border border-white/[0.06] rounded-2xl p-3.5 flex flex-col justify-between transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{uiText("dashboard.presupuesto_restante")}</span>
            <span className="text-sky-400 font-bold">{uiText("dashboard.detalle")}</span>
          </div>
          <div className="my-1.5">
            <span className={`text-xl font-black font-mono ${summary.restoTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {summary.restoTotal >= 0 ? '+' : ''}{formatCurrency(summary.restoTotal)}
            </span>
            <span className="text-[10px] text-slate-400 block">{uiText("dashboard.resto_previsto_ejecutado")}</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className={`h-full rounded-full ${summary.restoTotal < 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}
              style={{
                width: `${Math.min(100, Math.round((summary.gastosEjecutados / (summary.gastosPrevistos || 1)) * 100))}%`,
              }}
            />
          </div>
        </div>

        {/* Widget 2: Balance Previsto vs Real */}
        <div
          onClick={() => onNavigateToTab('budgets')}
          className="bg-[#141926] hover:bg-[#181f30] border border-white/[0.06] rounded-2xl p-3.5 flex flex-col justify-between transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{uiText("dashboard.balance_previsto")}</span>
            <span className="text-slate-400 font-mono text-[10px]">{formatCurrency(summary.balancePrevisto)}</span>
          </div>
          <div className="my-1.5">
            <span className="text-xl font-black font-mono text-white">
              {formatCurrency(summary.balanceReal)}
            </span>
            <span className="text-[10px] text-emerald-400 font-medium block"><I18nText id="dashboard.ingr_gast" values={{ ingresosReales: (formatCurrency(summary.ingresosReales)), gastosEjecutados: (formatCurrency(summary.gastosEjecutados)) }} /></span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-white/[0.04]">
            <span>{uiText("dashboard.desviacion")}</span>
            <span className={`font-bold ${summary.balanceReal >= summary.balancePrevisto ? 'text-emerald-400' : 'text-amber-400'}`}>
              {summary.balanceReal >= summary.balancePrevisto ? '+' : ''}{formatCurrency(summary.balanceReal - summary.balancePrevisto)}
            </span>
          </div>
        </div>

        {/* Widget 3: Deudas Activas */}
        <div
          onClick={() => onNavigateToTab('loans')}
          className="bg-[#141926] hover:bg-[#181f30] border border-white/[0.06] rounded-2xl p-3.5 flex flex-col justify-between transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{uiText("dashboard.deuda_pendiente_real")}</span>
            <span className="text-indigo-400 font-bold">{uiCount("loans",loans.length)}</span>
          </div>
          <div className="my-1.5">
            <span className="text-xl font-black font-mono text-rose-400">
              {formatCurrency(totalPendingDebt)}
            </span>
            <span className="text-[10px] text-slate-400 block"><I18nText id="dashboard.cuota_mes" values={{ formatCurrency: (formatCurrency(loans.reduce((s, l) => s + l.monthlyPayment, 0))) }} /></span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-white/[0.04]">
            <span>{uiText("dashboard.estado_amortizacion")}</span>
            <span className="text-emerald-400 font-medium">{uiText("dashboard.tramitaciones_al_dia")}</span>
          </div>
        </div>
      </div>

      {/* 5. Compact Budget Alerts Strip (Revolut Style) */}
      {(exceededRows.length > 0 || warningRows.length > 0) && (
        <div className="home-alerts bg-[#1a141b] border border-rose-500/30 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="truncate">
              <span className="font-semibold text-rose-300 block">
                {exceededRows.length > 0 ? uiCount("overBudget",exceededRows.length) : uiCount("budgetAlert",warningRows.length)}
              </span>
              <span className="text-[11px] text-slate-400 truncate block">
                {exceededRows[0] ? uiText("dashboard.resto", { name: catalogNames.itemRef(exceededRows[0].type,exceededRows[0].code,exceededRows[0].name), resto: formatCurrency(exceededRows[0].resto) }) : uiText("dashboard.revisa_tus_gastos_previstos")}
              </span>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('budgets')}
            className="text-[11px] font-bold text-rose-300 hover:text-white shrink-0 px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/30 cursor-pointer"
          >{uiText("dashboard.ver")}</button>
        </div>
      )}

      <div className="home-charts">{charts}</div>
      {/* 6. Revolut-Style Transactions List */}
      <div className="home-recent bg-[#141926] border border-white/[0.06] rounded-2xl overflow-hidden shadow-sm">
        <div className="p-3.5 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">{uiText("dashboard.ultimos_movimientos")}</h2>
          <button
            onClick={() => onNavigateToTab('transactions')}
            className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
          ><I18nText id="dashboard.ver_todos" values={{ length: (transactions.length), arrowright: (<ArrowRight className="w-3.5 h-3.5" />) }} /></button>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {recentTransactions.map(t => (
            <div
              key={t.id}
              className="px-3.5 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
            >
              {/* Left: Icon & Title */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0">
                  {getCategoryIcon(t.code, t.type)}
                </div>
                <div className="truncate">
                  <span className="text-xs font-bold text-white block truncate" title={t.description}>
                    {t.description}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                    <span>{t.wallet}</span>
                    <span>•</span>
                    <span>{formatDate(t.date,{day:'2-digit',month:'2-digit'})}</span>
                  </div>
                </div>
              </div>

              {/* Right: Amount & Status Pill */}
              <div className="text-right shrink-0 space-y-1">
                <span className={`text-xs sm:text-sm font-bold font-mono block ${
                  t.type === 'INGRESO' ? 'text-emerald-400' : 'text-white'
                }`}>
                  {t.type === 'INGRESO' ? '+' : '-'}{formatCurrency(t.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleProcessed(t.id)}
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                    t.processed
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                  }`}
                  title={uiText("dashboard.alternar_estado_de_tramitacion")}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${t.processed ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span>{t.processed ? uiText("dashboard.tramitado") : uiText("dashboard.pendiente")}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

import { economicTransactions } from '../utils/transfers';
import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  CheckCircle,
  Clock,
  Trash2,
  Plus,
  Download,
  Utensils,
  Car,
  Home,
  Briefcase,
  BookOpen,
  ShoppingBag,
  Zap,
  CreditCard,
  Edit2
} from 'lucide-react';
import { Transaction } from '../types/finance';
import { formatCurrency } from '../utils/finance';

interface TransactionsViewProps {
  transactions: Transaction[];
  onToggleProcessed: (id: string) => void;
  onDeleteTransaction: (id: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onOpenNewTransaction: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  onToggleProcessed,
  onDeleteTransaction,
  onEditTransaction,
  onOpenNewTransaction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'GASTO' | 'INGRESO' | 'PENDING'>('ALL');
  const [selectedWallet, setSelectedWallet] = useState<string>('ALL');

  // Wallets set
  const wallets = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => set.add(t.wallet));
    return Array.from(set);
  }, [transactions]);

  // Filtered
  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterType === 'GASTO' && t.type !== 'GASTO') return false;
      if (filterType === 'INGRESO' && t.type !== 'INGRESO') return false;
      if (filterType === 'PENDING' && t.processed) return false;
      if (selectedWallet !== 'ALL' && t.wallet !== selectedWallet) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const mDesc = t.description.toLowerCase().includes(q);
        const mCode = t.code.toLowerCase().includes(q);
        const mSub = t.subcategoryName.toLowerCase().includes(q);
        const mWallet = t.wallet.toLowerCase().includes(q);
        const mAmount = t.amount.toString().includes(q);
        if (!mDesc && !mCode && !mSub && !mWallet && !mAmount) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterType, selectedWallet, searchTerm]);

  const totalIncomes = economicTransactions(transactions).filter(t => filtered.some(f => f.id === t.id))
    .filter(t => t.type === 'INGRESO' && t.processed)
    .reduce((s, t) => s + t.amount, 0);

  const totalExpenses = economicTransactions(transactions).filter(t => filtered.some(f => f.id === t.id))
    .filter(t => t.type === 'GASTO' && t.processed)
    .reduce((s, t) => s + t.amount, 0);

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

  const handleExportCSV = () => {
    const headers = ['Fecha', 'Tipo', 'Código', 'Grupo', 'Partida', 'Descripción', 'Cartera', 'Tramitado', 'Importe (€)'];
    const rows = filtered.map(t => [
      t.date,
      t.type,
      t.code,
      `"${t.categoryName}"`,
      `"${t.subcategoryName}"`,
      `"${t.description.replace(/"/g, '""')}"`,
      t.wallet,
      t.processed ? 'SÍ' : 'NO',
      t.amount.toFixed(2).replace('.', ','),
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `movimientos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 pb-16 md:pb-6">
      {/* Search & Top Action */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por concepto, partida (V.001), cartera..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-[#141926] border border-white/[0.08] focus:border-sky-500 rounded-2xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none"
          />
        </div>

        <button
          onClick={handleExportCSV}
          className="p-2.5 rounded-2xl bg-[#141926] border border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
          title="Descargar CSV"
          aria-label="Descargar CSV"
        >
          <Download className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenNewTransaction}
          className="bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs px-3.5 py-2.5 rounded-2xl shadow transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span className="hidden sm:inline">Nuevo</span>
        </button>
      </div>

      {/* Segmented Filter Pills (Revolut Style) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setFilterType('ALL')}
          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            filterType === 'ALL'
              ? 'bg-white text-slate-950 font-bold'
              : 'bg-white/[0.04] text-slate-400 hover:text-white border border-white/[0.06]'
          }`}
        >
          Todos ({transactions.length})
        </button>
        <button
          onClick={() => setFilterType('GASTO')}
          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            filterType === 'GASTO'
              ? 'bg-rose-500 text-white font-bold'
              : 'bg-white/[0.04] text-slate-400 hover:text-white border border-white/[0.06]'
          }`}
        >
          Gastos
        </button>
        <button
          onClick={() => setFilterType('INGRESO')}
          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            filterType === 'INGRESO'
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'bg-white/[0.04] text-slate-400 hover:text-white border border-white/[0.06]'
          }`}
        >
          Ingresos
        </button>
        <button
          onClick={() => setFilterType('PENDING')}
          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            filterType === 'PENDING'
              ? 'bg-amber-400 text-slate-950 font-bold'
              : 'bg-white/[0.04] text-slate-400 hover:text-white border border-white/[0.06]'
          }`}
        >
          Pendientes ({transactions.filter(t => !t.processed).length})
        </button>

        {/* Filter Wallet dropdown */}
        <select
          aria-label="Filtrar por cartera"
          value={selectedWallet}
          onChange={e => setSelectedWallet(e.target.value)}
          className="bg-white/[0.04] text-slate-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-white/[0.06] focus:outline-none cursor-pointer"
        >
          <option value="ALL" className="bg-[#141926]">Todas las carteras</option>
          {wallets.map(w => (
            <option key={w} value={w} className="bg-[#141926]">{w}</option>
          ))}
        </select>
      </div>

      {/* Filter Stats Mini Bar */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
        <span>{filtered.length} movimientos encontrados</span>
        <div className="flex items-center gap-3">
          <span>Ingr: <strong className="text-emerald-400 font-mono">+{formatCurrency(totalIncomes)}</strong></span>
          <span>Gast: <strong className="text-rose-400 font-mono">-{formatCurrency(totalExpenses)}</strong></span>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-[#141926] border border-white/[0.06] rounded-2xl overflow-hidden shadow-sm divide-y divide-white/[0.04]">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No se encontraron movimientos con los filtros aplicados.
          </div>
        ) : (
          filtered.map(t => (
            <div
              key={t.id}
              className="px-3.5 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
            >
              {/* Category Icon & Movement Details */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0">
                  {getCategoryIcon(t.code, t.type)}
                </div>

                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white truncate" title={t.description}>
                      {t.description}{t.transfer ? ' · Traspaso interno' : t.reimbursement ? ' · Reintegro (no ingreso económico)' : ''}
                    </span>
                    {t.splitInfo?.isShared && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold shrink-0">
                        Compartido ({formatCurrency(t.splitInfo.totalOwedToMe)})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                    <span className="font-mono text-sky-400 font-semibold">[{t.code}]</span>
                    <span>•</span>
                    <span className="truncate max-w-[120px]">{t.subcategoryName.split(':')[1] || t.subcategoryName}</span>
                    <span>•</span>
                    <span className="text-slate-300 font-semibold">{t.wallet}</span>
                    <span>•</span>
                    <span>{t.date.split('-').slice(1).reverse().join('/')}</span>
                  </div>
                </div>
              </div>

              {/* Amount, Processed Toggle, and Delete */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="text-right space-y-1">
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
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}
                    title={t.transfer ? "Alternar ambos extremos del traspaso" : "Alternar estado de tramitación"}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${t.processed ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span>{t.processed ? 'SÍ' : 'NO'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onEditTransaction(t)}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors cursor-pointer"
                  title="Editar movimiento"
                  aria-label={`Editar movimiento ${t.description}`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteTransaction(t.id)}
                  className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Eliminar movimiento"
                  aria-label="Eliminar movimiento"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { Wallet, Transaction } from '../types/finance';
import { formatCurrency } from '../utils/finance';
import {
  Landmark,
  Plus,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  Edit2,
  Calendar,
  Layers,
  History
} from 'lucide-react';
import { WalletModal } from './WalletModal';
import { TransferModal } from './TransferModal';

interface WalletsViewProps {
  wallets: Wallet[];
  walletBalances: Record<string, number>;
  transactions: Transaction[];
  onAddWallet: (wallet: Wallet) => void;
  onUpdateWallet: (wallet: Wallet) => void;
  onDeleteWallet?: (walletId: string) => void;
  onExecuteTransfer: (
    originWalletName: string,
    destWalletName: string,
    amount: number,
    date: string,
    concept?: string
  ) => void;
}

export const WalletsView: React.FC<WalletsViewProps> = ({
  wallets,
  walletBalances,
  transactions,
  onAddWallet,
  onUpdateWallet,
  onDeleteWallet,
  onExecuteTransfer,
}) => {
  const [selectedWalletToEdit, setSelectedWalletToEdit] = useState<Wallet | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  const totalLiquid = useMemo(() => {
    return Object.values(walletBalances).reduce((sum, b) => sum + b, 0);
  }, [walletBalances]);

  // Find transfers between accounts in transactions (concept includes 'Traspaso a' or 'Traspaso desde' or subcategory 'Traspaso entre cuentas')
  const transferTransactions = useMemo(() => {
    return transactions
      .filter(
        t =>
          t.description.toLowerCase().includes('traspaso') ||
          (t.subcategoryName && t.subcategoryName.toLowerCase().includes('traspaso'))
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [transactions]);

  const handleOpenAdd = () => {
    setSelectedWalletToEdit(null);
    setIsWalletModalOpen(true);
  };

  const handleOpenEdit = (wallet: Wallet) => {
    setSelectedWalletToEdit(wallet);
    setIsWalletModalOpen(true);
  };

  const handleSaveWallet = (wallet: Wallet) => {
    if (selectedWalletToEdit) {
      onUpdateWallet(wallet);
    } else {
      onAddWallet(wallet);
    }
  };

  return (
    <div className="space-y-4 pb-16 md:pb-6 animate-fadeIn">
      {/* Top Banner: Total Patrimony & Action Buttons */}
      <div className="bg-[#141926] border border-white/[0.06] rounded-3xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div>
          <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">
            Patrimonio Líquido Total en Cuentas
          </span>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-0.5">
            {formatCurrency(totalLiquid)}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            {wallets.length} {wallets.length === 1 ? 'cuenta activa' : 'cuentas activas'} • Clica en una cuenta para editar su patrimonio
          </span>
        </div>

        {/* Actions: Traspaso & Añadir Cuenta */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTransferModalOpen(true)}
            disabled={wallets.length < 2}
            className="bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 disabled:opacity-40 font-bold text-xs px-3.5 py-2.5 rounded-2xl shadow transition-all cursor-pointer flex items-center gap-2 active:scale-95"
            title="Mover dinero entre tus cuentas"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Ordenar Traspaso</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs px-3.5 py-2.5 rounded-2xl shadow transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nueva Cuenta</span>
          </button>
        </div>
      </div>

      {/* Wallets List (Click to edit patrimonio) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {wallets.map(w => {
          const currentBalance = walletBalances[w.name] ?? w.initialBalance;
          const walletTxs = transactions.filter(t => t.wallet === w.name && t.processed);
          const totalIn = walletTxs.filter(t => t.type === 'INGRESO').reduce((s, t) => s + t.amount, 0);
          const totalOut = walletTxs.filter(t => t.type === 'GASTO').reduce((s, t) => s + t.amount, 0);

          return (
            <div
              key={w.id}
              onClick={() => handleOpenEdit(w)}
              className="bg-[#141926] border border-white/[0.06] rounded-3xl p-4 sm:p-5 space-y-3.5 hover:border-sky-500/40 transition-all cursor-pointer group shadow-sm hover:shadow-sky-500/5 relative overflow-hidden"
            >
              {/* Top Accent Strip */}
              <div
                className="absolute top-0 left-0 right-0 h-1 opacity-70 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: w.color }}
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs text-slate-950 shadow-sm"
                    style={{ backgroundColor: w.color }}
                  >
                    {w.name.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white group-hover:text-sky-300 transition-colors">
                        {w.name}
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-300">
                        {w.type}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block font-mono">{w.ibanOrDetails}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handleOpenEdit(w);
                  }}
                  className="p-1.5 rounded-xl bg-white/[0.04] group-hover:bg-sky-500/10 text-slate-400 group-hover:text-sky-400 border border-white/[0.06] group-hover:border-sky-500/30 transition-colors cursor-pointer"
                  title="Editar cuenta y patrimonio"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Saldo Actual & Patrimonio Base */}
              <div className="bg-[#0c0f17] border border-white/[0.04] rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">
                    Saldo Actual
                  </span>
                  <span
                    className={`text-xl font-black font-mono ${
                      currentBalance >= 0 ? 'text-white' : 'text-rose-400'
                    }`}
                  >
                    {formatCurrency(currentBalance)}
                  </span>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-semibold">
                    Patrimonio Base
                  </span>
                  <span className="font-mono text-slate-300 font-bold">
                    {formatCurrency(w.initialBalance)}
                  </span>
                </div>
              </div>

              {/* Income/Expense summary for this wallet */}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/[0.04]">
                <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-semibold">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>+{formatCurrency(totalIn)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-rose-400 font-mono font-semibold">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>-{formatCurrency(totalOut)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Ordered Transfers History */}
      {transferTransactions.length > 0 && (
        <div className="bg-[#141926] border border-white/[0.06] rounded-3xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <History className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-bold text-xs sm:text-sm text-white">
                Traspasos Recientes entre Cuentas
              </h3>
            </div>
            <button
              onClick={() => setIsTransferModalOpen(true)}
              disabled={wallets.length < 2}
              className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Nuevo traspaso</span>
            </button>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {transferTransactions.map(tx => (
              <div
                key={tx.id}
                className="py-2.5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      tx.type === 'INGRESO'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-sky-500/15 text-sky-400'
                    }`}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <span className="font-bold text-white block truncate">
                      {tx.description}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                      <span>{tx.date}</span>
                      <span>•</span>
                      <span className="text-slate-300">{tx.wallet}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`font-black font-mono ${
                      tx.type === 'INGRESO' ? 'text-emerald-400' : 'text-slate-200'
                    }`}
                  >
                    {tx.type === 'INGRESO' ? '+' : '-'}
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit / Add Wallet Modal */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => {
          setIsWalletModalOpen(false);
          setSelectedWalletToEdit(null);
        }}
        walletToEdit={selectedWalletToEdit}
        currentCalculatedBalance={
          selectedWalletToEdit
            ? walletBalances[selectedWalletToEdit.name] ?? selectedWalletToEdit.initialBalance
            : undefined
        }
        onSaveWallet={handleSaveWallet}
        onDeleteWallet={onDeleteWallet}
      />

      {/* Transfer between Accounts Modal */}
      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        wallets={wallets}
        walletBalances={walletBalances}
        onExecuteTransfer={onExecuteTransfer}
      />
    </div>
  );
};

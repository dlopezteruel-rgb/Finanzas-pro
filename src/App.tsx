/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Transaction,
  BudgetPlan,
  BudgetGroup,
  BudgetPartida,
  Loan,
  Wallet,
  MovementType,
  MonthlyBudgetRow,
  Contact,
} from './types/finance';
import {
  calculateMonthlyBudgetRows,
  calculateMonthlySummary,
  calculateWalletBalances,
  formatCurrency,
} from './utils/finance';
import {
  INITIAL_TRANSACTIONS,
  INITIAL_BUDGET_PLANS,
  INITIAL_LOANS,
  INITIAL_WALLETS,
  INITIAL_CONTACTS,
} from './utils/seedData';
import { BUDGET_GROUPS } from './constants/categories';
import { Header } from './components/Header';
import { Navigation, NavTab } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { BudgetsView } from './components/BudgetsView';
import { LoansView } from './components/LoansView';
import { WalletsView } from './components/WalletsView';
import { ContactsView } from './components/ContactsView';
import { AssistantChatView } from './components/AssistantChatView';
import { TransactionModal } from './components/TransactionModal';
import { PartidaDetailModal } from './components/PartidaDetailModal';
import { ConfirmClearModal, ClearDataOptions } from './components/ConfirmClearModal';
import { SettleDebtModal, DebtItemToSettle } from './components/SettleDebtModal';
import { CreateContactModal } from './components/CreateContactModal';

const STORAGE_KEY_TXS = 'finanzas_pro_transactions_v2';
const STORAGE_KEY_PLANS = 'finanzas_pro_plans_v2';
const STORAGE_KEY_LOANS = 'finanzas_pro_loans_v2';
const STORAGE_KEY_WALLETS = 'finanzas_pro_wallets_v2';
const STORAGE_KEY_GROUPS = 'finanzas_pro_groups_v2';
const STORAGE_KEY_CONTACTS = 'finanzas_pro_contacts_v2';
const STORAGE_KEY_THEME = 'finanzas_pro_theme';

export default function App() {
  // 0. Theme State (Dark / Light Mode)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME);
      if (saved === 'dark' || saved === 'light') return saved;
      return 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY_THEME, theme);
    } catch {}
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // 1. Core State with LocalStorage Persistence
  const [budgetGroups, setBudgetGroups] = useState<BudgetGroup[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GROUPS);
      return saved ? JSON.parse(saved) : BUDGET_GROUPS;
    } catch {
      return BUDGET_GROUPS;
    }
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TXS);
      return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  const [budgetPlans, setBudgetPlans] = useState<BudgetPlan[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PLANS);
      return saved ? JSON.parse(saved) : INITIAL_BUDGET_PLANS;
    } catch {
      return INITIAL_BUDGET_PLANS;
    }
  });

  const [loans, setLoans] = useState<Loan[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOANS);
      return saved ? JSON.parse(saved) : INITIAL_LOANS;
    } catch {
      return INITIAL_LOANS;
    }
  });

  const [wallets, setWallets] = useState<Wallet[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WALLETS);
      return saved ? JSON.parse(saved) : INITIAL_WALLETS;
    } catch {
      return INITIAL_WALLETS;
    }
  });

  const [contacts, setContacts] = useState<Contact[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONTACTS);
      return saved ? JSON.parse(saved) : INITIAL_CONTACTS;
    } catch {
      return INITIAL_CONTACTS;
    }
  });

  // Current Month/Year period
  const [currentMonthYear, setCurrentMonthYear] = useState<string>('2026-10');
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [initialPartidaCodeForModal, setInitialPartidaCodeForModal] = useState<string | undefined>(undefined);
  const [initialContactIdForModal, setInitialContactIdForModal] = useState<string | undefined>(undefined);

  // Partida Detail Modal state
  const [isPartidaDetailOpen, setIsPartidaDetailOpen] = useState(false);
  const [selectedPartidaForDetail, setSelectedPartidaForDetail] = useState<BudgetPartida | null>(null);

  // Clear All Modal state
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  // Contacts & Settle Modals state
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [debtToSettle, setDebtToSettle] = useState<DebtItemToSettle | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(budgetGroups));
  }, [budgetGroups]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(budgetPlans));
  }, [budgetPlans]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LOANS, JSON.stringify(loans));
  }, [loans]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WALLETS, JSON.stringify(wallets));
  }, [wallets]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contacts));
  }, [contacts]);

  // Derived available periods
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add('2026-10');
    set.add('2026-11');
    set.add('2026-09');
    transactions.forEach(t => {
      const my = t.date.slice(0, 7);
      if (my) set.add(my);
    });
    return Array.from(set).sort().reverse();
  }, [transactions]);

  // Derived all partidas from groups
  const allPartidas = useMemo(() => {
    return budgetGroups.flatMap(g => g.partidas);
  }, [budgetGroups]);

  // Calculations:
  // - RESTO = PREVISTO - EJECUTADO
  // - Balance Mensual Real = INGRESOS REALES - GASTOS EJECUTADOS
  // - Balance Mensual Previsto = INGRESOS PREVISTOS - GASTOS PREVISTOS
  const summary = useMemo(() => {
    return calculateMonthlySummary(currentMonthYear, transactions, budgetPlans, allPartidas);
  }, [currentMonthYear, transactions, budgetPlans, allPartidas]);

  const budgetRows = useMemo(() => {
    return calculateMonthlyBudgetRows(currentMonthYear, transactions, budgetPlans, allPartidas);
  }, [currentMonthYear, transactions, budgetPlans, allPartidas]);

  const walletBalances = useMemo(() => {
    return calculateWalletBalances(wallets, transactions);
  }, [wallets, transactions]);

  const totalLiquidBalance = useMemo(() => {
    return Object.values(walletBalances).reduce((acc, curr) => acc + curr, 0);
  }, [walletBalances]);

  // Count pending transactions (processed: false)
  const pendingTransactionsCount = useMemo(() => {
    return transactions.filter(t => !t.processed).length;
  }, [transactions]);

  // Count pending shared debts
  const pendingDebtsCount = useMemo(() => {
    let count = 0;
    transactions.forEach(t => {
      if (t.splitInfo && t.splitInfo.participants) {
        t.splitInfo.participants.forEach(p => {
          if (!p.isPaid) count++;
        });
      }
    });
    return count;
  }, [transactions]);

  // Count exceeded budgets in the current period
  const exceededBudgetsCount = useMemo(() => {
    return budgetRows.filter(r => r.type === 'GASTO' && r.status === 'exceeded').length;
  }, [budgetRows]);

  // Find the selected budget row for the detail modal
  const selectedBudgetRow = useMemo(() => {
    if (!selectedPartidaForDetail) return null;
    return budgetRows.find(
      r => r.code === selectedPartidaForDetail.code && r.type === selectedPartidaForDetail.type
    ) || null;
  }, [selectedPartidaForDetail, budgetRows]);

  // 3. Transactions Handlers
  const handleSaveTransaction = (txData: Omit<Transaction, 'id'>, existingId?: string) => {
    if (existingId) {
      setTransactions(prev =>
        prev.map(t => (t.id === existingId ? { ...txData, id: existingId } : t))
      );
    } else {
      const newTx: Transaction = {
        ...txData,
        id: `tx-${Date.now()}`,
      };
      setTransactions(prev => [newTx, ...prev]);
    }
  };

  const handleToggleProcessed = (id: string) => {
    setTransactions(prev =>
      prev.map(t => (t.id === id ? { ...t, processed: !t.processed } : t))
    );
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const handleOpenEditTransaction = (tx: Transaction) => {
    setTransactionToEdit(tx);
    setInitialPartidaCodeForModal(tx.code);
    setInitialContactIdForModal(undefined);
    setIsTxModalOpen(true);
  };

  const handleOpenNewTransaction = (partidaCode?: string) => {
    setTransactionToEdit(null);
    setInitialPartidaCodeForModal(partidaCode);
    setInitialContactIdForModal(undefined);
    setIsTxModalOpen(true);
  };

  const handleOpenNewSharedTransaction = (preselectedContactId?: string) => {
    setTransactionToEdit(null);
    setInitialPartidaCodeForModal(undefined);
    setInitialContactIdForModal(preselectedContactId);
    setIsTxModalOpen(true);
  };

  // 4. Budget Plans & Partidas Actions
  const handleUpdateBudgetPlan = (code: string, type: MovementType, newAmount: number) => {
    setBudgetPlans(prev => {
      const filtered = prev.filter(
        p => !(p.monthYear === currentMonthYear && p.code === code && p.type === type)
      );
      if (newAmount === 0) return filtered;
      return [
        ...filtered,
        {
          monthYear: currentMonthYear,
          code,
          type,
          plannedAmount: newAmount,
        },
      ];
    });
  };

  const handleMovePartida = (groupCode: string, partidaIndex: number, direction: 'UP' | 'DOWN') => {
    setBudgetGroups(prevGroups => {
      return prevGroups.map(group => {
        if (group.code !== groupCode) return group;
        const targetIndex = direction === 'UP' ? partidaIndex - 1 : partidaIndex + 1;
        if (targetIndex < 0 || targetIndex >= group.partidas.length) return group;

        const newPartidas = [...group.partidas];
        const [moved] = newPartidas.splice(partidaIndex, 1);
        newPartidas.splice(targetIndex, 0, moved);
        return { ...group, partidas: newPartidas };
      });
    });
  };

  const handleDuplicatePartida = (partida: BudgetPartida) => {
    setBudgetGroups(prevGroups => {
      return prevGroups.map(group => {
        if (group.code !== partida.groupCode) return group;
        const original = group.partidas.find(p => p.code === partida.code);
        if (!original) return group;

        const baseNum = parseInt(original.code.split('.').pop() || '1', 10);
        let nextNum = baseNum + 1;
        let newCode = `${original.code.split('.').slice(0, 2).join('.')}.${String(nextNum).padStart(3, '0')}`;
        while (group.partidas.some(p => p.code === newCode)) {
          nextNum++;
          newCode = `${original.code.split('.').slice(0, 2).join('.')}.${String(nextNum).padStart(3, '0')}`;
        }

        const duplicated: BudgetPartida = {
          ...original,
          code: newCode,
          name: `${original.name} (Copia)`,
          keywords: [...original.keywords],
        };

        const index = group.partidas.findIndex(p => p.code === partida.code);
        const newPartidas = [...group.partidas];
        newPartidas.splice(index + 1, 0, duplicated);
        return { ...group, partidas: newPartidas };
      });
    });
  };

  const handleChangePartidaGroup = (
    partida: BudgetPartida,
    targetGroupCode: string
  ) => {
    const currentGroupCode = partida.groupCode;
    const sourceGroup = budgetGroups.find(g => g.code === currentGroupCode);
    const targetGroup = budgetGroups.find(g => g.code === targetGroupCode);
    if (!sourceGroup || !targetGroup) return;

    const oldType = partida.type;
    const newType = targetGroup.type;

    const updatedPartida: BudgetPartida = {
      ...partida,
      groupCode: targetGroup.code,
      groupName: targetGroup.name,
      type: newType,
    };

    setBudgetGroups(prevGroups => {
      return prevGroups.map(g => {
        if (g.code === currentGroupCode) {
          return {
            ...g,
            partidas: g.partidas.filter(p => p.code !== partida.code),
          };
        }
        if (g.code === targetGroupCode) {
          return {
            ...g,
            partidas: [...g.partidas, updatedPartida],
          };
        }
        return g;
      });
    });

    if (oldType !== newType) {
      setBudgetPlans(prev =>
        prev.map(plan => {
          if (plan.code === partida.code && plan.type === oldType) {
            return { ...plan, type: newType };
          }
          return plan;
        })
      );
      setTransactions(prev =>
        prev.map(tx => {
          if (tx.code === partida.code && tx.type === oldType) {
            return {
              ...tx,
              type: newType,
              categoryName: targetGroup.name,
            };
          }
          return tx;
        })
      );
    }
  };

  // Inspect detail of a partida
  const handleSelectPartidaToView = (partida: BudgetPartida, _row?: MonthlyBudgetRow) => {
    setSelectedPartidaForDetail(partida);
    setIsPartidaDetailOpen(true);
  };

  const handleAddMovementToPartida = (partidaCode: string, _type: MovementType) => {
    handleOpenNewTransaction(partidaCode);
  };

  // 5. Contacts & Shared Expenses Handlers
  const handleOpenCreateContact = (contact?: Contact | null) => {
    setContactToEdit(contact || null);
    setIsContactModalOpen(true);
  };

  const handleSaveContact = (contact: Contact) => {
    setContacts(prev => {
      const exists = prev.some(c => c.id === contact.id);
      if (exists) {
        return prev.map(c => (c.id === contact.id ? contact : c));
      }
      return [contact, ...prev];
    });
  };

  const handleDeleteContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const handleOpenSettleDebt = (debtItem: DebtItemToSettle) => {
    setDebtToSettle(debtItem);
    setIsSettleModalOpen(true);
  };

  const handleConfirmSettleDebt = (
    debtItem: DebtItemToSettle,
    walletName: string,
    settleDate: string,
    createIncomeTx: boolean
  ) => {
    const reimbursementId = `tx-reintegro-${Date.now()}`;

    // 1. Mark participant as settled in original transaction
    setTransactions(prev =>
      prev.map(tx => {
        if (tx.id !== debtItem.transactionId || !tx.splitInfo) return tx;
        const updatedParticipants = tx.splitInfo.participants.map(p => {
          if (
            p.contactId === debtItem.participant.contactId ||
            p.contactName.toLowerCase() === debtItem.participant.contactName.toLowerCase()
          ) {
            return {
              ...p,
              isPaid: true,
              paidDate: settleDate,
              reimbursementTxId: createIncomeTx ? reimbursementId : undefined,
            };
          }
          return p;
        });

        return {
          ...tx,
          splitInfo: {
            ...tx.splitInfo,
            participants: updatedParticipants,
          },
        };
      })
    );

    // 2. Generate income movement for repayment
    if (createIncomeTx) {
      const newIncomeTx: Transaction = {
        id: reimbursementId,
        date: settleDate,
        amount: debtItem.participant.amount,
        type: 'INGRESO',
        code: debtItem.transactionCode, // Imputado a la misma partida que financiaste
        categoryName: debtItem.transactionCategory,
        subcategoryName: debtItem.transactionSubcategory,
        description: `Reintegro ${debtItem.contact.name}: ${debtItem.transactionDescription}`,
        wallet: walletName,
        processed: true,
        notes: `Reintegro por deuda compartida saldada (${formatCurrency(debtItem.participant.amount)})`,
      };
      setTransactions(prev => [newIncomeTx, ...prev]);
    }
  };

  // 6. Loans & Wallets Actions
  const handleAddLoan = (newLoan: Loan) => {
    setLoans(prev => [...prev, newLoan]);
  };

  const handlePayLoanInstallment = (loan: Loan) => {
    const newTx: Transaction = {
      id: `tx-loan-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      amount: loan.monthlyPayment,
      type: 'GASTO',
      code: loan.code || 'E.002.001',
      categoryName: 'ECONÓMICOS - Créditos y Préstamos',
      subcategoryName: 'Créditos: Cuotas de préstamos personales',
      description: `Cuota mensual: ${loan.name}`,
      wallet: loan.wallet,
      processed: true, // Tramitado: SÍ
      loanId: loan.id,
      notes: `Pago registrado de préstamo ${loan.entity}`,
    };
    setTransactions(prev => [newTx, ...prev]);
  };

  const handleUpdateLoan = (updatedLoan: Loan) => {
    setLoans(prev => prev.map(l => (l.id === updatedLoan.id ? updatedLoan : l)));
  };

  const handleDeleteLoan = (loanId: string) => {
    setLoans(prev => prev.filter(l => l.id !== loanId));
  };

  const handleAddWallet = (newWallet: Wallet) => {
    setWallets(prev => [...prev, newWallet]);
  };

  const handleUpdateWallet = (updatedWallet: Wallet) => {
    setWallets(prev => prev.map(w => (w.id === updatedWallet.id ? updatedWallet : w)));
  };

  const handleDeleteWallet = (walletId: string) => {
    setWallets(prev => prev.filter(w => w.id !== walletId));
  };

  const handleExecuteTransfer = (
    originWalletName: string,
    destWalletName: string,
    amount: number,
    date: string,
    concept?: string
  ) => {
    const timestamp = Date.now();
    const outTx: Transaction = {
      id: `tx-traspaso-out-${timestamp}`,
      date,
      amount,
      type: 'GASTO',
      code: 'F.003.001',
      categoryName: 'FINANCIEROS',
      subcategoryName: 'Traspaso entre cuentas',
      description: `Traspaso a ${destWalletName}${concept ? `: ${concept}` : ''}`,
      wallet: originWalletName,
      processed: true,
      notes: `Traspaso ordenado hacia ${destWalletName}`,
    };

    const inTx: Transaction = {
      id: `tx-traspaso-in-${timestamp + 1}`,
      date,
      amount,
      type: 'INGRESO',
      code: 'F.003.001',
      categoryName: 'FINANCIEROS',
      subcategoryName: 'Traspaso entre cuentas',
      description: `Traspaso desde ${originWalletName}${concept ? `: ${concept}` : ''}`,
      wallet: destWalletName,
      processed: true,
      notes: `Traspaso recibido desde ${originWalletName}`,
    };

    setTransactions(prev => [outTx, inTx, ...prev]);
  };

  const handleUpdateDebtAmount = (transactionId: string, contactId: string, newAmount: number) => {
    setTransactions(prev =>
      prev.map(tx => {
        if (tx.id !== transactionId || !tx.splitInfo) return tx;
        const updatedParticipants = tx.splitInfo.participants.map(p => {
          if (p.contactId === contactId) {
            return { ...p, amount: newAmount };
          }
          return p;
        });
        const newTotalOwed = updatedParticipants
          .filter(p => !p.isPaid)
          .reduce((sum, p) => sum + p.amount, 0);
        return {
          ...tx,
          splitInfo: {
            ...tx.splitInfo,
            participants: updatedParticipants,
            totalOwedToMe: newTotalOwed,
          },
        };
      })
    );
  };

  // 7. Clear Selected Data & Reset Actions
  const handleOpenClearModal = () => {
    setIsClearModalOpen(true);
  };

  const handleConfirmClearSelected = (options: ClearDataOptions) => {
    // 1. Dinero en las cuentas (patrimonio a 0)
    if (options.clearWalletBalances && !options.clearAllWallets) {
      setWallets(prev => prev.map(w => ({ ...w, initialBalance: 0 })));
    }

    // 2. Todas las cuentas
    if (options.clearAllWallets) {
      setWallets([]);
      localStorage.removeItem(STORAGE_KEY_WALLETS);
    }

    // 3. Movimientos
    if (options.clearTransactions) {
      setTransactions([]);
      localStorage.removeItem(STORAGE_KEY_TXS);
    }

    // 4. Presupuestos
    if (options.clearBudgets) {
      setBudgetPlans([]);
      localStorage.removeItem(STORAGE_KEY_PLANS);
    }

    // 5. Deudas
    if (options.clearDebts) {
      setLoans([]);
      localStorage.removeItem(STORAGE_KEY_LOANS);
      // Reset shared debts
      setTransactions(prev =>
        prev.map(t => {
          if (!t.splitInfo) return t;
          return {
            ...t,
            splitInfo: {
              ...t.splitInfo,
              participants: t.splitInfo.participants.map(p => ({
                ...p,
                isPaid: true,
                paidDate: new Date().toISOString().split('T')[0],
              })),
              totalOwedToMe: 0,
            },
          };
        })
      );
    }
  };

  const handleResetDemo = () => {
    setBudgetGroups(BUDGET_GROUPS);
    setTransactions(INITIAL_TRANSACTIONS);
    setBudgetPlans(INITIAL_BUDGET_PLANS);
    setLoans(INITIAL_LOANS);
    setWallets(INITIAL_WALLETS);
    setContacts(INITIAL_CONTACTS);
  };

  // 8. Backup Export & Import
  const handleExportJSON = () => {
    const data = {
      version: '2.5',
      exportedAt: new Date().toISOString(),
      theme,
      transactions,
      budgetPlans,
      budgetGroups,
      contacts,
      loans,
      wallets,
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finanzas_pro_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.transactions && Array.isArray(parsed.transactions)) {
          setTransactions(parsed.transactions);
        }
        if (parsed.budgetPlans && Array.isArray(parsed.budgetPlans)) {
          setBudgetPlans(parsed.budgetPlans);
        }
        if (parsed.budgetGroups && Array.isArray(parsed.budgetGroups)) {
          setBudgetGroups(parsed.budgetGroups);
        }
        if (parsed.contacts && Array.isArray(parsed.contacts)) {
          setContacts(parsed.contacts);
        }
        if (parsed.loans && Array.isArray(parsed.loans)) {
          setLoans(parsed.loans);
        }
        if (parsed.wallets && Array.isArray(parsed.wallets)) {
          setWallets(parsed.wallets);
        }
        if (parsed.theme === 'dark' || parsed.theme === 'light') {
          setTheme(parsed.theme);
        }
      } catch {
        console.error('Error al importar archivo JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-[#0c0f17] text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      {/* Hidden File Input for JSON import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* Revolut Top Header with Theme Switcher & Actions */}
      <Header
        currentMonthYear={currentMonthYear}
        onChangeMonthYear={setCurrentMonthYear}
        availableMonths={availableMonths}
        totalLiquidBalance={totalLiquidBalance}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenNewTransaction={() => handleOpenNewTransaction()}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        onResetDemo={handleResetDemo}
        onClearAllData={handleOpenClearModal}
      />

      {/* Revolut Navigation Bar */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingTransactionsCount={pendingTransactionsCount}
        exceededBudgetsCount={exceededBudgetsCount}
        pendingDebtsCount={pendingDebtsCount}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-xl sm:max-w-2xl w-full mx-auto px-3.5 sm:px-4 py-3.5 sm:py-5">
        {activeTab === 'dashboard' && (
          <DashboardView
            summary={summary}
            budgetRows={budgetRows}
            transactions={transactions}
            loans={loans}
            wallets={wallets}
            walletBalances={walletBalances}
            onAddTransaction={(tx) => handleSaveTransaction(tx)}
            onToggleProcessed={handleToggleProcessed}
            onNavigateToTab={setActiveTab}
            onOpenNewTransaction={() => handleOpenNewTransaction()}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            transactions={transactions}
            onToggleProcessed={handleToggleProcessed}
            onDeleteTransaction={handleDeleteTransaction}
            onEditTransaction={handleOpenEditTransaction}
            onOpenNewTransaction={() => handleOpenNewTransaction()}
          />
        )}

        {activeTab === 'budgets' && (
          <BudgetsView
            currentMonthYear={currentMonthYear}
            summary={summary}
            budgetRows={budgetRows}
            budgetGroups={budgetGroups}
            onUpdateBudgetPlan={handleUpdateBudgetPlan}
            onMovePartida={handleMovePartida}
            onDuplicatePartida={handleDuplicatePartida}
            onChangePartidaGroup={handleChangePartidaGroup}
            onSelectPartidaToView={handleSelectPartidaToView}
          />
        )}

        {activeTab === 'contacts' && (
          <ContactsView
            contacts={contacts}
            transactions={transactions}
            wallets={wallets}
            onOpenCreateContact={handleOpenCreateContact}
            onDeleteContact={handleDeleteContact}
            onOpenSettleDebt={handleOpenSettleDebt}
            onOpenNewSharedTransaction={handleOpenNewSharedTransaction}
            onEditTransaction={handleOpenEditTransaction}
            onUpdateDebtAmount={handleUpdateDebtAmount}
          />
        )}

        {activeTab === 'loans' && (
          <LoansView
            loans={loans}
            transactions={transactions}
            wallets={wallets}
            onAddLoan={handleAddLoan}
            onUpdateLoan={handleUpdateLoan}
            onDeleteLoan={handleDeleteLoan}
            onPayInstallment={handlePayLoanInstallment}
          />
        )}

        {activeTab === 'wallets' && (
          <WalletsView
            wallets={wallets}
            walletBalances={walletBalances}
            transactions={transactions}
            onAddWallet={handleAddWallet}
            onUpdateWallet={handleUpdateWallet}
            onDeleteWallet={handleDeleteWallet}
            onExecuteTransfer={handleExecuteTransfer}
          />
        )}

        {activeTab === 'assistant' && (
          <AssistantChatView
            summary={summary}
            budgetRows={budgetRows}
            transactions={transactions}
            loans={loans}
            wallets={wallets}
            onAddTransaction={(tx) => handleSaveTransaction(tx)}
          />
        )}
      </main>

      {/* New / Edit Transaction Modal */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => {
          setIsTxModalOpen(false);
          setTransactionToEdit(null);
          setInitialPartidaCodeForModal(undefined);
          setInitialContactIdForModal(undefined);
        }}
        onSave={handleSaveTransaction}
        wallets={wallets}
        contacts={contacts}
        onQuickCreateContact={handleSaveContact}
        defaultDate={`${currentMonthYear}-15`}
        transactionToEdit={transactionToEdit}
        initialPartidaCode={initialPartidaCodeForModal}
        initialContactId={initialContactIdForModal}
        availablePartidas={allPartidas}
      />

      {/* Partida Specific Detail Modal */}
      <PartidaDetailModal
        isOpen={isPartidaDetailOpen}
        onClose={() => {
          setIsPartidaDetailOpen(false);
          setSelectedPartidaForDetail(null);
        }}
        partida={selectedPartidaForDetail}
        budgetRow={selectedBudgetRow}
        transactions={transactions}
        monthYear={currentMonthYear}
        onEditTransaction={handleOpenEditTransaction}
        onDeleteTransaction={handleDeleteTransaction}
        onToggleProcessed={handleToggleProcessed}
        onAddMovementToPartida={handleAddMovementToPartida}
        onUpdatePrevisto={handleUpdateBudgetPlan}
      />

      {/* Confirmation Modal to Clear Selected Data & Reset */}
      <ConfirmClearModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleConfirmClearSelected}
      />

      {/* Settle Debt Modal */}
      <SettleDebtModal
        isOpen={isSettleModalOpen}
        onClose={() => {
          setIsSettleModalOpen(false);
          setDebtToSettle(null);
        }}
        debtItem={debtToSettle}
        wallets={wallets}
        onConfirmSettle={handleConfirmSettleDebt}
      />

      {/* Create / Edit Contact Modal */}
      <CreateContactModal
        isOpen={isContactModalOpen}
        onClose={() => {
          setIsContactModalOpen(false);
          setContactToEdit(null);
        }}
        onSaveContact={handleSaveContact}
        contactToEdit={contactToEdit}
      />
    </div>
  );
}

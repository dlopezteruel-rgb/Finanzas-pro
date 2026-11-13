import {legacyTransferNotice,legacySharedNotice} from './i18n/countMessages';
import {pluralCategory} from './i18n/messages';
import {storageOwnedText} from './i18n/storageMessages';
import {madridDate} from './utils/financialCalendar';
import {applyCatalogReorder} from './utils/catalogReorder';
import {CatalogManager} from './components/CatalogManager';
import {classificationCatalog} from './utils/budgetCatalog';
import { editSubitem, monthlySubitems, type SubitemEdit } from './utils/budgetSubitems';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { toggleObligationSettlement } from './utils/personalObligations';
import { currentMonth, realDate } from './utils/financialCalendar';
import { occurrencePreviews } from './utils/recurringMovements';
import { SharedExpenseDetail } from './components/SharedExpenseDetail';
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog';
import { deleteEntity, deletionReport, type DeletionTarget } from './utils/deletion';
import type { SaveResult } from './utils/saveResult';
import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { adjustDebt, deleteSettlement, isLegacyShared, isStructuredShared, migrateSharedExpenses, saveSettlement, saveSharedTransaction, sharedMigrationReport, sharedViewTransactions, sharedWalletName } from './utils/sharedExpenses';
import {
  Transaction,
  DebtSettlement,
  SettlementInput,
  TransferInput,
  BudgetPlan,
  BudgetPartida,
  Loan,
  Wallet,
  MovementType,
  MonthlyBudgetRow,
  Contact,
} from './types/finance';
import { calculateMonthlyBudgetRows, calculateMonthlySummary, calculateWalletBalances } from './utils/finance';
import {
  INITIAL_TRANSACTIONS,
  INITIAL_BUDGET_PLANS,
  INITIAL_LOANS,
  INITIAL_WALLETS,
  INITIAL_CONTACTS,
} from './utils/seedData';
import { BUDGET_GROUPS } from './constants/categories';
import { Header } from './components/Header';
import { Brand } from './components/Brand';
import { paths } from './app/paths';
import { useI18n, I18nText } from './i18n';
import { Navigation, NavTab } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { ChartSlot } from './components/charts/ChartSlot';
import type { EconomicFilter } from './utils/chartData';
import { BudgetWorkspace } from './components/BudgetWorkspace';
import { PlanningView } from './components/PlanningView';
import { effectiveBudgetPlans, planningBudgetRows, planningCatalog } from './utils/planningBasis';
import { applyAutomationPreview } from './utils/planningAutomation';
import { savePlanning, planCents } from './utils/planning';
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
import { Backup, FinanceData, makeBackup, MAX_BACKUP_BYTES, parseBackup, recoveryCopies } from './utils/backup';
import { useFinanceData } from './utils/useFinanceData';
import { RestorationModal } from './components/RestorationModal';
import { SafeDialog } from './components/SafeDialog';
import { confirmOnceAsync } from './utils/confirmation';
import { deleteTransfer, isLegacyTransfer, legacyTransferReport, migrateLegacyTransfers, saveTransfer, transferWalletName } from './utils/transfers';
import { changePartidaGroup, duplicatePartida, reorderPartida } from './utils/budgetChanges';
import { chooseDefaultWallet } from './utils/defaultWallet';
import { TransferModal } from './components/TransferModal';
import { TreasuryView } from './components/TreasuryView';
import { liquidBalanceCents } from './utils/treasury';
import { obligationOverview } from './utils/personalObligations';
import { DebtsWorkspace } from './components/DebtsWorkspace';
import { RecurringMovementsView } from './components/RecurringMovementsView';

const DEMO_DATA: FinanceData = {
  theme: 'dark', budgetGroups: BUDGET_GROUPS, transactions: INITIAL_TRANSACTIONS,
  budgetPlans: INITIAL_BUDGET_PLANS, loans: INITIAL_LOANS, wallets: INITIAL_WALLETS,
  contacts: INITIAL_CONTACTS,
};

function downloadJSON(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const { t: uiText , formatMoney: formatCurrency , formatCents,formatNumber,language } = useI18n();
  const { t } = useI18n();
  const { data, update, mutate, restore, conflict, capabilityError, loadError, saveError } = useFinanceData(DEMO_DATA);
  const { theme, budgetGroups, transactions: storedTransactions, budgetPlans, loans, wallets, contacts } = data;
  const effectivePlans=useMemo(()=>effectiveBudgetPlans(data),[data]);
  const transactions = useMemo(() => sharedViewTransactions(storedTransactions).map(t => ({ ...t, wallet: (t.recurrence || t.obligationSettlement) ? wallets.find(w=>w.id===(t.recurrence?.walletId??t.obligationSettlement?.walletId))!.name : t.transfer ? transferWalletName(t, wallets) : sharedWalletName(t, { wallets }) })), [storedTransactions, wallets]);
  const sharedMigration = useMemo(() => sharedMigrationReport(data), [data]);
  const [settlementToEdit, setSettlementToEdit] = useState<DebtSettlement | undefined>(undefined);
  const [deleteSettlementInitially, setDeleteSettlementInitially] = useState(false);
  const legacyTransfers = useMemo(() => legacyTransferReport(storedTransactions, wallets), [storedTransactions, wallets]);
  const [transferToEdit, setTransferToEdit] = useState<Transaction | null>(null);
  const [deleteTransferInitially, setDeleteTransferInitially] = useState(false);
  const setTheme = (value: React.SetStateAction<FinanceData['theme']>) => update('theme', value);
  const setTransactions = (value: React.SetStateAction<Transaction[]>) => update('transactions', value);
  const setBudgetPlans = (value: React.SetStateAction<BudgetPlan[]>) => update('budgetPlans', value);
  const setLoans = (value: React.SetStateAction<Loan[]>) => update('loans', value);
  const setWallets = (value: React.SetStateAction<Wallet[]>) => update('wallets', value);
  const setContacts = (value: React.SetStateAction<Contact[]>) => update('contacts', value);
  const [restoration, setRestoration] = useState<{ backup: Backup; label: string } | null>(null);
  const [dataError, setDataError] = useState('');
  const [dataNotice, setDataNotice] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const restorationGuard = useRef<ReturnType<typeof confirmOnceAsync<Backup>> | null>(null);
  const importRequest = useRef(0);
  const clearPending = useRef(false);
  const [restoring, setRestoring] = useState(false);

  useLayoutEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  const handleToggleTheme = () => setTheme(previous => previous === 'dark' ? 'light' : 'dark');

  // Current Month/Year period
  const [currentMonthYear, setCurrentMonthYear] = useState<string>(()=>currentMonth());
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [homeTab,setHomeTab]=useState<'overview'|'treasury'>('overview');
  const [movementTab,setMovementTab]=useState<'ledger'|'recurring'>('ledger');
  const [focusedTransactionId,setFocusedTransactionId]=useState<string|null>(null);
  const [focusedOccurrenceId,setFocusedOccurrenceId]=useState<string|null>(null);
  const [chartNavigation, setChartNavigation] = useState<EconomicFilter | undefined>();
  const planningState = useRef({ dirty: false, saving: false });
  const [planningNavigationFailure,setPlanningNavigationFailure]=useState(false);
  const planningNavigationSave=useRef<(()=>Promise<boolean>)|null>(null);
  const registerPlanningSave=useCallback((save:(()=>Promise<boolean>)|null)=>{planningNavigationSave.current=save},[]);
  const [planningBusy, setPlanningBusy] = useState(false);
  const [planningReset, setPlanningReset] = useState(0);
  const [pendingPlanningNavigation, setPendingPlanningNavigation] = useState<(() => void) | null>(null);
  const onPlanningDirty = useCallback((dirty: boolean, saving: boolean) => { planningState.current = { dirty, saving }; setPlanningBusy(saving); }, []);
  const guardPlanning = (action: () => void) => {
    if (planningState.current.saving) return;
    if (planningState.current.dirty) {setPlanningNavigationFailure(false);setPendingPlanningNavigation(() => action);}
    else action();
  };
  // Leaving /app is a document navigation; retain the existing draft protection.
  useEffect(() => {
    const beforeLeave = (event: BeforeUnloadEvent) => {
      if (planningState.current.dirty || planningState.current.saving) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeLeave);
    return () => window.removeEventListener('beforeunload', beforeLeave);
  }, []);
  const changeMonth = (month: string) => { if (month !== currentMonthYear) guardPlanning(() => { setFocusedTransactionId(null); setFocusedOccurrenceId(null); setCurrentMonthYear(month); }); };
  const changeTab = (tab: NavTab) => { if (tab !== activeTab) guardPlanning(() => { planningState.current = { dirty: false, saving: false }; setFocusedTransactionId(null); setFocusedOccurrenceId(null); setActiveTab(tab); }); };
  // Navigate to the exact registered movement without invoking its editor.
  // The same planning guard owns the complete navigation, so a pending draft cannot be lost.
  const openLinkedTransaction = (id: string) => {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) { setDataNotice('El movimiento vinculado ya no está disponible. Revisa el historial antes de continuar.'); return; }
    if (!realDate(transaction.date)) { setDataNotice('El movimiento vinculado no tiene una fecha admitida por el calendario.'); return; }
    guardPlanning(() => {
      planningState.current = { dirty: false, saving: false };
      setCurrentMonthYear(transaction.date.slice(0, 7));
      setChartNavigation(undefined);
      setMovementTab('ledger');
      setFocusedOccurrenceId(null);
      setFocusedTransactionId(id);
      setActiveTab('transactions');
    });
  };
  const openLinkedOccurrence = (id: string) => {
    const date = data.intelligentFinance?.occurrences.find(o => o.id === id)?.dueDate ?? id.slice(-10);
    if (!realDate(date)) { setDataNotice('La ocurrencia no tiene un mes válido.'); return; }
    const month = date.slice(0, 7);
    if (!occurrencePreviews(data, month).some(o => o.id === id)) { setDataNotice('La ocurrencia vinculada ya no está disponible. Revisa la regla antes de continuar.'); return; }
    guardPlanning(() => {
      planningState.current = { dirty: false, saving: false };
      setCurrentMonthYear(month);
      setMovementTab('recurring');
      setFocusedTransactionId(null);
      setFocusedOccurrenceId(id);
      setActiveTab('transactions');
    });
  };


  // Modals state
  const [sharedDetailId, setSharedDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeletionTarget | null>(null);
  const [initialMovementType, setInitialMovementType] = useState<MovementType>('GASTO');
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [initialPartidaCodeForModal, setInitialPartidaCodeForModal] = useState<string | undefined>(undefined);
  const [initialSubitemIdForModal,setInitialSubitemIdForModal]=useState<string|undefined>();
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

  // Derived available periods
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => {
      const my = t.date.slice(0, 7);
      if (my) set.add(my);
    });
    budgetPlans.forEach(p => set.add(p.monthYear));
    data.planningMonths?.forEach(m => set.add(m.monthYear));
    return Array.from(set).sort().reverse();
  }, [transactions, budgetPlans, data.planningMonths]);

  // Derived all partidas from groups
  const classificationPartidas=useMemo(()=>classificationCatalog(budgetGroups),[budgetGroups]);
  const allPartidas = useMemo(() => {
    return budgetGroups.flatMap(g => g.partidas);
  }, [budgetGroups]);

  // Calculations:
  // - RESTO = PREVISTO - EJECUTADO
  // - Balance Mensual Real = INGRESOS REALES - GASTOS EJECUTADOS
  // - Balance Mensual Previsto = INGRESOS PREVISTOS - GASTOS PREVISTOS
  const summary = useMemo(() => {
    return calculateMonthlySummary(currentMonthYear, transactions, effectivePlans, planningCatalog(data,allPartidas));
  }, [data,currentMonthYear,transactions,effectivePlans,allPartidas]);

  const budgetRows = useMemo(() => {
    return planningBudgetRows(data,currentMonthYear,allPartidas);
  }, [data,currentMonthYear,allPartidas]);

  const walletBalances = useMemo(() => {
    return calculateWalletBalances(wallets, transactions);
  }, [wallets, transactions]);

  const totalLiquidBalance = useMemo(() => {
    return liquidBalanceCents(data)/100;
  }, [data, walletBalances]);

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
    return mutate(current => saveSharedTransaction(current, txData, existingId));
  };

  const handleToggleProcessed = (id: string) => {
    const tx = storedTransactions.find(t => t.id === id);
    if(tx?.obligationSettlement)return mutate(current=>toggleObligationSettlement(current,id));
    if (tx?.reimbursement) {
      const expense = storedTransactions.find(t => t.id === tx.reimbursement!.expenseId)!;
      const s = expense.splitInfo!.settlements!.find(s => s.id === tx.reimbursement!.settlementId)!;
      return mutate(current => saveSettlement(current, { ...s, expenseId: expense.id, processed: !s.processed }, s.id));
    }
    return setTransactions(prev => {
      const target = prev.find(t => t.id === id);
      return prev.map(t => (t.id === id || (target?.transfer && t.transfer?.id === target.transfer.id)) ? { ...t, processed: !target!.processed } : t);
    });
  };

  const handleDeleteTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (tx?.reimbursement) { handleEditSettlement(tx.reimbursement.expenseId, tx.reimbursement.settlementId, true); return; }
    if (tx?.transfer) { setTransferToEdit(tx); setDeleteTransferInitially(true); return; }
    setDeleteTarget({ kind: 'transaction', id });
  };

  const handleOpenEditTransaction = (tx: Transaction) => {
    if(tx.obligationSettlement){setDataNotice('El principal y su historial están protegidos. Revisa esta liquidación desde Deudas; puedes tramitarla desde Movimientos.');return;}
    if (tx.reimbursement) { handleEditSettlement(tx.reimbursement.expenseId, tx.reimbursement.settlementId); return; }
    if (isLegacyShared(tx)) { setDataError('Revisa la migración del gasto compartido histórico antes de editarlo.'); return; }
    const raw = storedTransactions.find(t => t.id === tx.id);
    if (raw && isStructuredShared(raw)) tx = { ...raw, wallet: sharedWalletName(raw, { wallets }) };
    if (tx.transfer) { setTransferToEdit(tx); setDeleteTransferInitially(false); return; }
    if (isLegacyTransfer(tx)) { setDataError('Este traspaso histórico requiere revisión y vinculación antes de editar sus extremos.'); return; }
    setInitialSubitemIdForModal(undefined);
    setTransactionToEdit(tx);
    setInitialPartidaCodeForModal(tx.code);
    setInitialContactIdForModal(undefined);
    setIsTxModalOpen(true);
  };

  const handleOpenNewTransaction = (partidaCode?: string, movementType: MovementType = 'GASTO', subitemId?:string) => {
    setInitialSubitemIdForModal(subitemId);
    setInitialMovementType(movementType);
    setTransactionToEdit(null);
    setInitialPartidaCodeForModal(partidaCode);
    setInitialContactIdForModal(undefined);
    setIsTxModalOpen(true);
  };

  const handleOpenNewSharedTransaction = (preselectedContactId?: string) => {
    setInitialSubitemIdForModal(undefined);
    setInitialMovementType('GASTO');
    setTransactionToEdit(null);
    setInitialPartidaCodeForModal(undefined);
    setInitialContactIdForModal(preselectedContactId);
    setIsTxModalOpen(true);
  };

  // 4. Budget Plans & Partidas Actions
  const handleUpdateBudgetPlan = (code: string, type: MovementType, newAmount: number) => {
    if(monthlySubitems(data,currentMonthYear,{code,type}))return Promise.resolve({ok:false,error:'Esta base se calcula desde sus subítems. Edita el desglose en Planificación.'} as SaveResult);
    try { planCents(newAmount); } catch (error) { return Promise.resolve({ ok: false, error: (error as Error).message } as SaveResult); }
    return setBudgetPlans(prev => {
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
    return mutate(current => {const group=current.budgetGroups.find(g=>g.code===groupCode),item=group?.partidas.filter(p=>!p.deleted)[partidaIndex];if(!item)throw new Error('La partida ya no existe.');return reorderPartida(current,groupCode,group!.partidas.indexOf(item),direction);});
  };

  const handleDuplicatePartida = (partida: BudgetPartida) => {
    return mutate(current => duplicatePartida(current, partida));
  };

  const handleChangePartidaGroup = (
    partida: BudgetPartida,
    targetGroupCode: string
  ) => {
    return mutate(current => changePartidaGroup(current, partida, targetGroupCode));
  };

  // Inspect detail of a partida
  const handleSelectPartidaToView = (partida: BudgetPartida, _row?: MonthlyBudgetRow) => {
    guardPlanning(() => { setSelectedPartidaForDetail(partida); setIsPartidaDetailOpen(true); });
  };

  const handleAddMovementToPartida = (partidaCode: string, type: MovementType, subitemId?:string) => {
    handleOpenNewTransaction(partidaCode, type, subitemId);
  };

  // 5. Contacts & Shared Expenses Handlers
  const handleOpenCreateContact = (contact?: Contact | null) => {
    setContactToEdit(contact || null);
    setIsContactModalOpen(true);
  };

  const handleSaveContact = (contact: Contact) => {
    return setContacts(prev => {
      const exists = prev.some(c => c.id === contact.id);
      if (exists) {
        return prev.map(c => (c.id === contact.id ? contact : c));
      }
      return [contact, ...prev];
    });
  };

  const handleDeleteContact = (id: string) => {
    setDeleteTarget({ kind: 'contact', id });
  };

  const handleOpenSettleDebt = (debtItem: DebtItemToSettle) => {
    setSettlementToEdit(undefined); setDeleteSettlementInitially(false);
    setDebtToSettle(debtItem);
    setIsSettleModalOpen(true);
  };

  const handleConfirmSettleDebt = (input: SettlementInput, id?: string) => mutate(current => saveSettlement(current, input, id));
  const handleRemoveSettlement = (expenseId: string, id: string) => mutate(current => deleteSettlement(current, expenseId, id));
  const handleEditSettlement = (expenseId: string, id: string, deleting = false) => {
    const expense = transactions.find(t => t.id === expenseId), s = expense?.splitInfo?.settlements?.find(s => s.id === id);
    const contact = contacts.find(c => c.id === s?.contactId), participant = expense?.splitInfo?.participants.find(p => p.contactId === s?.contactId);
    if (!expense || !s || !contact || !participant) { setDataError('La liquidación ya no existe.'); return; }
    setSettlementToEdit(s); setDeleteSettlementInitially(deleting);
    setDebtToSettle({ transactionId: expense.id, transactionDescription: expense.description, transactionCode: expense.code, transactionCategory: expense.categoryName, transactionSubcategory: expense.subcategoryName, participant, contact });
    setIsSettleModalOpen(true);
  };

  // 6. Loans & Wallets Actions
  const handleAddLoan = (newLoan: Loan) => {
    return setLoans(prev => [...prev, newLoan]);
  };

  const handlePayLoanInstallment = (loan: Loan) => {
    const partida=classificationPartidas.find(p=>p.type==='GASTO'&&p.code===loan.code);
    if(!partida){const error='La partida habitual del préstamo está ausente o archivada. Edita el préstamo y selecciona una partida activa antes de registrar la cuota.';setDataError(error);return Promise.resolve({ok:false as const,error});}
    const newTx: Transaction = {
      id: `tx-loan-${crypto.randomUUID()}`,
      date: madridDate(),
      amount: loan.monthlyPayment,
      type: 'GASTO',
      code: partida.code,
      categoryName: partida.groupName,
      subcategoryName: partida.name,
      description: `Cuota mensual: ${loan.name}`,
      wallet: loan.wallet,
      processed: true, // Tramitado: SÍ
      loanId: loan.id,
      notes: `Pago registrado de préstamo ${loan.entity}`,
    };
    return setTransactions(prev => [newTx, ...prev]);
  };

  const handleUpdateLoan = (updatedLoan: Loan) => {
    return setLoans(prev => prev.map(l => (l.id === updatedLoan.id ? updatedLoan : l)));
  };

  const handleDeleteLoan = (loanId: string) => {
    return mutate(current => deleteEntity(current, { kind: 'loan', id: loanId }));
  };

  const handleAddWallet = (newWallet: Wallet) => {
    return setWallets(prev => [...prev, newWallet]);
  };

  const handleUpdateWallet = (updatedWallet: Wallet) => {
    return setWallets(prev => prev.map(w => (w.id === updatedWallet.id ? updatedWallet : w)));
  };

  const handleDeleteWallet = (walletId: string) => {
    return mutate(current => deleteEntity(current, { kind: 'wallet', id: walletId }));
  };

  const handleExecuteTransfer = (input: TransferInput, id?: string) => {
    return setTransactions(prev => saveTransfer(prev, wallets, input, id));
  };

  const handleDeleteTransfer = (id: string) => setTransactions(prev => deleteTransfer(prev, id));

  const handleUpdateDebtAmount = (transactionId: string, contactId: string, newAmount: number) => {
    return mutate(current => adjustDebt(current, transactionId, contactId, newAmount));
  };

  // 7. Clear Selected Data & Reset Actions
  const handleOpenClearModal = () => {
    setIsClearModalOpen(true);
  };

  const handleConfirmClearSelected = async (options: ClearDataOptions, scope: string): Promise<SaveResult> => {
    if (clearPending.current) return { ok: false, error: 'Hay un borrado pendiente de confirmación.' };
    clearPending.current = true;
    setDataError(''); setDataNotice('');
    try {
      const result = await mutate({ clear: options, scope });
      if (!result.ok) { const error = `No se ha aplicado el borrado. ${result.error}`; setDataError(error); return { ok: false, error }; }
      setDataNotice('Datos seleccionados borrados. El estado anterior está en «Copias de recuperación».');
      return { ok: true };
    } catch {
      const error = 'No se ha aplicado el borrado. No se pudo guardar una copia recuperable o los datos cambiaron en otra pestaña.';
      setDataError(error); return { ok: false, error };
    } finally { clearPending.current = false; }
  };

  const prepareRestoration = (backup: Backup, label: string) => {
    restorationGuard.current?.cancel();
    restorationGuard.current = confirmOnceAsync((next: Backup) => restore(next));
    setDataError('');
    guardPlanning(() => setRestoration({ backup, label }));
  };
  const handleResetDemo = () => prepareRestoration(makeBackup({ ...DEMO_DATA, theme }), 'Restablecer datos de demostración');

  const handleExportJSON = () => downloadJSON(JSON.stringify(makeBackup(data), null, 2), `finanzas_pro_backup_${new Date().toISOString().slice(0, 10)}.json`);
  const handleImportJSON = () => fileInputRef.current?.click();
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const request = ++importRequest.current;
    setDataError(''); setDataNotice('');
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('El archivo supera el límite de 10 MB.');
      const backup = parseBackup(await file.text());
      if (request === importRequest.current) prepareRestoration(backup, `Importar «${file.name}»`);
    } catch (error) {
      if (request === importRequest.current) setDataError(`${error instanceof Error ? error.message : 'No se pudo leer el archivo.'} No se ha modificado ningún dato.`);
    }
  };
  const cancelRestoration = () => {
    restorationGuard.current?.cancel();
    setRestoration(null);
  };
  const confirmRestoration = async () => {
    if (!restoration || restoring) return;
    setRestoring(true);
    try {
      if (await restorationGuard.current?.confirm(restoration.backup)) {
        setRestoration(null);
        setDataNotice('Datos sustituidos. La copia anterior está disponible en «Copias de recuperación».');
      }
    } catch {
      setDataError('No se pudo guardar la copia de recuperación o los datos nuevos. No se ha aplicado la sustitución. Comprueba el espacio disponible y si los datos cambiaron en otra pestaña.');
    } finally { setRestoring(false); }
  };

  if (loadError) return <main className="app-recovery">
    <Brand /><h1>{t('recovery.title')}</h1>
    <p role="alert">{storageOwnedText(loadError,uiText)}</p>
    {dataError && <p role="alert">{storageOwnedText(dataError,uiText)}</p>}
    <p>{uiText("app.conserva_una_copia_de_los_datos_locales_antes_de")}</p>
    <button className="button-primary" onClick={() => {
      try {
      const raw: Record<string, string | null> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('finanzas_pro_')) raw[key] = localStorage.getItem(key);
      }
      downloadJSON(JSON.stringify(raw, null, 2), 'finanzas_pro_datos_locales_para_recuperar.json');
      } catch { setDataError(t('recovery.blocked')); }
    }}>{uiText("app.descargar_datos_locales_sin_modificar")}</button>
    <a href={paths.home}>{t('recovery.back')}</a>
  </main>;

  return (
    <div className="finance-app min-h-screen bg-[#0c0f17] text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      <a className="skip-link" href="#app-content">{uiText("app.ir_al_contenido")}</a>
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
        onChangeMonthYear={changeMonth}
        availableMonths={[...new Set([...availableMonths, currentMonthYear])].sort().reverse()}
        totalLiquidBalance={totalLiquidBalance}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenNewTransaction={() => handleOpenNewTransaction()}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        onOpenRecovery={() => setShowRecovery(true)}
        onResetDemo={() => guardPlanning(handleResetDemo)}
        onClearAllData={() => guardPlanning(handleOpenClearModal)}
      />

      {/* Revolut Navigation Bar */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={changeTab}
        pendingTransactionsCount={pendingTransactionsCount}
        exceededBudgetsCount={exceededBudgetsCount}
        pendingDebtsCount={pendingDebtsCount}
      />

      {capabilityError && <div role="alert" className="app-banner p-4 text-sm text-amber-300 bg-[#141926] border border-amber-500/40 rounded-xl">
        <strong>{uiText("app.guardado_no_disponible")}</strong> {storageOwnedText(capabilityError,uiText)}{uiText("app.puedes_consultar_y_exportar_tus_datos_los_formularios_conservaran")}</div>}
      {(legacyTransfers.pairs.length > 0 || legacyTransfers.unresolved.length > 0) && <div role="status" className="app-banner p-4 text-sm text-amber-300 bg-[#141926] rounded-xl">
        <p>{legacyTransferNotice(legacyTransfers.pairs.length,legacyTransfers.unresolved.length,language,uiText,formatNumber)}</p>
        {legacyTransfers.missingWalletPairs.length > 0 && <p>{uiText(pluralCategory(legacyTransfers.missingWalletPairs.length,language)==='one'?'storage.warning.missingWalletPairs.one':'storage.warning.missingWalletPairs',{count:formatNumber(legacyTransfers.missingWalletPairs.length)})}</p>}
        {legacyTransfers.migratablePairs.length > 0 && <button className="mt-2 underline" onClick={() => prepareRestoration(makeBackup(migrateLegacyTransfers(data)), 'Vincular traspasos históricos (migración a 2.6)')}>{uiText("app.revisar_vinculacion_de_traspasos_historicos")}</button>}
      </div>}
      {(sharedMigration.candidates.length > 0 || sharedMigration.issues.length > 0) && <div role="status" className="app-banner p-4 text-sm text-amber-300 bg-[#141926] rounded-xl">
        <p>{legacySharedNotice(sharedMigration.candidates.length,sharedMigration.issues.length,language,uiText,formatNumber)}</p>
        {sharedMigration.issues.map(issue => <p key={issue}>{storageOwnedText(issue,uiText)}</p>)}
        {sharedMigration.candidates.length > 0 && <button className="underline" onClick={() => prepareRestoration(makeBackup(migrateSharedExpenses(data)), 'Migrar gastos compartidos a 2.7')}>{uiText("app.revisar_migracion_de_gastos_compartidos")}</button>}
      </div>}
      {/* Main Content Viewport */}
      <main id="app-content" tabIndex={-1} data-module={activeTab} className="app-main flex-1">
        {activeTab === 'dashboard' && (<>
          <div className="finance-actions" aria-label={uiText("app.secciones_de_inicio")}><button aria-pressed={homeTab==='overview'} onClick={()=>setHomeTab('overview')}>{uiText("app.resumen_financiero")}</button><button aria-pressed={homeTab==='treasury'} onClick={()=>setHomeTab('treasury')}>{uiText("app.proximos_30_dias")}</button></div>
          {homeTab==='treasury'?<TreasuryView data={data} navigate={(source,id)=>{if(source==='planning')changeTab('budgets');else if(source==='personal'||source==='loan')changeTab('loans');else if(source==='recurring')openLinkedOccurrence(id);else openLinkedTransaction(id);}}/>:<>
          <p className="planning-card"><I18nText id="app.cobros_pendientes_obligaciones_pendientes_separados_del_saldo_bancario" values={{ receivables: (formatCents(obligationOverview(data).filter(o=>o.direction==='receivable').reduce((n,o)=>n+o.remainingCents,0))), payables: (formatCents(obligationOverview(data).filter(o=>o.direction==='payable').reduce((n,o)=>n+o.remainingCents,0))) }} /></p>
          <DashboardView
            classificationPartidas={classificationPartidas}
            subitems={data.budgetSubitems?.items}
            defaultWalletId={data.defaultWalletId}
            charts={<ChartSlot data={data} month={currentMonthYear} kind="home" navigate={filter=>{setChartNavigation(filter);changeTab('transactions')}}/>}
            summary={summary}
            budgetRows={budgetRows}
            transactions={transactions}
            loans={loans}
            wallets={wallets}
            walletBalances={walletBalances}
            onAddTransaction={(tx) => handleSaveTransaction(tx)}
            onToggleProcessed={handleToggleProcessed}
            onNavigateToTab={changeTab}
            onOpenNewTransaction={() => handleOpenNewTransaction()}
          />
          </>}
        </>)}

        {activeTab === 'transactions' && (<>
          <div className="finance-actions" aria-label={uiText("app.secciones_de_movimientos")}><button aria-pressed={movementTab==='ledger'} onClick={()=>{setFocusedTransactionId(null);setFocusedOccurrenceId(null);setMovementTab('ledger');}}>{uiText("app.movimientos_registrados")}</button><button aria-pressed={movementTab==='recurring'} onClick={()=>{setFocusedTransactionId(null);setFocusedOccurrenceId(null);setMovementTab('recurring');}}>{uiText("app.movimientos_periodicos")}</button></div>
          {movementTab==='recurring'?<RecurringMovementsView key={currentMonthYear} data={data} month={currentMonthYear} focusedOccurrenceId={focusedOccurrenceId} mutate={mutate} onEdit={handleOpenEditTransaction}/>:<>
          <ChartSlot data={data} month={currentMonthYear} kind="movements" initialFilter={chartNavigation}/>
          <TransactionsView
            currentMonthYear={currentMonthYear}
            transactions={transactions}
            focusedTransactionId={focusedTransactionId}
            onToggleProcessed={handleToggleProcessed}
            onViewSharedDetails={setSharedDetailId}
            onDeleteTransaction={handleDeleteTransaction}
            onEditTransaction={handleOpenEditTransaction}
            onOpenNewTransaction={() => handleOpenNewTransaction()}
          />
          </>}
        </>)}

        {activeTab === 'budgets' && <BudgetWorkspace navigate={guardPlanning} locked={planningBusy} planning={
          <PlanningView key={`${currentMonthYear}:${planningReset}`} data={data} month={currentMonthYear} onMonth={changeMonth} onDirty={onPlanningDirty} onRegisterNavigationSave={registerPlanningSave}
            onSave={(edits, savings, scope, approve, deficit, subitems) => mutate(current => savePlanning(current, currentMonthYear, edits, savings, scope, approve, deficit, subitems))}
            onDetail={handleSelectPartidaToView} onAutomation={preview=>mutate(current=>applyAutomationPreview(current,preview))} />
        } catalog={<>
          <CatalogManager data={data} onEdit={edit=>planningState.current.dirty||planningState.current.saving?Promise.resolve({ok:false,error:"Guarda o descarta primero el borrador de planificación."}):mutate({catalog:edit})}/>
          <BudgetsView
            data={data} onReorder={request=>planningState.current.dirty||planningState.current.saving?Promise.resolve({ok:false,error:"Guarda o descarta primero el borrador de planificación."}):mutate(current=>applyCatalogReorder(current,request))}
            currentMonthYear={currentMonthYear}
            summary={summary}
            budgetRows={budgetRows}
            budgetGroups={budgetGroups}
            onUpdateBudgetPlan={(...args) => planningState.current.dirty || planningState.current.saving ? Promise.resolve({ ok: false, error: "Guarda o descarta primero el borrador de planificación." }) : handleUpdateBudgetPlan(...args)}
            onMovePartida={(...args) => planningState.current.dirty || planningState.current.saving ? Promise.resolve({ ok: false, error: "Guarda o descarta primero el borrador de planificación." }) : handleMovePartida(...args)}
            onDuplicatePartida={partida => planningState.current.dirty || planningState.current.saving ? Promise.resolve({ ok: false, error: "Guarda o descarta primero el borrador de planificación." }) : handleDuplicatePartida(partida)}
            onChangePartidaGroup={(...args) => planningState.current.dirty || planningState.current.saving ? Promise.resolve({ ok: false, error: "Guarda o descarta primero el borrador de planificación." }) : handleChangePartidaGroup(...args)}
            onSelectPartidaToView={handleSelectPartidaToView}
          />
        </>} />}

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
            onEditSettlement={handleEditSettlement}
          />
        )}

        {activeTab === 'loans' && (<DebtsWorkspace data={data} mutate={mutate} onContacts={()=>changeTab('contacts')} onMovement={openLinkedTransaction} loans={
          <LoansView
            deletionData={data}
            loans={loans}
            transactions={transactions}
            wallets={wallets}
            onAddLoan={handleAddLoan}
            onUpdateLoan={handleUpdateLoan}
            onDeleteLoan={handleDeleteLoan}
            onPayInstallment={handlePayLoanInstallment}
          />
        }/>)}

        {activeTab === 'wallets' && (<>
          <ChartSlot data={data} month={currentMonthYear} kind="wallets"/>
          <WalletsView
            deletionData={data}
            wallets={wallets}
            walletBalances={walletBalances}
            transactions={transactions}
            onAddWallet={handleAddWallet}
            onUpdateWallet={handleUpdateWallet}
            onDeleteWallet={handleDeleteWallet}
            onExecuteTransfer={handleExecuteTransfer}
            onChangeDefaultWallet={id => mutate(current => chooseDefaultWallet(current, id))}
          />
        </>)}

        {activeTab === 'assistant' && (
          <AssistantChatView
            financeData={data}
            summary={summary}
            budgetRows={budgetRows}
            transactions={transactions}
            loans={loans}
            wallets={wallets}
            availablePartidas={classificationPartidas}
            onAddTransaction={(tx) => handleSaveTransaction(tx)}
          />
        )}
      </main>

      {(dataError || saveError || dataNotice) && <div className={`fixed bottom-20 left-4 right-4 ${dataError ? 'z-[60]' : 'z-40'} max-w-xl mx-auto bg-[#141926] border border-sky-500/40 rounded-2xl p-4 text-sm shadow-xl`} role={dataError || saveError ? 'alert' : 'status'}>
        <p>{storageOwnedText(dataError || saveError || dataNotice,uiText)}</p>
        {conflict && <button className="block mt-2 text-sky-400" onClick={() => window.location.reload()}>{uiText("app.recargar_datos_actualizados")}</button>}
        <button className="mt-2 text-sky-400" onClick={() => { setDataError(''); setDataNotice(''); }}>{uiText("app.cerrar_aviso")}</button>
      </div>}
      {pendingPlanningNavigation && <SafeDialog title={uiText("app.cambios_de_planificacion_sin_guardar")} onCancel={() => {if(!planningBusy)setPendingPlanningNavigation(null)}}>
        {planningNavigationFailure&&<p role="alert">{saveError?storageOwnedText(saveError,uiText):uiText("app.corrige_los_importes_antes_de_guardar_puedes_seguir_editando")}</p>}
        <p>{uiText("app.hay_importes_u_objetivo_sin_guardar_puedes_volver_al")}</p>
        <div className="flex flex-wrap gap-2"><button disabled={planningBusy} onClick={() => setPendingPlanningNavigation(null)}>{uiText("app.seguir_editando")}</button><button disabled={planningBusy} onClick={async()=>{const action=pendingPlanningNavigation;if(await planningNavigationSave.current?.()){setPendingPlanningNavigation(null);planningState.current={dirty:false,saving:false};action();}else setPlanningNavigationFailure(true);}}>{uiText("app.guardar_y_continuar")}</button><button disabled={planningBusy} onClick={() => {
          const action = pendingPlanningNavigation; setPendingPlanningNavigation(null); planningState.current = { dirty: false, saving: false }; setPlanningReset(n => n + 1); action();
        }}>{uiText("app.descartar_y_continuar")}</button></div>
      </SafeDialog>}
      {restoration && <RestorationModal backup={restoration.backup} label={restoration.label} onCancel={cancelRestoration} onConfirm={confirmRestoration} busy={restoring} error={dataError} onDismissError={() => setDataError('')} />}
      {showRecovery && <SafeDialog title={uiText("app.copias_de_recuperacion")} onCancel={() => setShowRecovery(false)}>
          <p className="text-sm text-slate-300">{uiText("app.descarga_una_copia_y_utiliza_importar_json_para_revisarla")}</p>
          {recoveryCopies(localStorage).length === 0 && <p>{uiText("app.no_hay_copias_anteriores")}</p>}
          {recoveryCopies(localStorage).map(copy => <button key={copy.key} className="block text-sky-400 text-sm" onClick={() => downloadJSON(copy.content, `${copy.key}.json`)}><I18nText id="app.descargar" values={{ timestamp: (copy.key.slice('finanzas_pro_recovery_'.length, -37)) }} /></button>)}
          <button onClick={() => setShowRecovery(false)} className="bg-white/10 rounded-xl px-4 py-2">{uiText("app.cerrar")}</button>
      </SafeDialog>}

      <TransferModal isOpen={!!transferToEdit} transferToEdit={transferToEdit} initiallyDelete={deleteTransferInitially}
        onClose={() => setTransferToEdit(null)} defaultWalletId={data.defaultWalletId} wallets={wallets} walletBalances={walletBalances}
        onExecuteTransfer={handleExecuteTransfer} onDeleteTransfer={handleDeleteTransfer} />
      {sharedDetailId && <SharedExpenseDetail data={data} id={sharedDetailId} onClose={() => setSharedDetailId(null)} />}
      {deleteTarget && <ConfirmDeleteDialog source={{data,target:deleteTarget}} report={deletionReport(data, deleteTarget)} onCancel={() => setDeleteTarget(null)} onConfirm={() => mutate(current => deleteEntity(current, deleteTarget))} confirmLabel={deleteTarget.kind === 'transaction' ? uiText("app.confirmar_eliminacion_del_movimiento") : undefined} />}
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
        defaultWalletId={data.defaultWalletId}
        defaultDate={`${currentMonthYear}-15`}
        transactionToEdit={transactionToEdit}
        subitems={data.budgetSubitems?.items}
        initialSubitemId={initialSubitemIdForModal}
        initialPartidaCode={initialPartidaCodeForModal}
        initialContactId={initialContactIdForModal}
        availablePartidas={allPartidas}
        budgetGroups={budgetGroups}
        transactions={storedTransactions}
        initialMovementType={initialMovementType}
      />

      {/* Partida Specific Detail Modal */}
      <PartidaDetailModal
        onReorder={request=>mutate(current=>applyCatalogReorder(current,request))}
        isOpen={isPartidaDetailOpen}
        onClose={() => {
          setIsPartidaDetailOpen(false);
          setSelectedPartidaForDetail(null);
        }}
        data={data}
        onEditSubitem={(edit:SubitemEdit)=>mutate(current=>editSubitem(current,edit))}
        partida={selectedPartidaForDetail}
        budgetRow={selectedBudgetRow}
        transactions={transactions}
        monthYear={currentMonthYear}
        onEditTransaction={handleOpenEditTransaction}
        onDeleteTransaction={handleDeleteTransaction}
        onToggleProcessed={handleToggleProcessed}
        onAddMovementToPartida={handleAddMovementToPartida}
        onUpdatePrevisto={handleUpdateBudgetPlan}
        onViewSharedDetails={setSharedDetailId}
        error={dataError || saveError}
      />

      {/* Confirmation Modal to Clear Selected Data & Reset */}
      <ConfirmClearModal
        data={data}
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
        defaultWalletId={data.defaultWalletId}
        wallets={wallets}
        settlementToEdit={settlementToEdit}
        initiallyDelete={deleteSettlementInitially}
        onDeleteSettlement={handleRemoveSettlement}
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

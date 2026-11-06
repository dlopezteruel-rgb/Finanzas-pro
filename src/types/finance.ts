export type MovementType = 'GASTO' | 'INGRESO';

export interface BudgetPartida {
  code: string;
  name: string;
  groupCode: string;
  groupName: string;
  type: MovementType;
  description?: string;
  keywords: string[];
}

export interface BudgetGroup {
  code: string;
  name: string;
  type: MovementType;
  partidas: BudgetPartida[];
}

export interface SplitParticipant {
  contactId: string;
  contactName: string;
  amount: number; // Importe que debe esta persona
  remainingAmount?: number; // Derived UI value; never persisted.
  isPaid: boolean; // Si ya ha saldado/devuelto el dinero
  paidDate?: string;
  reimbursementTxId?: string; // ID del movimiento de ingreso generado al saldar
}

export interface DebtSettlement {
  id: string;
  contactId: string;
  amount: number;
  date: string;
  processed: boolean;
  kind: 'cash' | 'offset';
  walletId?: string;
  transactionId?: string;
}

export interface SettlementInput {
  operationId?: string;
  expenseId: string;
  contactId: string;
  amount: number;
  date: string;
  processed: boolean;
  kind: 'cash' | 'offset';
  walletId?: string;
}

export type SharedDistribution = { method: 'equal' } | { method: 'amounts' } | {
  method: 'weighted'; ownWeight: number; contactWeights: { contactId: string; weight: number }[];
};

export interface SharedExpenseInfo {
  distribution?: SharedDistribution;
  accountingVersion?: '2.7';
  walletId?: string;
  settlements?: DebtSettlement[];
  isShared: boolean;
  totalParticipants: number; // ej. 2, 3 personas en total (incluyéndote a ti)
  myShare: number; // Tu parte real (ej. 10 €)
  totalOwedToMe: number; // Total que te deben entre todos (ej. 20 €)
  participants: SplitParticipant[];
}

export interface Contact {
  id: string;
  name: string;
  phoneOrEmail?: string;
  avatarColor?: string;
  notes?: string;
  createdAt: string;
}

export interface TransferLink {
  id: string;
  fromWalletId: string;
  toWalletId: string;
  leg: 'out' | 'in';
  concept: string;
}

export interface TransferInput {
  fromWalletId: string;
  toWalletId: string;
  amount: number;
  date: string;
  concept: string;
  processed: boolean;
}

export interface Transaction {
  id: string;
  date: string; // ISO YYYY-MM-DD
  amount: number; // positive number
  type: MovementType;
  code: string; // e.g. 'V.001.002'
  categoryName: string; // e.g. 'Alimentación'
  subcategoryName: string; // e.g. 'Comer fuera / cafeterías'
  description: string;
  wallet: string; // e.g. 'OPENBANK', 'REVOLUT', 'EFECTIVO'
  processed: boolean; // Tramitado: SÍ / NO
  transfer?: TransferLink;
  reimbursement?: { expenseId: string; settlementId: string; contactId: string; walletId: string };
  loanId?: string; // Optional reference if associated with a loan payment
  notes?: string;
  splitInfo?: SharedExpenseInfo; // Información de gasto compartido y deudas
}

export interface BudgetPlan {
  monthYear: string; // 'YYYY-MM'
  code: string; // Partida code
  type: MovementType; // GASTO or INGRESO
  plannedAmount: number;
}

/** Planning amounts are integer cents; budgetPlans remains the editable source. */
export interface PlanningLine {
  code: string;
  type: MovementType;
  amountCents: number;
}
export interface PlanningTotals {
  income: number;
  expenses: number;
  savings: number;
  available: number;
  margin: number;
  balance: number;
}
export interface PlanningApproval {
  number: number;
  revision: number;
  approvedAt: string;
  lines: PlanningLine[];
  totals: PlanningTotals;
}
export interface PlanningMonth {
  monthYear: string;
  savingsCents: number;
  revision: number;
  approval?: PlanningApproval;
}

export interface Wallet {
  id: string;
  name: string;
  type: 'BANK' | 'NEOBANK' | 'CASH' | 'SAVINGS' | 'INVESTMENT';
  initialBalance: number;
  color: string;
  ibanOrDetails?: string;
}

export interface Loan {
  id: string;
  name: string;
  entity: string; // e.g. 'BBVA', 'Santander'
  principal: number; // Capital inicial prestado
  interestRate: number; // TIN o TAE %
  totalTermMonths: number; // Plazo en meses
  startDate: string; // 'YYYY-MM-DD'
  monthlyPayment: number; // Cuota teórica mensual
  wallet: string; // Cartera habitual de cobro
  code: string; // Partida presupuestaria habitual (ej. E.002.001 o F.001.001)
  notes?: string;
}

export interface MonthlyBudgetRow {
  code: string;
  groupName: string;
  name: string;
  type: MovementType;
  previsto: number;
  ejecutado: number;
  resto: number; // PREVISTO - EJECUTADO
  percent: number; // (EJECUTADO / PREVISTO) * 100
  status: 'ok' | 'warning' | 'exceeded' | 'neutral';
  transactionCount: number;
}

export interface MonthlySummary {
  monthYear: string;
  ingresosPrevistos: number;
  ingresosReales: number;
  gastosPrevistos: number;
  gastosEjecutados: number;
  balancePrevisto: number; // INGRESOS PREVISTOS - GASTOS PREVISTOS
  balanceReal: number; // INGRESOS REALES - GASTOS EJECUTADOS
  restoTotal: number;
  tasaAhorroReal: number; // (Balance Real / Ingresos Reales) * 100
  tasaAhorroPrevista: number;
}

export interface ParsedMovement {
  type: MovementType;
  amount: number;
  code: string;
  categoryName: string;
  subcategoryName: string;
  description: string;
  wallet: string;
  date: string;
  processed: boolean;
  confidence: number;
  explanation?: string;
}

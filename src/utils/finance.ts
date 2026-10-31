import { Transaction, BudgetPlan, MonthlyBudgetRow, MonthlySummary, Loan, Wallet, BudgetPartida } from '../types/finance';
import { ALL_PARTIDAS } from '../constants/categories';

/**
 * Formats a numeric amount strictly to European currency format with 2 decimals (e.g. 154,25 €)
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0,00 €';
  }
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const parts = abs.toFixed(2).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimalPart = parts[1];
  const formatted = `${integerPart},${decimalPart} €`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Parses user string input to standard number (accepts commas or dots)
 */
export function parseCurrencyInput(value: string | number): number {
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (!value) return 0;
  let str = value.trim().replace(/[€\s]/g, '');
  if (!str) return 0;

  // If there's a comma, comma is likely the decimal separator
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else {
    // If no comma, check if there is a dot. If multiple dots, they are thousand separators
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount === 1) {
      // Single dot: e.g. 42.99 or 1500.5
      // If dot has 1 or 2 digits after it, it's decimal. If 3 digits and >= 1000, could be thousand separator.
      // In JS inputs, single dot with 1-2 digits is standard decimal.
    } else if (dotCount > 1) {
      str = str.replace(/\./g, '');
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Rule 2: Calculation of monthly budget and deviations
 * RESTO = PREVISTO - EJECUTADO
 * Balance Mensual Real = INGRESOS REALES - GASTOS EJECUTADOS
 * Balance Mensual Previsto = INGRESOS PREVISTOS - GASTOS PREVISTOS
 */
export function calculateMonthlyBudgetRows(
  monthYear: string, // 'YYYY-MM'
  transactions: Transaction[],
  budgetPlans: BudgetPlan[],
  allPartidas: BudgetPartida[] = ALL_PARTIDAS
): MonthlyBudgetRow[] {
  // Filter transactions for this monthYear and that are processed/counted
  const monthTransactions = transactions.filter(t => t.date.startsWith(monthYear));

  // Build lookup of plans for this month using composite key (type + code)
  const planMap: Record<string, number> = {};
  budgetPlans
    .filter(p => p.monthYear === monthYear)
    .forEach(p => {
      planMap[`${p.type}:${p.code}`] = p.plannedAmount;
    });

  // Calculate executed amounts per partida
  const executedMap: Record<string, { total: number; count: number }> = {};
  monthTransactions.forEach(t => {
    const key = `${t.type}:${t.code}`;
    if (!executedMap[key]) {
      executedMap[key] = { total: 0, count: 0 };
    }
    // Only processed movements count towards real executed budget
    if (t.processed) {
      executedMap[key].total += t.amount;
    }
    executedMap[key].count += 1;
  });

  // Create rows for all known partidas
  const rows: MonthlyBudgetRow[] = allPartidas.map(partida => {
    const key = `${partida.type}:${partida.code}`;
    const previsto = planMap[key] || 0;
    const executedData = executedMap[key] || { total: 0, count: 0 };
    const ejecutado = Math.round(executedData.total * 100) / 100;
    // RESTO = PREVISTO - EJECUTADO
    const resto = Math.round((previsto - ejecutado) * 100) / 100;

    const percent = previsto > 0 ? Math.round((ejecutado / previsto) * 100) : ejecutado > 0 ? 100 : 0;

    let status: 'ok' | 'warning' | 'exceeded' | 'neutral' = 'neutral';
    if (previsto > 0) {
      if (partida.type === 'GASTO') {
        if (ejecutado > previsto) status = 'exceeded';
        else if (ejecutado >= previsto * 0.9) status = 'warning';
        else status = 'ok';
      } else {
        // INGRESO: exceeding planned is good ('ok'), under 80% is warning
        if (ejecutado >= previsto) status = 'ok';
        else if (ejecutado >= previsto * 0.8) status = 'neutral';
        else status = 'warning';
      }
    } else if (ejecutado > 0) {
      status = partida.type === 'GASTO' ? 'exceeded' : 'ok';
    }

    return {
      code: partida.code,
      groupName: partida.groupName,
      name: partida.name,
      type: partida.type,
      previsto,
      ejecutado,
      resto,
      percent,
      status,
      transactionCount: executedData.count,
    };
  });

  return rows;
}

/**
 * Calculates global monthly summary
 */
export function calculateMonthlySummary(
  monthYear: string,
  transactions: Transaction[],
  budgetPlans: BudgetPlan[],
  allPartidas: BudgetPartida[] = ALL_PARTIDAS
): MonthlySummary {
  const rows = calculateMonthlyBudgetRows(monthYear, transactions, budgetPlans, allPartidas);

  let ingresosPrevistos = 0;
  let ingresosReales = 0;
  let gastosPrevistos = 0;
  let gastosEjecutados = 0;

  rows.forEach(r => {
    if (r.type === 'INGRESO') {
      ingresosPrevistos += r.previsto;
      ingresosReales += r.ejecutado;
    } else {
      gastosPrevistos += r.previsto;
      gastosEjecutados += r.ejecutado;
    }
  });

  ingresosPrevistos = Math.round(ingresosPrevistos * 100) / 100;
  ingresosReales = Math.round(ingresosReales * 100) / 100;
  gastosPrevistos = Math.round(gastosPrevistos * 100) / 100;
  gastosEjecutados = Math.round(gastosEjecutados * 100) / 100;

  // Balance Mensual Real = INGRESOS REALES - GASTOS EJECUTADOS
  const balanceReal = Math.round((ingresosReales - gastosEjecutados) * 100) / 100;
  // Balance Mensual Previsto = INGRESOS PREVISTOS - GASTOS PREVISTOS
  const balancePrevisto = Math.round((ingresosPrevistos - gastosPrevistos) * 100) / 100;

  const restoTotal = Math.round((gastosPrevistos - gastosEjecutados) * 100) / 100;

  const tasaAhorroReal = ingresosReales > 0 ? Math.round((balanceReal / ingresosReales) * 1000) / 10 : 0;
  const tasaAhorroPrevista = ingresosPrevistos > 0 ? Math.round((balancePrevisto / ingresosPrevistos) * 1000) / 10 : 0;

  return {
    monthYear,
    ingresosPrevistos,
    ingresosReales,
    gastosPrevistos,
    gastosEjecutados,
    balancePrevisto,
    balanceReal,
    restoTotal,
    tasaAhorroReal,
    tasaAhorroPrevista,
  };
}

/**
 * Rule 3: Loan and Debt Tracking
 * - Mantiene el seguimiento de cuotas teóricas vs. reales acumuladas.
 * - Calcula el saldo pendiente real en base a los pagos tramitados.
 */
export interface LoanStatus {
  loan: Loan;
  cuotasTeoricasAcumuladas: number;
  cuotasRealesTramitadas: number;
  totalPagadoReal: number;
  saldoPendienteReal: number;
  progresoPorcentaje: number;
  mesesTranscurridos: number;
  cuotasRestantes: number;
  alDia: boolean;
}

export function calculateLoanStatus(loan: Loan, transactions: Transaction[], referenceDateStr?: string): LoanStatus {
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const startDate = new Date(loan.startDate);

  // Calculate elapsed months since startDate
  const diffYears = refDate.getFullYear() - startDate.getFullYear();
  const diffMonths = refDate.getMonth() - startDate.getMonth();
  const totalMonthsPassed = Math.max(0, diffYears * 12 + diffMonths + 1);
  const cuotasTeoricasAcumuladas = Math.min(loan.totalTermMonths, totalMonthsPassed);

  // Find all transactions linked to this loan or matching description/code
  const loanTxs = transactions.filter(t => {
    if (t.type !== 'GASTO') return false;
    if (t.loanId === loan.id) return true;
    if (t.description.toLowerCase().includes(loan.name.toLowerCase())) return true;
    return false;
  });

  // Only tramitados count for real payments
  const tramitados = loanTxs.filter(t => t.processed);
  const totalPagadoReal = Math.round(tramitados.reduce((sum, t) => sum + t.amount, 0) * 100) / 100;
  const cuotasRealesTramitadas = tramitados.length;

  // Approximate principal amortization (or direct linear reduction if not detailed bank schedule)
  // Simple debt reduction formula: principal remaining = max(0, principal - amortized capital)
  // For standard personal loan, payments include interest + principal.
  // We calculate remaining debt:
  const saldoPendienteReal = Math.max(0, Math.round((loan.principal - totalPagadoReal) * 100) / 100);
  const progresoPorcentaje = Math.min(100, Math.round((totalPagadoReal / loan.principal) * 100));
  const cuotasRestantes = Math.max(0, loan.totalTermMonths - cuotasRealesTramitadas);
  const alDia = cuotasRealesTramitadas >= cuotasTeoricasAcumuladas;

  return {
    loan,
    cuotasTeoricasAcumuladas,
    cuotasRealesTramitadas,
    totalPagadoReal,
    saldoPendienteReal,
    progresoPorcentaje,
    mesesTranscurridos: totalMonthsPassed,
    cuotasRestantes,
    alDia,
  };
}

/**
 * Calculates current balance for each wallet:
 * Current = initialBalance + Sum(tramitados INGRESO) - Sum(tramitados GASTO)
 */
export function calculateWalletBalances(wallets: Wallet[], transactions: Transaction[]): Record<string, number> {
  const balances: Record<string, number> = {};

  wallets.forEach(w => {
    balances[w.name] = w.initialBalance;
  });

  transactions.forEach(t => {
    if (!t.processed) return; // Only processed impact real bank balance
    const walletName = t.wallet.toUpperCase().trim();
    if (balances[walletName] === undefined) {
      balances[walletName] = 0;
    }
    if (t.type === 'INGRESO') {
      balances[walletName] += t.amount;
    } else {
      balances[walletName] -= t.amount;
    }
  });

  // Round to 2 decimals
  Object.keys(balances).forEach(k => {
    balances[k] = Math.round(balances[k] * 100) / 100;
  });

  return balances;
}

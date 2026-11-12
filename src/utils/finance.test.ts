import {ALL_PARTIDAS} from '../constants/categories';
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrency, parseCurrencyInput, calculateMonthlyBudgetRows, calculateMonthlySummary, calculateLoanStatus, calculateWalletBalances } from './finance';
import { parseFinancialInput } from './parser';
import { Transaction, BudgetPlan, Loan, Wallet } from '../types/finance';

test('formatCurrency formats strictly with European commas, dots and euro symbol', () => {
  assert.equal(formatCurrency(154.25), '154,25 €');
  assert.equal(formatCurrency(1500), '1.500,00 €');
  assert.equal(formatCurrency(0), '0,00 €');
  assert.equal(formatCurrency(-42.1), '-42,10 €');
});

test('parseCurrencyInput handles both comma and dot decimals', () => {
  assert.equal(parseCurrencyInput('15,50 €'), 15.5);
  assert.equal(parseCurrencyInput('1.500,50'), 1500.5);
  assert.equal(parseCurrencyInput('42.99'), 42.99);
});

test('calculateMonthlyBudgetRows calculates RESTO = PREVISTO - EJECUTADO correctly', () => {
  const monthYear = '2026-10';
  const plans: BudgetPlan[] = [
    { monthYear: '2026-10', code: 'V.001.002', type: 'GASTO', plannedAmount: 150.00 }, // Comer fuera
  ];
  const txs: Transaction[] = [
    {
      id: 'tx1',
      date: '2026-10-15',
      amount: 15.50,
      type: 'GASTO',
      code: 'V.001.002',
      categoryName: 'VARIABLES',
      subcategoryName: 'Comer fuera / cafeterías',
      description: 'Cena tapas',
      wallet: 'OPENBANK',
      processed: true,
    },
    {
      id: 'tx2',
      date: '2026-10-20',
      amount: 34.50,
      type: 'GASTO',
      code: 'V.001.002',
      categoryName: 'VARIABLES',
      subcategoryName: 'Comer fuera / cafeterías',
      description: 'Comida menú',
      wallet: 'OPENBANK',
      processed: true,
    },
    {
      id: 'tx3_pending',
      date: '2026-10-25',
      amount: 50.00,
      type: 'GASTO',
      code: 'V.001.002',
      categoryName: 'VARIABLES',
      subcategoryName: 'Comer fuera / cafeterías',
      description: 'Cena no tramitada',
      wallet: 'OPENBANK',
      processed: false, // Not processed -> should NOT count towards executed
    },
  ];

  const rows = calculateMonthlyBudgetRows(monthYear, txs, plans);
  const row = rows.find(r => r.code === 'V.001.002');
  assert.ok(row, 'Row for V.001.002 exists');
  assert.equal(row.previsto, 150.00);
  assert.equal(row.ejecutado, 50.00); // 15.50 + 34.50
  assert.equal(row.resto, 100.00); // 150.00 - 50.00
  assert.equal(row.status, 'ok');
});

test('calculateMonthlySummary calculates Balance Real and Previsto', () => {
  const monthYear = '2026-10';
  const plans: BudgetPlan[] = [
    { monthYear: '2026-10', code: 'L.001.001', type: 'INGRESO', plannedAmount: 2500.00 }, // Ingreso nómina
    { monthYear: '2026-10', code: 'F.001.001', type: 'GASTO', plannedAmount: 800.00 }, // Alquiler
    { monthYear: '2026-10', code: 'V.001.001', type: 'GASTO', plannedAmount: 300.00 }, // Super
  ];

  const txs: Transaction[] = [
    {
      id: 'tx1',
      date: '2026-10-01',
      amount: 2500.00,
      type: 'INGRESO',
      code: 'L.001.001',
      categoryName: 'LABORALES',
      subcategoryName: 'Fijo',
      description: 'Nómina',
      wallet: 'SANTANDER',
      processed: true,
    },
    {
      id: 'tx2',
      date: '2026-10-03',
      amount: 800.00,
      type: 'GASTO',
      code: 'F.001.001',
      categoryName: 'FIJOS',
      subcategoryName: 'Alquiler',
      description: 'Alquiler piso',
      wallet: 'OPENBANK',
      processed: true,
    },
    {
      id: 'tx3',
      date: '2026-10-05',
      amount: 250.00,
      type: 'GASTO',
      code: 'V.001.001',
      categoryName: 'VARIABLES',
      subcategoryName: 'Supermercado',
      description: 'Mercadona',
      wallet: 'OPENBANK',
      processed: true,
    },
  ];

  const summary = calculateMonthlySummary(monthYear, txs, plans);
  // Balance Previsto = 2500 - (800 + 300) = 1400
  assert.equal(summary.balancePrevisto, 1400.00);
  // Balance Real = 2500 - (800 + 250) = 1450
  assert.equal(summary.balanceReal, 1450.00);
});

test('calculateLoanStatus tracks theoretical vs real quotas and pending debt', () => {
  const loan: Loan = {
    id: 'loan-1',
    name: 'Préstamo Coche',
    entity: 'BBVA',
    principal: 12000.00,
    interestRate: 5.5,
    totalTermMonths: 48,
    startDate: '2026-05-01',
    monthlyPayment: 279.00,
    wallet: 'OPENBANK',
    code: 'E.002.001',
  };

  // 6 processed payments
  const txs: Transaction[] = Array.from({ length: 6 }).map((_, i) => ({
    id: `tx-loan-${i}`,
    date: `2026-0${5 + i}-05`,
    amount: 279.00,
    type: 'GASTO',
    code: 'E.002.001',
    categoryName: 'ECONÓMICOS',
    subcategoryName: 'Cuotas de préstamos personales',
    description: 'Cuota Préstamo Coche',
    wallet: 'OPENBANK',
    processed: true,
    loanId: 'loan-1',
  }));

  const refDate = '2026-10-30';
  const status = calculateLoanStatus(loan, txs, refDate);
  assert.equal(status.cuotasRealesTramitadas, 6);
  assert.equal(status.totalPagadoReal, 6 * 279.00); // 1674.00
  assert.equal(status.saldoPendienteReal, 12000 - 1674.00); // 10326.00
  assert.equal(status.cuotasRestantes, 42);
  assert.equal(status.alDia, true);
});

test('parseFinancialInput correctly classifies user prompt example', () => {
  const text = 'Ayer cené fuera por 15,50 € con Openbank';
  const refDate = new Date('2026-10-30T12:00:00Z');
  const parsed = parseFinancialInput(text, refDate,ALL_PARTIDAS);

  assert.ok(parsed, 'Parsed movement should not be null');
  assert.equal(parsed.amount, 15.50);
  assert.equal(parsed.type, 'GASTO');
  assert.equal(parsed.code, 'V.001.002');
  assert.equal(parsed.wallet, 'OPENBANK');
  assert.equal(parsed.date, '2026-10-29'); // Yesterday relative to Oct 30
  assert.equal(parsed.processed, true);
});

test('parseFinancialInput correctly classifies salary income', () => {
  const text = 'Nómina mensual cobrada 2450 € en Santander';
  const parsed = parseFinancialInput(text,undefined,ALL_PARTIDAS);

  assert.ok(parsed);
  assert.equal(parsed.amount, 2450);
  assert.equal(parsed.type, 'INGRESO');
  assert.equal(parsed.code, 'L.001.001');
  assert.equal(parsed.wallet, 'SANTANDER');
  assert.equal(parsed.processed, true);
});

test('calculateWalletBalances updates balances based on processed movements', () => {
  const wallets: Wallet[] = [
    { id: 'w1', name: 'OPENBANK', type: 'BANK', initialBalance: 1000, color: '#e63946' },
  ];
  const txs: Transaction[] = [
    {
      id: 't1',
      date: '2026-10-01',
      amount: 150,
      type: 'GASTO',
      code: 'V.001.001',
      categoryName: 'VARIABLES',
      subcategoryName: 'Super',
      description: 'Compra',
      wallet: 'OPENBANK',
      processed: true,
    },
    {
      id: 't2',
      date: '2026-10-02',
      amount: 50,
      type: 'GASTO',
      code: 'V.001.002',
      categoryName: 'VARIABLES',
      subcategoryName: 'Bar',
      description: 'Café',
      wallet: 'OPENBANK',
      processed: false, // not processed
    },
  ];

  const balances = calculateWalletBalances(wallets, txs);
  assert.equal(balances['OPENBANK'], 850); // 1000 - 150 (ignored unprocessed 50)
});

import test from 'node:test';
import assert from 'node:assert/strict';
import type { Transaction, TransferInput, Wallet } from '../types/finance';
import { assertTransferIntegrity, deleteTransfer, economicTransactions, isLegacyTransfer, legacyTransferReport, migrateLegacyTransfers, parseTransferAmount, saveTransfer, transferPair } from './transfers';
import { calculateLoanStatus, calculateMonthlyBudgetRows, calculateMonthlySummary, calculateWalletBalances } from './finance';
import { backupWarnings, DATA_KEY, FinanceData, makeBackup, parseBackup, parseSnapshot, recoveryCopies, serializeSnapshot, StorageConflictError, validateBackup } from './backup';
import { FinanceStore, type ExclusiveWrite } from './financeStore';
import { BUDGET_GROUPS } from '../constants/categories';
import { clearedData } from './clearData';

const wallets: Wallet[] = [
  { id: 'openbank', name: 'OPENBANK', type: 'BANK', initialBalance: 1000, color: '#fff' },
  { id: 'revolut', name: 'REVOLUT', type: 'NEOBANK', initialBalance: 200, color: '#fff' },
];
const input: TransferInput = { fromWalletId: 'openbank', toWalletId: 'revolut', amount: 500, date: '2026-10-08', concept: 'Ahorro', processed: true };
const normal = (type: Transaction['type'], code: string, amount: number, id = type): Transaction => ({ id, type, code, amount, date: input.date, categoryName: 'Normal', subcategoryName: 'Normal', description: 'Movimiento normal', wallet: 'OPENBANK', processed: true });
const fixture = (): FinanceData => ({ theme: 'dark', transactions: [normal('INGRESO', 'L.001.001', 2000), normal('GASTO', 'V.001.002', 100)], wallets: structuredClone(wallets), budgetGroups: structuredClone(BUDGET_GROUPS), budgetPlans: [{ monthYear: '2026-10', code: 'V.001.002', type: 'GASTO', plannedAmount: 300 }], loans: [], contacts: [] });
export function historicalPair(): Transaction[] {
  const [out, incoming] = transferPair(wallets, input, 'old');
  const { transfer: _out, ...a } = out;
  const { transfer: _in, ...b } = incoming;
  return [{ ...a, id: 'tx-traspaso-out-100', notes: 'Traspaso ordenado hacia REVOLUT' }, { ...b, id: 'tx-traspaso-in-101', notes: 'Traspaso recibido desde OPENBANK' }];
}
class MemoryStorage {
  values = new Map<string, string>();
  fail: (key: string) => boolean = () => false;
  writes = 0;
  get length() { return this.values.size; }
  key(i: number) { return [...this.values.keys()][i] ?? null; }
  getItem(k: string) { return this.values.get(k) ?? null; }
  setItem(k: string, v: string) { if (this.fail(k)) throw new DOMException('Cuota', 'QuotaExceededError'); this.writes++; this.values.set(k, v); }
}
const exclusive: ExclusiveWrite = async write => write();
const sum = (values: Record<string, number>) => Object.values(values).reduce((a, b) => a + b, 0);

function assertAccounting(before: FinanceData, after: FinanceData, amount = 500) {
  const a = calculateWalletBalances(before.wallets, before.transactions), b = calculateWalletBalances(after.wallets, after.transactions);
  assert.equal(b.OPENBANK - a.OPENBANK, -amount); assert.equal(b.REVOLUT - a.REVOLUT, amount); assert.equal(sum(b) - sum(a), 0);
  assert.deepEqual(calculateMonthlySummary('2026-10', after.transactions, after.budgetPlans), calculateMonthlySummary('2026-10', before.transactions, before.budgetPlans));
  assert.deepEqual(calculateMonthlyBudgetRows('2026-10', after.transactions, after.budgetPlans), calculateMonthlyBudgetRows('2026-10', before.transactions, before.budgetPlans));
}

test('500 € OPENBANK → REVOLUT: patrimonio, ingresos, gastos, presupuesto y ahorro invariables', () => {
  const before = fixture(); const after = { ...before, transactions: saveTransfer(before.transactions, wallets, input) };
  assertAccounting(before, after);
  const summary = calculateMonthlySummary('2026-10', after.transactions, after.budgetPlans);
  assert.equal(summary.ingresosReales, 2000); assert.equal(summary.gastosEjecutados, 100); assert.equal(summary.tasaAhorroReal, 95);
});

test('F.003.001 conserva los seguros y créditos normales, sin confundirlos con traspasos', () => {
  const txs = [normal('GASTO', 'F.003.001', 30), normal('INGRESO', 'F.003.001', 200)];
  assert.deepEqual(economicTransactions(txs), txs);
  const summary = calculateMonthlySummary('2026-10', txs, []);
  assert.equal(summary.ingresosReales, 200); assert.equal(summary.gastosEjecutados, 30);
});

for (const amount of [0, -500, NaN, Infinity, -Infinity, 0.001, 1.234, Number.MAX_VALUE, 1.0000000001]) test(`rechaza importe inválido ${amount}`, () => assert.throws(() => transferPair(wallets, { ...input, amount }), /importe/));
test('parser de traspasos estricto; no acepta prefijos, miles ambiguos o infinitos', () => {
  assert.equal(parseTransferAmount('500,25'), 500.25); assert.equal(parseTransferAmount('500.25'), 500.25);
  for (const value of ['500foo', 'Infinity', '1.000', '1,000', '1.000,00', '', '1e3', '-20']) assert.ok(Number.isNaN(parseTransferAmount(value)));
});
test('rechaza carteras iguales, inexistentes y fechas no reales', () => {
  for (const change of [{ toWalletId: 'openbank' }, { fromWalletId: 'missing' }, { toWalletId: 'missing' }, { date: '2026-02-30' }]) assert.throws(() => transferPair(wallets, { ...input, ...change }));
});

test('edición y eliminación son completas, conservan IDs y vuelven al saldo inicial', () => {
  const before = fixture(); const txs = saveTransfer(before.transactions, wallets, input, undefined); const id = txs[0].transfer!.id;
  const edited = saveTransfer(txs, wallets, { ...input, amount: 125, date: '2026-10-09', concept: 'Revisado' }, id);
  assert.deepEqual(edited.map(t => t.id), txs.map(t => t.id)); assertTransferIntegrity(edited, wallets);
  assertAccounting(before, { ...before, transactions: edited }, 125);
  assert.equal(edited.filter(t => t.transfer && t.amount === 125 && t.date === '2026-10-09').length, 2);
  assert.deepEqual(deleteTransfer(edited, id), before.transactions);
  assert.throws(() => saveTransfer(txs, wallets, input, 'missing')); assert.throws(() => deleteTransfer(txs, 'missing'));
});

test('transferencia pendiente y tramitación conjunta conservan los cálculos económicos', () => {
  const before = fixture(); const pending = saveTransfer(before.transactions, wallets, { ...input, processed: false });
  assert.deepEqual(calculateWalletBalances(wallets, pending), calculateWalletBalances(wallets, before.transactions));
  assert.deepEqual(calculateMonthlySummary('2026-10', pending, []), calculateMonthlySummary('2026-10', before.transactions, []));
});

test('validación rechaza extremos huérfanos, alterados o con enlaces a préstamos/deudas', () => {
  const data = { ...fixture(), transactions: transferPair(wallets, input) };
  const mutations = [
    (d: FinanceData) => { d.transactions.pop(); },
    (d: FinanceData) => { d.transactions[0].amount++; },
    (d: FinanceData) => { d.transactions[0].date = '2026-10-10'; },
    (d: FinanceData) => { d.transactions[0].processed = false; },
    (d: FinanceData) => { d.transactions[0].transfer!.toWalletId = 'missing'; },
    (d: FinanceData) => { d.transactions[0].transfer!.fromWalletId = 'revolut'; },
    (d: FinanceData) => { d.transactions[0].transfer!.leg = 'in'; },
    (d: FinanceData) => { d.transactions[0].transfer!.concept = 'distinto'; },
    (d: FinanceData) => { d.transactions[0].type = 'INGRESO'; },
    (d: FinanceData) => { d.transactions[0].loanId = 'loan'; },
    (d: FinanceData) => { d.wallets.pop(); },
    (d: FinanceData) => { d.transactions[0].code = 'V.001.002'; },
  ];
  for (const mutate of mutations) { const bad = structuredClone(data); mutate(bad); assert.throws(() => validateBackup(makeBackup(bad))); }
});

test('recarga y exportación/restauración 2.6 conservan íntegra la relación y los importes', async () => {
  const storage = new MemoryStorage(), before = fixture(); const store = new FinanceStore(storage, before, exclusive);
  await store.update('transactions', txs => saveTransfer(txs, wallets, input));
  assert.equal(makeBackup(store.data).version, '2.6');
  assertAccounting(before, new FinanceStore(storage, fixture(), exclusive).data);
  const exported = parseBackup(JSON.stringify(makeBackup(store.data)));
  assert.deepEqual(exported.transactions, store.data.transactions);
  const restoredStorage = new MemoryStorage(), restored = new FinanceStore(restoredStorage, before, exclusive);
  await restored.restore(exported); assertAccounting(before, restored.data);
  const previous = parseBackup(recoveryCopies(storage)[0].content);
  assert.equal(previous.version, '2.5'); assert.deepEqual(previous.transactions, before.transactions);
});

test('2.5 se lee sin cambios; no se admiten metadatos nuevos disfrazados de 2.5', () => {
  const backup = makeBackup(fixture()); assert.equal(backup.version, '2.5');
  assert.deepEqual(parseBackup(JSON.stringify(backup)), backup);
  const upgraded = makeBackup({ ...fixture(), transactions: transferPair(wallets, input) });
  assert.throws(() => parseBackup(JSON.stringify({ ...upgraded, version: '2.5' })), /campo no reconocido/);
});

test('renombrar una cartera no rompe el saldo ni los vínculos del traspaso', async () => {
  const data = { ...fixture(), transactions: transferPair(wallets, input) };
  const store = new FinanceStore(new MemoryStorage(), data, exclusive);
  await store.update('wallets', ws => ws.map(w => w.id === 'openbank' ? { ...w, name: 'Banco renombrado' } : w));
  const balance = calculateWalletBalances(store.data.wallets, store.data.transactions);
  assert.equal(balance['Banco renombrado'], 500); assert.equal(balance.REVOLUT, 700); assert.equal(balance.OPENBANK, undefined);
  await assert.rejects(store.update('wallets', ws => ws.filter(w => w.id !== 'openbank')), /carteras/);
});

for (const operation of ['create', 'edit', 'delete', 'toggle', 'migrate', 'restore'] as const) test(`${operation}: un fallo de cuota mantiene los dos extremos y permite reintentar`, async () => {
  const storage = new MemoryStorage(); const data = fixture();
  if (operation === 'migrate') data.transactions.push(...historicalPair());
  else if (operation !== 'create') data.transactions = saveTransfer(data.transactions, wallets, input);
  storage.setItem(DATA_KEY, serializeSnapshot(data));
  const store = new FinanceStore(storage, fixture(), exclusive); const before = storage.getItem(DATA_KEY); const original = structuredClone(store.data);
  const change = () => operation === 'migrate' ? store.restore(makeBackup(migrateLegacyTransfers(store.data))) : operation === 'restore' ? store.restore(makeBackup({ ...fixture(), transactions: transferPair(wallets, input) })) : store.update('transactions', txs => {
    const id = txs[0].transfer?.id;
    return operation === 'create' ? saveTransfer(txs, wallets, input) : operation === 'delete' ? deleteTransfer(txs, id!) : operation === 'edit' ? saveTransfer(txs, wallets, { ...input, amount: 200 }, id) : txs.map(t => t.transfer?.id === id ? { ...t, processed: !t.processed } : t);
  });
  storage.fail = k => k === DATA_KEY;
  await assert.rejects(change(), /Cuota/); assert.equal(storage.getItem(DATA_KEY), before); assert.deepEqual(store.data, original);
  storage.fail = () => false; await change(); assertTransferIntegrity(store.data.transactions, wallets);
  if (operation === 'delete') assert.equal(store.data.transactions.some(t => t.transfer), false);
});

test('primer cambio de formato: fallo en la copia previa impide crear el traspaso', async () => {
  const storage = new MemoryStorage(), before = fixture(); const store = new FinanceStore(storage, before, exclusive);
  storage.fail = key => key !== DATA_KEY;
  await assert.rejects(store.update('transactions', txs => saveTransfer(txs, wallets, input)), /Cuota/);
  assert.equal(storage.getItem(DATA_KEY), null); assert.deepEqual(store.data.transactions, before.transactions);
});

test('conflictos entre pestañas bloquean creación, edición, borrado y migración completos', async () => {
  for (const mode of ['create', 'edit', 'delete', 'migrate']) {
    const storage = new MemoryStorage(), data = fixture();
    if (mode === 'migrate') data.transactions.push(...historicalPair());
    else if (mode !== 'create') data.transactions = saveTransfer(data.transactions, wallets, input);
    storage.setItem(DATA_KEY, serializeSnapshot(data));
    const stale = new FinanceStore(storage, data, exclusive), other = new FinanceStore(storage, data, exclusive);
    await other.update('theme', 'light'); const newer = storage.getItem(DATA_KEY);
    const action = mode === 'migrate' ? stale.restore(makeBackup(migrateLegacyTransfers(stale.data))) : stale.update('transactions', txs => mode === 'create' ? saveTransfer(txs, wallets, input) : mode === 'edit' ? saveTransfer(txs, wallets, { ...input, amount: 10 }, txs[0].transfer!.id) : deleteTransfer(txs, txs[0].transfer!.id));
    await assert.rejects(action, StorageConflictError); assert.equal(storage.getItem(DATA_KEY), newer);
    assertTransferIntegrity(parseSnapshot(newer!).transactions, wallets);
  }
});

test('histórico inequívoco: lectura sin escritura, migración aditiva explícita e idempotente', async () => {
  const data = fixture(); data.transactions.push(...historicalPair());
  const untouched = structuredClone(data); const storage = new MemoryStorage(); storage.setItem(DATA_KEY, JSON.stringify(makeBackup(data)));
  const before = storage.getItem(DATA_KEY), writes = storage.writes;
  const store = new FinanceStore(storage, fixture(), exclusive);
  assert.equal(storage.writes, writes); assert.equal(storage.getItem(DATA_KEY), before); assert.deepEqual(data, untouched);
  assertAccounting(fixture(), store.data);
  assert.equal(legacyTransferReport(store.data.transactions, wallets).pairs.length, 1);
  const migrated = migrateLegacyTransfers(store.data);
  assert.deepEqual(migrateLegacyTransfers(migrated), migrated);
  for (const old of data.transactions) { const { transfer, ...preserved } = migrated.transactions.find(t => t.id === old.id)!; assert.deepEqual(preserved, old); }
  await store.restore(makeBackup(migrated));
  assert.deepEqual(JSON.parse(recoveryCopies(storage)[0].content).transactions, data.transactions);
  assertAccounting(fixture(), store.data); assert.equal(legacyTransferReport(store.data.transactions).pairs.length, 0);
});

test('históricos ambiguos, huérfanos, modificados o sin carteras: se conservan y se avisa', () => {
  for (const change of [(txs: Transaction[]) => { txs.pop(); }, (txs: Transaction[]) => { txs[1].amount = 501; }, (txs: Transaction[]) => { txs[1].notes = 'editado'; }, (txs: Transaction[]) => { txs[1].id = 'otro-id'; }]) {
    const data = fixture(); const history = historicalPair(); change(history); data.transactions.push(...history);
    const migrated = migrateLegacyTransfers(data); assert.deepEqual(migrated, data);
    assert.equal(legacyTransferReport(history).pairs.length, 0); assert.ok(backupWarnings(data).some(w => /sin correspondencia/.test(w)));
  }
  const data = { ...fixture(), transactions: historicalPair(), wallets: [] };
  assert.deepEqual(migrateLegacyTransfers(data), data); assert.ok(backupWarnings(data).some(w => /sin carteras/.test(w)));
});

test('no se permite editar ni borrar un extremo histórico fuera de la migración', async () => {
  const data = { ...fixture(), transactions: historicalPair() }, store = new FinanceStore(new MemoryStorage(), data, exclusive);
  await assert.rejects(store.update('transactions', txs => txs.slice(1)), /histórico/);
  await assert.rejects(store.update('transactions', txs => txs.map((t, i) => i ? t : { ...t, amount: 4 })), /histórico/);
  await assert.rejects(store.update('wallets', ws => ws.map(w => ({ ...w, name: w.name + '2' }))), /históricos/);
  assert.equal(isLegacyTransfer(normal('GASTO', 'F.003.001', 30)), false);
});

test('borrado parcial de carteras bloqueado; borrado completo conserva copia íntegra', async () => {
  const data = { ...fixture(), transactions: transferPair(wallets, input) };
  const opts = { clearAllWallets: true, clearTransactions: false, clearWalletBalances: false, clearBudgets: false, clearDebts: false };
  assert.throws(() => clearedData(data, opts), /traspasos/);
  const storage = new MemoryStorage(), store = new FinanceStore(storage, data, exclusive);
  await store.restore(makeBackup(clearedData(store.data, { ...opts, clearTransactions: true })));
  assert.equal(store.data.transactions.length, 0); assert.equal(store.data.wallets.length, 0);
  assert.deepEqual(parseBackup(recoveryCopies(storage)[0].content).transactions, data.transactions);
});

test('no se pueden retirar los metadatos de un extremo ni de ambos en una edición normal', async () => {
  const data = { ...fixture(), transactions: transferPair(wallets, input) };
  const store = new FinanceStore(new MemoryStorage(), data, exclusive);
  await assert.rejects(store.update('transactions', txs => txs.map(t => { const { transfer, ...normal } = t; return normal; })), /desvincular/);
  await assert.rejects(store.update('transactions', txs => txs.slice(1)), /dos extremos/);
});

test('editar el sentido del traspaso y recargar mantiene los IDs y revierte los saldos', async () => {
  const storage = new MemoryStorage(), data = fixture(), store = new FinanceStore(storage, data, exclusive);
  await store.update('transactions', txs => saveTransfer(txs, wallets, input));
  const before = store.data.transactions.filter(t => t.transfer).map(t => t.id), id = store.data.transactions[0].transfer!.id;
  await store.update('transactions', txs => saveTransfer(txs, wallets, { ...input, fromWalletId: 'revolut', toWalletId: 'openbank' }, id));
  const reloaded = new FinanceStore(storage, data, exclusive).data;
  assert.deepEqual(reloaded.transactions.filter(t => t.transfer).map(t => t.id), before);
  assertAccounting(data, reloaded, -500);
});


test('un concepto de traspaso que menciona un préstamo no se convierte en una cuota', () => {
  const loan = { id: 'loan', name: 'Préstamo coche', entity: 'Banco', principal: 1000, interestRate: 0, totalTermMonths: 12, startDate: '2026-01-01', monthlyPayment: 100, wallet: 'OPENBANK', code: 'E.002.001' };
  const transactions = transferPair(wallets, { ...input, concept: 'Préstamo coche' });
  assert.equal(calculateLoanStatus(loan, transactions, '2026-10-08').totalPagadoReal, 0);
});

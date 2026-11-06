import test from 'node:test';
import assert from 'node:assert/strict';
import type { Transaction, SettlementInput } from '../types/finance';
import { FinanceData, makeBackup, parseBackup, serializeSnapshot, DATA_KEY, recoveryCopies, backupWarnings } from './backup';
import { FinanceStore, type ExclusiveWrite } from './financeStore';
import { BUDGET_GROUPS } from '../constants/categories';
import { adjustDebt, assertSharedIntegrity, cents, deleteSettlement, migrateSharedExpenses, remainingDebt, saveSettlement, saveSharedTransaction, sharedMigrationReport, sharedViewTransactions, splitExactly } from './sharedExpenses';
import { calculateLoanStatus, calculateMonthlyBudgetRows, calculateMonthlySummary, calculateWalletBalances } from './finance';
import { economicTransactions, transferPair } from './transfers';

const base = (): FinanceData => ({ theme: 'dark', transactions: [], budgetGroups: structuredClone(BUDGET_GROUPS), budgetPlans: [], loans: [],
  contacts: [{ id: 'a', name: 'Ana', createdAt: '2026-01-01' }, { id: 'b', name: 'Bea', createdAt: '2026-01-01' }],
  wallets: [{ id: 'bank', name: 'OPENBANK', type: 'BANK', color: '#fff', initialBalance: 1000 }, { id: 'rev', name: 'REVOLUT', type: 'NEOBANK', color: '#fff', initialBalance: 100 }] });
const expense = (amount = 60, processed = true): Transaction => ({ id: 'dinner', date: '2026-10-08', amount, type: 'GASTO', code: 'V.001.002', categoryName: 'Alimentación', subcategoryName: 'Comer fuera', description: 'Cena ficticia', wallet: 'OPENBANK', processed, splitInfo: splitExactly(amount, base().contacts, 'bank') });
const fixture = (amount = 60, processed = true): FinanceData => ({ ...base(), transactions: [expense(amount, processed)] });
const input = (amount = 20, contactId = 'a', date = '2026-10-09'): SettlementInput => ({ expenseId: 'dinner', contactId, amount, date, kind: 'cash', processed: true, walletId: 'rev' });
const parent = (d: FinanceData) => d.transactions.find(t => t.id === 'dinner')!;
const summary = (d: FinanceData, month = '2026-10') => calculateMonthlySummary(month, d.transactions, d.budgetPlans);
class Memory {
  values = new Map<string, string>();
  fail: (key: string) => boolean = () => false;
  get length() { return this.values.size; }
  key(i: number) { return [...this.values.keys()][i] ?? null; }
  getItem(k: string) { return this.values.get(k) ?? null; }
  setItem(k: string, v: string) { if (this.fail(k)) throw new DOMException('Cuota simulada', 'QuotaExceededError'); this.values.set(k, v); }
}
const exclusive: ExclusiveWrite = async write => write();
function oldData(paid = false): FinanceData {
  const d = fixture(), e = parent(d), s = e.splitInfo!;
  delete s.accountingVersion; delete s.walletId; delete s.settlements;
  if (paid) {
    s.participants[0] = { ...s.participants[0], isPaid: true, paidDate: '2026-10-09', reimbursementTxId: 'old-receipt' };
    d.transactions.unshift({ id: 'old-receipt', date: '2026-10-09', amount: 20, type: 'INGRESO', code: e.code, categoryName: e.categoryName, subcategoryName: e.subcategoryName, wallet: 'REVOLUT', processed: true, description: 'Reintegro Ana: Cena ficticia' });
  }
  return d;
}

test('A/B/C: cena 60 €, gasto propio 20 €, deuda 40 → 20 → 0, sin ingresos económicos', () => {
  const a = fixture(); assertSharedIntegrity(a);
  assert.equal(calculateWalletBalances(a.wallets, a.transactions).OPENBANK, 940);
  assert.equal(summary(a).gastosEjecutados, 20); assert.equal(summary(a).ingresosReales, 0);
  assert.equal(parent(a).splitInfo!.participants.reduce((s, p) => s + remainingDebt(parent(a), p.contactId), 0), 40);
  const b = saveSettlement(a, input()); assert.equal(calculateWalletBalances(b.wallets, b.transactions).REVOLUT, 120);
  assert.equal(remainingDebt(parent(b), 'a'), 0); assert.equal(remainingDebt(parent(b), 'b'), 20);
  const c = saveSettlement(b, input(20, 'b')); assert.equal(calculateWalletBalances(c.wallets, c.transactions).REVOLUT, 140);
  assert.equal(remainingDebt(parent(c), 'b'), 0); assert.deepEqual(summary(c), summary(a));
  assert.deepEqual(calculateMonthlyBudgetRows('2026-10', c.transactions, []), calculateMonthlyBudgetRows('2026-10', a.transactions, []));
});

test('D: reparto exacto 100/3 y cientos de combinaciones mantienen el total en céntimos', () => {
  const s = splitExactly(100, base().contacts, 'bank');
  assert.deepEqual([s.myShare, ...s.participants.map(p => p.amount)], [33.34, 33.33, 33.33]);
  for (let total = 1; total <= 10000; total += 37) for (let count = 1; count < 7; count++) {
    const split = splitExactly(total / 100, Array.from({ length: count }, (_, i) => ({ id: String(i), name: String(i), createdAt: '2026-01-01' })), 'bank');
    assert.equal(cents(split.myShare) + split.participants.reduce((n, p) => n + cents(p.amount), 0), total);
  }
});

test('E: pago parcial, reserva de cobros no tramitados y rechazo de duplicados/sobrecobros', () => {
  const d = saveSettlement(fixture(), input(10)); assert.equal(remainingDebt(parent(d), 'a'), 10);
  assert.throws(() => saveSettlement(d, input(11)), /supera|duplica/);
  const paid = saveSettlement(d, input(10)); assert.equal(remainingDebt(parent(paid), 'a'), 0);
  assert.throws(() => saveSettlement(paid, input()), /supera|duplica/);
  const pending = saveSettlement(fixture(), { ...input(), processed: false });
  assert.equal(remainingDebt(parent(pending), 'a'), 20); assert.equal(calculateWalletBalances(pending.wallets, pending.transactions).REVOLUT, 100);
  assert.throws(() => saveSettlement(pending, input()), /supera|duplica/);
});

test('F: reintegro en noviembre solo altera caja y deuda; gasto propio queda en octubre', () => {
  const d = saveSettlement(fixture(), input(20, 'a', '2026-11-05'));
  assert.equal(summary(d).gastosEjecutados, 20); assert.equal(summary(d, '2026-11').gastosEjecutados, 0);
  assert.equal(summary(d, '2026-11').ingresosReales, 0); assert.equal(remainingDebt(parent(d), 'a'), 0);
});

test('processed: gasto no tramitado no modifica caja ni presupuesto ni admite cobros', () => {
  const d = fixture(60, false); assert.equal(summary(d).gastosEjecutados, 0);
  assert.equal(calculateWalletBalances(d.wallets, d.transactions).OPENBANK, 1000);
  assert.throws(() => saveSettlement(d, input()), /no está tramitado/);
});

test('compensación persistida sin movimiento bancario; editar/borrar reconstruye la deuda', () => {
  const d = saveSettlement(fixture(), { ...input(10), kind: 'offset', walletId: undefined });
  assert.equal(d.transactions.length, 1); assert.equal(remainingDebt(parent(d), 'a'), 10);
  assert.equal(calculateWalletBalances(d.wallets, d.transactions).REVOLUT, 100);
  const s = parent(d).splitInfo!.settlements![0];
  const cash = saveSettlement(d, input(10), s.id); assert.equal(cash.transactions.length, 2);
  const edited = saveSettlement(cash, input(15), s.id); assert.equal(remainingDebt(parent(edited), 'a'), 5);
  assert.equal(calculateWalletBalances(edited.wallets, edited.transactions).REVOLUT, 115);
  const deleted = deleteSettlement(edited, 'dinner', s.id);
  assert.equal(deleted.transactions.length, 1); assert.equal(remainingDebt(parent(deleted), 'a'), 20);
  assert.deepEqual(summary(deleted), summary(d));
});

test('corrección manual de la deuda mantiene la igualdad y no reescribe cobros', () => {
  const d = saveSettlement(fixture(), input(10)); const s = structuredClone(parent(d).splitInfo!.settlements);
  const adjusted = adjustDebt(d, 'dinner', 'a', 15);
  assert.equal(parent(adjusted).splitInfo!.myShare, 25); assert.equal(remainingDebt(parent(adjusted), 'a'), 5);
  assert.deepEqual(parent(adjusted).splitInfo!.settlements, s);
  assert.throws(() => adjustDebt(d, 'dinner', 'a', 9), /supera|duplica/);
  assert.throws(() => adjustDebt(d, 'dinner', 'a', 45), /superan/);
});

test('edición del concepto conserva reparto manual y cobros; cambios contables con cobros se rechazan', async () => {
  const storage = new Memory(), d = adjustDebt(saveSettlement(fixture(), input(10)), 'dinner', 'a', 15);
  storage.setItem(DATA_KEY, serializeSnapshot(d)); const store = new FinanceStore(storage, base(), exclusive);
  await store.mutate(current => saveSharedTransaction(current, { ...parent(current), description: 'Concepto revisado', splitInfo: splitExactly(60, current.contacts, 'bank') }, 'dinner'));
  assert.equal(parent(store.data).splitInfo!.myShare, 25); assert.equal(remainingDebt(parent(store.data), 'a'), 5);
  const raw = storage.getItem(DATA_KEY);
  for (const change of [{ amount: 90 }, { code: 'V.001.001' }, { date: '2026-10-01' }, { processed: false }, { splitInfo: undefined }]) {
    await assert.rejects(store.mutate(current => ({ ...current, transactions: current.transactions.map(t => t.id === 'dinner' ? { ...t, ...change } : t) })));
    assert.equal(storage.getItem(DATA_KEY), raw);
  }
  await assert.rejects(store.update('transactions', ts => ts.filter(t => t.id !== 'dinner')));
  await assert.rejects(store.update('contacts', cs => cs.filter(c => c.id !== 'a')), /contacto/);
});

test('relaciones por ID: nombres iguales y renombrado de contactos/carteras no cambian deudas ni saldos', async () => {
  const d = saveSettlement(fixture(), input(10)); const store = new FinanceStore(new Memory(), d, exclusive);
  await store.update('contacts', cs => cs.map(c => ({ ...c, name: 'Mismo nombre' })));
  await store.update('wallets', ws => ws.map(w => ({ ...w, name: w.name + ' NUEVA' })));
  assert.equal(remainingDebt(parent(store.data), 'a'), 10); assert.equal(remainingDebt(parent(store.data), 'b'), 20);
  assert.equal(calculateWalletBalances(store.data.wallets, store.data.transactions)['OPENBANK NUEVA'], 940);
  assert.equal(calculateWalletBalances(store.data.wallets, store.data.transactions)['REVOLUT NUEVA'], 110);
  await assert.rejects(store.update('wallets', ws => ws.slice(1)), /cartera/);
});

test('validación rechaza reparto, cobros huérfanos, estados, referencias y compensaciones con caja inválidos', () => {
  const d = saveSettlement(fixture(), input());
  const mutations: ((d: FinanceData) => void)[] = [
    d => { parent(d).splitInfo!.myShare = 21; }, d => { parent(d).splitInfo!.totalParticipants = 4; },
    d => { parent(d).splitInfo!.participants[0].contactId = 'missing'; }, d => { d.transactions.shift(); },
    d => { d.transactions[0].processed = false; }, d => { d.transactions[0].amount = 19; },
    d => { parent(d).splitInfo!.settlements![0].walletId = 'missing'; },
    d => { parent(d).splitInfo!.settlements![0].kind = 'offset'; },
    d => { parent(d).splitInfo!.settlements![0].date = '2026-10-01'; },
    d => { parent(d).splitInfo!.settlements!.push({ ...parent(d).splitInfo!.settlements![0] }); },
  ];
  for (const mutate of mutations) { const bad = structuredClone(d); mutate(bad); assert.throws(() => parseBackup(JSON.stringify(makeBackup(bad)))); }
  for (const n of [NaN, Infinity, -1, 0.001, Number.MAX_VALUE]) assert.throws(() => splitExactly(n, base().contacts, 'bank'));
});

for (const mode of ['create', 'collect', 'edit', 'delete', 'adjust'] as const) for (const failure of ['quota', 'conflict'] as const) test(`H: ${mode}/${failure} no aplica estado parcial, y recarga conserva vínculos`, async () => {
  const storage = new Memory(), original = mode === 'create' ? base() : ['edit', 'delete', 'adjust'].includes(mode) ? saveSettlement(fixture(), input(10)) : fixture();
  storage.setItem(DATA_KEY, serializeSnapshot(original)); const store = new FinanceStore(storage, base(), exclusive);
  const transform = (current: FinanceData) => {
    if (mode === 'create') return saveSharedTransaction(current, expense());
    if (mode === 'collect') return saveSettlement(current, input(10));
    const id = parent(current).splitInfo!.settlements![0].id;
    return mode === 'edit' ? saveSettlement(current, input(15), id) : mode === 'delete' ? deleteSettlement(current, 'dinner', id) : adjustDebt(current, 'dinner', 'a', 15);
  };
  if (failure === 'quota') storage.fail = key => key === DATA_KEY;
  else await new FinanceStore(storage, base(), exclusive).update('theme', 'light');
  const before = storage.getItem(DATA_KEY), state = structuredClone(store.data);
  await assert.rejects(store.mutate(transform)); assert.equal(storage.getItem(DATA_KEY), before); assert.deepEqual(store.data, state);
  assertSharedIntegrity(new FinanceStore(storage, base(), exclusive).data);
  if (failure === 'quota') { storage.fail = () => false; await store.mutate(transform); assertSharedIntegrity(new FinanceStore(storage, base(), exclusive).data); }
});

test('I: 2.5/2.6 permanecen legibles, 2.7 exporta/restaura el ledger completo y se rechaza etiquetarlo 2.5/2.6', async () => {
  for (const version of ['2.5', '2.6']) { const backup = { ...makeBackup(oldData()), version }; assert.deepEqual(parseBackup(JSON.stringify(backup)), backup); }
  const d = saveSettlement(fixture(), input(10));
  const backup = parseBackup(JSON.stringify(makeBackup(d))); assert.equal(backup.version, '2.7');
  const storage = new Memory(), store = new FinanceStore(storage, base(), exclusive);
  await store.restore(backup); const loaded = new FinanceStore(storage, base(), exclusive).data;
  assert.deepEqual(loaded.transactions, d.transactions); assert.equal(remainingDebt(parent(loaded), 'a'), 10);
  for (const version of ['2.5', '2.6']) assert.throws(() => parseBackup(JSON.stringify({ ...backup, version })));
});

test('primer 2.7 guarda copia 2.5/2.6; un fallo de la copia no cambia los datos', async () => {
  for (const withTransfers of [false, true]) {
    const d = base(); if (withTransfers) d.transactions = transferPair(d.wallets, { fromWalletId: 'bank', toWalletId: 'rev', amount: 50, date: '2026-10-01', processed: true, concept: 'Ficticio' });
    const storage = new Memory(); storage.setItem(DATA_KEY, serializeSnapshot(d)); const store = new FinanceStore(storage, base(), exclusive), before = storage.getItem(DATA_KEY);
    storage.fail = key => key !== DATA_KEY;
    await assert.rejects(store.mutate(current => saveSharedTransaction(current, expense()))); assert.equal(storage.getItem(DATA_KEY), before);
    storage.fail = () => false; await store.mutate(current => saveSharedTransaction(current, expense()));
    assert.equal(parseBackup(recoveryCopies(storage)[0].content).version, withTransfers ? '2.6' : '2.5');
  }
});

test('migración conservadora con cobro inequívoco: aditiva, explícita, idempotente y sin doble contabilización', async () => {
  const d = oldData(true), original = structuredClone(d); const storage = new Memory(); storage.setItem(DATA_KEY, JSON.stringify(makeBackup(d)));
  const before = storage.getItem(DATA_KEY), store = new FinanceStore(storage, base(), exclusive);
  assert.equal(storage.getItem(DATA_KEY), before); assert.equal(economicTransactions(store.data.transactions).find(t => t.id === 'dinner')!.amount, 60);
  const migrated = migrateSharedExpenses(store.data); assert.deepEqual(migrateSharedExpenses(migrated), migrated);
  for (const old of d.transactions) {
    const updated = migrated.transactions.find(t => t.id === old.id)!;
    if (old.splitInfo) { const { accountingVersion, walletId, settlements, ...preserved } = updated.splitInfo!; assert.deepEqual(preserved, old.splitInfo); }
    else { const { reimbursement, ...preserved } = updated; assert.deepEqual(preserved, old); }
  }
  await store.restore(makeBackup(migrated)); assert.deepEqual(d, original);
  assert.equal(summary(store.data).gastosEjecutados, 20); assert.equal(economicTransactions(store.data.transactions).some(t => t.id === 'old-receipt'), false);
  assert.equal(remainingDebt(parent(store.data), 'a'), 0); assert.equal(remainingDebt(parent(store.data), 'b'), 20);
  assert.equal(store.data.transactions.filter(t => t.id === 'old-receipt').length, 1);
  assert.deepEqual(parseBackup(recoveryCopies(storage)[0].content).transactions, d.transactions);
});

test('históricos ambiguos: no inventa pagos/compensaciones ni vincula por categoría o nombre', () => {
  for (const mutation of [
    (d: FinanceData) => { parent(d).splitInfo!.participants[0].reimbursementTxId = undefined; },
    (d: FinanceData) => { parent(d).splitInfo!.myShare = 20.01; },
    (d: FinanceData) => { d.contacts = []; },
    (d: FinanceData) => { d.wallets = []; },
    (d: FinanceData) => { d.transactions[0].amount = 19; },
    (d: FinanceData) => { parent(d).splitInfo!.participants[1].reimbursementTxId = 'old-receipt'; },
  ]) {
    const d = oldData(true); mutation(d);
    const report = sharedMigrationReport(d); assert.equal(report.candidates.length, 0); assert.equal(report.issues.length, 1);
    assert.deepEqual(migrateSharedExpenses(d), d); assert.ok(backupWarnings(d).some(w => /sin migrar/.test(w)));
  }
  const d = oldData(); d.transactions.unshift({ ...expense(), id: 'unrelated-credit', type: 'INGRESO', splitInfo: undefined, amount: 20, description: 'Reintegro no vinculado' });
  const migrated = migrateSharedExpenses(d); assert.equal(migrated.transactions[0].reimbursement, undefined);
});

test('históricos congelados hasta migración y edición de reintegro solo mediante su liquidación', async () => {
  const storage = new Memory(), d = oldData(true); storage.setItem(DATA_KEY, serializeSnapshot(d)); const store = new FinanceStore(storage, base(), exclusive);
  await assert.rejects(store.update('transactions', ts => ts.filter(t => t.id !== 'old-receipt')), /histórico/);
  await store.restore(makeBackup(migrateSharedExpenses(store.data)));
  await assert.rejects(store.mutate(current => saveSharedTransaction(current, { ...current.transactions[0], amount: 1 }, 'old-receipt')), /liquidación/);
});

for (const failure of ['recovery', 'active', 'conflict']) test(`migración 2.7: ${failure} deja los históricos sin alteraciones`, async () => {
  const storage = new Memory(), d = oldData(true); storage.setItem(DATA_KEY, serializeSnapshot(d));
  const store = new FinanceStore(storage, base(), exclusive);
  if (failure === 'conflict') await new FinanceStore(storage, base(), exclusive).update('theme', 'light');
  else storage.fail = key => failure === 'recovery' ? key !== DATA_KEY : key === DATA_KEY;
  const before = storage.getItem(DATA_KEY);
  await assert.rejects(store.restore(makeBackup(migrateSharedExpenses(store.data))));
  assert.equal(storage.getItem(DATA_KEY), before); assert.equal(parent(store.data).splitInfo!.accountingVersion, undefined);
});


test('un identificador estable de operación impide repetir también un cobro parcial', () => {
  const request = { ...input(10), operationId: 'one-action' };
  const d = saveSettlement(fixture(), request);
  assert.throws(() => saveSettlement(d, request), /ya se ha registrado/);
  assert.equal(remainingDebt(parent(d), 'a'), 10); assert.equal(d.transactions.length, 2);
});

test('J: movimientos normales, cuotas y traspasos mantienen su contabilidad junto a gastos compartidos', () => {
  const d = fixture();
  const normal: Transaction = { ...expense(), id: 'salary', type: 'INGRESO', code: 'L.001.001', amount: 2000, splitInfo: undefined, description: 'Nómina ficticia' };
  const loan = { id: 'loan', name: 'Préstamo ficticio', entity: 'Entidad', principal: 1000, interestRate: 0, totalTermMonths: 12, startDate: '2026-01-01', monthlyPayment: 100, wallet: 'OPENBANK', code: 'E.002.001' };
  const quota: Transaction = { ...normal, id: 'quota', type: 'GASTO', code: loan.code, loanId: loan.id, amount: 100, description: loan.name };
  d.transactions[0].description = loan.name;
  d.transactions.push(normal, quota, ...transferPair(d.wallets, { fromWalletId: 'bank', toWalletId: 'rev', date: '2026-10-08', amount: 500, concept: 'Ficticio', processed: true }));
  const paid = saveSettlement(d, input());
  assert.equal(summary(paid).ingresosReales, 2000); assert.equal(summary(paid).gastosEjecutados, 120);
  assert.equal(summary(paid).tasaAhorroReal, 94);
  assert.equal(calculateLoanStatus(loan, paid.transactions, '2026-10-09').totalPagadoReal, 100);
  assert.equal(calculateWalletBalances(paid.wallets, paid.transactions).OPENBANK, 2340);
});

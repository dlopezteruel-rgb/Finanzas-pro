import test from 'node:test';
import assert from 'node:assert/strict';
import { BUDGET_GROUPS } from '../constants/categories';
import type { Transaction } from '../types/finance';
import { DATA_KEY, type FinanceData, makeBackup, parseBackup, recoveryCopies, serializeSnapshot } from './backup';
import { deletionReport, deleteEntity, type DeletionTarget } from './deletion';
import { clearedData, clearImpact, clearScope, type ClearDataOptions } from './clearData';
import { FinanceStore, type ExclusiveWrite } from './financeStore';
import { saveSettlement, splitExactly } from './sharedExpenses';
import { transferPair } from './transfers';
import { calculateLoanStatus, calculateWalletBalances } from './finance';

const base = (): FinanceData => ({ theme: 'dark', budgetGroups: structuredClone(BUDGET_GROUPS), budgetPlans: [{ monthYear: '2026-10', code: 'V.001.002', type: 'GASTO', plannedAmount: 100 }],
  contacts: [{ id: 'ana', name: 'Ana', createdAt: '2026-01-01' }, { id: 'free', name: 'Ana', createdAt: '2026-01-01' }],
  loans: [{ id: 'loan', name: 'Préstamo ficticio', entity: 'Banco', principal: 1000, monthlyPayment: 100, interestRate: 0, totalTermMonths: 10, startDate: '2026-01-01', code: 'E.002.001', wallet: 'OPENBANK' }],
  wallets: [{ id: 'bank', name: 'OPENBANK', initialBalance: 1000, type: 'BANK', color: '#fff' }, { id: 'rev', name: 'REVOLUT', initialBalance: 100, type: 'BANK', color: '#fff' }], transactions: [] });
const normal = (): Transaction => ({ id: 'normal', type: 'GASTO', code: 'V.001.002', categoryName: 'Alimentación', subcategoryName: 'Restaurante', amount: 60, date: '2026-10-08', description: 'Cena ficticia', wallet: 'OPENBANK', processed: true });
const shared = (): FinanceData => ({ ...base(), transactions: [{ ...normal(), splitInfo: { ...splitExactly(60, [base().contacts[0]], 'bank'), distribution: { method: 'equal' } } }] });
class Memory {
  values = new Map<string, string>(); fail: (key: string) => boolean = () => false; writes = 0;
  get length() { return this.values.size; } key(i: number) { return [...this.values.keys()][i] ?? null; }
  getItem(k: string) { return this.values.get(k) ?? null; }
  setItem(k: string, v: string) { if (this.fail(k)) throw new DOMException('Cuota', 'QuotaExceededError'); if (k === DATA_KEY) this.writes++; this.values.set(k, v); }
}
function lock(): ExclusiveWrite { let queue = Promise.resolve(); return fn => { const result = queue.then(fn); queue = result.then(() => undefined, () => undefined); return result; }; }
function setup(initial = base(), exclusive = lock()) {
  const storage = new Memory(); storage.setItem(DATA_KEY, serializeSnapshot(initial));
  return { storage, store: new FinanceStore(storage, base(), exclusive) };
}
const opts: ClearDataOptions = { clearAllWallets: true, clearWalletBalances: true, clearTransactions: true, clearBudgets: true, clearDebts: true };

for (const target of [{ kind: 'contact', id: 'free' }, { kind: 'wallet', id: 'rev' }, { kind: 'loan', id: 'loan' }, { kind: 'transaction', id: 'normal' }] as DeletionTarget[]) test(`eliminar ${target.kind} sin dependencias: vista previa sin escritura, una confirmación y recarga`, async () => {
  const initial = { ...base(), transactions: [normal()] }, { storage, store } = setup(initial), before = storage.getItem(DATA_KEY);
  assert.equal(deletionReport(store.data, target).blockers.length, 0); assert.equal(storage.getItem(DATA_KEY), before);
  await store.mutate(current => deleteEntity(current, target)); assert.equal(storage.writes, 2);
  const reloaded = new FinanceStore(storage, base(), lock()); assert.equal(deletionReport(reloaded.data, target).exists, false);
  for (const field of ['theme', 'transactions', 'wallets', 'contacts', 'loans', 'budgetPlans', 'budgetGroups'] as const) assert.deepEqual(reloaded.data[field], store.data[field]); assert.equal(reloaded.data.budgetGroups.length, initial.budgetGroups.length);
});

for (const scenario of ['movement', 'pending', 'loan', 'transfer', 'shared', 'receipt'] as const) test(`cuenta con ${scenario}: bloquea diálogo y mutación directa sin dejar huérfanos`, async () => {
  let initial = base(), id = 'bank';
  if (scenario === 'movement' || scenario === 'pending') initial.transactions = [{ ...normal(), processed: scenario !== 'pending' }];
  if (scenario === 'transfer') { initial.transactions = transferPair(initial.wallets, { fromWalletId: 'bank', toWalletId: 'rev', date: '2026-10-08', amount: 500, concept: 'Ficticio', processed: true }); initial.wallets[0].name = 'NOMBRE ACTUAL'; }
  if (scenario === 'shared') initial = shared();
  if (scenario === 'receipt') { initial = saveSettlement(shared(), { expenseId: 'normal', contactId: 'ana', kind: 'cash', walletId: 'rev', amount: 10, date: '2026-10-09', processed: true }); id = 'rev'; }
  const target: DeletionTarget = { kind: 'wallet', id }, { storage, store } = setup(initial), before = storage.getItem(DATA_KEY);
  assert.ok(deletionReport(store.data, target).blockers.length);
  await assert.rejects(store.mutate(current => deleteEntity(current, target)), /cartera/);
  await assert.rejects(store.update('wallets', wallets => wallets.filter(w => w.id !== id)), /cartera/);
  assert.equal(storage.getItem(DATA_KEY), before); assert.equal(storage.writes, 1);
});

for (const legacy of [false, true]) test(`contacto con reparto ${legacy ? 'histórico saldado' : '2.8 y liquidación'}: protege por ID incluso con nombres iguales`, async () => {
  let initial = shared();
  if (legacy) { const s = initial.transactions[0].splitInfo!; delete s.accountingVersion; delete s.distribution; delete s.walletId; delete s.settlements; s.participants[0].isPaid = true; }
  else initial = saveSettlement(initial, { expenseId: 'normal', contactId: 'ana', kind: 'offset', amount: 10, date: '2026-10-09', processed: true });
  const { storage, store } = setup(initial), before = storage.getItem(DATA_KEY);
  assert.ok(deletionReport(store.data, { kind: 'contact', id: 'ana' }).blockers.length);
  assert.equal(deletionReport(store.data, { kind: 'contact', id: 'free' }).blockers.length, 0);
  await assert.rejects(store.update('contacts', contacts => contacts.filter(c => c.id !== 'ana')), /contacto/);
  assert.equal(storage.getItem(DATA_KEY), before);
});

for (const historical of [false, true]) test(`préstamo con cuota ${historical ? 'por criterio de nombre' : 'por loanId'} no puede eliminarse`, async () => {
  const initial = base(); initial.transactions = [{ ...normal(), ...(historical ? { description: 'Cuota Préstamo ficticio' } : { loanId: 'loan' }) }];
  const { storage, store } = setup(initial), before = storage.getItem(DATA_KEY);
  assert.ok(deletionReport(store.data, { kind: 'loan', id: 'loan' }).blockers.length);
  await assert.rejects(store.update('loans', []), /préstamo/); assert.equal(storage.getItem(DATA_KEY), before);
  // Removing a child payment is an explicit correction; it leaves the parent valid.
  await store.mutate(current => deleteEntity(current, { kind: 'transaction', id: 'normal' }));
  assert.equal(calculateLoanStatus(store.data.loans[0], store.data.transactions).totalPagadoReal, 0);
});

test('gastos con liquidaciones y reintegros históricos referenciados requieren su operación vinculada', async () => {
  const initial = saveSettlement(shared(), { expenseId: 'normal', contactId: 'ana', kind: 'cash', walletId: 'rev', amount: 10, date: '2026-10-09', processed: true });
  const { storage, store } = setup(initial), before = storage.getItem(DATA_KEY);
  for (const id of initial.transactions.map(t => t.id)) await assert.rejects(store.mutate(current => deleteEntity(current, { kind: 'transaction', id })));
  assert.equal(storage.getItem(DATA_KEY), before);
  const old = base(), expense = { ...normal(), splitInfo: { ...splitExactly(60, [old.contacts[0]], 'bank') } }; delete expense.splitInfo.accountingVersion;
  expense.splitInfo.participants[0].reimbursementTxId = 'old-receipt'; old.transactions = [expense, { ...normal(), id: 'old-receipt', type: 'INGRESO' }];
  assert.ok(deletionReport(old, { kind: 'transaction', id: 'old-receipt' }).blockers.length);
  assert.equal(deletionReport(old, { kind: 'contact', id: 'ana' }).relations.find(r => r.label === 'Reintegros')!.count, 1);
});

test('dependencia añadida en la misma pestaña después de la vista previa se comprueba bajo el bloqueo', async () => {
  const { storage, store } = setup(); const target: DeletionTarget = { kind: 'loan', id: 'loan' };
  assert.equal(deletionReport(store.data, target).blockers.length, 0);
  const first = store.update('transactions', [{ ...normal(), loanId: 'loan' }]);
  const deletion = store.mutate(current => deleteEntity(current, target));
  await first; const latest = storage.getItem(DATA_KEY); await assert.rejects(deletion, /Cuotas/); assert.equal(storage.getItem(DATA_KEY), latest);
});

for (const kind of ['contact', 'wallet', 'loan'] as const) for (const failure of ['quota', 'conflict'] as const) test(`${kind}/${failure}: no elimina ni deja escritura parcial`, async () => {
  const { storage, store } = setup(), target: DeletionTarget = { kind, id: kind === 'contact' ? 'free' : kind === 'wallet' ? 'rev' : 'loan' };
  if (failure === 'quota') storage.fail = k => k === DATA_KEY;
  else { const other = new FinanceStore(storage, base(), lock()); await other.update('theme', 'light'); }
  const before = storage.getItem(DATA_KEY); await assert.rejects(store.mutate(current => deleteEntity(current, target)), failure === 'quota' ? /Cuota/ : /Otra pestaña/);
  assert.equal(storage.getItem(DATA_KEY), before);
});

test('borrado masivo: alcance exacto, conserva catálogo/contactos y copia 2.8 recuperable sin cambiar las reglas', async () => {
  let initial = shared(); initial = saveSettlement(initial, { expenseId: 'normal', contactId: 'ana', kind: 'cash', walletId: 'rev', amount: 10, date: '2026-10-09', processed: true });
  initial.transactions.push(...transferPair(initial.wallets, { fromWalletId: 'bank', toWalletId: 'rev', amount: 500, date: '2026-10-08', processed: true, concept: 'Ficticio' }), { ...normal(), id: 'quota', loanId: 'loan' });
  const report = clearImpact(initial, opts), count = (label: string) => report.relations.find(r => r.label === label)!.count;
  assert.deepEqual([count('Movimientos a eliminar'), count('Transferencias completas incluidas'), count('Gastos compartidos incluidos'), count('Liquidaciones y compensaciones incluidas'), count('Reintegros incluidos'), count('Cuotas de préstamos incluidas')], [5, 1, 1, 1, 1, 1]);
  assert.deepEqual(report.blockers, []);
  const { storage, store } = setup(initial); await store.mutate({ clear: opts, scope: clearScope(store.data, opts) });
  assert.deepEqual(store.data.transactions, []); assert.deepEqual(store.data.wallets, []); assert.deepEqual(store.data.loans, []);
  assert.deepEqual(store.data.contacts, initial.contacts); assert.deepEqual(store.data.budgetGroups, initial.budgetGroups);
  const copy = parseBackup(recoveryCopies(storage)[0].content); assert.equal(copy.version, '2.8'); assert.deepEqual(copy.transactions, initial.transactions);
  await store.restore(copy); assert.deepEqual(store.data.transactions, initial.transactions); assert.deepEqual(calculateWalletBalances(store.data.wallets, store.data.transactions), calculateWalletBalances(initial.wallets, initial.transactions));
});

for (const failure of ['recovery', 'active', 'scope', 'conflict'] as const) test(`borrado masivo/${failure}: aborta íntegro y conserva datos y revisión`, async () => {
  const { storage, store } = setup(shared()), scope = clearScope(store.data, opts);
  if (failure === 'recovery') storage.fail = k => k !== DATA_KEY;
  if (failure === 'active') storage.fail = k => k === DATA_KEY;
  if (failure === 'scope') await store.update('transactions', txs => txs.map(t => ({ ...t, notes: 'Cambio con la misma cantidad de registros' })));
  if (failure === 'conflict') { const other = new FinanceStore(storage, base(), lock()); await other.update('theme', 'light'); }
  const before = storage.getItem(DATA_KEY); await assert.rejects(store.mutate({ clear: opts, scope })); assert.equal(storage.getItem(DATA_KEY), before);
});

test('borrado parcial bloquea movimientos, préstamos y deudas históricas que se conservarían; no amplía opciones implícitamente', () => {
  const initial = { ...base(), transactions: [{ ...normal(), loanId: 'loan' }] };
  for (const options of [{ ...opts, clearTransactions: false }, { ...opts, clearDebts: false }]) { assert.ok(clearImpact(initial, options).blockers.length); assert.throws(() => clearedData(initial, options)); }
  const old = shared(); delete old.transactions[0].splitInfo!.accountingVersion; delete old.transactions[0].splitInfo!.distribution; delete old.transactions[0].splitInfo!.walletId; delete old.transactions[0].splitInfo!.settlements;
  assert.throws(() => clearedData(old, { ...opts, clearAllWallets: false, clearTransactions: false }), /compensación/);
  assert.equal(makeBackup(old).version, '2.5'); assert.deepEqual(parseBackup(JSON.stringify(makeBackup(old))).transactions, old.transactions);
});

test('objetivo inexistente: no convierte una segunda confirmación en un borrado exitoso silencioso', async () => {
  const { storage, store } = setup(), before = storage.getItem(DATA_KEY);
  for (const kind of ['contact', 'wallet', 'loan', 'transaction'] as const) {
    assert.equal(deletionReport(store.data, { kind, id: 'missing' }).exists, false);
    await assert.rejects(store.mutate(current => deleteEntity(current, { kind, id: 'missing' })), /ya no existe/);
  }
  assert.equal(storage.getItem(DATA_KEY), before); assert.equal(storage.writes, 1);
});

test('alcance histórico 2.5: cuenta pares y registros ambiguos sin convertirlos, guarda originales recuperables', async () => {
  const initial = base(), pair = transferPair(initial.wallets, { fromWalletId: 'bank', toWalletId: 'rev', amount: 500, date: '2026-10-08', processed: true, concept: 'Ficticio' });
  const { transfer: _a, ...a } = pair[0], { transfer: _b, ...b } = pair[1];
  initial.transactions = [{ ...a, id: 'tx-traspaso-out-100', notes: 'Traspaso ordenado hacia REVOLUT' }, { ...b, id: 'tx-traspaso-in-101', notes: 'Traspaso recibido desde OPENBANK' }, { ...a, id: 'ambiguous', description: 'Editado' }];
  assert.equal(makeBackup(initial).version, '2.5'); const original = structuredClone(initial.transactions), report = clearImpact(initial, opts);
  assert.equal(report.relations.find(r => r.label === 'Transferencias completas incluidas')!.count, 1);
  assert.equal(report.relations.find(r => r.label === 'Registros históricos de traspaso incluidos')!.count, 3);
  assert.equal(report.relations.find(r => r.label === 'Registros de traspaso pendientes de revisión')!.count, 1);
  const { storage, store } = setup(initial); await store.mutate({ clear: opts, scope: clearScope(store.data, opts) });
  const saved = parseBackup(recoveryCopies(storage)[0].content); assert.equal(saved.version, '2.5'); assert.deepEqual(saved.transactions, original);
});

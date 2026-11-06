import test from 'node:test';
import assert from 'node:assert/strict';
import { amountCents, validateDistribution, weightedCents } from './sharedDistribution';
import { normalizeSearch, partidaCatalog, recentPartidas, searchPartidas } from './partidaSearch';
import { BUDGET_GROUPS } from '../constants/categories';
import type { SharedDistribution, Transaction } from '../types/finance';
import { FinanceData, makeBackup, parseBackup, recoveryCopies, serializeSnapshot, DATA_KEY } from './backup';
import { FinanceStore, type ExclusiveWrite } from './financeStore';
import { adjustDebt, remainingDebt, saveSettlement, saveSharedTransaction, splitExactly } from './sharedExpenses';
import { calculateMonthlySummary, calculateWalletBalances } from './finance';

const catalog = partidaCatalog(BUDGET_GROUPS);
const tx = (code: string, type: Transaction['type'], date: string, id: string = crypto.randomUUID()): Transaction => ({ id, code, type, date, amount: 10, wallet: 'OPENBANK', processed: true, description: 'Ficticio', categoryName: 'Prueba', subcategoryName: 'Prueba' });
const fixture = (): FinanceData => ({ theme: 'dark', budgetGroups: structuredClone(BUDGET_GROUPS), budgetPlans: [], loans: [],
  contacts: [{ id: 'a', name: 'Ana', createdAt: '2026-01-01' }, { id: 'b', name: 'Bea', createdAt: '2026-01-01' }], wallets: [{ id: 'bank', name: 'OPENBANK', type: 'BANK', color: '#fff', initialBalance: 1000 }], transactions: [] });
function expense(distribution?: SharedDistribution): Transaction {
  const split = splitExactly(60, fixture().contacts, 'bank');
  if (distribution?.method === 'weighted') {
    const shares = weightedCents(6000, [distribution.ownWeight, ...distribution.contactWeights.map(w => w.weight)]);
    split.myShare = shares[0] / 100; split.participants.forEach((p, i) => { p.amount = shares[i + 1] / 100; });
    split.totalOwedToMe = (6000 - shares[0]) / 100;
  }
  if (distribution) split.distribution = distribution;
  return { ...tx('V.001.002', 'GASTO', '2026-10-08', 'expense'), amount: 60, splitInfo: split };
}
class Memory {
  values = new Map<string, string>(); fail = false;
  get length() { return this.values.size; }
  key(i: number) { return [...this.values.keys()][i] ?? null; }
  getItem(k: string) { return this.values.get(k) ?? null; }
  setItem(k: string, value: string) { if (this.fail && k === DATA_KEY) throw new DOMException('Cuota', 'QuotaExceededError'); this.values.set(k, value); }
}
const exclusive: ExclusiveWrite = async write => write();

test('catálogo: búsqueda por código, nombre, categoría, familia y grupo sin acentos ni mayúsculas', () => {
  assert.equal(normalizeSearch('  MÉDICOS  '), 'medicos');
  for (const query of ['F.003.001', 'MEDICOS', 'FIJOS SALUD', 'seguros médicos']) assert.ok(searchPartidas(catalog, 'GASTO', query).some(c => c.partida.code === 'F.003.001'));
  const group = catalog.find(c => c.partida.type === 'GASTO' && c.partida.code === 'F.003.001')!;
  const filtered = searchPartidas(catalog, 'GASTO', '', group.familyCode, `${group.partida.groupCode}:${group.partida.groupName}`);
  assert.ok(filtered.length); assert.ok(filtered.every(c => c.familyCode === group.familyCode && c.partida.groupName === group.partida.groupName && c.partida.type === 'GASTO'));
  assert.equal(searchPartidas(catalog, 'INGRESO', 'seguro medico').length, 0);
  const p = group.partida, dynamic = partidaCatalog([{ code: group.familyCode, name: 'Familia personalizada', type: p.type, partidas: [{ ...p, name: 'Partida personalizada' }] }]);
  assert.equal(searchPartidas(dynamic, 'GASTO', 'personalizada').length, 1);
});

test('cinco recientes reales, únicos y del tipo elegido; excluye transferencias y reintegros, no inventa códigos', () => {
  const expenses = catalog.filter(c => c.partida.type === 'GASTO').slice(0, 7).map(c => c.partida.code);
  const records = expenses.map((code, i) => tx(code, 'GASTO', `2026-10-${String(i + 1).padStart(2, '0')}`));
  records.unshift(tx(expenses[6], 'GASTO', '2026-11-01'));
  records.unshift({ ...tx('F.003.001', 'GASTO', '2026-12-01'), transfer: { id: 'transfer', fromWalletId: 'a', toWalletId: 'b', leg: 'out', concept: '' } });
  records.unshift({ ...tx(expenses[0], 'GASTO', '2026-12-01'), reimbursement: { expenseId: 'old', contactId: 'c', settlementId: 's', walletId: 'a' } });
  records.unshift({ ...tx('F.003.001', 'GASTO', '2026-12-01'), subcategoryName: 'Traspaso entre cuentas' });
  records.unshift(tx('NO-EXISTE', 'GASTO', '2026-12-01'));
  records.unshift(tx('L.001.001', 'INGRESO', '2026-12-01'));
  assert.deepEqual(recentPartidas(catalog, records, 'GASTO').map(c => c.partida.code), expenses.slice(2).reverse());
  assert.deepEqual(recentPartidas(catalog, records, 'INGRESO').map(c => c.partida.code), ['L.001.001']);
});

test('reparto equitativo y proporcional con céntimos deterministas, pesos cero y decimales', () => {
  assert.deepEqual(weightedCents(10000, [1, 1, 1]), [3334, 3333, 3333]);
  assert.deepEqual(weightedCents(6000, [1, 2, 1]), [1500, 3000, 1500]);
  assert.deepEqual(weightedCents(10001, [1, 1, 1]), [3334, 3334, 3333]);
  assert.deepEqual(weightedCents(6000, [0, 2, 0]), [0, 6000, 0]);
  assert.deepEqual(weightedCents(6000, [0.1, 0.2, 0.1]), [1500, 3000, 1500]);
  for (const weights of [[0, 0], [-1, 1], [NaN, 1], [Infinity, 1], [1e7, 1], [1.0000001, 1]]) assert.throws(() => weightedCents(10000, weights));
  for (let total = 1; total < 10000; total += 19) for (const weights of [[1, 1], [1, 2, 1], [1, 3, 9, 2], [0, 0.333333, 0.666667]]) {
    const result = weightedCents(total, weights);
    assert.equal(result.reduce((a, b) => a + b, 0), total); assert.ok(result.every(n => Number.isSafeInteger(n) && n >= 0));
    assert.deepEqual(weightedCents(total, weights), result);
  }
});

test('importes: el último contacto recibe el resto al cambiar total, añadir o quitar participantes', () => {
  assert.deepEqual(amountCents(6000, [1500, 2500]), [1500, 2500, 2000]);
  assert.deepEqual(amountCents(8000, [1500, 2500]), [1500, 2500, 4000]);
  assert.deepEqual(amountCents(6000, [1500]), [1500, 4500]);
  assert.deepEqual(amountCents(6000, [1500, 2500, 2000]), [1500, 2500, 2000, 0]);
  for (const fixed of [[-1], [6001], [1.5], [NaN], []]) assert.throws(() => amountCents(6000, fixed));
});

test('validación estricta de modalidad, pesos, referencias y correspondencia con importes', () => {
  const good = { method: 'weighted', ownWeight: 1, contactWeights: [{ contactId: 'a', weight: 2 }, { contactId: 'b', weight: 1 }] };
  validateDistribution(good, ['a', 'b'], 6000, [1500, 3000, 1500]);
  for (const value of [{ method: 'unknown' }, { method: 'equal', extra: true }, { ...good, ownWeight: -1 }, { ...good, ownWeight: '1' }, { ...good, contactWeights: [{ contactId: 'b', weight: 1 }, { contactId: 'a', weight: 2 }] }, { ...good, contactWeights: [{ contactId: 'a', weight: 1 }, { contactId: 'a', weight: 1 }] }, { method: 'amounts', ownWeight: 2 }]) assert.throws(() => validateDistribution(value, ['a', 'b'], 6000, [1500, 3000, 1500]));
  assert.throws(() => validateDistribution(good, ['a', 'b'], 6000, [2000, 2000, 2000]));
});

test('JSON 2.8 conserva pesos y modalidades; 2.5/2.6/2.7 permanecen legibles y no aceptan los metadatos nuevos', () => {
  for (const distribution of [{ method: 'equal' }, { method: 'amounts' }, { method: 'weighted', ownWeight: 1, contactWeights: [{ contactId: 'a', weight: 2 }, { contactId: 'b', weight: 1 }] }] as SharedDistribution[]) {
    const data = { ...fixture(), transactions: [expense(distribution)] }, backup = makeBackup(data);
    assert.equal(backup.version, '2.8'); assert.deepEqual(parseBackup(JSON.stringify(backup)).transactions, data.transactions);
    for (const version of ['2.5', '2.6', '2.7']) assert.throws(() => parseBackup(JSON.stringify({ ...backup, version })));
  }
  const old = { ...fixture(), transactions: [expense()] }; assert.equal(makeBackup(old).version, '2.7');
  assert.deepEqual(parseBackup(JSON.stringify(makeBackup(old))).transactions, old.transactions);
  for (const version of ['2.5', '2.6']) assert.equal(parseBackup(JSON.stringify({ ...makeBackup(fixture()), version })).version, version);
});

test('editar reparto con liquidaciones: conserva importes/cobros al cambiar concepto y rechaza reasignaciones', async () => {
  const distribution: SharedDistribution = { method: 'weighted', ownWeight: 1, contactWeights: [{ contactId: 'a', weight: 2 }, { contactId: 'b', weight: 1 }] };
  let data = { ...fixture(), transactions: [expense(distribution)] };
  data = saveSettlement(data, { expenseId: 'expense', contactId: 'a', amount: 10, date: '2026-10-09', kind: 'cash', walletId: 'bank', processed: true });
  const storage = new Memory(); storage.setItem(DATA_KEY, serializeSnapshot(data)); const store = new FinanceStore(storage, fixture(), exclusive);
  const original = structuredClone(store.data.transactions.find(t => t.id === 'expense')!.splitInfo);
  await store.mutate(current => saveSharedTransaction(current, { ...current.transactions.find(t => t.id === 'expense')!, description: 'Descripción revisada' }, 'expense'));
  assert.deepEqual(store.data.transactions.find(t => t.id === 'expense')!.splitInfo, original);
  const before = storage.getItem(DATA_KEY), changed = expense({ method: 'equal' });
  await assert.rejects(store.mutate(current => saveSharedTransaction(current, changed, 'expense')), /liquidaciones/);
  assert.equal(storage.getItem(DATA_KEY), before); assert.equal(remainingDebt(store.data.transactions.find(t => t.id === 'expense')!, 'a'), 20);
  const corrected = adjustDebt(store.data, 'expense', 'a', 25);
  assert.equal(corrected.transactions.find(t => t.id === 'expense')!.splitInfo!.distribution!.method, 'amounts');
  assert.deepEqual(corrected.transactions.find(t => t.id === 'expense')!.splitInfo!.settlements, original!.settlements);
});

test('introducir modalidad en 2.7 guarda copia previa; cuota y conflicto no modifican reparto ni saldos', async () => {
  const old = { ...fixture(), transactions: [expense()] }, storage = new Memory(); storage.setItem(DATA_KEY, serializeSnapshot(old));
  const store = new FinanceStore(storage, fixture(), exclusive), before = storage.getItem(DATA_KEY);
  const distribution: SharedDistribution = { method: 'weighted', ownWeight: 1, contactWeights: [{ contactId: 'a', weight: 2 }, { contactId: 'b', weight: 1 }] };
  storage.fail = true; await assert.rejects(store.mutate(current => saveSharedTransaction(current, expense(distribution), 'expense')));
  assert.equal(storage.getItem(DATA_KEY), before); storage.fail = false;
  await store.mutate(current => saveSharedTransaction(current, expense(distribution), 'expense'));
  assert.equal(makeBackup(store.data).version, '2.8'); assert.equal(parseBackup(recoveryCopies(storage)[0].content).version, '2.7');
  assert.equal(calculateWalletBalances(store.data.wallets, store.data.transactions).OPENBANK, 940);
  assert.equal(calculateMonthlySummary('2026-10', store.data.transactions, []).gastosEjecutados, 15);
  const stale = new FinanceStore(storage, fixture(), exclusive); await store.update('theme', 'light'); const latest = storage.getItem(DATA_KEY);
  await assert.rejects(stale.mutate(current => saveSharedTransaction(current, expense({ method: 'equal' }), 'expense')), /Otra pestaña/);
  assert.equal(storage.getItem(DATA_KEY), latest);
});

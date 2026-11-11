import test from 'node:test';
import assert from 'node:assert/strict';
import { BUDGET_GROUPS } from '../constants/categories';
import { DATA_KEY, RECOVERY_PREFIX, makeBackup, parseBackup, serializeSnapshot, type FinanceData } from './backup';
import { FinanceStore } from './financeStore';
import { changePartidaGroup, duplicatePartida, reorderPartida } from './budgetChanges';
import { calculateMonthlySummary, calculateWalletBalances } from './finance';
import { savePlanning, planningScope } from './planning';

class Storage {
  values = new Map<string, string>(); writes = 0; fail = false;
  get length() { return this.values.size; }
  key(i: number) { return [...this.values.keys()][i] ?? null; }
  getItem(k: string) { return this.values.get(k) ?? null; }
  setItem(k: string, v: string) { if (this.fail) throw new DOMException('Cuota ficticia', 'QuotaExceededError'); this.values.set(k, v); this.writes++; }
}
function fixture(): FinanceData {
  const data: FinanceData = { theme: 'light', wallets: [{ id: 'bank', name: 'BANCO FICTICIO', type: 'BANK', initialBalance: 1000, color: '#172B4D' }], contacts: [], loans: [], budgetGroups: structuredClone(BUDGET_GROUPS), budgetPlans: [], transactions: [
    { id: 'purchase', code: 'V.001.001', type: 'GASTO', amount: 135.35, date: '2026-10-08', processed: true, wallet: 'BANCO FICTICIO', description: 'Compra ficticia', categoryName: 'Familia histórica', subcategoryName: 'Nombre histórico' },
  ] };
  return savePlanning(data, '2026-10', [{ code: 'V.001.001', type: 'GASTO', amountCents: 30000 }], 0, planningScope(data, '2026-10'), true, true);
}
const partida = (d: FinanceData, code = 'F.001.001', type = 'GASTO') => d.budgetGroups.flatMap(g => g.partidas).find(p => p.code === code && p.type === type)!;
function setup(d = fixture()) {
  const storage = new Storage(); storage.setItem(DATA_KEY, serializeSnapshot(d));
  storage.setItem(`${RECOVERY_PREFIX}previous`, JSON.stringify(makeBackup(d)));
  const store = new FinanceStore(storage, fixture(), async write => write());
  return { storage, store };
}
function sameFinances(a: FinanceData, b: FinanceData) {
  for (const k of ['transactions', 'budgetPlans', 'planningMonths', 'planningAutomation', 'loans', 'wallets', 'contacts', 'intelligentFinance'] as const) assert.deepEqual(b[k], a[k], k);
  assert.deepEqual(calculateWalletBalances(b.wallets, b.transactions), calculateWalletBalances(a.wallets, a.transactions));
  assert.deepEqual(calculateMonthlySummary('2026-10', b.transactions, b.budgetPlans), calculateMonthlySummary('2026-10', a.transactions, a.budgetPlans));
}

for (const [type, code, target] of [['GASTO', 'V.001.001', 'L'], ['INGRESO', 'L.001.001', 'V_EXP']]) test(`catálogo: rechaza ${type} al otro tipo sin escrituras ni cambios de saldo`, async () => {
  const { store, storage } = setup(), before = structuredClone(store.data), snapshot = new Map(storage.values), writes = storage.writes;
  await assert.rejects(store.mutate(d => changePartidaGroup(d, partida(d, code, type), target)), /No se permite cambiar/);
  assert.deepEqual(storage.values, snapshot); assert.equal(storage.writes, writes); assert.deepEqual(store.data, before); sameFinances(before, store.data);
});

test('catálogo: mismo tipo cambia solo organización, conserva aprobación, etiquetas históricas y copia previa', async () => {
  const { store, storage } = setup(), before = structuredClone(store.data), copy = storage.getItem(`${RECOVERY_PREFIX}previous`), writes = storage.writes;
  await store.mutate(d => changePartidaGroup(d, partida(d, 'V.001.001'), 'F_EXP'));
  assert.equal(storage.writes, writes + 1); sameFinances(before, store.data);
  assert.equal(partida(store.data, 'V.001.001').groupCode, 'F_EXP');
  assert.equal(storage.getItem(`${RECOVERY_PREFIX}previous`), copy);
  const restored = parseBackup(JSON.stringify(makeBackup(store.data))); sameFinances(before, restored);
});

test('catálogo: duplicación real usa el contenedor F_EXP aunque groupCode sea F.001 y evita códigos de cualquier familia', async () => {
  const { store, storage } = setup(), before = structuredClone(store.data), source = partida(store.data), writes = storage.writes;
  assert.equal(source.groupCode, 'F.001');
  await store.mutate(d => duplicatePartida(d, source));
  const allBefore = before.budgetGroups.flatMap(g => g.partidas), all = store.data.budgetGroups.flatMap(g => g.partidas);
  assert.equal(all.length, allBefore.length + 1); assert.equal(storage.writes, writes + 1);
  const added = all.find(p => !allBefore.some(old => old.type === p.type && old.code === p.code))!;
  assert.ok(added.code && !allBefore.some(p => p.code === added.code)); assert.equal(added.name, `${source.name} (Copia)`);
  assert.deepEqual(partida(store.data), source); assert.deepEqual(added.keywords, source.keywords); sameFinances(before, store.data);
  assert.ok(store.data.budgetGroups.find(g => g.code === 'F_EXP')!.partidas.includes(added));
  const exported = makeBackup(store.data); assert.equal(exported.version, makeBackup(before).version);
  assert.deepEqual(parseBackup(JSON.stringify(exported)).budgetGroups, store.data.budgetGroups);
  assert.deepEqual(JSON.parse(storage.getItem(`${RECOVERY_PREFIX}previous`)!).budgetGroups, before.budgetGroups);
});

test('catálogo: códigos no numéricos y colisiones fuera del contenedor producen una identidad válida', () => {
  const d = fixture(); const source = partida(d); source.code = 'custom';
  d.budgetGroups.find(g => g.code === 'L')!.partidas.push({ ...partida(d, 'L.001.001', 'INGRESO'), code: 'custom.001' });
  const result = duplicatePartida(d, source);
  assert.ok(result.budgetGroups.flatMap(g => g.partidas).some(p => p.code === 'custom.002'));
  parseBackup(JSON.stringify(makeBackup(result)));
});

test('catálogo: duplicar no reutiliza un código de movimientos o previsiones fuera del catálogo', () => {
  const d = fixture(), source = partida(d);
  const candidate = duplicatePartida(d, source).budgetGroups.flatMap(g => g.partidas).find(p => p.name.endsWith('(Copia)'))!;
  d.transactions.push({ ...d.transactions[0], id: 'old', code: candidate.code, description: 'Registro histórico ficticio' });
  d.budgetPlans.push({ type: 'GASTO', code: candidate.code, monthYear: '2025-01', plannedAmount: 20 });
  const result = duplicatePartida(d, source), added = result.budgetGroups.flatMap(g => g.partidas).find(p => p.name.endsWith('(Copia)'))!;
  assert.notEqual(added.code, candidate.code); sameFinances(d, result);
  parseBackup(JSON.stringify(makeBackup(result)));
});

test('catálogo: selección sin cambio y límites de orden no escriben ni renuevan la revisión', async () => {
  const { store, storage } = setup(), snapshot = new Map(storage.values), writes = storage.writes;
  await store.mutate(d => changePartidaGroup(d, partida(d), 'F_EXP'));
  await store.mutate(d => reorderPartida(d, 'F_EXP', 0, 'UP'));
  await store.mutate(d => reorderPartida(d, 'F_EXP', -1, 'DOWN'));
  assert.equal(storage.writes, writes); assert.deepEqual(storage.values, snapshot);
});

test('catálogo: partida ausente y validación fallida no escriben ninguna colección', async () => {
  const { store, storage } = setup(), snapshot = new Map(storage.values), before = structuredClone(store.data);
  await assert.rejects(store.mutate(d => duplicatePartida(d, { ...partida(d), code: 'missing' })), /ya no existe/);
  await assert.rejects(store.mutate(d => ({ ...duplicatePartida(d, partida(d)), wallets: [{ ...d.wallets[0], initialBalance: NaN }] })), /initialBalance/);
  assert.deepEqual(storage.values, snapshot); assert.deepEqual(store.data, before);
});

test('catálogo: fallo de cuota al duplicar conserva original/copia previa; reintento crea exactamente una copia', async () => {
  const { store, storage } = setup(), snapshot = new Map(storage.values), before = structuredClone(store.data);
  storage.fail = true;
  await assert.rejects(store.mutate(d => duplicatePartida(d, partida(d))), /Cuota/);
  assert.deepEqual(storage.values, snapshot); assert.deepEqual(store.data, before);
  storage.fail = false; await store.mutate(d => duplicatePartida(d, partida(d)));
  assert.equal(store.data.budgetGroups.flatMap(g => g.partidas).length, before.budgetGroups.flatMap(g => g.partidas).length + 1); sameFinances(before, store.data);
});

test('catálogo: operaciones previamente reclasificadas se cargan y restauran sin migración ni escrituras', () => {
  const d = fixture();
  const old = partida(d, 'V.001.001');
  d.budgetGroups = d.budgetGroups.map(g => g.code === 'V_EXP'
    ? { ...g, partidas: g.partidas.filter(p => p !== old) }
    : g.code === 'L' ? { ...g, partidas: [...g.partidas, { ...old, type: 'INGRESO', groupCode: g.code, groupName: g.name }] } : g);
  d.transactions = [{ ...d.transactions[0], type: 'INGRESO', categoryName: 'LABORALES' }];
  d.budgetPlans = d.budgetPlans.map(p => ({ ...p, type: 'INGRESO' }));
  d.planningMonths = d.planningMonths!.map(m => ({ ...m, revision: m.revision + 1 }));
  const { storage } = setup(d), snapshot = new Map(storage.values), writes = storage.writes;
  const loaded = new FinanceStore(storage, fixture(), async write => write());
  assert.equal(loaded.data.transactions[0].type, 'INGRESO');
  assert.deepEqual(loaded.data.budgetGroups, d.budgetGroups);
  assert.deepEqual(loaded.data.planningMonths, d.planningMonths);
  assert.deepEqual(parseBackup(JSON.stringify(makeBackup(loaded.data))).transactions, d.transactions);
  assert.equal(storage.writes, writes); assert.deepEqual(storage.values, snapshot);
});

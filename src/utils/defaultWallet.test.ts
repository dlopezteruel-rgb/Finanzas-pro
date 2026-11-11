import test from 'node:test';
import assert from 'node:assert/strict';
import { intelligentFixture, movementRule, personalObligation } from '../../scripts/intelligentFixture';
import { FinanceStore } from './financeStore';
import { DATA_KEY, RECOVERY_PREFIX, makeBackup, parseBackup, type FinanceData } from './backup';
import { resolveDefaultWallet, initialWalletName, initialWalletId, chooseDefaultWallet, walletFromText } from './defaultWallet';
import { deleteEntity } from './deletion';
import { clearedData } from './clearData';
import { calculateWalletBalances } from './finance';
import { proposeChatMovement } from './chatRegistration';
import { savePlanning, planningScope } from './planning';
import { saveMovementRule, occurrencePreviews, occurrenceScope, applyOccurrenceBatch } from './recurringMovements';
import { saveObligation, settleObligation } from './personalObligations';
import { transferPair } from './transfers';
import { splitExactly, saveSharedTransaction, saveSettlement } from './sharedExpenses';
import { previewAutomation, applyAutomationPreview } from './planningAutomation';

function fixture(count = 3): FinanceData {
  const data = intelligentFixture();
  return { ...data, wallets: [data.wallets[0], { ...data.wallets[0], id: 'saving', name: 'AHORRO FICTICIO', type: 'SAVINGS' as const }, { ...data.wallets[0], id: 'cash', name: 'EFECTIVO FICTICIO', type: 'CASH' as const }].slice(0, count) };
}
class MemoryStorage {
  values = new Map<string, string>(); writes = 0; fail: 'copy' | 'active' | 'verify' | null = null;
  get length() { return this.values.size; } key(i: number) { return [...this.values.keys()][i] ?? null; }
  getItem(k: string) { return this.values.get(k) ?? null; }
  setItem(k: string, v: string) {
    if ((this.fail === 'copy' && k.startsWith(RECOVERY_PREFIX)) || (this.fail === 'active' && k === DATA_KEY)) throw new Error('Cuota ficticia');
    this.writes++; this.values.set(k, this.fail === 'verify' && k.startsWith(RECOVERY_PREFIX) ? 'incompleto' : v);
  }
}
function setup(data = fixture()) {
  const storage = new MemoryStorage(); storage.setItem(DATA_KEY, JSON.stringify(makeBackup(data)));
  const store = new FinanceStore(storage, fixture(), async write => write());
  return { storage, store };
}
const finances = (data: FinanceData) => { const { defaultWalletId, version, exportedAt, ...rest } = data as any; return rest; };

test('cartera: cero, una y varias; ID estable frente a orden/nombre y ausencia de primera implícita', () => {
  assert.equal(resolveDefaultWallet([], 'bank'), undefined);
  assert.equal(resolveDefaultWallet(fixture(1).wallets)?.id, 'bank');
  const wallets = fixture().wallets;
  assert.equal(resolveDefaultWallet(wallets), undefined); assert.equal(resolveDefaultWallet(wallets, 'missing'), undefined);
  assert.equal(resolveDefaultWallet(wallets, 'saving')?.name, 'AHORRO FICTICIO');
  assert.equal(resolveDefaultWallet([...wallets].reverse().map(w => ({ ...w, name: w.name + ' RENOMBRADA' })), 'saving')?.id, 'saving');
  assert.equal(initialWalletName(wallets, 'saving', 'ORIGEN HISTÓRICO'), 'ORIGEN HISTÓRICO');
  assert.equal(initialWalletId(wallets, 'saving', 'bank'), 'bank'); assert.equal(initialWalletId(wallets, null), '');
});
test('cartera: texto explícito, nombres personalizados, ambigüedad y banco inexistente no sustituidos', () => {
  const wallets = fixture().wallets;
  assert.equal(walletFromText('Registra 5 en ahorro ficticio', '', wallets, 'bank')?.id, 'saving');
  assert.equal(walletFromText('Registra 5 en banco ficticio y ahorro ficticio', '', wallets, 'cash'), undefined);
  assert.equal(walletFromText('Registra 5 con Openbank', 'OPENBANK', wallets, 'cash'), undefined);
  assert.equal(walletFromText('Registra 5', '', wallets, 'cash')?.id, 'cash');
  assert.equal(walletFromText('Registra 5 en la cuenta desconocida', '', wallets, 'cash'), undefined);
  const custom = [{ ...wallets[0], name: 'Mi-cuenta Ágil' }, wallets[1]];
  assert.equal(walletFromText('Pagué 5 con mi cuenta agil', '', custom, 'saving')?.id, 'bank');
});
test('cartera: propuestas de chat siguen preferencia, única automática y selección explícita', () => {
  const data = fixture(), partidas = data.budgetGroups.flatMap(g => g.partidas);
  assert.equal(proposeChatMovement('Registra un gasto de 5', data.wallets, partidas)!.wallet, '');
  assert.equal(proposeChatMovement('Registra un gasto de 5', data.wallets, partidas, undefined, 'saving')!.wallet, 'AHORRO FICTICIO');
  assert.equal(proposeChatMovement('Registra un gasto de 5 con banco ficticio', data.wallets, partidas, undefined, 'saving')!.wallet, 'BANCO FICTICIO');
  assert.equal(proposeChatMovement('Registra un gasto de 5', fixture(1).wallets, partidas)!.wallet, 'BANCO FICTICIO');
  assert.equal(proposeChatMovement('Registra un gasto de 5', [], partidas)!.wallet, '');
});
test('cartera: elegir/cambiar/quitar/no-op conserva finanzas, exporta 3.2 y crea copia previa', async () => {
  const { store, storage } = setup(), original = structuredClone(store.data), raw = storage.getItem(DATA_KEY);
  await store.mutate(d => chooseDefaultWallet(d, 'saving'));
  assert.equal(makeBackup(store.data).version, '3.2'); assert.equal(store.data.defaultWalletId, 'saving');
  assert.deepEqual(finances(store.data), finances(original));
  const copies = [...storage.values].filter(([key]) => key.startsWith(RECOVERY_PREFIX)); assert.equal(copies.length, 1);
  assert.deepEqual(finances(parseBackup(copies[0][1])), finances(original));
  const writes = storage.writes; await store.mutate(d => chooseDefaultWallet(d, 'saving')); assert.equal(storage.writes, writes);
  await store.mutate(d => chooseDefaultWallet(d, 'cash')); assert.equal(store.data.defaultWalletId, 'cash');
  await store.mutate(d => chooseDefaultWallet(d, null)); assert.equal(store.data.defaultWalletId, null); assert.equal(makeBackup(store.data).version, '3.2');
  assert.deepEqual(finances(store.data), finances(original)); assert.notEqual(storage.getItem(DATA_KEY), raw);
  assert.equal(new FinanceStore(storage, fixture(), async write => write()).data.defaultWalletId, null);
});
test('cartera: preferencia inválida y banca sin origen válido no escriben; históricos huérfanos se conservan', async () => {
  const data = fixture(); data.transactions = [{ id: 'old', type: 'GASTO', code: 'g', categoryName: 'Histórica', subcategoryName: 'Histórica', description: 'Histórico ficticio', date: '2026-10-01', amount: 10, processed: true, wallet: 'ANTIGUA' }];
  const { store, storage } = setup(data), raw = storage.getItem(DATA_KEY);
  await assert.rejects(store.mutate(d => chooseDefaultWallet(d, 'missing')), /no existe/);
  await assert.rejects(store.update('defaultWalletId', 'missing'), /defaultWalletId/);
  await assert.rejects(store.update('transactions', txs => [{ ...txs[0], id: 'new', wallet: '' }, ...txs]), /cartera de origen/);
  assert.equal(storage.getItem(DATA_KEY), raw);
  await store.mutate(d => chooseDefaultWallet(d, 'saving')); assert.deepEqual(store.data.transactions, data.transactions);
  assert.deepEqual(parseBackup(JSON.stringify(makeBackup(store.data))).transactions, data.transactions);
});
test('cartera: edición conserva origen aunque cambie la predeterminada; cero carteras rechaza banca', async () => {
  const d = fixture(); const t = { id: 'tx', type: 'GASTO' as const, code: 'g', categoryName: 'Gasto', subcategoryName: 'Gasto', description: 'Compra ficticia', date: '2026-10-01', amount: 10, processed: true, wallet: d.wallets[0].name };
  const { store } = setup({ ...d, transactions: [t], defaultWalletId: 'saving' });
  await store.update('transactions', list => list.map(tx => ({ ...tx, description: 'Editado' })));
  assert.equal(store.data.transactions[0].wallet, t.wallet); assert.equal(store.data.defaultWalletId, 'saving');
  const empty = setup(fixture(0)); await assert.rejects(empty.store.update('transactions', [t]), /cartera de origen/);
});
for (const failure of ['copy', 'verify', 'active'] as const) test(`cartera: migración 3.2 falla en ${failure} sin cambios parciales y permite reintentar`, async () => {
  const { store, storage } = setup(), raw = storage.getItem(DATA_KEY), original = structuredClone(store.data);
  storage.fail = failure; await assert.rejects(store.mutate(d => chooseDefaultWallet(d, 'saving')));
  assert.equal(storage.getItem(DATA_KEY), raw); assert.deepEqual(store.data, original);
  storage.fail = null; await store.mutate(d => chooseDefaultWallet(d, 'saving')); assert.equal(store.data.defaultWalletId, 'saving');
});
test('cartera: conflicto entre pestañas y cuota en 3.2 no aplican preferencia optimista', async () => {
  const { store, storage } = setup(); const other = new FinanceStore(storage, fixture(), async write => write());
  await store.mutate(d => chooseDefaultWallet(d, 'saving')); const raw = storage.getItem(DATA_KEY);
  await assert.rejects(other.mutate(d => chooseDefaultWallet(d, 'cash')), /Otra pestaña/); assert.equal(storage.getItem(DATA_KEY), raw);
  storage.fail = 'active'; await assert.rejects(store.mutate(d => chooseDefaultWallet(d, 'cash'))); assert.equal(store.data.defaultWalletId, 'saving');
});
test('cartera: borrar la predeterminada limpia el ID atómicamente; única restante automática, borrado vinculado rechazado', async () => {
  const { store } = setup({ ...fixture(2), defaultWalletId: 'saving' });
  await store.mutate(d => deleteEntity(d, { kind: 'wallet', id: 'saving' })); assert.equal(store.data.defaultWalletId, null);
  assert.equal(resolveDefaultWallet(store.data.wallets, store.data.defaultWalletId)?.id, 'bank');
  await store.mutate(d => ({ ...d, wallets: [] })); assert.equal(resolveDefaultWallet(store.data.wallets, store.data.defaultWalletId), undefined);
  const all = clearedData({ ...fixture(), defaultWalletId: 'saving' }, { clearAllWallets: true, clearTransactions: true, clearWalletBalances: false, clearBudgets: false, clearDebts: false });
  assert.equal(all.defaultWalletId, null);
  const data = fixture(); data.transactions = transferPair(data.wallets, { fromWalletId: 'bank', toWalletId: 'saving', amount: 10, date: '2026-10-01', concept: 'Ficticio', processed: true });
  const linked = setup({ ...data, defaultWalletId: 'saving' }); const raw = linked.storage.getItem(DATA_KEY);
  await assert.rejects(linked.store.mutate(d => deleteEntity(d, { kind: 'wallet', id: 'saving' })), /No se puede eliminar/);
  assert.equal(linked.storage.getItem(DATA_KEY), raw);
});
test('cartera: validación estricta 3.2 y ausencia de contaminación de formatos antiguos', () => {
  const valid = makeBackup({ ...fixture(), defaultWalletId: 'saving' });
  for (const id of ['', 1, {}, 'missing', undefined]) { const copy: any = { ...valid, defaultWalletId: id }; assert.throws(() => parseBackup(JSON.stringify(copy)), /defaultWalletId/); }
  assert.throws(() => parseBackup(JSON.stringify({ ...valid, version: '3.1' })), /campo no reconocido/);
  assert.equal(parseBackup(JSON.stringify({ ...valid, defaultWalletId: null })).defaultWalletId, null);
});
for (const version of ['2.5', '2.6', '2.7', '2.8', '2.9', '3.0', '3.1'] as const) test(`cartera: carga/restauración ${version}, ampliación a 3.2 y vuelta completa sin escrituras al leer`, async () => {
  let data = fixture();
  if (version >= '2.9') data = savePlanning(data, '2026-10', [{ type: 'GASTO', code: 'g', amountCents: 1000 }], 0, planningScope(data, '2026-10'));
  if (version >= '3.0') data = applyAutomationPreview(data, previewAutomation(data, { kind: 'copy', source: '2026-10', first: '2026-11', last: '2026-11', keys: ['GASTO:g'], savings: false, overwrite: [] }));
  if (version === '3.1') data = { ...data, intelligentFinance: { recurringRules: [], occurrences: [], obligations: [] } };
  const backup = parseBackup(JSON.stringify({ ...makeBackup(data), version })); const storage = new MemoryStorage(); storage.setItem(DATA_KEY, JSON.stringify(backup));
  const raw = storage.getItem(DATA_KEY), writes = storage.writes; const store = new FinanceStore(storage, fixture(), async write => write());
  assert.equal(storage.writes, writes); assert.equal(storage.getItem(DATA_KEY), raw); assert.equal(store.data.defaultWalletId, undefined);
  await store.mutate(d => chooseDefaultWallet(d, 'saving')); const exported = parseBackup(JSON.stringify(makeBackup(store.data)));
  assert.equal(exported.version, '3.2'); assert.deepEqual(finances(exported), finances(backup));
  await store.restore(backup); assert.equal(store.data.defaultWalletId, undefined); assert.deepEqual(finances(store.data), finances(backup));
  await store.restore(exported); assert.equal(store.data.defaultWalletId, 'saving');
});
test('cartera: JSON 3.2 conserva transferencias, repartos, reintegros, ocurrencias, principal y aprobación', async () => {
  let d = fixture(); d.transactions = transferPair(d.wallets, { fromWalletId: 'bank', toWalletId: 'saving', amount: 10, date: '2026-10-01', concept: 'Ficticio', processed: true });
  d = saveSharedTransaction(d, { type: 'GASTO', code: 'g', amount: 60, date: '2026-10-02', categoryName: 'Gastos ficticios', subcategoryName: 'Alquiler ficticio', description: 'Comida ficticia', wallet: 'BANCO FICTICIO', processed: true, splitInfo: splitExactly(60, d.contacts, 'bank') });
  const expense = d.transactions.find(t => t.splitInfo)!;
  d = saveSettlement(d, { expenseId: expense.id, contactId: 'friend', amount: 5, date: '2026-10-03', kind: 'cash', processed: true, walletId: 'saving' });
  d = saveMovementRule(d, movementRule());
  const occurrence = occurrencePreviews(d, '2026-10')[0];
  d = applyOccurrenceBatch(d, { first: '2026-10', last: '2026-10', ids: [occurrence.id], action: 'register', scope: occurrenceScope(d), acknowledgeCollisions: false });
  d = saveObligation(d, personalObligation());
  d = settleObligation(d, 'personal', { id: 'partial', amountCents: 1000, date: '2026-10-04', kind: 'bank', processed: false, note: 'Ficticio', walletId: 'saving' });
  d = savePlanning(d, '2026-10', [], 0, planningScope(d, '2026-10'), true, true);
  const original = structuredClone(d), { store } = setup(d), balances = calculateWalletBalances(d.wallets, d.transactions);
  await store.mutate(data => chooseDefaultWallet(data, 'cash'));
  const restored = parseBackup(JSON.stringify(makeBackup(store.data))); assert.deepEqual(finances(restored), finances(original));
  assert.deepEqual(calculateWalletBalances(restored.wallets, restored.transactions), balances);
  assert.equal(restored.intelligentFinance!.recurringRules[0].walletId, 'bank');
});

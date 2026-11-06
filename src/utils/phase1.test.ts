import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyChatIntent, proposeChatMovement } from './chatRegistration';
import { confirmOnce, confirmOnceAsync } from './confirmation';
import { Backup, commitRestoration, DATA_KEY, makeBackup, parseBackup, parseSnapshot, recoveryCopies, validateBackup, StorageConflictError } from './backup';
import { ExclusiveWrite, FinanceStore } from './financeStore';
import { clearedData, ClearDataOptions } from './clearData';
import { loadFinanceData } from './useFinanceData';
import { BUDGET_GROUPS } from '../constants/categories';
import { INITIAL_TRANSACTIONS, INITIAL_BUDGET_PLANS, INITIAL_CONTACTS, INITIAL_LOANS, INITIAL_WALLETS } from './seedData';

const fixture = (): Backup => structuredClone(makeBackup({
  theme: 'dark', transactions: INITIAL_TRANSACTIONS, budgetPlans: INITIAL_BUDGET_PLANS,
  budgetGroups: BUDGET_GROUPS, contacts: INITIAL_CONTACTS, loans: INITIAL_LOANS, wallets: INITIAL_WALLETS,
}));
class MemoryStorage {
  values = new Map<string, string>();
  fail: (key: string) => boolean = () => false;
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.fail(key)) throw new Error('Sin espacio');
    this.values.set(key, value);
  }
}
const partidas = BUDGET_GROUPS.flatMap(g => g.partidas);

for (const text of ['¿Puedo gastar 500 € este mes?', 'No registres 100 euros', 'Tengo 2 préstamos', '¿Puedes registrar un gasto de 20 euros?', 'Si gasto 100 euros, cuánto me queda', 'Nunca anotes 30 euros']) {
  test(`el chat no propone ni registra: ${text}`, () => {
    let saved = 0;
    const proposal = proposeChatMovement(text, INITIAL_WALLETS, partidas);
    const confirm = confirmOnce(() => saved++);
    assert.notEqual(classifyChatIntent(text), 'registration');
    assert.equal(proposal, null);
    if (proposal) confirm.confirm(proposal);
    assert.equal(saved, 0);
  });
}
test('una orden válida solo se guarda tras confirmar y conserva los campos revisados', () => {
  const saved: unknown[] = [];
  const proposal = proposeChatMovement('Registra un gasto de 15 euros con Openbank', INITIAL_WALLETS, partidas);
  assert.ok(proposal);
  const confirmation = confirmOnce(value => saved.push(value));
  assert.equal(saved.length, 0);
  const reviewed = { ...proposal, amount: 20, date: '2026-11-01', wallet: 'REVOLUT', description: 'Revisado', processed: false };
  assert.equal(confirmation.confirm(reviewed), true);
  assert.equal(confirmation.confirm(reviewed), false);
  assert.deepEqual(saved, [reviewed]);
});
test('cancelar una propuesta impide guardarla después', () => {
  let saved = 0;
  const confirmation = confirmOnce(() => saved++);
  confirmation.cancel();
  assert.equal(confirmation.confirm({}), false);
  assert.equal(saved, 0);
});
test('un fallo de guardado permite reintentar la confirmación', () => {
  let attempts = 0;
  const confirmation = confirmOnce(() => { if (++attempts === 1) throw new Error('Fallo'); });
  assert.throws(() => confirmation.confirm({}));
  assert.equal(confirmation.confirm({}), true);
});
test('el formato exportado y los datos demo pasan la validación completa', () => {
  const data = fixture();
  assert.deepEqual(parseBackup(JSON.stringify(data)), data);
});
test('transactions: [{}] es rechazado antes de modificar datos o almacenamiento', () => {
  const storage = new MemoryStorage();
  const previous = fixture();
  storage.setItem(DATA_KEY, JSON.stringify(previous));
  const before = [...storage.values];
  const invalid = { ...fixture(), transactions: [{}] } as Backup;
  assert.throws(() => commitRestoration(storage, previous, invalid), /transactions\[0\].id/);
  assert.deepEqual([...storage.values], before);
  assert.deepEqual(previous, JSON.parse(storage.getItem(DATA_KEY)!));
});
test('rechaza JSON inválido, versiones desconocidas, colecciones ausentes y valores no finitos', () => {
  assert.throws(() => parseBackup('{'), /JSON válido/);
  for (const mutate of [
    (b: any) => { delete b.contacts; },
    (b: any) => { b.version = '3.0'; },
    (b: any) => { b.wallets = {}; },
    (b: any) => { b.transactions[0].amount = Infinity; },
    (b: any) => { b.transactions[0].processed = 'true'; },
    (b: any) => { b.transactions[0].date = '2026-02-30'; },
    (b: any) => { b.transactions[0].extra = 'no reconocido'; },
    (b: any) => { b.budgetPlans[0].monthYear = '2026-13'; },
    (b: any) => { b.budgetGroups[0].partidas[0].keywords = [1]; },
    (b: any) => { b.contacts[0].name = 2; },
    (b: any) => { b.loans[0].totalTermMonths = 2.5; },
    (b: any) => { b.wallets[0].initialBalance = '100'; },
    (b: any) => { b.transactions.push(b.transactions[0]); },
    (b: any) => { b.transactions.find((t: any) => t.splitInfo).splitInfo.participants[0].isPaid = 'no'; },
  ]) {
    const invalid = fixture(); mutate(invalid);
    assert.throws(() => validateBackup(invalid));
  }
});
test('cancelar una restauración conserva íntegramente estado y almacenamiento', () => {
  const storage = new MemoryStorage();
  let state = fixture();
  storage.setItem(DATA_KEY, JSON.stringify(state));
  const before = structuredClone(state), storedBefore = [...storage.values];
  const next = fixture(); next.transactions = [];
  const confirmation = confirmOnce((backup: Backup) => { state = commitRestoration(storage, state, backup) as Backup; });
  // Preparar y validar la vista previa tampoco escribe.
  validateBackup(next);
  assert.deepEqual([...storage.values], storedBefore);
  confirmation.cancel(); confirmation.confirm(next);
  assert.deepEqual(state, before);
  assert.deepEqual([...storage.values], storedBefore);
});
test('la sustitución completa guarda una copia recuperable y conserva las claves antiguas', () => {
  const storage = new MemoryStorage();
  const previous = fixture(), next = fixture(); next.transactions = []; next.contacts = [];
  storage.setItem('finanzas_pro_transactions_v2', JSON.stringify(previous.transactions));
  const restored = commitRestoration(storage, previous, next);
  assert.deepEqual(restored, next);
  const persisted = parseSnapshot(storage.getItem(DATA_KEY)!);
  for (const key of ['theme', 'transactions', 'budgetPlans', 'budgetGroups', 'contacts', 'loans', 'wallets'] as const) assert.deepEqual(persisted[key], next[key]);
  assert.deepEqual(parseBackup(recoveryCopies(storage)[0].content).transactions, previous.transactions);
  assert.equal(storage.getItem('finanzas_pro_transactions_v2'), JSON.stringify(previous.transactions));
});
for (const failure of ['recovery', 'active']) {
  test(`si falla ${failure}, no se sustituye el estado activo`, () => {
    const storage = new MemoryStorage();
    let state = fixture();
    storage.setItem(DATA_KEY, JSON.stringify(state));
    const before = structuredClone(state), storedBefore = storage.getItem(DATA_KEY);
    storage.fail = key => failure === 'active' ? key === DATA_KEY : key !== DATA_KEY;
    const next = fixture(); next.transactions = [];
    assert.throws(() => { state = commitRestoration(storage, state, next) as Backup; });
    assert.deepEqual(state, before);
    assert.equal(storage.getItem(DATA_KEY), storedBefore);
  });
}
test('varias sustituciones mantienen las copias anteriores', () => {
  const storage = new MemoryStorage(), previous = fixture(), next = fixture();
  commitRestoration(storage, previous, next);
  commitRestoration(storage, next, previous);
  assert.equal(recoveryCopies(storage).length, 2);
});
test('las claves antiguas se leen sin borrarse y el snapshot activo tiene precedencia', () => {
  const storage = new MemoryStorage(), defaults = fixture();
  storage.setItem('finanzas_pro_transactions_v2', '[]');
  assert.deepEqual(loadFinanceData(storage, defaults).transactions, []);
  assert.equal(storage.getItem('finanzas_pro_transactions_v2'), '[]');
  const active = fixture();
  storage.setItem(DATA_KEY, JSON.stringify(active));
  assert.deepEqual(loadFinanceData(storage, defaults), active);
});

function sharedLock(): ExclusiveWrite {
  let tail = Promise.resolve();
  return write => {
    const result = tail.then(write);
    tail = result.then(() => {}, () => {});
    return result;
  };
}
test('el dominio rechaza nombres de cartera duplicados sin cambiar estado ni persistencia', async () => {
  const storage = new MemoryStorage(), original = fixture();
  const store = new FinanceStore(storage, original, sharedLock());
  const before = store.data;
  await assert.rejects(store.update('wallets', wallets => [...wallets, { ...wallets[0], id: 'duplicate', name: ` ${wallets[0].name.toLowerCase()} ` }]), /duplicados/);
  assert.equal(store.data, before);
  assert.equal(storage.getItem(DATA_KEY), null);
  await store.update('wallets', wallets => [...wallets, { ...wallets[0], id: 'new-wallet', name: 'NUEVA' }]);
  const reloaded = new FinanceStore(storage, original, sharedLock());
  assert.equal(reloaded.data.wallets.at(-1)?.name, 'NUEVA');
  await reloaded.update('wallets', wallets => wallets.map(w => ({ ...w, color: '#ffffff' })));
  assert.equal(reloaded.data.wallets.length, original.wallets.length + 1);
});
test('validar antes de guardar evita persistir un movimiento inválido', async () => {
  const storage = new MemoryStorage(), store = new FinanceStore(storage, fixture(), sharedLock());
  const before = store.data;
  await assert.rejects(store.update('transactions', transactions => [{ ...transactions[0], amount: NaN }, ...transactions.slice(1)]), /amount/);
  assert.equal(store.data, before);
  assert.equal(storage.length, 0);
});
test('los datos antiguos duplicados se conservan sin reemplazo ni borrado', () => {
  const storage = new MemoryStorage(), original = fixture();
  const duplicates = [...original.wallets, { ...original.wallets[0], id: 'other' }];
  storage.setItem('finanzas_pro_wallets_v2', JSON.stringify(duplicates));
  const before = [...storage.values];
  assert.throws(() => new FinanceStore(storage, original, sharedLock()), /duplicados/);
  assert.deepEqual([...storage.values], before);
});
test('dos escrituras simultáneas de pestañas distintas no pierden cambios silenciosamente', async () => {
  const storage = new MemoryStorage(), lock = sharedLock(), original = fixture();
  const a = new FinanceStore(storage, original, lock), b = new FinanceStore(storage, original, lock);
  const results = await Promise.allSettled([a.update('theme', 'light'), b.update('transactions', [])]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.ok(results[1].status === 'rejected' && results[1].reason instanceof StorageConflictError);
  assert.equal(parseSnapshot(storage.getItem(DATA_KEY)!).theme, 'light');
  assert.deepEqual(parseSnapshot(storage.getItem(DATA_KEY)!).transactions, original.transactions);
});
test('una pestaña obsoleta tampoco puede sobrescribir una restauración aunque no reciba storage', async () => {
  const storage = new MemoryStorage(), lock = sharedLock(), original = fixture();
  const a = new FinanceStore(storage, original, lock), b = new FinanceStore(storage, original, lock);
  const replacement = fixture(); replacement.transactions = [];
  await a.restore(replacement);
  const before = [...storage.values];
  await assert.rejects(b.update('theme', 'light'), StorageConflictError);
  await assert.rejects(b.restore(original), StorageConflictError);
  assert.deepEqual([...storage.values], before);
  assert.ok(b.checkForConflict());
});
test('las actualizaciones consecutivas de una pestaña usan el último estado confirmado', async () => {
  const storage = new MemoryStorage(), store = new FinanceStore(storage, fixture(), sharedLock());
  await Promise.all([
    store.update('contacts', contacts => [...contacts, { id: 'one', name: 'Uno', createdAt: '2026-11-01' }]),
    store.update('contacts', contacts => [...contacts, { id: 'two', name: 'Dos', createdAt: '2026-11-01' }]),
  ]);
  assert.deepEqual(store.data.contacts.slice(-2).map(c => c.id), ['one', 'two']);
});
test('cada restauración cambia la revisión aunque su contenido financiero sea igual', async () => {
  const storage = new MemoryStorage(), store = new FinanceStore(storage, fixture(), sharedLock());
  const data = fixture();
  await store.restore(data); const first = storage.getItem(DATA_KEY);
  await store.restore(data);
  assert.notEqual(storage.getItem(DATA_KEY), first);
  assert.equal(recoveryCopies(storage).length, 2);
});
const clearOptions: ClearDataOptions = { clearAllWallets: true, clearWalletBalances: true, clearTransactions: true, clearBudgets: true, clearDebts: true };
test('cancelar el borrado no modifica ningún dato ni crea copias', async () => {
  const storage = new MemoryStorage(), store = new FinanceStore(storage, fixture(), sharedLock());
  const before = store.data;
  const guard = confirmOnceAsync(async () => { await store.restore(makeBackup(clearedData(store.data, clearOptions))); });
  guard.cancel(); await guard.confirm(undefined);
  assert.equal(storage.length, 0);
  assert.equal(store.data, before);
});
test('borrar conserva una copia completa recuperable antes de vaciar las colecciones', async () => {
  const storage = new MemoryStorage(), store = new FinanceStore(storage, fixture(), sharedLock());
  const before = structuredClone(store.data);
  const cleared = clearedData(store.data, clearOptions);
  assert.deepEqual(store.data, before);
  await store.restore(makeBackup(cleared));
  assert.deepEqual(parseBackup(recoveryCopies(storage)[0].content).transactions, before.transactions);
  assert.deepEqual(store.data.transactions, []);
  assert.deepEqual(store.data.wallets, []);
  assert.deepEqual(store.data.contacts, before.contacts);
});
for (const failure of ['recovery', 'active']) {
  test(`borrado con fallo en ${failure} conserva estado y snapshot`, async () => {
    const storage = new MemoryStorage(), original = fixture();
    storage.setItem(DATA_KEY, JSON.stringify(original));
    const store = new FinanceStore(storage, original, sharedLock());
    const before = store.data, raw = storage.getItem(DATA_KEY);
    storage.fail = key => failure === 'active' ? key === DATA_KEY : key !== DATA_KEY;
    await assert.rejects(store.restore(makeBackup(clearedData(store.data, clearOptions))));
    assert.equal(store.data, before);
    assert.equal(storage.getItem(DATA_KEY), raw);
  });
}
test('la confirmación asíncrona bloquea dobles clics mientras el guardado está pendiente', async () => {
  let calls = 0;
  let release!: () => void;
  const guard = confirmOnceAsync(async () => { calls++; await new Promise<void>(resolve => { release = resolve; }); });
  const first = guard.confirm(undefined);
  assert.equal(await guard.confirm(undefined), false);
  release(); assert.equal(await first, true);
  assert.equal(calls, 1);
});
test('un borrado parcial en cola conserva los cambios previos de la misma pestaña', async () => {
  const storage = new MemoryStorage(), store = new FinanceStore(storage, fixture(), sharedLock());
  await Promise.all([
    store.update('transactions', transactions => [{ ...transactions[0], id: 'just-saved' }, ...transactions]),
    store.restore(current => makeBackup(clearedData(current, { ...clearOptions, clearAllWallets: false, clearDebts: false, clearTransactions: false }))),
  ]);
  assert.equal(store.data.transactions[0].id, 'just-saved');
  assert.equal(parseBackup(recoveryCopies(storage)[0].content).transactions[0].id, 'just-saved');
});
for (const text of ['No me cuadran los gastos, ¿por qué?', '¿Por qué no ahorro 100 euros?', 'No entiendo mi presupuesto', 'No tengo ingresos este mes']) {
  test(`la consulta negativa llega al asesor sin proponer movimientos: ${text}`, () => {
    assert.equal(classifyChatIntent(text), 'query');
    assert.equal(proposeChatMovement(text, INITIAL_WALLETS, partidas), null);
  });
}
test('una orden con estado no tramitado sigue siendo una propuesta pendiente', () => {
  const proposal = proposeChatMovement('Registra un gasto de 20 euros no tramitado', INITIAL_WALLETS, partidas);
  assert.ok(proposal);
  assert.equal(proposal.processed, false);
});

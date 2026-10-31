import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyChatIntent, proposeChatMovement } from './chatRegistration';
import { confirmOnce } from './confirmation';
import { Backup, commitRestoration, DATA_KEY, makeBackup, parseBackup, recoveryCopies, validateBackup } from './backup';
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
  assert.deepEqual(JSON.parse(storage.getItem(DATA_KEY)!), next);
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

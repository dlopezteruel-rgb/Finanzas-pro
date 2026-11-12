import {chooseMovementPartida} from './browserNavigation';
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import type { Browser, Page } from 'playwright-core';
import { DATA_KEY, FinanceData, makeBackup, parseBackup, RECOVERY_PREFIX } from '../src/utils/backup';
import { BUDGET_GROUPS } from '../src/constants/categories';
import { assertSharedIntegrity, remainingDebt, saveSettlement, sharedViewTransactions, splitExactly } from '../src/utils/sharedExpenses';
import { calculateMonthlySummary, calculateWalletBalances } from '../src/utils/finance';
import { STORAGE_LOCK } from '../src/utils/financeStore';
import type { Transaction } from '../src/types/finance';

const base = (): FinanceData => ({ theme: 'dark', transactions: [], budgetPlans: [], budgetGroups: BUDGET_GROUPS, loans: [],
  wallets: [{ id: 'bank', name: 'OPENBANK', type: 'BANK', color: '#fff', initialBalance: 1000 }, { id: 'rev', name: 'REVOLUT', type: 'NEOBANK', color: '#fff', initialBalance: 100 }],
  contacts: [{ id: 'a', name: 'Ana', createdAt: '2026-01-01' }, { id: 'b', name: 'Bea', createdAt: '2026-01-01' }] });
const fixture = (amount = 60): FinanceData => ({ ...base(), transactions: [{ id: 'dinner', amount, date: '2026-10-08', type: 'GASTO', code: 'V.001.002', categoryName: 'Alimentación', subcategoryName: 'Comer fuera', description: 'Cena ficticia', wallet: 'OPENBANK', processed: true, splitInfo: splitExactly(amount, base().contacts, 'bank') }] });
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), DATA_KEY);
const data = async (page: Page) => JSON.parse((await raw(page))!) as FinanceData;
const original = (d: FinanceData) => d.transactions.find(t => t.splitInfo)!;
const navigate = (page: Page, name: string) => page.getByRole('button', { name: new RegExp('^' + name + '(?:\\s*\\d+)?$') }).first().click();
const liquid = (page: Page) => page.getByRole('dialog', { name: 'Liquidación', exact: true });

export async function sharedExpenseCases(t: TestContext, browser: Browser, url: string) {
  async function setup(initial: FinanceData) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
    await context.addInitScript(({ key, initial }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(initial)); }, { key: DATA_KEY, initial: makeBackup(initial) });
    const page = await context.newPage(); page.setDefaultTimeout(7000); await page.goto(url);
    return { context, page };
  }
  async function openNew(page: Page, amount = '60') {
    await navigate(page, 'Añadir'); const d = page.getByRole('dialog', { name: 'Movimiento', exact: true });
    await d.locator('input[type=number]').fill(amount);
    await d.getByLabel('Cartera u Origen', { exact: true }).selectOption('OPENBANK');
    await d.getByPlaceholder('ej. Cena restaurante, Compra Zara, Supermercado...').fill('Cena ficticia');
    await d.locator('input[type=date]').fill('2026-10-08');
    await d.getByRole('checkbox').first().check();
    await d.getByRole('button', { name: 'Ana', exact: true }).click(); await d.getByRole('button', { name: 'Bea', exact: true }).click();
    await chooseMovementPartida(d);return d;
  }
  async function contacts(page: Page, name = 'Ana') {
    await navigate(page, 'Inicio'); await navigate(page, 'Contactos'); await page.getByText(name, { exact: true }).first().click();
  }
  async function collect(page: Page, name = 'Ana', amount = '20', date = '2026-10-09') {
    await contacts(page, name); await page.getByRole('button', { name: 'Saldar deuda', exact: true }).click();
    const d = liquid(page);
    await d.getByLabel('Importe a saldar (€)').fill(amount); await d.getByLabel('Fecha del cobro o compensación').fill(date);
    await d.getByLabel('Cartera receptora').selectOption('rev'); return d;
  }
  async function editReceipt(page: Page, deleting = false) {
    await contacts(page);
    await page.getByRole('button', { name: deleting ? /^Eliminar liquidación / : /^Editar liquidación / }).first().click(); return liquid(page);
  }
  const pending = (d: FinanceData) => original(d).splitInfo!.participants.reduce((n, p) => n + remainingDebt(original(d), p.contactId), 0);
  const summary = (d: FinanceData, month = '2026-10') => calculateMonthlySummary(month, d.transactions, d.budgetPlans);

  await t.test('2B A/B/C/F/G: crear 60/3, dos reintegros, meses, recarga, edición, cancelación y borrado', async () => {
    const { context, page } = await setup(base());
    try {
      const before = await raw(page); let d = await openNew(page);
      await d.getByRole('button', { name: 'Cancelar', exact: true }).click(); assert.equal(await raw(page), before);
      d = await openNew(page);
      await d.locator('form').evaluate(f => { (f as HTMLFormElement).requestSubmit(); f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
      await d.waitFor({ state: 'hidden' }); let saved = await data(page);
      assert.equal(saved.transactions.length, 1); assert.equal(original(saved).splitInfo!.myShare, 20); assert.equal(pending(saved), 40);
      assert.equal(calculateWalletBalances(saved.wallets, saved.transactions).OPENBANK, 940); assert.equal(summary(saved).gastosEjecutados, 20);
      const october = summary(saved); await page.reload(); assert.equal(pending(await data(page)), 40);
      d = await collect(page); await d.getByRole('button', { name: 'Cancelar', exact: true }).click(); assert.equal(pending(await data(page)), 40);
      d = await collect(page); await d.locator('button[type=submit]').click(); await d.waitFor({ state: 'hidden' });
      saved = await data(page); assert.equal(pending(saved), 20); assert.equal(calculateWalletBalances(saved.wallets, saved.transactions).REVOLUT, 120); assert.deepEqual(summary(saved), october);
      d = await collect(page, 'Bea', '20', '2026-11-05'); await d.locator('button[type=submit]').click(); await d.waitFor({ state: 'hidden' });
      saved = await data(page); assert.equal(pending(saved), 0); assert.deepEqual(summary(saved), october); assert.equal(summary(saved, '2026-11').ingresosReales, 0); assert.equal(summary(saved, '2026-11').gastosEjecutados, 0);
      assert.equal(calculateWalletBalances(saved.wallets, saved.transactions).REVOLUT, 140);
      // Reopening from the normal movements list must route to the linked editor.
      await navigate(page, 'Movimientos'); await page.getByRole('button', { name: /^Editar movimiento Reintegro Ana/ }).click();
      d = liquid(page); await d.getByLabel('Importe a saldar (€)').fill('10'); await d.locator('button[type=submit]').click(); await d.waitFor({ state: 'hidden' });
      saved = await data(page); assert.equal(pending(saved), 10); assert.equal(calculateWalletBalances(saved.wallets, saved.transactions).REVOLUT, 130);
      d = await editReceipt(page, true); const unchanged = await raw(page); await d.getByRole('button', { name: 'Cancelar', exact: true }).click(); assert.equal(await raw(page), unchanged);
      d = await editReceipt(page, true); await d.getByRole('button', { name: 'Confirmar eliminación de liquidación', exact: true }).click(); await d.waitFor({ state: 'hidden' });
      saved = await data(page); assert.equal(pending(saved), 20); assert.equal(calculateWalletBalances(saved.wallets, saved.transactions).REVOLUT, 120);
      await page.reload(); assert.equal(pending(await data(page)), 20); assertSharedIntegrity(await data(page));
    } finally { await context.close(); }
  });

  await t.test('2B D/E: reparto 100/3 exacto, cobro parcial, sobrecobro rechazado y compensación sin banco', async () => {
    const { context, page } = await setup(base());
    try {
      let d = await openNew(page, '100.01');
      assert.match(await d.getByLabel('Parte de Ana', { exact: true }).innerText(), /33,34/);
      assert.match(await d.getByLabel('Parte de Bea', { exact: true }).innerText(), /33,33/);
      await d.locator('input[type=number]').fill('100'); await d.locator('button[type=submit]').click(); await d.waitFor({ state: 'hidden' });
      let saved = await data(page), e = original(saved);
      assert.deepEqual([e.splitInfo!.myShare, ...e.splitInfo!.participants.map(p => p.amount)], [33.34, 33.33, 33.33]);
      d = await collect(page, 'Ana', '10'); await d.locator('button[type=submit]').click(); await d.waitFor({ state: 'hidden' });
      assert.equal(remainingDebt(original(await data(page)), 'a'), 23.33);
      d = await collect(page, 'Ana', '24'); const before = await raw(page); await d.locator('button[type=submit]').click(); await d.getByRole('alert').waitFor();
      assert.match(await d.getByRole('alert').innerText(), /supera|duplica/); assert.equal(await raw(page), before); assert.equal(await d.getByLabel('Importe a saldar (€)').inputValue(), '24');
      await d.getByLabel('Importe a saldar (€)').fill('23.33'); await d.getByLabel('Registrar entrada bancaria').uncheck();
      await d.locator('button[type=submit]').click(); await d.waitFor({ state: 'hidden' });
      saved = await data(page); assert.equal(saved.transactions.length, 2); assert.equal(remainingDebt(original(saved), 'a'), 0);
      assert.equal(calculateWalletBalances(saved.wallets, saved.transactions).REVOLUT, 110); assert.equal(summary(saved).gastosEjecutados, 33.34);
      await page.reload(); assert.equal(original(await data(page)).splitInfo!.settlements!.filter(s => s.kind === 'offset').length, 1);
    } finally { await context.close(); }
  });

  await t.test('2B processed: gasto y cobro pendientes no alteran caja ni ejecutado hasta tramitarlos', async () => {
    const initial = fixture(); initial.transactions[0].processed = false;
    const { context, page } = await setup(initial);
    try {
      let saved = await data(page); assert.equal(summary(saved).gastosEjecutados, 0); assert.equal(calculateWalletBalances(saved.wallets, saved.transactions).OPENBANK, 1000);
      await navigate(page, 'Movimientos'); await page.getByRole('button', { name: 'NO', exact: true }).click();
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)!).transactions[0].processed, DATA_KEY);
      let d = await collect(page); await d.getByLabel('Liquidación tramitada').uncheck(); await d.locator('button[type=submit]').click(); await d.waitFor({ state: 'hidden' });
      saved = await data(page); assert.equal(pending(saved), 40); assert.equal(calculateWalletBalances(saved.wallets, saved.transactions).REVOLUT, 100); assert.equal(summary(saved).gastosEjecutados, 20);
      d = await editReceipt(page); await d.getByLabel('Liquidación tramitada').check(); await d.locator('button[type=submit]').click(); await d.waitFor({ state: 'hidden' });
      saved = await data(page); assert.equal(pending(saved), 20); assert.equal(calculateWalletBalances(saved.wallets, saved.transactions).REVOLUT, 120); assert.equal(summary(saved).ingresosReales, 0);
    } finally { await context.close(); }
  });

  for (const mode of ['create', 'collect', 'edit', 'delete', 'adjust'] as const) for (const failure of ['storage', 'conflict'] as const) await t.test(`2B H: ${mode}/${failure} espera el bloqueo, conserva campos y evita dobles escrituras`, async () => {
    const initial = mode === 'create' ? base() : ['edit', 'delete', 'adjust'].includes(mode) ? saveSettlement(fixture(), { expenseId: 'dinner', contactId: 'a', amount: 10, date: '2026-10-09', kind: 'cash', processed: true, walletId: 'rev' }) : fixture();
    const { context, page } = await setup(initial);
    try {
      let d;
      if (mode === 'create') d = await openNew(page);
      else if (mode === 'collect') d = await collect(page, 'Ana', '10');
      else if (mode === 'adjust') {
        await contacts(page); await page.getByTitle('Editar importe de la deuda').first().click(); d = page.getByRole('dialog', { name: 'Corregir deuda' });
        await d.getByLabel('Deuda total del participante (€)').fill('15');
      } else { d = await editReceipt(page, mode === 'delete'); if (mode === 'edit') await d.getByLabel('Importe a saldar (€)').fill('15'); }
      const fields = () => d.locator('input,select').evaluateAll(els => els.map(e => ({ value: (e as HTMLInputElement).value, checked: (e as HTMLInputElement).checked })));
      const draft = await fields();
      await page.evaluate(key => {
        const original = Storage.prototype.setItem;
        (window as any).sharedSave = { fail: false, attempts: 0 };
        Storage.prototype.setItem = function(k, v) { if (k === key) { (window as any).sharedSave.attempts++; if ((window as any).sharedSave.fail) throw new DOMException('Cuota', 'QuotaExceededError'); } return original.call(this, k, v); };
      }, DATA_KEY);
      if (failure === 'storage') await page.evaluate(() => { (window as any).sharedSave.fail = true; });
      else {
        const other = await context.newPage(); await other.goto(url); const previous = await raw(other);
        await other.getByRole('button', { name: /Cambiar a modo/ }).click(); await other.waitForFunction(({ key, previous }) => localStorage.getItem(key) !== previous, { key: DATA_KEY, previous }); await other.close();
      }
      const before = await raw(page);
      await page.evaluate(lock => { void navigator.locks.request(lock, async () => { (window as any).sharedHeld = true; await new Promise<void>(resolve => { (window as any).releaseShared = resolve; }); }); }, STORAGE_LOCK);
      await page.waitForFunction(() => (window as any).sharedHeld);
      const button = mode === 'delete' ? d.getByRole('button', { name: 'Confirmar eliminación de liquidación', exact: true }) : mode === 'adjust' ? d.getByRole('button', { name: 'Guardar', exact: true }) : d.locator('button[type=submit]');
      await button.evaluate(b => { (b as HTMLButtonElement).click(); (b as HTMLButtonElement).click(); });
      await d.locator('fieldset:disabled').waitFor(); assert.ok(await button.isDisabled()); assert.deepEqual(await fields(), draft); assert.equal(await raw(page), before);
      await page.evaluate(() => (window as any).releaseShared()); await d.getByRole('alert').waitFor();
      assert.match(await d.getByRole('alert').innerText(), failure === 'storage' ? /No hay espacio/ : /Otra pestaña/); assert.deepEqual(await fields(), draft); assert.equal(await raw(page), before);
      if (failure === 'storage') {
        await page.evaluate(() => { (window as any).sharedSave.fail = false; }); await button.click(); await d.waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => (window as any).sharedSave.attempts), 2); const saved = await data(page); assertSharedIntegrity(saved);
        assert.equal(pending(saved), mode === 'create' ? 40 : mode === 'delete' ? 40 : mode === 'edit' ? 25 : mode === 'adjust' ? 25 : 30);
        await page.reload(); assertSharedIntegrity(await data(page));
      }
    } finally { await context.close(); }
  });

  await t.test('2B I: vista previa, históricos inequívocos/ambiguos, copia anterior e intercambio 2.5/2.6/2.7', async () => {
    const initial = fixture(), e = original(initial); delete e.splitInfo!.accountingVersion; delete e.splitInfo!.walletId; delete e.splitInfo!.settlements;
    e.splitInfo!.participants[0] = { ...e.splitInfo!.participants[0], isPaid: true, paidDate: '2026-10-09', reimbursementTxId: 'legacy-cash' };
    const ambiguous: Transaction = structuredClone(e); ambiguous.id = 'ambiguous'; delete ambiguous.splitInfo!.participants[0].reimbursementTxId;
    initial.transactions.push(ambiguous, { id: 'legacy-cash', amount: 20, type: 'INGRESO', date: '2026-10-09', code: e.code, categoryName: e.categoryName, subcategoryName: e.subcategoryName, description: 'Reintegro Ana: Cena ficticia', wallet: 'REVOLUT', processed: true });
    const { context, page } = await setup(initial);
    try {
      const before = await raw(page); await page.getByRole('status').filter({ hasText: '1 gastos verificables y 1 casos para revisión' }).waitFor();
      await navigate(page, 'Revisar migración de gastos compartidos'); const preview = page.getByRole('dialog');
      assert.match(await preview.innerText(), /gasto propio 20,00/); await preview.getByRole('button', { name: 'Cancelar', exact: true }).click(); assert.equal(await raw(page), before);
      await navigate(page, 'Revisar migración de gastos compartidos'); await page.getByRole('button', { name: 'Confirmar sustitución' }).click(); await preview.waitFor({ state: 'hidden' });
      const migrated = await data(page); assertSharedIntegrity(migrated);
      assert.equal(migrated.transactions.filter(t => t.id === 'legacy-cash').length, 1); assert.equal(migrated.transactions.find(t => t.id === 'ambiguous')!.splitInfo!.accountingVersion, undefined);
      assert.equal(summary(migrated).gastosEjecutados, 80); assert.equal(remainingDebt(migrated.transactions.find(t => t.id === 'dinner')!, 'a'), 0);
      assert.deepEqual(await page.evaluate(prefix => Object.entries(localStorage).filter(([k]) => k.startsWith(prefix)).map(([, value]) => JSON.parse(value).transactions), RECOVERY_PREFIX), [initial.transactions]);
      await page.getByRole('button', { name: 'Opciones y datos' }).click(); const downloading = page.waitForEvent('download'); await navigate(page, 'Exportar JSON');
      const exported = parseBackup(await readFile((await (await downloading).path())!, 'utf8')); assert.equal(exported.version, '2.7');
      const upload = (file: unknown) => page.locator('input[type=file]').setInputFiles({ name: 'compartidos.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
      for (const backup of [{ ...makeBackup(initial), version: '2.6' }, exported]) {
        await upload(backup); await page.getByRole('button', { name: 'Confirmar sustitución' }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
        assert.deepEqual((await data(page)).transactions, backup.transactions);
      }
      await page.reload(); assert.deepEqual((await data(page)).transactions, exported.transactions);
    } finally { await context.close(); }
  });
}

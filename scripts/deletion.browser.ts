import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium, type Page } from 'playwright-core';
import { BUDGET_GROUPS } from '../src/constants/categories';
import type { Transaction } from '../src/types/finance';
import { DATA_KEY, type FinanceData, makeBackup, parseBackup, RECOVERY_PREFIX } from '../src/utils/backup';
import { saveSettlement, splitExactly } from '../src/utils/sharedExpenses';
import { STORAGE_LOCK } from '../src/utils/financeStore';
import { transferPair } from '../src/utils/transfers';

const base = (): FinanceData => ({ theme: 'dark', budgetGroups: structuredClone(BUDGET_GROUPS), transactions: [],
  budgetPlans: [{ monthYear: '2026-10', type: 'GASTO', code: 'V.001.002', plannedAmount: 100 }],
  contacts: [{ id: 'ana', name: 'Ana', createdAt: '2026-01-01' }, { id: 'free', name: 'Libre', createdAt: '2026-01-01' }],
  wallets: [{ id: 'bank', name: 'OPENBANK', type: 'BANK', color: '#fff', initialBalance: 1000 }, { id: 'rev', name: 'REVOLUT', type: 'BANK', color: '#fff', initialBalance: 100 }],
  loans: [{ id: 'loan', name: 'Préstamo ficticio', entity: 'Banco', principal: 1000, monthlyPayment: 100, interestRate: 0, totalTermMonths: 10, startDate: '2026-01-01', wallet: 'OPENBANK', code: 'E.002.001' }] });
const normal = (): Transaction => ({ id: 'normal', type: 'GASTO', amount: 12, date: '2026-10-08', code: 'V.001.002', categoryName: 'Alimentación', subcategoryName: 'Restaurante', description: 'Compra ficticia', wallet: 'OPENBANK', processed: true });
function linked(): FinanceData {
  let initial = base(); initial.transactions = [{ ...normal(), id: 'shared', amount: 60, description: 'Cena ficticia', splitInfo: { ...splitExactly(60, [initial.contacts[0]], 'bank'), distribution: { method: 'equal' } } }, normal(), { ...normal(), id: 'quota', loanId: 'loan', amount: 100, description: 'Cuota ficticia' }];
  initial = saveSettlement(initial, { expenseId: 'shared', contactId: 'ana', kind: 'cash', walletId: 'rev', amount: 10, date: '2026-10-09', processed: true });
  initial.transactions.push(...transferPair(initial.wallets, { fromWalletId: 'bank', toWalletId: 'rev', amount: 500, date: '2026-10-08', concept: 'Traspaso ficticio', processed: true }));
  return initial;
}
const navigate = (page: Page, name: string) => page.getByRole('button', { name: new RegExp('^(?:\\d+\\s*)?' + name + '(?:\\s*\\d+)?$') }).first().click();
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), DATA_KEY);
const data = async (page: Page) => JSON.parse((await raw(page))!) as FinanceData;
const copies = (page: Page) => page.evaluate(prefix => Object.entries(localStorage).filter(([key]) => key.startsWith(prefix)).map(([, value]) => value), RECOVERY_PREFIX);
const fields = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true }).locator('input,select,textarea').evaluateAll(els => els.map(el => (el as HTMLInputElement).value));
const titles = { contact: 'Eliminar contacto', wallet: 'Eliminar cuenta', loan: 'Eliminar préstamo', transaction: 'Eliminar movimiento' };
type Kind = keyof typeof titles;
const confirm = (page: Page, kind: Kind) => page.getByRole('dialog', { name: titles[kind], exact: true });
async function hold(page: Page) {
  await page.evaluate(lock => { void navigator.locks.request(lock, async () => { (window as any).deleteHeld = true; await new Promise<void>(resolve => { (window as any).releaseDelete = resolve; }); }); }, STORAGE_LOCK);
  await page.waitForFunction(() => (window as any).deleteHeld);
}
async function assertTop(page: Page, title: string) {
  const top = page.getByRole('dialog', { name: title, exact: true }); await top.waitFor();
  assert.equal(await page.getByRole('dialog').count(), 1); assert.equal(await top.evaluate(el => el.contains(document.activeElement)), true);
  assert.equal(await top.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true);
  for (const key of ['Tab', 'Tab', 'Shift+Tab']) { await page.keyboard.press(key); assert.equal(await top.evaluate(el => el.contains(document.activeElement)), true); }
  assert.equal(await page.locator('#root').evaluate(el => (el as HTMLElement).inert), true);
  return top;
}

test('Eliminaciones seguras: confirmación, dependencias, concurrencia y recuperación', { timeout: 180000 }, async t => {
  const listener = createServer(); await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = (listener.address() as { port: number }).port; await new Promise<void>(resolve => listener.close(() => resolve()));
  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { env: { ...process.env, PORT: String(port), NODE_ENV: 'production' }, stdio: 'pipe' });
  let log = ''; server.stdout.on('data', c => { log += c; }); server.stderr.on('data', c => { log += c; }); t.after(() => { server.kill(); });
  const url = `http://127.0.0.1:${port}`;
  let ready = false; for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw new Error(log); try { if ((await fetch(url)).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert.ok(ready, log);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] }); t.after(() => browser.close());
  async function setup(initial = base(), mobile = false) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
    await context.addInitScript(({ key, value }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, value); }, { key: DATA_KEY, value: JSON.stringify(makeBackup(initial)) });
    const page = await context.newPage(), errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.setDefaultTimeout(7000); await page.clock.setFixedTime(new Date('2026-10-31T12:00:00Z')); await page.goto(url);
    return { context, page, close: async () => { await context.close(); assert.deepEqual(errors, []); } };
  }
  async function open(page: Page, kind: Kind, linkedTarget = false) {
    if (kind === 'contact') { await navigate(page, 'Contactos'); const name = linkedTarget ? 'Ana' : 'Libre'; const action = page.getByRole('button', { name: `Eliminar contacto ${name}`, exact: true }); if (!await action.isVisible()) await page.getByText(name, { exact: true }).click(); await action.click(); }
    if (kind === 'wallet') { await navigate(page, 'Cuentas'); await page.getByRole('button', { name: `Editar cuenta y patrimonio ${linkedTarget ? 'OPENBANK' : 'REVOLUT'}`, exact: true }).click(); await page.getByRole('button', { name: 'Eliminar esta cuenta bancaria', exact: true }).click(); }
    if (kind === 'loan') { await navigate(page, 'Deudas'); await page.getByRole('button', { name: 'Editar deuda o préstamo Préstamo ficticio', exact: true }).click(); await page.getByRole('button', { name: 'Eliminar esta deuda o préstamo', exact: true }).click(); }
    if (kind === 'transaction') { await navigate(page, 'Movimientos'); const row = page.locator('div').filter({ has: page.getByText('Compra ficticia', { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Eliminar movimiento', exact: true }) }).last(); await row.getByRole('button', { name: 'Eliminar movimiento', exact: true }).click(); }
    const d = confirm(page, kind); await d.waitFor(); return d;
  }
  const confirmButton = (page: Page, kind: Kind) => confirm(page, kind).getByRole('button', { name: kind === 'transaction' ? 'Confirmar eliminación del movimiento' : 'Confirmar eliminación', exact: true });
  async function openClear(page: Page) { await page.getByRole('button', { name: 'Opciones y datos', exact: true }).click(); await page.getByRole('button', { name: 'Limpiar todo (Borrar datos)', exact: true }).click(); return page.getByRole('dialog', { name: 'Borrar datos', exact: true }); }
  async function reviewClear(page: Page) { const p = await openClear(page); await p.getByRole('button', { name: 'Seleccionar todo', exact: true }).click(); await p.getByRole('button', { name: /Borrar seleccionados/ }).click(); const d = page.getByRole('dialog', { name: 'Confirmar borrado seleccionado', exact: true }); await d.waitFor(); return d; }

  for (const kind of ['contact', 'wallet', 'loan', 'transaction'] as const) await t.test(`${kind}: papelera no escribe; cancelar, Escape, foco seguro y doble clic con espera real`, async () => {
    const initial = { ...base(), transactions: [normal()] }, { page, close } = await setup(initial);
    try {
      const before = await raw(page); let d = await open(page, kind); assert.equal(await raw(page), before); assert.equal(await d.getByRole('button', { name: 'Cancelar', exact: true }).evaluate(el => el === document.activeElement), true);
      await assertTop(page, titles[kind]); await page.keyboard.press('Escape'); await d.waitFor({ state: 'hidden' }); assert.equal(await raw(page), before);
      if (kind === 'wallet' || kind === 'loan') { const parentTitle = kind === 'wallet' ? 'Cartera' : 'Préstamo', parent = page.getByRole('dialog', { name: parentTitle, exact: true }); await parent.waitFor();
        const text = parent.locator('input[type=text]').first(); await text.fill('Borrador sin guardar'); const draft = await fields(page, parentTitle);
        await parent.getByRole('button', { name: kind === 'wallet' ? 'Eliminar esta cuenta bancaria' : 'Eliminar esta deuda o préstamo', exact: true }).click();
        d = confirm(page, kind); await d.getByRole('button', { name: 'Cancelar', exact: true }).click(); assert.deepEqual(await fields(page, parentTitle), draft);
        await parent.getByRole('button', { name: kind === 'wallet' ? 'Eliminar esta cuenta bancaria' : 'Eliminar esta deuda o préstamo', exact: true }).click();
      } else d = await open(page, kind);
      d = confirm(page, kind); await hold(page);
      await page.evaluate(key => { const original = Storage.prototype.setItem; (window as any).deleteWrites = 0; Storage.prototype.setItem = function(k, v) { if (k === key) (window as any).deleteWrites++; return original.call(this, k, v); }; }, DATA_KEY);
      await confirmButton(page, kind).evaluate(b => { (b as HTMLButtonElement).click(); (b as HTMLButtonElement).click(); }); await d.getByRole('status').waitFor(); assert.equal(await confirmButton(page, kind).isDisabled(), true); assert.equal(await d.getByRole('button', { name: 'Cancelar', exact: true }).isDisabled(), true);
      assert.equal(await d.evaluate(el => el.contains(document.activeElement)), true); await page.keyboard.press('Escape'); assert.equal(await d.count(), 1); assert.equal(await raw(page), before);
      await page.evaluate(() => (window as any).releaseDelete()); await d.waitFor({ state: 'hidden' }); assert.equal(await page.evaluate(() => (window as any).deleteWrites), 1);
      const saved = await data(page), id = kind === 'contact' ? 'free' : kind === 'wallet' ? 'rev' : kind === 'loan' ? 'loan' : 'normal', field = kind === 'contact' ? 'contacts' : kind === 'wallet' ? 'wallets' : kind === 'loan' ? 'loans' : 'transactions';
      assert.equal(saved[field].some(item => item.id === id), false); assert.equal(await page.getByRole('dialog').count(), 0);
      assert.equal(await page.locator('#root').evaluate(el => (el as HTMLElement).inert), false); assert.equal(await page.evaluate(() => document.body.style.overflow), ''); assert.equal(await page.locator('#root').evaluate(el => el.contains(document.activeElement) && document.activeElement !== document.body), true);
      await page.reload(); assert.equal((await data(page))[field].some(item => item.id === id), false);
    } finally { await close(); }
  });

  for (const historical of [false, true]) await t.test(`contacto con deudas ${historical ? 'históricas saldadas' : '2.8'}: explica y bloquea sin borrar en cascada`, async () => {
    const initial = linked(); if (historical) { initial.transactions = initial.transactions.filter(t => t.id === 'shared'); const s = initial.transactions[0].splitInfo!; delete s.accountingVersion; delete s.distribution; delete s.walletId; delete s.settlements; s.participants[0].isPaid = true; s.participants[0].reimbursementTxId = 'old-receipt'; s.participants[0].paidDate = '2026-10-09'; initial.transactions.push({ ...normal(), id: 'old-receipt', type: 'INGRESO', amount: 30, date: '2026-10-09', description: 'Reintegro Ana: Cena ficticia', wallet: 'REVOLUT' }); }
    const { page, close } = await setup(initial);
    try { const before = await raw(page), d = await open(page, 'contact', true); assert.match(await d.innerText(), /Gastos compartidos: 1/); assert.match(await d.innerText(), /Obligaciones del reparto.*: 1/); assert.match(await d.innerText(), /Reintegros: 1/); assert.ok(await confirmButton(page, 'contact').isDisabled()); await d.getByRole('alert').waitFor(); await d.getByRole('button', { name: 'Cancelar', exact: true }).click(); assert.equal(await raw(page), before); assert.equal((await copies(page)).length, 0); } finally { await close(); }
  });

  for (const mobile of [false, true]) await t.test(`cuentas, cuotas y movimientos compartidos: dependencias exactas y diálogo superior (${mobile ? 'móvil' : 'escritorio'})`, async () => {
    const { page, close } = await setup(linked(), mobile);
    try {
      const before = await raw(page); let d = await open(page, 'wallet', true); await assertTop(page, 'Eliminar cuenta'); assert.match(await d.innerText(), /Movimientos vinculados.*: 5/); assert.match(await d.innerText(), /Transferencias: 1/); assert.match(await d.innerText(), /Gastos compartidos: 1/); assert.match(await d.innerText(), /Préstamos con esta cartera habitual: 1/); assert.ok(await confirmButton(page, 'wallet').isDisabled());
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      d = await open(page, 'wallet'); assert.match(await d.innerText(), /Reintegros: 1/); assert.match(await d.innerText(), /Liquidaciones con cartera receptora: 1/); assert.ok(await confirmButton(page, 'wallet').isDisabled()); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      d = await open(page, 'loan'); assert.match(await d.innerText(), /Cuotas y movimientos del préstamo: 1/); assert.ok(await confirmButton(page, 'loan').isDisabled()); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      await navigate(page, 'Presupuestos');
      await page.getByRole('tab', { name: 'Catálogo y detalle de partidas', exact: true }).click();
      await page.getByRole('button', { name: /^Ver partida V\.001\.002 / }).click();
      const panel = page.getByRole('dialog', { name: 'Detalle de partida', exact: true }); await panel.locator('[data-movement-id=shared]').getByRole('button', { name: 'Eliminar movimiento', exact: true }).click();
      d = await assertTop(page, 'Eliminar movimiento'); assert.match(await d.innerText(), /Liquidaciones del gasto: 1/); assert.ok(await confirmButton(page, 'transaction').isDisabled()); await page.keyboard.press('Escape'); assert.equal(await panel.evaluate(el => el.contains(document.activeElement)), true); await page.keyboard.press('Escape'); assert.equal(await raw(page), before);
    } finally { await close(); }
  });

  for (const kind of ['contact', 'wallet', 'loan', 'transaction'] as const) for (const failure of ['quota', 'conflict'] as const) await t.test(`${kind}/${failure}: conserva confirmación y borrador tras el rechazo`, async () => {
    const { page, context, close } = await setup({ ...base(), transactions: [normal()] });
    try {
      const d = await open(page, kind); await page.evaluate(key => { const original = Storage.prototype.setItem; (window as any).deleteFail = true; Storage.prototype.setItem = function(k, v) { if (k === key && (window as any).deleteFail) throw new DOMException('Cuota', 'QuotaExceededError'); return original.call(this, k, v); }; }, DATA_KEY);
      if (failure === 'conflict') { await page.evaluate(() => { (window as any).deleteFail = false; }); const other = await context.newPage(); await other.goto(url); const old = await raw(other); await other.getByRole('button', { name: /Cambiar a modo/ }).click(); await other.waitForFunction(({ key, old }) => localStorage.getItem(key) !== old, { key: DATA_KEY, old }); await other.close(); }
      const before = await raw(page); await confirmButton(page, kind).click(); await d.getByRole('alert').waitFor(); assert.match(await d.getByRole('alert').innerText(), failure === 'quota' ? /No hay espacio/ : /Otra pestaña/); assert.equal(await raw(page), before); assert.equal((await copies(page)).length, 0);
      if (failure === 'quota') { await page.evaluate(() => { (window as any).deleteFail = false; }); await confirmButton(page, kind).click(); await d.waitFor({ state: 'hidden' }); }
    } finally { await close(); }
  });

  for (const mobile of [false, true]) await t.test(`masivo: cantidades, cancelación, doble envío, copia 2.8 y restauración (${mobile ? 'móvil' : 'escritorio'})`, async () => {
    const initial = linked(), { page, close } = await setup(initial, mobile);
    try {
      const before = await raw(page); let d = await reviewClear(page); await assertTop(page, 'Confirmar borrado seleccionado'); const text = await d.innerText();
      for (const value of ['Movimientos a eliminar: 6', 'Transferencias completas incluidas: 1', 'Gastos compartidos incluidos: 1', 'Liquidaciones y compensaciones incluidas: 1', 'Cuotas de préstamos incluidas: 1', 'Cuentas a eliminar: 2', 'Planes presupuestarios a eliminar: 1', 'Préstamos a eliminar: 1']) assert.ok(text.includes(value), value);
      const button = d.getByRole('button', { name: 'Confirmar eliminación', exact: true }); assert.ok(await button.isDisabled()); await d.getByLabel('Escribe BORRAR para confirmar').fill('borrar'); assert.ok(await button.isDisabled());
      await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog', { name: 'Borrar datos', exact: true }).count(), 1); assert.equal(await raw(page), before); assert.equal((await copies(page)).length, 0);
      await page.getByRole('button', { name: /Borrar seleccionados/ }).click(); d = page.getByRole('dialog', { name: 'Confirmar borrado seleccionado', exact: true }); await d.getByLabel('Escribe BORRAR para confirmar').fill('BORRAR');
      await hold(page); await d.getByRole('button', { name: 'Confirmar eliminación', exact: true }).evaluate(b => { (b as HTMLButtonElement).click(); (b as HTMLButtonElement).click(); }); await d.getByRole('status').waitFor(); await page.keyboard.press('Escape'); assert.equal(await raw(page), before); await page.evaluate(() => (window as any).releaseDelete()); await d.waitFor({ state: 'hidden' });
      const saved = await data(page); assert.equal(saved.transactions.length, 0); assert.equal(saved.wallets.length, 0); assert.equal(saved.loans.length, 0); assert.deepEqual(saved.contacts, initial.contacts); assert.deepEqual(saved.budgetGroups, initial.budgetGroups);
      const backups = await copies(page); assert.equal(backups.length, 1); const backup = parseBackup(backups[0]); assert.equal(backup.version, '2.8'); assert.deepEqual(backup.transactions, initial.transactions);
      await page.reload(); assert.equal((await data(page)).transactions.length, 0);
      await page.locator('input[type=file]').setInputFiles({ name: 'recuperable-2.8.json', mimeType: 'application/json', buffer: Buffer.from(backups[0]) }); await page.getByRole('button', { name: 'Confirmar sustitución', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); assert.deepEqual((await data(page)).transactions, initial.transactions);
    } finally { await close(); }
  });

  for (const failure of ['recovery', 'active', 'conflict'] as const) await t.test(`masivo/${failure}: conserva opciones, texto y copia previa obligatoria`, async () => {
    const { page, context, close } = await setup(linked());
    try {
      const d = await reviewClear(page); await d.getByLabel('Escribe BORRAR para confirmar').fill('BORRAR');
      if (failure !== 'conflict') await page.evaluate(({ key, prefix, failure }) => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (failure === 'active' ? k === key : k.startsWith(prefix)) throw new DOMException('Cuota', 'QuotaExceededError'); return original.call(this, k, v); }; }, { key: DATA_KEY, prefix: RECOVERY_PREFIX, failure });
      else { const other = await context.newPage(); await other.goto(url); const old = await raw(other); await other.getByRole('button', { name: /Cambiar a modo/ }).click(); await other.waitForFunction(({ key, old }) => localStorage.getItem(key) !== old, { key: DATA_KEY, old }); await other.close(); }
      const before = await raw(page); await d.getByRole('button', { name: 'Confirmar eliminación', exact: true }).click(); await d.getByRole('alert').waitFor(); assert.match(await d.getByRole('alert').innerText(), failure === 'conflict' ? /Otra pestaña/ : /No hay espacio/); assert.equal(await raw(page), before); assert.equal(await d.getByLabel('Escribe BORRAR para confirmar').inputValue(), 'BORRAR');
      await d.getByRole('button', { name: 'Cancelar', exact: true }).click(); assert.equal(await page.getByRole('button', { name: 'Eliminar todas las cuentas', exact: true }).getAttribute('aria-pressed'), 'true');
    } finally { await close(); }
  });

  await t.test('masivo: dependencia conservada bloquea y una cuota en cola invalida el alcance revisado', async () => {
    const { page, close } = await setup();
    try {
      const before = await raw(page), p = await openClear(page); await p.getByRole('button', { name: 'Eliminar todas las cuentas', exact: true }).click(); await p.getByRole('button', { name: 'Borrar préstamos y deudas', exact: true }).click(); await p.getByRole('button', { name: /Borrar seleccionados/ }).click();
      let d = page.getByRole('dialog', { name: 'Confirmar borrado seleccionado', exact: true }); assert.ok(await d.getByRole('button', { name: 'Confirmar eliminación', exact: true }).isDisabled()); assert.match(await d.getByRole('alert').innerText(), /Préstamos/); assert.equal(await raw(page), before); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      await navigate(page, 'Deudas'); await hold(page); await page.getByRole('button', { name: /^Pagar Cuota/ }).click(); d = await reviewClear(page); await d.getByLabel('Escribe BORRAR para confirmar').fill('BORRAR'); await d.getByRole('button', { name: 'Confirmar eliminación', exact: true }).click(); await page.evaluate(() => (window as any).releaseDelete()); await d.getByRole('alert').waitFor(); assert.match(await d.getByRole('alert').innerText(), /alcance del borrado ha cambiado/); const saved = await data(page); assert.equal(saved.transactions.length, 1); assert.equal(saved.transactions[0].loanId, 'loan'); assert.equal((await copies(page)).length, 0);
    } finally { await close(); }
  });
});

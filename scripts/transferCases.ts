import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import type { Browser, Page } from 'playwright-core';
import { Backup, DATA_KEY, parseBackup, RECOVERY_PREFIX } from '../src/utils/backup';
import { calculateMonthlyBudgetRows, calculateMonthlySummary, calculateWalletBalances, formatCurrency } from '../src/utils/finance';
import { STORAGE_LOCK } from '../src/utils/financeStore';
import { assertTransferIntegrity, transferPair } from '../src/utils/transfers';

const navigate = (page: Page, name: string) => page.getByRole('button', { name: new RegExp('^' + name + '(?:\\s*\\d+)?$') }).first().click();
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), DATA_KEY);
const data = async (page: Page) => JSON.parse((await raw(page))!) as Backup;
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Traspaso', exact: true });
const readCopies = (page: Page) => page.evaluate(prefix => Object.entries(localStorage).filter(([key]) => key.startsWith(prefix)).map(([, value]) => JSON.parse(value)), RECOVERY_PREFIX);

export async function transferCases(t: TestContext, browser: Browser, url: string, fixture: Backup) {
  const input = { fromWalletId: fixture.wallets.find(w => w.name === 'OPENBANK')!.id, toWalletId: fixture.wallets.find(w => w.name === 'REVOLUT')!.id, amount: 500, date: '2026-10-08', concept: 'Ahorro fase 2A', processed: true };
  async function setup(initial = fixture) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
    const page = await context.newPage(); page.setDefaultTimeout(7000);
    // Seed once per isolated context; reloads and the second tab must read actual writes.
    await context.addInitScript(({ key, initial }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(initial)); }, { key: DATA_KEY, initial });
    await page.goto(url);
    return { context, page };
  }
  async function openNew(page: Page) {
    await navigate(page, 'Cuentas'); await navigate(page, 'Ordenar Traspaso');
    const d = dialog(page);
    await d.getByLabel('Cuenta de origen', { exact: true }).selectOption(input.fromWalletId);
    await d.getByLabel('Cuenta de destino', { exact: true }).selectOption(input.toWalletId);
    await d.getByLabel('Importe a transferir (€)', { exact: true }).fill('500');
    await d.getByLabel('Fecha', { exact: true }).fill(input.date);
    await d.getByLabel('Concepto / Nota', { exact: true }).fill(input.concept);
  }
  async function openEdit(page: Page) {
    await navigate(page, 'Movimientos');
    await page.getByRole('button', { name: /^Editar movimiento Traspaso a REVOLUT/ }).first().click();
  }
  const economics = (b: Backup) => calculateMonthlySummary('2026-10', b.transactions, b.budgetPlans);

  await t.test('traspaso de 500 €: cancelación, doble clic, saldos, edición, recarga, JSON y eliminación conjunta', async () => {
    const { context, page } = await setup();
    try {
      const initial = await raw(page);
      await openNew(page); await dialog(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.equal(await raw(page), initial);
      await openNew(page);
      await dialog(page).locator('form').evaluate(form => { (form as HTMLFormElement).requestSubmit(); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
      await dialog(page).waitFor({ state: 'hidden' });
      let saved = await data(page);
      assert.equal(saved.transactions.filter(t => t.transfer).length, 2); assert.equal(saved.version, '2.6');
      const initialBalances = calculateWalletBalances(fixture.wallets, fixture.transactions), balances = calculateWalletBalances(saved.wallets, saved.transactions);
      assert.equal(Math.round(balances.OPENBANK * 100) - Math.round(initialBalances.OPENBANK * 100), -50000); assert.equal(Math.round(balances.REVOLUT * 100) - Math.round(initialBalances.REVOLUT * 100), 50000);
      assert.equal(Object.values(balances).reduce((a, b) => a + Math.round(b * 100), 0), Object.values(initialBalances).reduce((a, b) => a + Math.round(b * 100), 0));
      assert.deepEqual(economics(saved), economics(fixture));
      assert.deepEqual(calculateMonthlyBudgetRows('2026-10', saved.transactions, saved.budgetPlans), calculateMonthlyBudgetRows('2026-10', fixture.transactions, fixture.budgetPlans));
      assert.ok(await page.getByText(formatCurrency(balances.OPENBANK), { exact: true }).count());
      assert.ok(await page.getByText(formatCurrency(balances.REVOLUT), { exact: true }).count());
      assert.deepEqual((await readCopies(page))[0].transactions, fixture.transactions);
      const ids = saved.transactions.filter(t => t.transfer).map(t => t.id);
      await page.reload(); assert.deepEqual((await data(page)).transactions, saved.transactions);
      await openEdit(page);
      await dialog(page).getByLabel('Importe a transferir (€)').fill('600');
      await dialog(page).getByLabel('Concepto / Nota').fill('Revisado fase 2A');
      await dialog(page).getByRole('button', { name: 'Confirmar Traspaso', exact: true }).click();
      await dialog(page).waitFor({ state: 'hidden' }); saved = await data(page);
      assert.deepEqual(saved.transactions.filter(t => t.transfer).map(t => t.id), ids);
      assert.ok(saved.transactions.filter(t => t.transfer).every(t => t.amount === 600));
      assertTransferIntegrity(saved.transactions, saved.wallets);
      await page.getByRole('button', { name: 'Opciones y datos' }).click();
      const downloadPromise = page.waitForEvent('download');
      await navigate(page, 'Exportar JSON');
      const download = await downloadPromise;
      const exported = parseBackup(await readFile((await download.path())!, 'utf8'));
      assert.deepEqual(exported.transactions, saved.transactions); assert.equal(exported.version, '2.6');
      const beforeImport = await raw(page);
      const importFile = () => page.locator('input[type=file]').setInputFiles({ name: 'traspasos.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
      await importFile(); await page.getByRole('button', { name: 'Cancelar', exact: true }).click(); assert.equal(await raw(page), beforeImport);
      await importFile(); await page.getByRole('button', { name: 'Confirmar sustitución' }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      assert.deepEqual((await data(page)).transactions, exported.transactions);
      // Edit from either leg opens the single operation, never the normal movement form.
      await page.getByRole('button', { name: /^Editar movimiento Traspaso desde OPENBANK/ }).first().click();
      await dialog(page).getByRole('button', { name: 'Eliminar traspaso completo', exact: true }).click();
      await dialog(page).getByRole('button', { name: 'Conservar traspaso', exact: true }).click();
      assert.deepEqual((await data(page)).transactions, exported.transactions);
      await dialog(page).getByRole('button', { name: 'Eliminar traspaso completo', exact: true }).click();
      await dialog(page).getByRole('button', { name: 'Confirmar eliminación del traspaso', exact: true }).evaluate(b => { (b as HTMLButtonElement).click(); (b as HTMLButtonElement).click(); });
      await dialog(page).waitFor({ state: 'hidden' });
      assert.deepEqual((await data(page)).transactions, fixture.transactions);
      await page.reload(); assert.deepEqual((await data(page)).transactions, fixture.transactions);
    } finally { await context.close(); }
  });

  for (const mode of ['create', 'edit', 'delete'] as const) for (const failure of ['storage', 'conflict'] as const) await t.test(`traspaso ${mode}: ${failure}, espera real, conservación de campos y doble envío`, async () => {
    const initial = mode === 'create' ? fixture : { ...fixture, version: '2.6' as const, transactions: [...transferPair(fixture.wallets, input, 'ui-fixture'), ...fixture.transactions] };
    const { context, page } = await setup(initial);
    try {
      if (mode === 'create') await openNew(page); else {
        await openEdit(page);
        await dialog(page).getByLabel('Importe a transferir (€)').fill('625.50');
        if (mode === 'delete') await dialog(page).getByRole('button', { name: 'Eliminar traspaso completo', exact: true }).click();
      }
      const d = dialog(page), fields = () => d.locator('input,select').evaluateAll(els => els.map(e => ({ value: (e as HTMLInputElement).value, checked: (e as HTMLInputElement).checked })));
      const draft = await fields();
      if (failure === 'storage') {
        await page.evaluate(key => {
          const original = Storage.prototype.setItem;
          (window as any).transferControl = { fail: true, writes: 0 };
          Storage.prototype.setItem = function(k, v) {
            if (k === key) { (window as any).transferControl.writes++; if ((window as any).transferControl.fail) throw new DOMException('Cuota', 'QuotaExceededError'); }
            return original.call(this, k, v);
          };
        }, DATA_KEY);
      } else {
        const other = await context.newPage(); await other.goto(url);
        const before = await raw(other);
        await other.getByRole('button', { name: /Cambiar a modo/ }).click();
        await other.waitForFunction(({ key, before }) => localStorage.getItem(key) !== before, { key: DATA_KEY, before }); await other.close();
      }
      const before = await raw(page);
      await page.evaluate(lock => { void navigator.locks.request(lock, async () => { (window as any).transferLockHeld = true; await new Promise<void>(resolve => { (window as any).releaseTransferLock = resolve; }); }); }, STORAGE_LOCK);
      await page.waitForFunction(() => (window as any).transferLockHeld);
      const button = mode === 'delete' ? d.getByRole('button', { name: 'Confirmar eliminación del traspaso' }) : d.locator('button[type=submit]');
      await button.click(); await d.locator('form[aria-busy=true]').waitFor();
      assert.ok(await button.isDisabled());
      if (mode === 'delete') await button.evaluate(b => { (b as HTMLButtonElement).click(); });
      else await d.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      assert.deepEqual(await fields(), draft); assert.equal(await raw(page), before);
      assert.ok(await d.getByRole('button', { name: 'Cerrar traspaso' }).isDisabled());
      await page.evaluate(() => (window as any).releaseTransferLock());
      await d.getByRole('alert').waitFor();
      assert.match(await d.getByRole('alert').innerText(), failure === 'storage' ? /No hay espacio/ : /Otra pestaña/);
      assert.deepEqual(await fields(), draft); assert.equal(await raw(page), before);
      if (failure === 'storage') {
        await page.evaluate(() => { (window as any).transferControl.fail = false; });
        await button.click(); await d.waitFor({ state: 'hidden' });
        const saved = await data(page); assertTransferIntegrity(saved.transactions, saved.wallets);
        assert.equal(saved.transactions.filter(t => t.transfer).length, mode === 'delete' ? 0 : 2);
        if (mode === 'edit') assert.ok(saved.transactions.filter(t => t.transfer).every(t => t.amount === 625.5));
        assert.equal(await page.evaluate(() => (window as any).transferControl.writes), 2);
      }
    } finally { await context.close(); }
  });

  await t.test('traspaso: validación de cartera inválida conserva el formulario y los datos', async () => {
    const { context, page } = await setup();
    try {
      await openNew(page); const before = await raw(page);
      const select = dialog(page).getByLabel('Cuenta de destino', { exact: true });
      await select.evaluate(s => { const o = document.createElement('option'); o.value = 'missing-wallet'; o.textContent = 'No existe'; s.appendChild(o); });
      await select.selectOption('missing-wallet');
      await dialog(page).getByRole('button', { name: 'Confirmar Traspaso', exact: true }).click();
      await dialog(page).getByRole('alert').waitFor();
      assert.match(await dialog(page).getByRole('alert').innerText(), /deben existir/);
      assert.equal(await dialog(page).getByLabel('Importe a transferir (€)').inputValue(), '500'); assert.equal(await raw(page), before);
    } finally { await context.close(); }
  });

  await t.test('traspaso: tramitación conjunta, renombrado por ID y borrado desde el listado', async () => {
    // Transfer-only data isolates stable wallet relations from legacy normal name-based movements.
    const initial = { ...fixture, version: '2.6' as const, transactions: transferPair(fixture.wallets, input, 'rename-test') };
    const { context, page } = await setup(initial);
    try {
      await openEdit(page);
      await dialog(page).getByLabel('Tramitado (ambos extremos)', { exact: true }).uncheck();
      await dialog(page).getByRole('button', { name: 'Confirmar Traspaso', exact: true }).click();
      await dialog(page).waitFor({ state: 'hidden' });
      assert.ok((await data(page)).transactions.every(t => !t.processed));
      await page.getByRole('button', { name: 'NO', exact: true }).first().click();
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)!).transactions.every((t: any) => t.processed), DATA_KEY);
      await navigate(page, 'Cuentas');
      await page.getByRole('heading', { name: 'OPENBANK', exact: true }).click();
      const walletDialog = page.getByRole('dialog', { name: 'Cartera', exact: true });
      await walletDialog.getByLabel('Nombre de la cuenta').fill('OPENBANK RENOMBRADA');
      await walletDialog.locator('button[type=submit]').click(); await walletDialog.waitFor({ state: 'hidden' });
      await page.reload(); const saved = await data(page);
      assert.equal(saved.transactions[0].transfer!.fromWalletId, input.fromWalletId);
      const balance = calculateWalletBalances(saved.wallets, saved.transactions);
      assert.equal(balance['OPENBANK RENOMBRADA'], Math.round((fixture.wallets.find(w => w.id === input.fromWalletId)!.initialBalance - 500) * 100) / 100);
      assert.equal(balance.OPENBANK, undefined);
      await navigate(page, 'Movimientos');
      await page.getByRole('button', { name: 'Eliminar movimiento', exact: true }).first().click();
      await dialog(page).getByRole('button', { name: 'Confirmar eliminación del traspaso', exact: true }).click();
      await dialog(page).waitFor({ state: 'hidden' }); assert.equal((await data(page)).transactions.length, 0);
    } finally { await context.close(); }
  });

  await t.test('históricos: aviso de ambigüedad, cancelación, migración explícita, copia previa y recarga', async () => {
    const history = transferPair(fixture.wallets, input, 'history').map((t, i) => {
      const { transfer, ...original } = t;
      return { ...original, id: `tx-traspaso-${i ? 'in-101' : 'out-100'}`, notes: i ? 'Traspaso recibido desde OPENBANK' : 'Traspaso ordenado hacia REVOLUT' };
    });
    const ambiguous = { ...history[0], id: 'historico-sin-pareja' };
    const original = { ...fixture, transactions: [...history, ambiguous, ...fixture.transactions] };
    const { context, page } = await setup(original);
    try {
      await page.getByRole('status').filter({ hasText: '1 pares inequívocos y 1 registros pendientes' }).waitFor();
      const before = await raw(page);
      await navigate(page, 'Revisar vinculación de traspasos históricos');
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click(); assert.equal(await raw(page), before);
      await navigate(page, 'Revisar vinculación de traspasos históricos');
      await page.getByRole('button', { name: 'Confirmar sustitución' }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
      const saved = await data(page); assert.equal(saved.transactions.filter(t => t.transfer).length, 2);
      assert.deepEqual(saved.transactions.find(t => t.id === ambiguous.id), ambiguous);
      for (const old of history) { const { transfer, ...preserved } = saved.transactions.find(t => t.id === old.id)!; assert.deepEqual(preserved, old); }
      assert.deepEqual((await readCopies(page))[0].transactions, original.transactions);
      await page.reload(); assert.deepEqual((await data(page)).transactions, saved.transactions);
      await page.getByRole('status').filter({ hasText: '0 pares inequívocos y 1 registros pendientes' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Revisar vinculación de traspasos históricos' }).count(), 0);
    } finally { await context.close(); }
  });
}

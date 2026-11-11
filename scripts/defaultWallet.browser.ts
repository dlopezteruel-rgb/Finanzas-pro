import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright-core';
import { DATA_KEY, RECOVERY_PREFIX, makeBackup, parseBackup, type FinanceData } from '../src/utils/backup';
import { intelligentFixture, movementRule, personalObligation } from './intelligentFixture';
import { saveMovementRule } from '../src/utils/recurringMovements';
import { saveObligation } from '../src/utils/personalObligations';
import { transferPair } from '../src/utils/transfers';
import { saveSharedTransaction, saveSettlement, splitExactly } from '../src/utils/sharedExpenses';
import { navigateModule as nav } from './browserNavigation';
import { STORAGE_LOCK } from '../src/utils/financeStore';

function fixture(count = 3, advanced = false): FinanceData {
  const base = intelligentFixture();
  let data: FinanceData = { ...base, theme: 'light', wallets: [base.wallets[0], { ...base.wallets[0], id: 'saving', name: 'AHORRO FICTICIO' }, { ...base.wallets[0], id: 'cash', name: 'EFECTIVO FICTICIO' }].slice(0, count) };
  if (count) {
    data.transactions = [{ id: 'original', type: 'GASTO', code: 'g', amount: 20, date: '2026-11-01', description: 'Histórico ficticio', categoryName: 'Gastos ficticios', subcategoryName: 'Alquiler ficticio', wallet: 'BANCO FICTICIO', processed: true }];
    data = saveMovementRule(data, movementRule());
    data.loans = [{ id: 'loan', name: 'Préstamo ficticio', entity: 'Entidad ficticia', principal: 1000, interestRate: 0, totalTermMonths: 20, startDate: '2026-01-01', monthlyPayment: 50, wallet: 'BANCO FICTICIO', code: 'g' }];
  }
  data = saveObligation(data, personalObligation());
  if (advanced) {
    data = { ...data, defaultWalletId: 'cash', transactions: [...data.transactions, ...transferPair(data.wallets, { fromWalletId: 'bank', toWalletId: 'saving', amount: 10, date: '2026-11-02', concept: 'Traspaso ficticio', processed: false }, 'transfer')] };
    data = saveSharedTransaction(data, { type: 'GASTO', code: 'g', amount: 60, date: '2026-11-03', categoryName: 'Gastos ficticios', subcategoryName: 'Alquiler ficticio', description: 'Comida compartida ficticia', wallet: 'BANCO FICTICIO', processed: true, splitInfo: splitExactly(60, data.contacts, 'bank') });
    const expense = data.transactions.find(tx => tx.splitInfo)!;
    data = saveSettlement(data, { expenseId: expense.id, contactId: 'friend', amount: 5, date: '2026-11-04', kind: 'cash', processed: true, walletId: 'saving' });
  }
  parseBackup(JSON.stringify(makeBackup(data))); return data;
}
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), DATA_KEY);
const saved = async (page: Page) => JSON.parse((await raw(page))!);
const finances = (data: any) => { const { defaultWalletId, version, revision, exportedAt, ...rest } = data; return rest; };
const dialog = (page: Page, name = 'Movimiento') => page.getByRole('dialog', { name, exact: true });
async function newMovement(page: Page) { await nav(page, 'Inicio'); await page.getByRole('button', { name: 'Añadir', exact: true }).click(); await dialog(page).waitFor(); }
async function choose(page: Page, name: string, id: string) {
  await nav(page, 'Cuentas'); await page.getByRole('button', { name: `Usar como predeterminada ${name}`, exact: true }).click();
  await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key)!).defaultWalletId === id, { key: DATA_KEY, id });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
}

test('cartera predeterminada: contratos completos en Chromium aislado', { timeout: 240000 }, async t => {
  const listener = createServer(); await new Promise<void>(r => listener.listen(0, '127.0.0.1', r));
  const port = (listener.address() as { port: number }).port; await new Promise<void>(r => listener.close(() => r()));
  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { env: { ...process.env, NODE_ENV: 'production', PORT: String(port), APP_BASE_PATH: '/', GEMINI_API_KEY: '', GOOGLE_API_KEY: '' }, stdio: 'pipe' });
  let log = ''; server.stdout.on('data', c => log += c); server.stderr.on('data', c => log += c); t.after(() => { server.kill(); });
  const origin = `http://127.0.0.1:${port}`, url = origin + '/app';
  let ready = false; for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw new Error(log); try { if ((await fetch(url)).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); } assert.ok(ready, log);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] }); t.after(() => browser.close());
  async function setup(width: number, data = fixture()) {
    const c = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 1000 }, isMobile: width < 768, hasTouch: width < 768, locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: 'block', acceptDownloads: true });
    const errors: string[] = [], blocked: string[] = [];
    await c.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : (blocked.push(route.request().url()), route.abort()));
    await c.addInitScript(({ key, value }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, value); }, { key: DATA_KEY, value: JSON.stringify(makeBackup(data)) });
    const p = await c.newPage(); p.setDefaultTimeout(8000); p.on('pageerror', error => errors.push(error.message)); p.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await p.clock.setFixedTime(new Date('2026-11-11T10:00:00Z')); await p.goto(url); await p.getByLabel('Seleccionar periodo contable').waitFor();
    return { c, p, close: async () => { await c.close(); assert.deepEqual(errors, []); assert.deepEqual(blocked, []); } };
  }
  for (const width of [390, 1280]) {
    for (const count of [0, 1]) await t.test(`${width}px: ${count} carteras, origen válido automático o guardado bloqueado sin escrituras`, async () => {
      const s = await setup(width, fixture(count)); const { p } = s;
      try {
        const before = await raw(p); await newMovement(p);
        assert.equal(await dialog(p).getByLabel('Cartera u Origen', { exact: true }).inputValue(), count ? 'BANCO FICTICIO' : '');
        assert.equal(await dialog(p).getByRole('button', { name: 'Guardar Movimiento', exact: true }).isDisabled(), !count);
        await p.keyboard.press('Escape'); assert.equal(await raw(p), before);
        await nav(p, 'Cuentas'); await p.getByRole('region', { name: 'Cartera predeterminada' }).waitFor();
        assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
        assert.match(await p.getByRole('region', { name: 'Cartera predeterminada' }).innerText(), count ? /automática/ : /Crea una cartera/);
        assert.equal(await raw(p), before);
      } finally { await s.close(); }
    });
    await t.test(`${width}px: varias sin preferencia exigen elección en manual, rápido y chat`, async () => {
      const s = await setup(width); const { p } = s;
      try {
        await newMovement(p); const d = dialog(p); assert.equal(await d.getByLabel('Cartera u Origen').inputValue(), '');
        await d.getByLabel('Importe Total (€)').fill('12'); assert.equal(await d.getByRole('button', { name: 'Guardar Movimiento', exact: true }).isDisabled(), true);
        await d.getByLabel('Cartera u Origen').selectOption('AHORRO FICTICIO'); await d.getByRole('button', { name: 'Guardar Movimiento', exact: true }).click(); await d.waitFor({ state: 'hidden' });
        assert.equal((await saved(p)).transactions[0].wallet, 'AHORRO FICTICIO');
        await p.getByPlaceholder(/^Registrar:/).fill('Gasté 13');
        assert.equal(await p.getByLabel('Cartera del registro rápido').inputValue(), ''); assert.equal(await p.getByRole('button', { name: 'Registrar', exact: true }).isDisabled(), true);
        await p.getByLabel('Cartera del registro rápido').selectOption('EFECTIVO FICTICIO'); await p.getByPlaceholder(/^Registrar:/).fill('Gasté 14');
        assert.equal(await p.getByLabel('Cartera del registro rápido').inputValue(), 'EFECTIVO FICTICIO');
        await p.getByRole('button', { name: 'Registrar', exact: true }).click(); await p.getByLabel('Cartera del registro rápido').waitFor({ state: 'hidden' });
        assert.equal((await saved(p)).transactions[0].wallet, 'EFECTIVO FICTICIO');
        await nav(p, 'Asistente'); await p.getByRole('textbox', { name: 'Mensaje para el asistente' }).fill('Registra un gasto de 7'); await p.getByRole('button', { name: 'Enviar', exact: true }).click();
        const proposal = dialog(p, 'Revisar propuesta de movimiento'); await proposal.waitFor(); assert.equal(await proposal.getByLabel('Cartera', { exact: true }).inputValue(), '');
        await proposal.getByLabel('Cartera', { exact: true }).selectOption('BANCO FICTICIO'); await proposal.getByRole('button', { name: 'Confirmar y registrar', exact: true }).click(); await proposal.waitFor({ state: 'hidden' });
        assert.equal((await saved(p)).transactions[0].wallet, 'BANCO FICTICIO'); assert.equal((await saved(p)).defaultWalletId, undefined);
      } finally { await s.close(); }
    });
    await t.test(`${width}px: elegir, recargar, sobrescribir origen explícito, editar histórico y restaurar JSON`, async () => {
      const initial = fixture(), s = await setup(width, initial); const { p } = s;
      try {
        const before = await saved(p); await choose(p, 'EFECTIVO FICTICIO', 'cash'); const data = await saved(p);
        assert.equal(data.version, '3.2'); assert.deepEqual(finances(data), finances(before));
        assert.equal(await p.evaluate(prefix => Object.keys(localStorage).filter(k => k.startsWith(prefix)).length, RECOVERY_PREFIX), 1);
        if (process.env.DEFAULT_WALLET_ARTIFACT_DIR) { await mkdir(process.env.DEFAULT_WALLET_ARTIFACT_DIR, { recursive: true }); await p.screenshot({ path: `${process.env.DEFAULT_WALLET_ARTIFACT_DIR}/${width}-carteras.jpg`, type: 'jpeg', quality: 80, animations: 'disabled' }); }
        await nav(p, 'Inicio'); await p.getByPlaceholder(/^Registrar:/).fill('Gasté 8'); assert.equal(await p.getByLabel('Cartera del registro rápido').inputValue(), 'EFECTIVO FICTICIO'); await p.getByRole('button', { name: 'Borrar texto', exact: true }).click();
        await nav(p, 'Asistente'); await p.getByRole('textbox', { name: 'Mensaje para el asistente' }).fill('Registra un gasto de 9'); await p.getByRole('button', { name: 'Enviar', exact: true }).click();
        const proposed = dialog(p, 'Revisar propuesta de movimiento'); assert.equal(await proposed.getByLabel('Cartera', { exact: true }).inputValue(), 'EFECTIVO FICTICIO'); await proposed.getByLabel('Cartera', { exact: true }).selectOption('BANCO FICTICIO'); await proposed.getByRole('button', { name: 'Cancelar', exact: true }).click();
        await p.reload(); await newMovement(p); const d = dialog(p); assert.equal(await d.getByLabel('Cartera u Origen').inputValue(), 'EFECTIVO FICTICIO');
        await d.getByLabel('Cartera u Origen').selectOption('AHORRO FICTICIO'); await d.getByLabel('Importe Total (€)').fill('15'); await d.getByRole('button', { name: 'Guardar Movimiento', exact: true }).click(); await d.waitFor({ state: 'hidden' });
        assert.equal((await saved(p)).defaultWalletId, 'cash');
        await nav(p, 'Movimientos'); await p.getByRole('button', { name: 'Editar movimiento Histórico ficticio', exact: true }).click();
        assert.equal(await dialog(p).getByLabel('Cartera u Origen').inputValue(), 'BANCO FICTICIO'); await dialog(p).getByLabel('Concepto', { exact: true }).fill('Histórico editado'); await dialog(p).getByRole('button', { name: 'Guardar Cambios', exact: true }).click(); await dialog(p).waitFor({ state: 'hidden' });
        assert.equal((await saved(p)).transactions.find((tx: any) => tx.id === 'original').wallet, 'BANCO FICTICIO');
        await p.getByRole('button', { name: 'Opciones y datos', exact: true }).click(); const download = p.waitForEvent('download'); await p.getByRole('button', { name: 'Exportar JSON', exact: true }).click();
        const exported = parseBackup(await readFile((await (await download).path())!, 'utf8')); assert.equal(exported.defaultWalletId, 'cash'); assert.equal(exported.version, '3.2');
        await nav(p, 'Cuentas'); await p.getByRole('button', { name: 'Quitar cartera predeterminada', exact: true }).click(); await p.waitForFunction(key => JSON.parse(localStorage.getItem(key)!).defaultWalletId === null, DATA_KEY);
        await newMovement(p); assert.equal(await dialog(p).getByLabel('Cartera u Origen').inputValue(), ''); await p.keyboard.press('Escape');
        await choose(p, 'AHORRO FICTICIO', 'saving');
        for (const backup of [exported, makeBackup(initial)]) {
          await p.locator('input[type=file]').setInputFiles({ name: 'fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
          const confirm = p.getByRole('dialog').filter({ hasText: 'Se sustituirán todos los datos por esta copia.' });
          await confirm.getByRole('button', { name: 'Confirmar sustitución', exact: true }).click(); await confirm.waitFor({ state: 'hidden' }); assert.equal((await saved(p)).defaultWalletId, backup.defaultWalletId);
        }
        await newMovement(p); assert.equal(await dialog(p).getByLabel('Cartera u Origen').inputValue(), ''); await p.keyboard.press('Escape');
      } finally { await s.close(); }
    });
    await t.test(`${width}px: borrar predeterminada limpia ID, dos sin preferencia y una restante automática`, async () => {
      const s = await setup(width); const { p } = s;
      try {
        await choose(p, 'EFECTIVO FICTICIO', 'cash');
        for (const name of ['EFECTIVO FICTICIO', 'AHORRO FICTICIO']) {
          await nav(p, 'Cuentas'); await p.getByRole('button', { name: `Editar cuenta y patrimonio ${name}`, exact: true }).click();
          await dialog(p, 'Cartera').getByRole('button', { name: 'Eliminar esta cuenta bancaria', exact: true }).click();
          await p.getByRole('button', { name: 'Confirmar eliminación', exact: true }).click();
          await p.waitForFunction(({ key, name }) => !JSON.parse(localStorage.getItem(key)!).wallets.some((w: any) => w.name === name), { key: DATA_KEY, name });
          await p.getByRole('button', { name: 'Confirmar eliminación', exact: true }).waitFor({ state: 'hidden' });
          assert.equal((await saved(p)).defaultWalletId, null); await newMovement(p);
          assert.equal(await dialog(p).getByLabel('Cartera u Origen').inputValue(), name === 'EFECTIVO FICTICIO' ? '' : 'BANCO FICTICIO'); await p.keyboard.press('Escape');
        }
      } finally { await s.close(); }
    });
    await t.test(`${width}px: traspasos, reglas, reintegros, liquidaciones y préstamos respetan orígenes`, async () => {
      const initial = fixture(3, true), s = await setup(width, initial); const { p } = s;
      try {
        const before = await raw(p); await nav(p, 'Cuentas'); await p.getByRole('button', { name: 'Ordenar Traspaso', exact: true }).first().click();
        assert.equal(await dialog(p, 'Traspaso').getByLabel('Cuenta de origen').inputValue(), 'cash'); assert.equal(await dialog(p, 'Traspaso').getByLabel('Cuenta de destino').inputValue(), ''); await p.keyboard.press('Escape');
        await nav(p, 'Movimientos');
        for (const tx of initial.transactions.filter(t => t.transfer?.leg === 'out' || t.reimbursement)) {
          await p.getByRole('button', { name: `Editar movimiento ${tx.description}`, exact: true }).click();
          assert.equal(await dialog(p, tx.transfer ? 'Traspaso' : 'Liquidación').getByLabel(tx.transfer ? 'Cuenta de origen' : 'Cartera receptora').inputValue(), tx.transfer ? 'bank' : 'saving'); await p.keyboard.press('Escape');
        }
        await p.getByRole('button', { name: 'Movimientos periódicos', exact: true }).click(); await p.getByRole('button', { name: 'Nueva regla periódica', exact: true }).click();
        assert.equal(await dialog(p, 'Regla de movimiento periódico').getByLabel('Cartera periódica', { exact: true }).inputValue(), 'cash'); await p.keyboard.press('Escape');
        await p.getByRole('button', { name: 'Editar Alquiler ficticio', exact: true }).click(); assert.equal(await dialog(p, 'Regla de movimiento periódico').getByLabel('Cartera periódica', { exact: true }).inputValue(), 'bank'); await p.keyboard.press('Escape');
        await nav(p, 'Deudas'); await p.getByRole('button', { name: 'Nuevo Préstamo', exact: true }).click(); assert.equal(await dialog(p, 'Préstamo').getByLabel('Cuenta habitual de cobro').inputValue(), 'EFECTIVO FICTICIO'); await p.keyboard.press('Escape');
        await p.getByRole('button', { name: 'Editar deuda o préstamo Préstamo ficticio', exact: true }).click(); assert.equal(await dialog(p, 'Préstamo').getByLabel('Cuenta habitual de cobro').inputValue(), 'BANCO FICTICIO'); await p.keyboard.press('Escape');
        await p.getByRole('button', { name: 'Me deben', exact: true }).click(); await p.getByRole('button', { name: 'Registrar cobro parcial', exact: true }).first().click();
        const payment = dialog(p, 'Liquidación personal'); await payment.getByLabel('Modalidad de liquidación').selectOption('bank');
        assert.equal(await payment.getByLabel('Cartera de liquidación', { exact: true }).inputValue(), 'cash');
        await payment.getByLabel('Cartera de liquidación', { exact: true }).selectOption('saving'); await payment.getByLabel('Modalidad de liquidación').selectOption('adjustment'); await payment.getByLabel('Modalidad de liquidación').selectOption('bank');
        assert.equal(await payment.getByLabel('Cartera de liquidación', { exact: true }).inputValue(), 'saving'); await p.keyboard.press('Escape'); assert.equal(await raw(p), before);
      } finally { await s.close(); }
    });
  }
  await t.test('cuota, espera bajo Web Lock, doble envío y conflicto real entre pestañas', async () => {
    const s = await setup(1280); const { p } = s;
    try {
      const other = await s.c.newPage(); await other.clock.setFixedTime(new Date('2026-11-11T10:00:00Z')); await other.goto(url); await nav(other, 'Cuentas');
      await nav(p, 'Cuentas'); const before = await raw(p);
      await p.evaluate(({ prefix, key }) => { const set = Storage.prototype.setItem; (window as any).failDefault = true; (window as any).preferenceWrites = 0; Storage.prototype.setItem = function(k, v) { if ((window as any).failDefault && k.startsWith(prefix)) throw new DOMException('Cuota ficticia', 'QuotaExceededError'); if (k === key) (window as any).preferenceWrites++; return set.call(this, k, v); }; }, { prefix: RECOVERY_PREFIX, key: DATA_KEY });
      const pick = p.getByRole('button', { name: 'Usar como predeterminada AHORRO FICTICIO', exact: true }); await pick.click(); await p.getByRole('alert').first().waitFor(); assert.equal(await raw(p), before);
      await p.evaluate(() => { (window as any).failDefault = false; });
      await p.evaluate(lock => { (window as any).heldPreference = navigator.locks.request(lock, () => new Promise<void>(resolve => { (window as any).releasePreference = resolve; })); }, STORAGE_LOCK);
      await p.waitForFunction(() => typeof (window as any).releasePreference === 'function');
      await pick.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
      assert.equal(await pick.isDisabled(), true); assert.equal(await raw(p), before);
      await p.evaluate(() => (window as any).releasePreference());
      await p.waitForFunction(key => JSON.parse(localStorage.getItem(key)!).defaultWalletId === 'saving', DATA_KEY);
      assert.equal(await p.evaluate(() => (window as any).preferenceWrites), 1);
      const after = await raw(p); await other.getByRole('button', { name: 'Usar como predeterminada EFECTIVO FICTICIO', exact: true }).click(); await other.getByRole('alert').first().waitFor(); assert.equal(await raw(other), after);
      await other.reload(); await nav(other, 'Cuentas'); assert.match(await other.getByRole('region', { name: 'Cartera predeterminada' }).innerText(), /AHORRO FICTICIO/);
    } finally { await s.close(); }
  });
});

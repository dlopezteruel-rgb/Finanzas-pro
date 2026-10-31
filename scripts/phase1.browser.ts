import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium } from 'playwright-core';
import { DATA_KEY, RECOVERY_PREFIX, makeBackup } from '../src/utils/backup';
import { BUDGET_GROUPS } from '../src/constants/categories';
import { INITIAL_TRANSACTIONS, INITIAL_BUDGET_PLANS, INITIAL_CONTACTS, INITIAL_LOANS, INITIAL_WALLETS } from '../src/utils/seedData';

test('Fase 1: recorridos completos en Chromium', { timeout: 60000 }, async t => {
  const listener = createServer();
  await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = (listener.address() as { port: number }).port;
  await new Promise<void>(resolve => listener.close(() => resolve()));
  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production' }, stdio: 'pipe',
  });
  let serverLog = '';
  server.stdout.on('data', chunk => { serverLog += chunk; });
  server.stderr.on('data', chunk => { serverLog += chunk; });
  t.after(() => { server.kill(); });
  const url = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`El servidor no arrancó: ${serverLog}`);
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, `El servidor no está disponible: ${serverLog}`);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(7000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let queries = 0;
  await page.route('**/api/assistant-chat', route => {
    queries++;
    return route.fulfill({ json: { success: true, reply: 'Consulta financiera atendida sin registrar movimientos.' } });
  });
  const fixture = makeBackup({ theme: 'dark', transactions: INITIAL_TRANSACTIONS, budgetPlans: INITIAL_BUDGET_PLANS, budgetGroups: BUDGET_GROUPS, contacts: INITIAL_CONTACTS, loans: INITIAL_LOANS, wallets: INITIAL_WALLETS });
  // Simulate an existing user's legacy keys rather than an empty installation.
  await page.addInitScript(data => {
    if (sessionStorage.getItem('phase1-seeded')) return;
    localStorage.setItem('finanzas_pro_transactions_v2', JSON.stringify(data.transactions));
    sessionStorage.setItem('phase1-seeded', 'yes');
  }, fixture);
  await page.goto(url);
  const stored = () => page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('finanzas_pro_'))));
  const readData = async () => JSON.parse((await stored())[DATA_KEY]);
  const menu = () => page.getByRole('button', { name: 'Opciones y datos' }).click();
  const importFile = (backup: unknown) => page.locator('input[type=file]').setInputFiles({ name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });

  await t.test('consultas y negaciones con números nunca guardan datos', async () => {
    await page.getByRole('button', { name: 'Asistente', exact: true }).first().click();
    const before = await stored();
    for (const text of ['¿Puedo gastar 500 € este mes?', 'No registres 100 euros', 'Tengo 2 préstamos']) {
      await page.getByPlaceholder('Pregunta o registra un gasto...').fill(text);
      await page.getByRole('button', { name: 'Enviar', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('button[aria-label="Enviar"]:disabled') !== null);
      await page.getByPlaceholder('Pregunta o registra un gasto...').fill('siguiente');
      await page.getByRole('button', { name: 'Enviar', exact: true }).waitFor({ state: 'visible' });
      await page.waitForFunction(() => !(document.querySelector('button[aria-label="Enviar"]') as HTMLButtonElement).disabled);
      assert.equal(await page.getByRole('dialog').count(), 0);
      assert.deepEqual(await stored(), before);
    }
    assert.equal(queries, 2);
    assert.ok(await page.getByText('Consulta financiera atendida sin registrar movimientos.', { exact: true }).count());
  });
  await t.test('propuesta editable, cancelación y confirmación única', async () => {
    const before = await stored();
    const send = async () => {
      await page.getByPlaceholder('Pregunta o registra un gasto...').fill('Registra un gasto de 15 euros con Openbank');
      await page.getByRole('button', { name: 'Enviar', exact: true }).click();
      await page.getByRole('dialog').waitFor();
    };
    await send();
    assert.deepEqual(await stored(), before);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    assert.deepEqual(await stored(), before);
    await send();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Importe (€)').fill('27.50');
    await dialog.getByLabel('Fecha', { exact: true }).fill('2026-11-05');
    await dialog.getByLabel('Cartera', { exact: true }).selectOption('REVOLUT');
    await dialog.getByLabel('Categoría', { exact: true }).selectOption('V.001.001');
    await dialog.getByLabel('Concepto', { exact: true }).fill('Compra revisada');
    await dialog.getByLabel('Estado', { exact: true }).selectOption('false');
    await dialog.getByRole('button', { name: 'Confirmar y registrar' }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    const data = await readData();
    assert.equal(data.transactions.length, INITIAL_TRANSACTIONS.length + 1);
    assert.deepEqual({ amount: data.transactions[0].amount, date: data.transactions[0].date, wallet: data.transactions[0].wallet, code: data.transactions[0].code, description: data.transactions[0].description, processed: data.transactions[0].processed }, { amount: 27.5, date: '2026-11-05', wallet: 'REVOLUT', code: 'V.001.001', description: 'Compra revisada', processed: false });
  });
  await t.test('importación inválida conserva todos los datos', async () => {
    const before = await stored();
    await importFile({ ...fixture, transactions: [{}] });
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(), /transactions\[0\].id/);
    assert.deepEqual(await stored(), before);
    await page.getByRole('button', { name: 'Cerrar aviso' }).click();
  });
  await t.test('cancelar la vista previa de importación no modifica nada', async () => {
    const before = await stored();
    await importFile(fixture);
    await page.getByRole('dialog').waitFor();
    assert.match(await page.getByRole('dialog').innerText(), /Movimientos/);
    assert.deepEqual(await stored(), before);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    assert.deepEqual(await stored(), before);
  });
  await t.test('el restablecimiento demo exige confirmación y se puede cancelar', async () => {
    const before = await stored();
    await menu(); await page.getByRole('button', { name: 'Restablecer datos demo', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    assert.deepEqual(await stored(), before);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    assert.deepEqual(await stored(), before);
  });
  await t.test('restaurar conserva una copia descargable y sobrevive a la recarga', async () => {
    const before = await readData();
    await importFile(fixture);
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: 'Confirmar sustitución' }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    const data = await readData();
    assert.deepEqual(data.transactions, fixture.transactions);
    const copies = Object.entries(await stored()).filter(([key]) => key.startsWith(RECOVERY_PREFIX));
    assert.equal(copies.length, 1);
    assert.deepEqual(JSON.parse(copies[0][1]).transactions, before.transactions);
    await menu(); await page.getByRole('button', { name: 'Copias de recuperación', exact: true }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /^Descargar / }).click();
    assert.match((await download).suggestedFilename(), /finanzas_pro_recovery_.*\.json/);
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.reload();
    assert.deepEqual((await readData()).transactions, fixture.transactions);
  });
  await t.test('si no se puede guardar la copia, la interfaz conserva el estado', async () => {
    const before = await stored();
    await page.evaluate(prefix => {
      const original = Storage.prototype.setItem;
      (window as any).restoreStorageForTest = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = function(key, value) {
        if (key.startsWith(prefix)) throw new DOMException('Sin espacio', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    }, RECOVERY_PREFIX);
    await importFile({ ...fixture, transactions: [] });
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: 'Confirmar sustitución' }).click();
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(), /No se ha aplicado la sustitución/);
    assert.deepEqual(await stored(), before);
    await page.getByRole('button', { name: 'Cerrar aviso' }).click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.evaluate(() => (window as any).restoreStorageForTest());
  });
  await t.test('confirmar demo conserva otra copia sin borrar las anteriores', async () => {
    const countBefore = Object.keys(await stored()).filter(key => key.startsWith(RECOVERY_PREFIX)).length;
    await menu(); await page.getByRole('button', { name: 'Restablecer datos demo', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar sustitución' }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(Object.keys(await stored()).filter(key => key.startsWith(RECOVERY_PREFIX)).length, countBefore + 1);
    assert.deepEqual((await readData()).transactions, fixture.transactions);
  });
  assert.deepEqual(errors, []);
});

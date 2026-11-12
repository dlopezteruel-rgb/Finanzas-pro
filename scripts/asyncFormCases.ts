import {chooseMovementPartida} from './browserNavigation';
import { migrateSharedExpenses, sharedViewTransactions } from '../src/utils/sharedExpenses';
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { devices, type Browser, type Locator, type Page } from 'playwright-core';
import { Backup, DATA_KEY } from '../src/utils/backup';
import { STORAGE_LOCK } from '../src/utils/financeStore';

type Scenario = { name: string; open: (page: Page) => Promise<void>; fill: (dialog: Locator) => Promise<void>; verify: (data: Backup, fixture: Backup) => void };
const navigate = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name}(?:\\s*\\d+)?$`) }).first().click();
const scenarios: Scenario[] = [
  {
    name: 'Movimiento', open: page => navigate(page, 'Añadir'),
    async fill(dialog) {
      await dialog.locator('input[type=number]').fill('19.75');
      await dialog.getByLabel('Cartera u Origen', { exact: true }).selectOption('OPENBANK');
      await dialog.getByPlaceholder('ej. Cena restaurante, Compra Zara, Supermercado...').fill('Movimiento revisado');
      await dialog.locator('input[type=date]').fill('2026-11-03');
    },
    verify(data, fixture) { assert.equal(data.transactions.length, fixture.transactions.length + 1); assert.equal(data.transactions[0].description, 'Movimiento revisado'); },
  },
  {
    name: 'Cartera', async open(page) { await navigate(page, 'Cuentas'); await navigate(page, 'Nueva Cuenta'); },
    async fill(dialog) { await dialog.getByLabel('Nombre de la cuenta').fill('CARTERA REVISADA'); await dialog.locator('input[type=number]').fill('123.45'); },
    verify(data, fixture) { assert.equal(data.wallets.length, fixture.wallets.length + 1); assert.equal(data.wallets.at(-1)?.name, 'CARTERA REVISADA'); },
  },
  {
    name: 'Contacto', async open(page) { await navigate(page, 'Contactos'); await navigate(page, 'Nuevo Contacto'); },
    async fill(dialog) { await dialog.getByPlaceholder('Ej. Carlos Ruiz').fill('Contacto revisado'); await dialog.getByPlaceholder('Ej. Compañero de piso, cenas, viajes...').fill('Conservar esta nota'); },
    verify(data, fixture) { assert.equal(data.contacts.length, fixture.contacts.length + 1); assert.equal(data.contacts[0].notes, 'Conservar esta nota'); },
  },
  {
    name: 'Préstamo', async open(page) { await navigate(page, 'Deudas'); await navigate(page, 'Nuevo Préstamo'); },
    async fill(dialog) { await dialog.getByPlaceholder('ej. Préstamo Coche, Hipoteca...').fill('Préstamo revisado'); await dialog.locator('input[type=number]').first().fill('4321'); await dialog.getByLabel('Cuenta habitual de cobro', { exact: true }).selectOption('OPENBANK'); },
    verify(data, fixture) { assert.equal(data.loans.length, fixture.loans.length + 1); assert.equal(data.loans.at(-1)?.principal, 4321); },
  },
  {
    name: 'Liquidación', async open(page) { await navigate(page, 'Contactos'); await page.getByText('Carlos Ruiz', { exact: true }).first().click(); await page.getByRole('button', { name: 'Saldar deuda', exact: true }).first().click(); },
    async fill(dialog) { await dialog.locator('select').selectOption('w2'); await dialog.locator('input[type=date]').fill('2026-11-03'); },
    verify(data, fixture) {
      assert.equal(data.transactions.length, fixture.transactions.length + 1);
      const reimbursement = data.transactions[0];
      const participant = sharedViewTransactions(data.transactions).flatMap(t => t.splitInfo?.participants ?? []).find(p => p.contactId === reimbursement.reimbursement?.contactId);
      assert.ok(participant?.isPaid); assert.equal(reimbursement.wallet, 'REVOLUT'); assert.equal(reimbursement.date, '2026-11-03');
    },
  },
];

export async function asyncFormCases(t: TestContext, browser: Browser, url: string, fixture: Backup) {
  for (const scenario of scenarios) for (const failure of ['storage', 'conflict']) {
    await t.test(`${scenario.name}: conserva la edición ante ${failure}, espera y evita envíos repetidos`, async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
      const page = await context.newPage(); page.setDefaultTimeout(7000);
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      try {
        const scenarioFixture = scenario.name === 'Liquidación' ? { ...fixture, ...migrateSharedExpenses(fixture), version: '2.7' as const } : fixture;
        await page.addInitScript(({ key, fixture }) => localStorage.setItem(key, JSON.stringify(fixture)), { key: DATA_KEY, fixture: scenarioFixture });
        await page.goto(url);
        // Wait for the non-mutating startup capability probe before holding the write lock.
        await page.evaluate(() => navigator.locks.request('startup-check-finished', () => undefined));
        await scenario.open(page);
        const dialog = page.getByRole('dialog', { name: scenario.name, exact: true });
        await scenario.fill(dialog); await chooseMovementPartida(dialog);
        const fields = () => dialog.locator('input, select, textarea').evaluateAll(elements => elements.map(e => ({ value: (e as HTMLInputElement).value, checked: (e as HTMLInputElement).checked })));
        const draft = await fields();
        const raw = () => page.evaluate(key => localStorage.getItem(key), DATA_KEY);
        let before = await raw();
        if (failure === 'storage') {
          await page.evaluate(key => {
            const original = Storage.prototype.setItem;
            (window as any).saveControl = { fail: true, writes: 0 };
            Storage.prototype.setItem = function(k, value) {
              if (k === key) {
                (window as any).saveControl.writes++;
                if ((window as any).saveControl.fail) throw new DOMException('Cuota simulada', 'QuotaExceededError');
              }
              return original.call(this, k, value);
            };
          }, DATA_KEY);
        } else {
          const other = await context.newPage();
          await other.goto(url);
          await other.getByRole('button', { name: /Cambiar a modo/ }).click();
          await other.waitForFunction(({ key, before }) => localStorage.getItem(key) !== before, { key: DATA_KEY, before });
          before = await raw();
          await other.close();
        }
        // Hold the actual shared Web Lock: submit must remain pending without closing.
        await page.evaluate(lock => {
          void navigator.locks.request(lock, async () => {
            (window as any).lockHeld = true;
            await new Promise<void>(resolve => { (window as any).releaseFormLock = resolve; });
          });
        }, STORAGE_LOCK);
        await page.waitForFunction(() => (window as any).lockHeld);
        await dialog.locator('button[type=submit]').click();
        await dialog.locator('form[aria-busy=true]').waitFor();
        assert.ok(await dialog.locator('button[type=submit]').isDisabled());
        await dialog.locator('form').evaluate(form => {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        });
        assert.deepEqual(await fields(), draft);
        assert.equal(await raw(), before);
        await page.evaluate(() => (window as any).releaseFormLock());
        await dialog.getByRole('alert').waitFor();
        assert.match(await dialog.getByRole('alert').innerText(), failure === 'storage' ? /No hay espacio/ : /Otra pestaña/);
        assert.deepEqual(await fields(), draft);
        assert.equal(await raw(), before);
        assert.equal(await dialog.locator('button[type=submit]').isDisabled(), false);
        if (failure === 'storage') {
          await page.evaluate(() => { (window as any).saveControl.fail = false; });
          await dialog.locator('form').evaluate(form => {
            (form as HTMLFormElement).requestSubmit();
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          });
          await dialog.waitFor({ state: 'hidden' });
          scenario.verify(JSON.parse((await raw())!), fixture);
          assert.equal(await page.evaluate(() => (window as any).saveControl.writes), 2, 'un intento fallido y un guardado exitoso, sin duplicados');
        }
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });
  }

  await t.test('el registro rápido conserva el texto tras un fallo y solo lo limpia al guardar', async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage(); page.setDefaultTimeout(7000);
      await page.addInitScript(({ key, fixture }) => localStorage.setItem(key, JSON.stringify(fixture)), { key: DATA_KEY, fixture });
      await page.goto(url);
      const input = page.getByPlaceholder(/^Registrar:/);
      const text = 'Compra supermercado 23,45 € con Openbank';
      await input.fill(text);
      await page.evaluate(key => {
        const original = Storage.prototype.setItem;
        (window as any).failQuickSave = true;
        Storage.prototype.setItem = function(k, v) {
          if (k === key && (window as any).failQuickSave) throw new DOMException('Cuota simulada', 'QuotaExceededError');
          return original.call(this, k, v);
        };
      }, DATA_KEY);
      await page.getByRole('button', { name: 'Registrar', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'No hay espacio' }).first().waitFor();
      assert.equal(await input.inputValue(), text);
      assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), DATA_KEY), fixture);
      await page.evaluate(() => { (window as any).failQuickSave = false; });
      await page.getByRole('button', { name: 'Registrar', exact: true }).click();
      await page.waitForFunction(() => (document.querySelector('input[placeholder^="Registrar:"]') as HTMLInputElement).value === '');
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).transactions.length, DATA_KEY), fixture.transactions.length + 1);
    } finally { await context.close(); }
  });

  await t.test('crear un contacto dentro del movimiento no pierde la edición pendiente', async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage(); page.setDefaultTimeout(7000);
      await page.addInitScript(({ key, fixture }) => localStorage.setItem(key, JSON.stringify(fixture)), { key: DATA_KEY, fixture });
      await page.goto(url);
      await scenarios[0].open(page);
      const dialog = page.getByRole('dialog', { name: 'Movimiento', exact: true });
      await scenarios[0].fill(dialog);
      await dialog.getByRole('checkbox').first().check();
      await dialog.getByRole('button', { name: /Nuevo Contacto/ }).click();
      await dialog.getByPlaceholder('Nombre del nuevo contacto...').fill('Contacto dentro del gasto');
      await page.evaluate(key => {
        const original = Storage.prototype.setItem;
        (window as any).failContactSave = true;
        Storage.prototype.setItem = function(k, v) {
          if (k === key && (window as any).failContactSave) throw new DOMException('Cuota simulada', 'QuotaExceededError');
          return original.call(this, k, v);
        };
      }, DATA_KEY);
      await dialog.getByRole('button', { name: 'Añadir', exact: true }).click();
      // The shared-expense validation already has an alert before storage fails.
      await dialog.getByRole('alert').filter({ hasText: /No hay espacio/ }).waitFor();
      assert.equal(await dialog.getByPlaceholder('Nombre del nuevo contacto...').inputValue(), 'Contacto dentro del gasto');
      await page.evaluate(() => { (window as any).failContactSave = false; });
      await dialog.getByRole('button', { name: 'Añadir', exact: true }).click();
      await dialog.getByPlaceholder('Nombre del nuevo contacto...').waitFor({ state: 'hidden' });
      assert.equal(await dialog.locator('input[type=number]').first().inputValue(), '19.75');
      assert.equal(await dialog.getByPlaceholder('ej. Cena restaurante, Compra Zara, Supermercado...').inputValue(), 'Movimiento revisado');
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).transactions.length, DATA_KEY), fixture.transactions.length);
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).contacts.length, DATA_KEY), fixture.contacts.length + 1);
    } finally { await context.close(); }
  });

  await t.test('Web Locks funciona en Chromium escritorio, iframe y emulación Android', async () => {
    for (const options of [{ viewport: { width: 1280, height: 1000 } }, devices['Pixel 7']]) {
      const context = await browser.newContext(options);
      try {
        const page = await context.newPage(); await page.goto(url);
        const check = async () => {
          let acquired = false;
          await navigator.locks.request('finanzas-compatibility-probe', () => { acquired = true; });
          return { secure: isSecureContext, available: typeof navigator.locks?.request === 'function', acquired };
        };
        assert.deepEqual(await page.evaluate(check), { secure: true, available: true, acquired: true });
        await page.evaluate(src => new Promise<void>(resolve => { const iframe = document.createElement('iframe'); iframe.src = src; iframe.onload = () => resolve(); document.body.appendChild(iframe); }), url);
        assert.deepEqual(await page.frames()[1].evaluate(check), { secure: true, available: true, acquired: true });
      } finally { await context.close(); }
    }
  });
  await t.test('sin Web Locks hay aviso al iniciar y el formulario fallido conserva la edición', async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage(); page.setDefaultTimeout(7000);
      await page.addInitScript(({ key, fixture }) => { Object.defineProperty(navigator, 'locks', { value: undefined }); localStorage.setItem(key, JSON.stringify(fixture)); }, { key: DATA_KEY, fixture });
      await page.goto(url);
      await page.getByRole('alert').filter({ hasText: 'Guardado no disponible' }).waitFor();
      await scenarios[1].open(page);
      const dialog = page.getByRole('dialog', { name: 'Cartera', exact: true });
      await scenarios[1].fill(dialog);
      await dialog.locator('button[type=submit]').click();
      await dialog.getByRole('alert').waitFor();
      assert.match(await dialog.getByRole('alert').innerText(), /Web Locks/);
      assert.equal(await dialog.getByLabel('Nombre de la cuenta').inputValue(), 'CARTERA REVISADA');
      assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), DATA_KEY), fixture);
    } finally { await context.close(); }
  });
}

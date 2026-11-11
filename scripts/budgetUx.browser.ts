import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium, type Page } from 'playwright-core';
import { DATA_KEY, makeBackup, type FinanceData } from '../src/utils/backup';
import { STORAGE_LOCK } from '../src/utils/financeStore';
import { savePlanning, planningScope } from '../src/utils/planning';

const fixture = (theme: 'dark' | 'light' = 'dark'): FinanceData => ({
  theme, transactions: [
    { id: 'income', type: 'INGRESO', code: 'i', amount: 1200, date: '2026-10-01', categoryName: 'Trabajo', subcategoryName: 'Salario de prueba', description: 'Ingreso ficticio', wallet: 'BANCO FICTICIO', processed: true },
    { id: 'expense', type: 'GASTO', code: 'g', amount: 250, date: '2026-10-01', categoryName: 'Vida diaria', subcategoryName: 'Gasto diario', description: 'Gasto ficticio', wallet: 'BANCO FICTICIO', processed: true },
    { id: 'pending', type: 'GASTO', code: 'g', amount: 400, date: '2026-10-01', categoryName: 'Vida diaria', subcategoryName: 'Gasto diario', description: 'Pendiente ficticio', wallet: 'BANCO FICTICIO', processed: false },
  ], budgetPlans: [], contacts: [], loans: [],
  wallets: [{ id: 'bank', name: 'BANCO FICTICIO', type: 'BANK', initialBalance: 1000, color: '#fff' }],
  budgetGroups: [
    { code: 'I', name: 'Trabajo', type: 'INGRESO', partidas: [{ code: 'i', name: 'Salario de prueba', groupCode: 'I', groupName: 'Trabajo', type: 'INGRESO', keywords: [] }] },
    { code: 'P', name: 'Ingresos puntuales', type: 'INGRESO', partidas: [{ code: 'p', name: 'Extra de prueba', groupCode: 'P', groupName: 'Ingresos puntuales', type: 'INGRESO', keywords: [] }] },
    { code: 'G', name: 'Vida diaria', type: 'GASTO', partidas: [{ code: 'g', name: 'Gasto diario', groupCode: 'G', groupName: 'Vida diaria', type: 'GASTO', keywords: [] }] },
    { code: 'R', name: 'Vivienda', type: 'GASTO', partidas: [{ code: 'r', name: 'Alquiler de prueba', groupCode: 'R', groupName: 'Vivienda', type: 'GASTO', keywords: [] }] },
  ],
});
const planner = (page: Page) => page.getByRole('region', { name: 'Planificación financiera', exact: true });
const tab = (page: Page, name: 'Planificación financiera' | 'Catálogo y detalle de partidas') => page.getByRole('tab', { name, exact: true });
const section = (page: Page, name: string) => planner(page).getByRole('region', { name, exact: true });
const input = (page: Page, name: string) => planner(page).getByRole('textbox', { name, exact: true });
const guard = (page: Page) => page.getByRole('dialog', { name: 'Cambios de planificación sin guardar', exact: true });
const snapshot = (page: Page) => page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
const data = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), DATA_KEY);
async function fill(page: Page) {
  await input(page, 'Previsto INGRESO Salario de prueba').fill('3000,00');
  await input(page, 'Previsto GASTO Gasto diario').fill('200.00');
  await input(page, 'Previsto GASTO Alquiler de prueba').fill('2000');
  await input(page, 'Ahorro objetivo (€)').fill('600');
}
async function approve(page: Page) {
  await planner(page).getByRole('button', { name: 'Revisar y aprobar previsión', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Revisar y aprobar previsión', exact: true });
  await review.getByRole('button', { name: 'Confirmar aprobación', exact: true }).click();
  await review.waitFor({ state: 'hidden' });
}

test('3B UX: pestañas internas y plegado sin efectos financieros', { timeout: 180000 }, async t => {
  const listener = createServer(); await new Promise<void>(r => listener.listen(0, '127.0.0.1', r));
  const port = (listener.address() as { port: number }).port; await new Promise<void>(r => listener.close(() => r()));
  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { env: { ...process.env, PORT: String(port), NODE_ENV: 'production' }, stdio: 'pipe' });
  let log = ''; server.stdout.on('data', c => log += c); server.stderr.on('data', c => log += c); t.after(() => { server.kill(); });
  const url = `http://127.0.0.1:${port}/app`; let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(log);
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(ready, log);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] }); t.after(() => browser.close());
  async function setup(mobile = false, theme: 'dark' | 'light' = 'dark', initial = fixture(theme)) {
    const context = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 1000 } });
    await context.addInitScript(({ key, value }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, value); }, { key: DATA_KEY, value: JSON.stringify('version' in initial ? initial : makeBackup(initial)) });
    const page = await context.newPage(); page.setDefaultTimeout(7000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-31T12:00:00Z')); await page.goto(url); await page.getByRole('button', { name: /^(?:\d+\s*)?Presupuestos(?:\s*\d+)?$/ }).first().click();
    return { page, context, close: async () => { await context.close(); assert.deepEqual(errors, []); } };
  }

  for (const mobile of [false, true]) for (const theme of ['dark', 'light'] as const) {
    await t.test(`plegados independientes, valores/errores, totales y teclado: ${mobile ? '390px' : 'escritorio'}, ${theme}`, async () => {
      const s = await setup(mobile, theme); const { page } = s;
      try {
        const before = await snapshot(page);
        assert.equal(await tab(page, 'Planificación financiera').getAttribute('aria-selected'), 'true');
        assert.equal(await page.getByRole('navigation').getByRole('button').count(), mobile ? 5 : 7);
        assert.equal(await page.getByRole('tabpanel').count(), 1);
        assert.equal(await page.getByRole('button', { name: /^Ver partida / }).count(), 0);
        await fill(page);
        const expense = section(page, 'Gastos'), income = section(page, 'Ingresos');
        assert.match(await expense.locator(':scope > .planning-section-totals').innerText(), /2 partidas.*2\.200,00/s);
        assert.match(await expense.locator(':scope > .planning-section-totals').innerText(), /Ejecutado: 250,00/);
        assert.match(await section(page, 'Vida diaria').innerText(), /supera el previsto en 50,00/);
        await input(page, 'Previsto GASTO Gasto diario').fill('1,234');
        await section(page, 'Vida diaria').getByRole('button', { name: 'Vida diaria', exact: true }).click();
        assert.match(await section(page, 'Vida diaria').getByRole('alert').innerText(), /1 importe inválido oculto/);
        assert.equal(await input(page, 'Previsto GASTO Alquiler de prueba').isVisible(), true);
        await expense.getByRole('button', { name: 'Gastos', exact: true }).click();
        await income.getByRole('button', { name: 'Ingresos', exact: true }).click();
        assert.match(await expense.getByRole('alert').innerText(), /1 importe inválido oculto/);
        assert.match(await income.innerText(), /3\.000,00.*1\.200,00/s);
        assert.equal(await planner(page).locator('.planning-totals').first().isVisible(), true);
        assert.equal(await planner(page).getByRole('button', { name: 'Guardar borrador', exact: true }).isDisabled(), true);
        assert.equal(await planner(page).getByRole('button', { name: 'Revisar y aprobar previsión', exact: true }).isDisabled(), true);
        await income.getByRole('button', { name: 'Ingresos', exact: true }).focus();
        await page.keyboard.press('Enter');
        assert.equal(await input(page, 'Previsto INGRESO Salario de prueba').inputValue(), '3000,00');
        await section(page, 'Trabajo').getByRole('button', { name: 'Trabajo', exact: true }).click();
        assert.equal(await input(page, 'Previsto INGRESO Extra de prueba').isVisible(), true);
        await section(page, 'Trabajo').getByRole('button', { name: 'Trabajo', exact: true }).click();
        await expense.getByRole('button', { name: 'Gastos', exact: true }).click();
        assert.equal(await input(page, 'Previsto GASTO Gasto diario').isVisible(), false);
        await section(page, 'Vida diaria').getByRole('button', { name: 'Vida diaria', exact: true }).focus();
        await page.keyboard.press('Space');
        assert.equal(await input(page, 'Previsto GASTO Gasto diario').inputValue(), '1,234');
        assert.equal(await input(page, 'Previsto GASTO Gasto diario').getAttribute('aria-invalid'), 'true');
        await input(page, 'Previsto GASTO Gasto diario').fill('200,00');
        for (const name of ['Ingresos', 'Gastos']) {
          const controls = planner(page).getByRole('group', { name: `Plegado de ${name}`, exact: true });
          await controls.getByRole('button', { name: 'Contraer todo', exact: true }).click();
          assert.equal(await section(page, name).getByRole('button', { name, exact: true }).getAttribute('aria-expanded'), 'false');
          await controls.getByRole('button', { name: 'Expandir todo', exact: true }).click();
        }
        assert.equal(await input(page, 'Previsto GASTO Gasto diario').inputValue(), '200,00');
        assert.equal(await input(page, 'Previsto GASTO Alquiler de prueba').inputValue(), '2000');
        assert.equal(await input(page, 'Ahorro objetivo (€)').inputValue(), '600');
        assert.equal(await planner(page).getByRole('button', { name: 'Guardar borrador', exact: true }).isEnabled(), true);
        await input(page, 'Ahorro objetivo (€)').fill('900');
        await expense.getByRole('button', { name: 'Gastos', exact: true }).click();
        assert.match(await expense.innerText(), /margen por asignar negativo/);
        assert.match(await planner(page).locator('.planning-totals').first().innerText(), /-100,00/);
        const controlled = await expense.getByRole('button', { name: 'Gastos', exact: true }).getAttribute('aria-controls');
        assert.equal(await page.evaluate(id => document.getElementById(id!)?.hidden, controlled), true);
        assert.deepEqual(await snapshot(page), before);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        if (process.env.BUDGET_UX_ARTIFACT_DIR) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({ path: `${process.env.BUDGET_UX_ARTIFACT_DIR}/${mobile ? 'mobile' : 'desktop'}-${theme}.png`, fullPage: true });
        }
      } finally { await s.close(); }
    });
  }

  await t.test('subpestañas con guardia, Escape, foco y descartado explícito sin guardar', async () => {
    const s = await setup(); const { page } = s;
    try {
      const before = await snapshot(page); await fill(page);
      await tab(page, 'Planificación financiera').focus(); await page.keyboard.press('ArrowRight');
      assert.equal(await tab(page, 'Catálogo y detalle de partidas').evaluate(el => el === document.activeElement), true);
      assert.equal(await tab(page, 'Planificación financiera').getAttribute('aria-selected'), 'true');
      await page.keyboard.press('Enter'); await guard(page).waitFor();
      await page.keyboard.press('Escape'); await guard(page).waitFor({ state: 'hidden' });
      assert.equal(await tab(page, 'Catálogo y detalle de partidas').evaluate(el => el === document.activeElement), true);
      assert.equal(await input(page, 'Previsto GASTO Gasto diario').inputValue(), '200.00');
      await tab(page, 'Catálogo y detalle de partidas').click(); await guard(page).getByRole('button', { name: 'Seguir editando' }).click();
      assert.equal(await input(page, 'Previsto INGRESO Salario de prueba').inputValue(), '3000,00');
      await tab(page, 'Catálogo y detalle de partidas').click(); await guard(page).getByRole('button', { name: 'Descartar y continuar' }).click();
      assert.equal(await tab(page, 'Catálogo y detalle de partidas').getAttribute('aria-selected'), 'true');
      assert.equal(await tab(page, 'Catálogo y detalle de partidas').evaluate(el => el === document.activeElement), true);
      assert.equal(await planner(page).count(), 0);
      await page.keyboard.press('Tab'); assert.equal(await page.getByRole('tabpanel').evaluate(el => el === document.activeElement), true);
      await tab(page, 'Catálogo y detalle de partidas').focus(); await page.keyboard.press('Home'); await page.keyboard.press('Space');
      assert.equal(await input(page, 'Previsto GASTO Gasto diario').inputValue(), '0');
      assert.deepEqual(await snapshot(page), before);
    } finally { await s.close(); }
  });

  await t.test('catálogo conserva pestaña/plegados y actualiza planificación/aprobación sin duplicar el editor', async () => {
    const s = await setup(); const { page } = s;
    try {
      await fill(page); await approve(page);
      const approved = (await data(page)).planningMonths[0].approval;
      const beforeFolding = await snapshot(page);
      await section(page, 'Ingresos').getByRole('button', { name: 'Ingresos', exact: true }).click();
      await tab(page, 'Catálogo y detalle de partidas').click();
      assert.deepEqual(await snapshot(page), beforeFolding);
      await page.getByRole('button', { name: /^Ver partida g / }).click();
      const panel = page.getByRole('dialog', { name: 'Detalle de partida', exact: true });
      await panel.getByTitle('Editar previsto').click(); await panel.getByRole('textbox', { name: 'Previsto de la partida' }).fill('350,01');
      await panel.getByRole('button', { name: 'Guardar previsto de la partida' }).click();
      await panel.getByRole('textbox', { name: 'Previsto de la partida' }).waitFor({ state: 'hidden' });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /^Paquetes de Ingresos/ }).click();
      const beforeNavigation = await snapshot(page);
      await tab(page, 'Planificación financiera').click();
      assert.equal(await section(page, 'Ingresos').getByRole('button', { name: 'Ingresos', exact: true }).getAttribute('aria-expanded'), 'false');
      assert.equal(await input(page, 'Previsto GASTO Gasto diario').inputValue(), '350.01');
      assert.match(await planner(page).innerText(), /Modificada desde la última aprobación/);
      assert.deepEqual((await data(page)).planningMonths[0].approval, approved);
      await tab(page, 'Catálogo y detalle de partidas').click();
      assert.equal(await page.getByRole('button', { name: /^Ver partida g / }).count(), 0);
      assert.equal(await page.getByRole('button', { name: /^Ver partida i / }).isVisible(), true);
      assert.equal(await page.locator('input[aria-label="Previsto GASTO Gasto diario"]').count(), 1);
      assert.deepEqual(await snapshot(page), beforeNavigation);
    } finally { await s.close(); }
  });

  for (const mode of ['draft', 'approval'] as const) await t.test(`navegación bloqueada durante ${mode} pendiente y tras fallo de cuota reintentable`, async () => {
    const s = await setup(); const { page } = s;
    try {
      await fill(page); const before = await snapshot(page);
      await page.evaluate(async lock => {
        let entered!: () => void; const ready = new Promise<void>(r => entered = r);
        (window as any).held = navigator.locks.request(lock, async () => { entered(); await new Promise<void>(r => (window as any).releaseUx = r); }); await ready;
      }, STORAGE_LOCK);
      await page.evaluate(key => {
        const original = Storage.prototype.setItem; (window as any).failUx = true;
        Storage.prototype.setItem = function(k, v) { if (k === key && (window as any).failUx) throw new DOMException('Cuota ficticia', 'QuotaExceededError'); return original.call(this, k, v); };
      }, DATA_KEY);
      if (mode === 'draft') await planner(page).getByRole('button', { name: 'Guardar borrador', exact: true }).click();
      else {
        await planner(page).getByRole('button', { name: 'Revisar y aprobar previsión', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Confirmar aprobación', exact: true }).click();
      }
      await page.waitForFunction(() => (document.getElementById('budget-tab-catalog') as HTMLButtonElement).disabled);
      assert.equal(await page.locator('#budget-tab-catalog').isDisabled(), true);
      await page.locator('#budget-tab-catalog').evaluate(el => (el as HTMLButtonElement).click());
      assert.equal(await page.locator('#budget-tab-planning').getAttribute('aria-selected'), 'true');
      assert.deepEqual(await snapshot(page), before);
      await page.evaluate(() => (window as any).releaseUx());
      const form = mode === 'draft' ? planner(page) : page.getByRole('dialog', { name: 'Revisar y aprobar previsión' });
      await form.getByRole('alert').filter({ hasText: /No hay espacio/ }).waitFor();
      assert.equal((await data(page)).planningMonths, undefined);
      await page.evaluate(() => { (window as any).failUx = false; });
      await form.getByRole('button', { name: mode === 'draft' ? 'Guardar borrador' : 'Confirmar aprobación', exact: true }).click();
      if (mode === 'approval') await form.waitFor({ state: 'hidden' }); else await planner(page).getByText('Borrador guardado.', { exact: true }).waitFor();
      await tab(page, 'Catálogo y detalle de partidas').click();
      assert.equal(await tab(page, 'Catálogo y detalle de partidas').getAttribute('aria-selected'), 'true');
    } finally { await s.close(); }
  });

  await t.test('históricos fuera del catálogo permanecen editables al plegar y guardar', async () => {
    const initial = fixture(); initial.budgetPlans = [{ monthYear: '2026-10', type: 'GASTO', code: 'old', plannedAmount: 15 }];
    const s = await setup(false, 'dark', initial); const { page } = s;
    try {
      const before = await snapshot(page); const historical = section(page, 'Fuera del catálogo');
      await input(page, 'Previsto GASTO Partida histórica old').fill('25,50');
      await historical.getByRole('button', { name: 'Fuera del catálogo', exact: true }).click();
      assert.match(await historical.innerText(), /1 partida.*25,50/s);
      await section(page, 'Gastos').getByRole('button', { name: 'Gastos', exact: true }).click();
      assert.deepEqual(await snapshot(page), before);
      await planner(page).getByRole('button', { name: 'Guardar borrador', exact: true }).click();
      await planner(page).getByText('Borrador guardado.', { exact: true }).waitFor();
      assert.equal((await data(page)).budgetPlans.find((p: any) => p.code === 'old').plannedAmount, 25.5);
      await section(page, 'Gastos').getByRole('button', { name: 'Gastos', exact: true }).click();
      await historical.getByRole('button', { name: 'Fuera del catálogo', exact: true }).click();
      assert.equal(await input(page, 'Previsto GASTO Partida histórica old').inputValue(), '25.5');
    } finally { await s.close(); }
  });

  await t.test('cambiar subpestañas restaura scroll por panel y no escribe preferencias en JSON 2.5–2.9', async () => {
    for (const version of ['2.5', '2.6', '2.7', '2.8', '2.9'] as const) {
      const initial = fixture();
      const value = version === '2.9' ? makeBackup(savePlanning(initial, '2026-10', [], 100, planningScope(initial, '2026-10'))) : { ...makeBackup(initial), version };
      const s = await setup(false, 'dark', value); const { page } = s;
      try {
        const before = await snapshot(page);
        await page.evaluate(() => window.scrollTo(0, 350)); const planningScroll = await page.evaluate(() => window.scrollY);
        await tab(page, 'Catálogo y detalle de partidas').evaluate(el => (el as HTMLButtonElement).click());
        await page.evaluate(() => window.scrollTo(0, 200)); const catalogScroll = await page.evaluate(() => window.scrollY);
        await tab(page, 'Planificación financiera').evaluate(el => (el as HTMLButtonElement).click());
        assert.equal(await page.evaluate(() => window.scrollY), planningScroll);
        assert.equal(await tab(page, 'Planificación financiera').evaluate(el => el === document.activeElement), true);
        await tab(page, 'Catálogo y detalle de partidas').evaluate(el => (el as HTMLButtonElement).click());
        assert.equal(await page.evaluate(() => window.scrollY), catalogScroll);
        assert.deepEqual(await snapshot(page), before);
      } finally { await s.close(); }
    }
  });

  for (const mobile of [false, true]) await t.test(`catálogo seguro: destinos del mismo tipo y financieros intactos (${mobile ? 'móvil' : 'escritorio'})`, async () => {
    const initial = savePlanning(fixture(), '2026-10', [{ type: 'GASTO', code: 'g', amountCents: 80000 }], 0, planningScope(fixture(), '2026-10'), true, true);
    const s = await setup(mobile, 'dark', initial); const { page } = s;
    try {
      const before = await data(page); await tab(page, 'Catálogo y detalle de partidas').click();
      await page.getByRole('button', { name: 'Mover de paquete Gasto diario', exact: true }).click();
      const d = page.getByRole('dialog', { name: 'Mover partida', exact: true });
      const select = d.getByLabel('Paquete de destino');
      assert.deepEqual(await select.locator('option').evaluateAll(options => options.map(o => (o as HTMLOptionElement).value)), ['G', 'R']);
      const unchanged = await snapshot(page);
      await select.evaluate(el => { const option = document.createElement('option'); option.value = 'I'; option.textContent = 'Destino manipulado'; el.append(option); });
      await select.selectOption('I'); await d.getByRole('button', { name: 'Confirmar Traslado', exact: true }).click();
      await d.getByRole('alert').waitFor(); assert.match(await d.getByRole('alert').innerText(), /mismo tipo/);
      assert.deepEqual(await snapshot(page), unchanged);
      await select.selectOption('R'); await d.getByRole('button', { name: 'Confirmar Traslado', exact: true }).click(); await d.waitFor({ state: 'hidden' });
      const saved = await data(page);
      for (const k of ['transactions', 'budgetPlans', 'planningMonths', 'wallets', 'loans']) assert.deepEqual(saved[k], before[k], k);
      assert.ok(saved.budgetGroups.find((g: any) => g.code === 'R').partidas.some((p: any) => p.code === 'g'));
      await page.reload(); assert.deepEqual((await data(page)).transactions, before.transactions);
    } finally { await s.close(); }
  });

  await t.test('duplicar con groupCode distinto del padre espera al guardado, conserva datos ante cuota y evita doble envío', async () => {
    const initial = fixture(); initial.budgetGroups.find(g => g.code === 'G')!.partidas[0].groupCode = 'G.subgrupo';
    const s = await setup(false, 'light', initial); const { page } = s;
    try {
      await tab(page, 'Catálogo y detalle de partidas').click(); const before = await data(page);
      await page.evaluate(key => {
        (window as any).catalogIo = { fail: true, attempts: 0, waiting: true };
        const set = Storage.prototype.setItem, request = navigator.locks.request.bind(navigator.locks);
        Storage.prototype.setItem = function(k, value) { if (k === key) { (window as any).catalogIo.attempts++; if ((window as any).catalogIo.fail) throw new DOMException('Cuota simulada', 'QuotaExceededError'); } return set.call(this, k, value); };
        navigator.locks.request = ((...args: any[]) => (request as any)(args[0], async () => {
          if ((window as any).catalogIo.waiting) await new Promise<void>(resolve => { (window as any).releaseCatalog = resolve; });
          return args[1]();
        })) as typeof navigator.locks.request;
      }, DATA_KEY);
      const duplicate = page.getByRole('button', { name: 'Duplicar partida Gasto diario', exact: true });
      await duplicate.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
      await page.waitForFunction(() => typeof (window as any).releaseCatalog === 'function');
      assert.equal(await duplicate.isDisabled(), true); assert.deepEqual(await data(page), before);
      await page.evaluate(() => (window as any).releaseCatalog());
      await page.getByRole('alert').filter({ hasText: /No hay espacio/ }).first().waitFor();
      assert.deepEqual(await data(page), before); assert.equal(await page.evaluate(() => (window as any).catalogIo.attempts), 1);
      await page.evaluate(() => { (window as any).catalogIo.fail = false; (window as any).catalogIo.waiting = false; });
      await duplicate.click(); await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)!).budgetGroups.flatMap((g: any) => g.partidas).length === 5, DATA_KEY);
      const after = await data(page);
      assert.equal(after.budgetGroups.find((g: any) => g.code === 'G').partidas.length, 2);
      assert.deepEqual(after.transactions, before.transactions); assert.deepEqual(after.budgetPlans, before.budgetPlans);
      assert.equal(await page.evaluate(() => (window as any).catalogIo.attempts), 2);
      await page.reload(); assert.equal((await data(page)).budgetGroups.flatMap((g: any) => g.partidas).length, 5);
    } finally { await s.close(); }
  });

});

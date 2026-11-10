import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir } from 'node:fs/promises';
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import { DATA_KEY, makeBackup } from '../src/utils/backup';
import { responsiveFixture } from './responsiveFixture';

const widths = [390, 768, 1280, 1440, 1920];
const themes = ['dark', 'light'] as const;
const baseline = !!process.env.RESPONSIVE_BASE_DIR;
const artifactDir = process.env.RESPONSIVE_ARTIFACT_DIR;
const planner = (p: Page) => p.getByRole('region', { name: 'Planificación financiera', exact: true });
const live = (p: Page) => p.getByRole('complementary', { name: 'Asignación del mes en directo', exact: true });
const nav = (p: Page, name: string) => p.getByRole('navigation').getByRole('button', { name: new RegExp('^(?:\\d+\\s*)?' + name + '(?:\\s*\\d+)?$') }).click();
const raw = (p: Page) => p.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
const metric = (p: Page, label: string) => live(p).getByText(label, { exact: true }).locator('..').locator('dd');
const field = (p: Page, label: string) => planner(p).getByRole('textbox', { name: label, exact: true });
async function noOverflow(page: Page) {
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
  assert.ok(size.scroll <= size.width + 1, `desbordamiento global: ${JSON.stringify(size)}`);
}
async function expandLive(page: Page) {
  const toggle = live(page).getByRole('button', { name: 'Ver desglose de asignación', exact: true });
  if (await toggle.isVisible()) await toggle.click();
}
async function photo(page: Page, name: string) {
  if (!artifactDir) return;
  await mkdir(artifactDir, { recursive: true });
  await page.screenshot({ path: `${artifactDir}/${name}.jpg`, type: 'jpeg', quality: 75, animations: 'disabled' });
}

test('Fase 4: módulos fluidos, asignación local, arrastres, zoom y accesibilidad', { timeout: 300000 }, async t => {
  const listener = createServer(); await new Promise<void>(r => listener.listen(0, '127.0.0.1', r));
  const port = (listener.address() as { port: number }).port; await new Promise<void>(r => listener.close(() => r()));
  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { cwd: process.env.RESPONSIVE_BASE_DIR || process.cwd(), env: { ...process.env, PORT: String(port), NODE_ENV: 'production' }, stdio: 'pipe' });
  let log = ''; server.stdout.on('data', c => log += c); server.stderr.on('data', c => log += c); t.after(() => { server.kill(); });
  const url = `http://127.0.0.1:${port}`;
  let ready = false; for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw new Error(log); try { if ((await fetch(url)).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert.ok(ready, log);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] }); t.after(() => browser.close());
  async function seed(context: BrowserContext, theme: 'dark' | 'light') {
    await context.route('**/*', route => new URL(route.request().url()).origin === url ? route.continue() : route.abort());
    await context.addInitScript(({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
      const set = Storage.prototype.setItem; (window as any).layoutWrites = 0;
      Storage.prototype.setItem = function (k, v) { (window as any).layoutWrites++; return set.call(this, k, v); };
    }, { key: DATA_KEY, value: JSON.stringify(makeBackup({ ...responsiveFixture(), theme })) });
  }
  async function setup(width = 1440, theme: 'dark' | 'light' = 'dark') {
    const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 1000 }, isMobile: width < 768, hasTouch: width <= 768, timezoneId: 'Europe/Madrid' });
    await seed(context, theme);
    const page = await context.newPage(); page.setDefaultTimeout(8000); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await page.goto(url);
    return { page, close: async () => { await context.close(); assert.deepEqual(errors, []); } };
  }
  for (const width of widths) for (const theme of themes) await t.test(`${baseline ? 'base comparativa' : 'siete módulos, táctil y borrador sin escrituras'}: ${width}px ${theme}`, async () => {
    const s = await setup(width, theme), { page } = s;
    try {
      const before = await raw(page);
      if (!baseline) {
        for (const name of ['Inicio', 'Movimientos', 'Cuentas', 'Contactos', 'Deudas', 'Asistente']) {
          await nav(page, name); assert.equal(await page.getByRole('navigation').getByRole('button').count(), 7);
          const charts = page.locator('details.financial-charts');
          if (await charts.count()) {
            await charts.locator('summary').click(); await charts.getByRole('table').first().waitFor();
            const svg = charts.locator('svg').first();
            if (await svg.count()) { const bounds = (await svg.boundingBox())!; assert.ok(bounds.width <= width); }
          }
          if(name==='Contactos'){
            const card=page.getByRole('button',{name:'Detalle de Contacto ficticio ana',exact:true});await card.focus();await page.keyboard.press('Enter');assert.equal(await card.getAttribute('aria-expanded'),'true');await noOverflow(page);await page.keyboard.press('Space');assert.equal(await card.getAttribute('aria-expanded'),'false');
          }
          if (name === 'Asistente') {
            const input = page.getByRole('textbox', { name: 'Mensaje para el asistente' }); await input.fill('Consulta ficticia sin enviar');
            assert.ok((await input.boundingBox())!.width > 120);
          }
          await noOverflow(page);
          if (width >= 1280) assert.ok((await page.getByRole('main').boundingBox())!.width > width * .95);
          if (width >= 1280 && ['Contactos', 'Deudas', 'Cuentas'].includes(name)) {
            const grid = page.locator(name === 'Contactos' ? '.contact-cards' : name === 'Deudas' ? '.loan-cards' : '.wallet-cards');
            assert.ok((await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)) >= 2);
          }
          await page.evaluate(() => scrollTo(0, 0)); await photo(page, `${width}-${theme}-${name}`);
        }
      }
      await nav(page, 'Presupuestos'); await planner(page).getByLabel('Mes de planificación', { exact: true }).fill('2026-10');
      await field(page, 'Previsto GASTO Comida ficticia').scrollIntoViewIfNeeded(); await page.evaluate(() => scrollBy(0, -160));
      await photo(page, `${width}-${theme}-planificacion`);
      if (baseline) return;
      await page.getByRole('tab',{name:'Catálogo y detalle de partidas',exact:true}).click();await noOverflow(page);await photo(page,`${width}-${theme}-catalogo`);
      if(width>=1280)assert.ok(await page.locator('.catalog-families').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)>=2);
      const family=page.getByRole('button',{name:'Familia Vida diaria',exact:true});const wasOpen=await family.getAttribute('aria-expanded');await family.focus();await page.keyboard.press('Space');assert.notEqual(await family.getAttribute('aria-expanded'),wasOpen);await page.keyboard.press('Enter');assert.equal(await family.getAttribute('aria-expanded'),wasOpen);
      await page.getByRole('tab',{name:'Planificación financiera',exact:true}).click();
      await planner(page).getByRole('button',{name:'Ver resumen anual',exact:true}).click();
      const annual=planner(page).getByRole('table',{name:'Previsiones mensuales guardadas',exact:true});assert.equal(await annual.locator('tbody tr').count(),12);
      if(width>=1920)assert.equal(await annual.locator('..').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
      await expandLive(page);
      for (const [label, value] of [['Ingresos previstos', '3.000,00 €'], ['Ahorro objetivo', '600,00 €'], ['Gastos base asignados', '1.800,00 €'], ['Pendiente de asignar del mes', '600,00 €'], ['Arrastres presupuestarios recibidos', '100,00 €'], ['Gasto efectivo previsto', '1.900,00 €'], ['Margen previsto efectivo', '500,00 €']]) assert.equal(await metric(page, label).innerText(), value);
      const carry = planner(page).getByRole('group', { name: 'Arrastre de Comida ficticia', exact: true });
      assert.match(await carry.innerText(), /50,00.*septiembre de 2026.*2026-09/s);
      assert.match(await carry.innerText(), /potencialmente desactualizado/);
      assert.equal(await planner(page).locator('.planning-row').filter({ has: field(page, 'Previsto GASTO Alquiler ficticio') }).locator('.planning-carry').count(), 0);
      await page.getByText('Gráficos de Planificación', { exact: true }).click();
      const graph = planner(page).getByRole('region', { name: 'Previsión guardada, ejecución y última aprobación', exact: true }); await graph.getByRole('table').waitFor();
      const storedGraph = await graph.getByRole('table').innerText();
      await field(page, 'Previsto GASTO Comida ficticia').fill('210');
      assert.equal(await metric(page, 'Gastos base asignados').innerText(), '1.810,00 €');
      assert.equal(await metric(page, 'Pendiente de asignar del mes').innerText(), '590,00 €');
      assert.equal(await metric(page, 'Margen previsto efectivo').innerText(), '490,00 €');
      assert.match(await carry.innerText(), /Presupuesto efectivo: 260,00/);
      assert.match(await live(page).innerText(), /Vista previa local · sin guardar/);
      assert.equal(await graph.getByRole('table').innerText(), storedGraph);
      await field(page, 'Previsto INGRESO Salario ficticio').fill('3100'); await field(page, 'Ahorro objetivo (€)').fill('650');
      assert.equal(await metric(page, 'Pendiente de asignar del mes').innerText(), '640,00 €');
      assert.equal(await metric(page, 'Margen previsto efectivo').innerText(), '540,00 €');
      await field(page, 'Previsto GASTO Comida ficticia').fill('2,');
      assert.match(await live(page).getByRole('alert').innerText(), /Cálculo no disponible/);
      assert.equal(await metric(page, 'Gastos base asignados').innerText(), '—');
      assert.equal(await metric(page, 'Margen previsto efectivo').innerText(), '—');
      assert.equal(await planner(page).getByRole('button', { name: 'Guardar borrador', exact: true }).isDisabled(), true);
      await field(page, 'Previsto GASTO Comida ficticia').fill('210');
      await field(page, 'Ahorro objetivo (€)').fill('4000');
      assert.equal(await metric(page, 'Pendiente de asignar del mes').innerText(), '-2.710,00 €');
      assert.equal(await metric(page, 'Margen previsto efectivo').innerText(), '-2.810,00 €');
      await field(page, 'Ahorro objetivo (€)').fill('650');
      await nav(page, 'Cuentas'); const guard = page.getByRole('dialog', { name: 'Cambios de planificación sin guardar', exact: true }); await guard.waitFor();
      await guard.getByRole('button', { name: 'Seguir editando', exact: true }).click();
      assert.equal(await field(page, 'Previsto GASTO Comida ficticia').inputValue(), '210');
      await noOverflow(page); assert.deepEqual(await raw(page), before); assert.equal(await page.evaluate(() => (window as any).layoutWrites), 0);
      if (width >= 1280) {
        await field(page, 'Previsto GASTO Regalos ficticios').scrollIntoViewIfNeeded();
        const panel = (await live(page).boundingBox())!, editor = (await planner(page).locator('.planning-partidas').boundingBox())!;
        assert.ok(panel.x > editor.x + editor.width - 1); assert.ok(panel.y >= 55 && panel.y < 1000);
      }
      if (width <= 768) {
        const toggle = live(page).getByRole('button', { name: 'Resumir asignación', exact: true }); await toggle.tap();
        const compact = (await live(page).boundingBox())!; assert.ok(compact.height < 230);
      }
    } finally { await s.close(); }
  });
  if (baseline) return;
  for (const zoom of [1.25, 2]) for (const theme of themes) await t.test(`zoom nativo ${zoom * 100}% ${theme}: reflow, diálogo y teclado`, async () => {
    // Chrome's own zoom API in a disposable profile; neither CSS zoom nor device scale emulation.
    const context = await chromium.launchPersistentContext('', { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', viewport: { width: 1440, height: 1000 }, args: ['--no-sandbox'] });
    try {
      const page = context.pages()[0];
      await page.goto('chrome://settings/appearance');
      await page.evaluate(zoom => new Promise<void>(resolve => (window as any).chrome.settingsPrivate.setDefaultZoom(zoom, resolve)), zoom);
      await seed(context, theme); await page.goto(url); page.setDefaultTimeout(8000);
      const scale = await page.evaluate(() => ({ ratio: devicePixelRatio, width: innerWidth }));
      assert.ok(Math.abs(scale.ratio - zoom) < .01); assert.ok(Math.abs(scale.width - 1440 / zoom) < 2);
      const before = await raw(page);
      await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Ir al contenido');
      await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.activeElement?.id), 'app-content');
      for (const name of ['Inicio', 'Movimientos', 'Presupuestos', 'Cuentas', 'Contactos', 'Deudas', 'Asistente']) { await nav(page, name); await noOverflow(page); }
      await nav(page, 'Presupuestos'); await planner(page).getByLabel('Mes de planificación').fill('2026-10'); await expandLive(page);
      await field(page, 'Previsto GASTO Comida ficticia').fill('210'); assert.equal(await metric(page, 'Margen previsto efectivo').innerText(), '490,00 €');
      await planner(page).getByRole('button', { name: 'Revisar y aprobar previsión', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Revisar y aprobar previsión', exact: true }); await dialog.waitFor();
      for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true); }
      assert.equal(await dialog.evaluate(el => { const r = el.getBoundingClientRect(); return r.x >= 0 && r.right <= innerWidth + 1 && r.width > 0; }), true);
      await noOverflow(page); await photo(page, `zoom-${zoom * 100}-${theme}`); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      assert.equal(await field(page, 'Previsto GASTO Comida ficticia').inputValue(), '210'); assert.deepEqual(await raw(page), before);
    } finally { await context.close(); }
  });
  await t.test('revisión existente desde la partida, foco y redimensionado sin perder filtros/borrador', async () => {
    const s = await setup(), { page } = s;
    try {
      await nav(page, 'Presupuestos'); await planner(page).getByLabel('Mes de planificación').fill('2026-10'); const before = await raw(page);
      const review = planner(page).getByRole('button', { name: 'Revisar arrastre de Comida ficticia', exact: true }); await review.click();
      const dialog = page.getByRole('dialog', { name: 'Confirmar operación de planificación', exact: true }); await dialog.waitFor();
      for (let i = 0; i < 5; i++) { await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab'); assert.ok(await dialog.evaluate(el => el.contains(document.activeElement))); }
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); assert.equal(await review.evaluate(el => el === document.activeElement), true);
      await page.getByText('Gráficos de Planificación', { exact: true }).click(); await page.getByLabel('Agrupar comparación', { exact: true }).selectOption('partida');
      await field(page, 'Previsto GASTO Comida ficticia').fill('210'); assert.equal(await review.isDisabled(), true);
      await page.setViewportSize({ width: 390, height: 844 }); await noOverflow(page);
      assert.equal(await field(page, 'Previsto GASTO Comida ficticia').inputValue(), '210'); assert.equal(await page.getByLabel('Agrupar comparación', { exact: true }).inputValue(), 'partida');
      await page.setViewportSize({ width: 1920, height: 1000 }); await noOverflow(page); assert.equal(await field(page, 'Previsto GASTO Comida ficticia').inputValue(), '210');
      assert.deepEqual(await raw(page), before);
    } finally { await s.close(); }
  });
});

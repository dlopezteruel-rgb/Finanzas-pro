import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { DATA_KEY, makeBackup } from '../src/utils/backup';
import { visualFixture, VISUAL_TIME } from './visualFixture';
import { navigateModule } from './browserNavigation';
import { textContrast } from './presentationChecks';

test('experiencia visual: rutas, carga real, móvil y protección de datos', { timeout: 180000 }, async t => {
  const app = express(); app.use(express.static(path.resolve('dist'))); app.get('*', (_q, r) => r.sendFile(path.resolve('dist/index.html')));
  const server = await new Promise<ReturnType<typeof app.listen>>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, env: { PATH: process.env.PATH!, LANG: 'es_ES.UTF-8', TZ: 'Europe/Madrid' }, args: ['--no-sandbox', '--disable-background-networking', '--disable-sync'] });
  t.after(async () => { await browser.close(); await new Promise<void>(r => server.close(() => r())); });
  async function setup({ width = 390, theme = 'light' as 'light' | 'dark', raw = JSON.stringify(makeBackup(visualFixture(theme))), hold = undefined as Promise<void> | undefined, blockedStorage = false } = {}) {
    const c = await browser.newContext({ viewport: { width, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: true });
    const errors: string[] = [], external: string[] = [], requests: string[] = [];
    await c.route('**/*', async route => {
      const u = new URL(route.request().url()); requests.push(u.pathname);
      if (u.origin !== origin || u.pathname.startsWith('/api/')) { external.push(u.origin); await route.abort(); return; }
      if (hold && /\/assets\/App-[^/]+\.js$/.test(u.pathname)) await hold;
      await route.continue();
    });
    await c.addInitScript(({ key, raw, blockedStorage }) => {
      (window as any).__name = (fn: unknown) => fn;
      const storage = localStorage; if (storage.getItem(key) === null) storage.setItem(key, raw);
      (window as any).visualReads = 0; (window as any).visualWrites = 0;
      const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
      (window as any).visualRaw = () => get.call(storage, key);
      Storage.prototype.getItem = function(k) { if (k === key) (window as any).visualReads++; return get.call(this, k); };
      Storage.prototype.setItem = function(k, v) { (window as any).visualWrites++; return set.call(this, k, v); };
      if (blockedStorage) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Almacenamiento ficticio no disponible', 'SecurityError'); } });
    }, { key: DATA_KEY, raw, blockedStorage });
    const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.clock.setFixedTime(new Date(VISUAL_TIME)); p.setDefaultTimeout(8000);
    return { c, p, errors, external, requests, close: async () => { await c.close(); assert.deepEqual(errors, []); assert.deepEqual(external, []); } };
  }
  const saved = (p: any) => p.evaluate(() => (window as any).visualRaw());

  await t.test('landing no lee finanzas ni carga el módulo financiero; Abrir conserva el origen y el JSON 3.1', async () => {
    const s = await setup(); const { p } = s;
    try {
      await p.goto(origin, { waitUntil: 'networkidle' });
      await p.getByRole('heading', { name: 'Entiende tu dinero. Decide con tranquilidad.', exact: true }).waitFor();
      assert.equal(await p.locator('article').count(), 3); assert.equal(await p.evaluate(() => (window as any).visualReads), 0);
      assert.equal(s.requests.some(u => /\/App-[^/]+\.js$/.test(u)), false);
      assert.equal(await p.locator('.landing-preview img').evaluate(i => (i as HTMLImageElement).naturalWidth > 0), true);
      const before = await saved(p);
      await p.getByRole('link', { name: 'Abrir FinanZas', exact: true }).first().click();
      await p.waitForURL(`${origin}/app`); await p.getByLabel('Seleccionar periodo contable').waitFor();
      assert.equal(await saved(p), before); assert.equal(JSON.parse(before!).version, '3.1');
      assert.equal(await p.evaluate(() => (window as any).visualWrites), 0);
    } finally { await s.close(); }
  });

  for (const width of [390, 1440]) await t.test(`splash durante descarga real y navegación posterior segura (${width}px)`, async () => {
    let release!: () => void; const hold = new Promise<void>(resolve => { release = resolve; });
    const s = await setup({ hold, width });
    try {
      await s.p.goto(`${origin}/app`, { waitUntil: 'domcontentloaded' });
      const splash = s.p.getByRole('status').filter({ hasText: 'Preparando FinanZas' }); await splash.waitFor();
      assert.equal(await splash.locator('img').isVisible(), true);
      assert.equal(await splash.locator('.loading-line').evaluate(el => getComputedStyle(el).animationName), 'none');
      release(); await navigateModule(s.p, 'Contactos'); await s.p.getByLabel('Seleccionar periodo contable').waitFor(); await splash.waitFor({ state: 'hidden' });
      assert.equal(await s.p.evaluate(() => (window as any).visualWrites), 0);
    } finally { release(); await s.close(); }
  });

  for (const theme of ['light', 'dark'] as const) await t.test(`cinco destinos, Más accesible, siete módulos y consulta sin escrituras (${theme})`, async () => {
    const s = await setup({ theme }); const { p } = s;
    try {
      await p.goto(`${origin}/app`); await p.getByLabel('Seleccionar periodo contable').waitFor(); const before = await saved(p);
      const nav = p.getByRole('navigation', { name: 'Navegación principal' }).filter({ visible: true });
      assert.equal(await nav.getByRole('button').count(), 5);
      const more = nav.getByRole('button', { name: 'Más', exact: true }); await more.click();
      const d = p.getByRole('dialog', { name: 'Más opciones', exact: true }); await d.waitFor();
      assert.equal(await d.getByRole('button').count(), 4); await p.keyboard.press('Tab');
      assert.equal(await d.evaluate(el => el.contains(document.activeElement)), true);
      await p.keyboard.press('Escape'); await d.waitFor({ state: 'hidden' }); assert.equal(await more.evaluate(el => el === document.activeElement), true);
      for (const label of ['Contactos', 'Deudas', 'Asistente', 'Inicio', 'Movimientos', 'Presupuestos', 'Cuentas']) await navigateModule(p, label);
      assert.equal(await saved(p), before); assert.equal(await p.evaluate(() => (window as any).visualWrites), 0);
      const labels = await nav.locator('.nav-button > span:not(.nav-badge)').evaluateAll(elements => elements.map(el => parseFloat(getComputedStyle(el).fontSize)));
      assert.ok(labels.every(size => size >= 12));
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    } finally { await s.close(); }
  });

  await t.test('Más respeta la guardia y las opciones seguir editando/descartar sin mutación', async () => {
    const s = await setup(); const { p } = s;
    try {
      await p.goto(`${origin}/app`); await p.getByLabel('Seleccionar periodo contable').waitFor(); const before = await saved(p);
      await navigateModule(p, 'Presupuestos'); const savings = p.getByLabel('Ahorro objetivo (€)', { exact: true }); await savings.fill('600');
      await navigateModule(p, 'Contactos'); const guard = p.getByRole('dialog', { name: 'Cambios de planificación sin guardar', exact: true }); await guard.waitFor();
      await guard.getByRole('button', { name: 'Seguir editando', exact: true }).click(); await guard.waitFor({ state: 'hidden' });
      assert.equal(await savings.inputValue(), '600'); assert.equal(await p.locator('main[data-module]').getAttribute('data-module'), 'budgets');
      await navigateModule(p, 'Contactos'); await guard.getByRole('button', { name: 'Descartar y continuar', exact: true }).click(); await guard.waitFor({ state: 'hidden' });
      assert.equal(await p.locator('main[data-module]').getAttribute('data-module'), 'contacts'); assert.equal(await saved(p), before);
      assert.equal(await p.getByRole('navigation').getByRole('button', { name: 'Más', exact: true }).getAttribute('aria-current'), 'page');
    } finally { await s.close(); }
  });

  await t.test('JSON inválido conserva datos originales y ofrece descarga segura, sin mostrar demo', async () => {
    const raw = '{"version":"3.1","fixture_invalida":true}'; const s = await setup({ raw }); const { p } = s;
    try {
      await p.goto(`${origin}/app`); await p.getByRole('alert').filter({ hasText: 'No se han podido cargar' }).waitFor();
      assert.equal(await p.getByLabel('Seleccionar periodo contable').count(), 0); assert.equal(await saved(p), raw);
      const event = p.waitForEvent('download'); await p.getByRole('button', { name: 'Descargar datos locales sin modificar', exact: true }).click();
      const download = await event, file = await download.path(); assert.ok(file);
      assert.equal(JSON.parse(await readFile(file, 'utf8'))[DATA_KEY], raw);
      assert.equal(await p.evaluate(() => (window as any).visualWrites), 0);
    } finally { await s.close(); }
  });

  await t.test('storage no disponible sale a recuperación sin sobrescribir ni permitir edición', async () => {
    const s = await setup({ blockedStorage: true });
    try {
      await s.p.goto(`${origin}/app`); await s.p.getByRole('alert').filter({ hasText: 'No se han podido cargar' }).waitFor();
      assert.equal(await s.p.getByRole('navigation').count(), 0); assert.equal(await s.p.evaluate(() => (window as any).visualWrites), 0);
      await s.p.getByRole('button', { name: 'Descargar datos locales sin modificar', exact: true }).click();
      await s.p.getByRole('alert').filter({ hasText: 'El navegador no permite leer' }).waitFor();
      assert.equal(JSON.parse((await saved(s.p))!).version, '3.1');
    } finally { await s.close(); }
  });

  await t.test('320 px conserva navegación y formularios sin desbordamiento horizontal global', async () => {
    const s = await setup({ width: 320 });
    try {
      await s.p.goto(`${origin}/app`); await s.p.getByLabel('Seleccionar periodo contable').waitFor();
      for (const label of ['Inicio', 'Movimientos', 'Presupuestos', 'Cuentas', 'Contactos', 'Deudas', 'Asistente']) {
        await navigateModule(s.p, label); assert.equal(await s.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, label);
      }
    } finally { await s.close(); }
  });

  for (const theme of ['light', 'dark'] as const) await t.test(`contraste AA en controles de periodo, navegación y acción principal (${theme})`, async () => {
    const s = await setup({ theme }); const { p } = s;
    try {
      await p.goto(`${origin}/app`); await p.getByLabel('Seleccionar periodo contable').waitFor();
      const previous = p.getByRole('button', { name: 'Mes anterior', exact: true });
      const nav = p.getByRole('navigation', { name: 'Navegación principal' }).filter({ visible: true });
      const selected = nav.getByRole('button', { name: 'Inicio', exact: true }).locator('span').first();
      const normal = nav.getByRole('button', { name: 'Cuentas', exact: true }).locator('span').first();
      for (const target of [previous, selected, normal]) assert.ok(await textContrast(target) >= 4.5);
      await previous.focus(); assert.equal(await previous.evaluate(el => getComputedStyle(el).outlineWidth), '3px');
      await navigateModule(p, 'Contactos'); const create = p.getByRole('button', { name: 'Nuevo Contacto', exact: true }).locator('span');
      const ratio = await textContrast(create); assert.ok(ratio >= 4.5, `Acción principal: ${ratio}`);
      await navigateModule(p, 'Cuentas');
      assert.equal(await p.locator('.wallet-initials').count(), 3);
      for (const initials of await p.locator('.wallet-initials').all()) assert.ok(await textContrast(initials) >= 4.5);
      await p.getByRole('button', { name: 'Editar cuenta y patrimonio CUENTA PRINCIPAL FICTICIA', exact: true }).click();
      const walletDialog = p.getByRole('dialog', { name: 'Cartera', exact: true }); await walletDialog.waitFor();
      assert.ok(await textContrast(walletDialog.locator('.wallet-initials')) >= 4.5);
      await p.keyboard.press('Escape'); await walletDialog.waitFor({ state: 'hidden' });
      await navigateModule(p, 'Presupuestos');
      assert.ok(await p.locator('.planning-base-label').count() > 0);
      for (const label of await p.locator('.planning-base-label').all()) assert.ok(await textContrast(label) >= 4.5);
      console.log(`Contraste acción principal ${theme}: ${ratio.toFixed(2)}:1`);
    } finally { await s.close(); }
  });
});

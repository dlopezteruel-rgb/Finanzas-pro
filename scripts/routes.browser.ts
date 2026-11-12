import {catalogClassificationFixture} from './catalogClassificationFixture';
import {editCatalog} from '../src/utils/budgetCatalog';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium } from 'playwright-core';
import { DATA_KEY, makeBackup } from '../src/utils/backup';
import { visualFixture, VISUAL_TIME } from './visualFixture';
import { navigateModule } from './browserNavigation';

// Exercise the real Express/Vite server, including a host that preserves a URL prefix.
test('integración: rutas reales en desarrollo, producción y previsualización con prefijo', { timeout: 240000 }, async t => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox', '--disable-background-networking'] });
  t.after(() => browser.close());
  const build = (base: string) => execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
    env: { ...process.env, APP_BASE_PATH: base, GEMINI_API_KEY: '', GOOGLE_API_KEY: '' }, stdio: 'pipe', timeout: 60000,
  });
  const bases = process.env.ROUTES_PREFIX_ONLY ? ['/preview/finanzas/'] : ['/', '/preview/finanzas/'];
  try {
    for (const base of bases) {
      build(base);
      for (const mode of ['production', 'development']) await t.test(`${mode}: ${base} landing, app, recursos, API local y almacenamiento`, async () => {
        const listener = createServer(); await new Promise<void>(r => listener.listen(0, '127.0.0.1', r));
        const port = (listener.address() as { port: number }).port; await new Promise<void>(r => listener.close(() => r()));
        const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
          env: { ...process.env, NODE_ENV: mode, PORT: String(port), APP_BASE_PATH: base, DISABLE_HMR: 'true', GEMINI_API_KEY: '', GOOGLE_API_KEY: '' }, stdio: 'pipe',
        });
        let log = ''; server.stdout.on('data', c => log += c); server.stderr.on('data', c => log += c);
        const origin = `http://127.0.0.1:${port}`, home = origin + base;
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: 'block', acceptDownloads: true });
        const errors: string[] = [], external: string[] = [], api: string[] = [], failures: string[] = [];
        const backup = JSON.stringify({ ...makeBackup(visualFixture()), exportedAt: VISUAL_TIME });
        await context.route('**/*', route => {
          const u = new URL(route.request().url());
          if (u.origin !== origin) { external.push(u.origin); return route.abort(); }
          if (route.request().method() === 'POST') api.push(u.pathname);
          return route.continue();
        });
        await context.addInitScript(({ key, value }) => {
          if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
          (window as any).routeWrites = 0;
          const set = Storage.prototype.setItem;
          Storage.prototype.setItem = function(k, v) { (window as any).routeWrites++; return set.call(this, k, v); };
        }, { key: DATA_KEY, value: backup });
        const page = await context.newPage(); page.setDefaultTimeout(10000);
        page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        page.on('response', r => { if (r.status() >= 400) failures.push(`${r.status()} ${new URL(r.url()).pathname}`); });
        await page.clock.setFixedTime(new Date(VISUAL_TIME));
        try {
          let ready = false;
          for (let i = 0; i < 100; i++) {
            if (server.exitCode !== null) throw new Error(log);
            try { if ((await fetch(home)).ok) { ready = true; break; } } catch {}
            await new Promise(r => setTimeout(r, 100));
          }
          assert.ok(ready, log);
          if (base !== '/') {
            const redirect = await fetch(origin + base.slice(0, -1), { redirect: 'manual' });
            assert.ok([301, 302, 307, 308].includes(redirect.status));
            assert.equal(new URL(redirect.headers.get('location')!, origin).href, home);
          }
          await page.goto(home, { waitUntil: 'networkidle' });
          await page.getByRole('heading', { name: 'Entiende tu dinero. Decide con tranquilidad.', exact: true }).waitFor();
          const open = page.getByRole('link', { name: 'Abrir FinanZas', exact: true }).first();
          assert.equal(await open.getAttribute('href'), base + 'app', 'el enlace debe conservar el prefijo del host');
          assert.ok(await page.locator('.brand img').first().evaluate(e => (e as HTMLImageElement).naturalWidth > 0));
          assert.ok(await page.locator('.landing-preview img').evaluate(e => (e as HTMLImageElement).naturalWidth > 0));
          await open.click(); await page.waitForURL(home + 'app');
          await page.getByLabel('Seleccionar periodo contable').waitFor();
          assert.equal(await page.evaluate(() => location.origin), origin);
          assert.equal(await page.evaluate(k => localStorage.getItem(k), DATA_KEY), backup);
          await page.reload(); await page.getByLabel('Seleccionar periodo contable').waitFor();
          assert.equal(await page.evaluate(k => localStorage.getItem(k), DATA_KEY), backup);
          for (const module of ['Movimientos', 'Presupuestos', 'Cuentas', 'Contactos', 'Deudas', 'Asistente', 'Inicio']) await navigateModule(page, module);
          await navigateModule(page, 'Asistente');
          await page.getByRole('textbox', { name: 'Mensaje para el asistente' }).fill('Dame orientación general');
          const response = page.waitForResponse(r => r.request().method() === 'POST');
          await page.getByRole('button', { name: 'Enviar', exact: true }).click();
          const result = await response; assert.equal(result.status(), 200); assert.equal((await result.json()).success, true);
          assert.deepEqual(api, [base + 'api/assistant-chat']);
          const parsed = await context.request.post(home + 'api/parse-movement', { data: { text: 'Ejemplo ficticio de prueba', referenceDate: '2026-11-11' } });
          assert.equal(parsed.status(), 200); assert.deepEqual(await parsed.json(), { success: false, fallback: true });
          assert.equal(await page.evaluate(k => localStorage.getItem(k), DATA_KEY), backup);
          const custom=catalogClassificationFixture();const actual=await context.request.post(home+'api/parse-movement',{data:{text:'Gasté 12 en kayak azul',referenceDate:'2026-11-11',budgetGroups:custom.budgetGroups}});assert.equal(actual.status(),200);assert.equal((await actual.json()).parsed.code,'partida-ticket');
          const archived=editCatalog(custom,{kind:'archiveFamily',code:'family-travel',archived:true});const unavailable=await context.request.post(home+'api/parse-movement',{data:{text:'Gasté 12 en kayak azul',referenceDate:'2026-11-11',budgetGroups:archived.budgetGroups}});assert.equal((await unavailable.json()).parsed.code,'');
          assert.equal(await page.evaluate(() => (window as any).routeWrites), 0);
          await page.goto(home + 'app/?vista=ficticia#resumen'); await page.getByLabel('Seleccionar periodo contable').waitFor();
          assert.equal(await page.evaluate(k => localStorage.getItem(k), DATA_KEY), backup);
          await page.goto(home); await open.waitFor(); await open.click(); await page.getByLabel('Seleccionar periodo contable').waitFor();
          assert.equal(await page.evaluate(k => localStorage.getItem(k), DATA_KEY), backup);
          // A deliberately invalid fixture must retain the recovery exit within this host prefix.
          const invalid = '{"version":"3.1","ficticio_invalido":true}';
          await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: DATA_KEY, value: invalid });
          await page.reload(); await page.getByRole('alert').filter({ hasText: 'No se han podido cargar' }).waitFor();
          assert.equal(await page.evaluate(k => localStorage.getItem(k), DATA_KEY), invalid);
          assert.equal(await page.evaluate(() => (window as any).routeWrites), 0);
          const back = page.getByRole('link', { name: 'Volver a la presentación', exact: true });
          assert.equal(await back.getAttribute('href'), base); await back.click(); await open.waitFor();
          assert.equal(await page.evaluate(k => localStorage.getItem(k), DATA_KEY), invalid);
          assert.deepEqual(failures, []); assert.deepEqual(errors, []); assert.deepEqual(external, []);
        } finally {
          await context.close(); server.kill();
          if (server.exitCode === null) await new Promise<void>(resolve => server.once('exit', () => resolve()));
        }
      });
    }
  } finally { build('/'); }
});

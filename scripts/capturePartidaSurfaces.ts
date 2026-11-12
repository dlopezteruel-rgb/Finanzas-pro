import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import express from 'express';
import { chromium, type Locator } from 'playwright-core';
import { DATA_KEY, makeBackup } from '../src/utils/backup';
import { visualFixture, VISUAL_TIME } from './visualFixture';
import { navigateModule } from './browserNavigation';
import { textContrast } from './presentationChecks';

const option = (name: string) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const stage = option('stage');
assert.ok(stage === 'before' || stage === 'after', 'Indica --stage=before o --stage=after');
const dist = path.resolve(option('dist') ?? 'dist');
const output = path.resolve(option('output') ?? `docs/assets/partida-surfaces/${stage}`);
await mkdir(output, { recursive: true });
const app = express(); app.use(express.static(dist)); app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
const server = await new Promise<ReturnType<typeof app.listen>>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-sync'] });
const captures: Record<string, unknown>[] = [];
const geometry = (target: Locator) => target.evaluate(el => {
  const style = getComputedStyle(el), rect = el.getBoundingClientRect();
  return { width: rect.width, height: rect.height, radius: style.borderRadius, border: style.borderColor, borderWidth: style.borderWidth, background: style.backgroundColor };
});
try {
  for (const theme of ['light', 'dark'] as const) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', reducedMotion: 'reduce', colorScheme: theme, serviceWorkers: 'block' });
    const errors: string[] = [], blocked: string[] = [];
    try {
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin || url.pathname.startsWith('/api/')) { blocked.push(url.pathname); return route.abort(); }
        return route.continue();
      });
      await context.addInitScript(({ key, value }) => {
        (window as any).__name = (fn: unknown) => fn;
        localStorage.setItem(key, value); (window as any).surfaceWrites = 0;
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function(k, v) { (window as any).surfaceWrites++; return set.call(this, k, v); };
      }, { key: DATA_KEY, value: JSON.stringify({ ...makeBackup(visualFixture(theme)), exportedAt: VISUAL_TIME }) });
      const page = await context.newPage(); page.setDefaultTimeout(10000);
      page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.clock.setFixedTime(new Date(VISUAL_TIME)); await page.goto(`${origin}/app`, { waitUntil: 'networkidle' });
      await navigateModule(page, 'Presupuestos');
      const saved = await page.evaluate(key => localStorage.getItem(key), DATA_KEY);
      const expense = visualFixture(theme).budgetGroups.find(group => group.type === 'GASTO')!.partidas[0];
      const photo = async (name: string, target: Locator, extra: Record<string, unknown> = {}) => {
        const file = `${theme}-${name}.jpg`;
        await target.evaluate((el, offset) => window.scrollTo({ top: scrollY + el.getBoundingClientRect().top - offset, behavior: 'instant' }), name === 'planificacion' ? 320 : 144);
        await page.screenshot({ path: path.join(output, file), type: 'jpeg', quality: 85, animations: 'disabled' });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false); assert.equal(await page.evaluate(key => localStorage.getItem(key), DATA_KEY), saved);
        assert.equal(await page.evaluate(() => (window as any).surfaceWrites), 0);
        captures.push({ file, theme, view: name, frame: await geometry(target), overflow, ...extra });
      };
      const planner = page.getByRole('region', { name: 'Planificación financiera', exact: true });
      const planRow = planner.locator('.planning-row').filter({ has: page.getByRole('textbox', { name: `Previsto GASTO ${expense.name}`, exact: true }) });
      await photo('planificacion', planRow, { textContrast: await textContrast(planRow.locator('label')) });
      await page.getByRole('tab', { name: 'Catálogo y detalle de partidas', exact: true }).click();
      for (const type of ['Gastos', 'Ingresos']) {
        await page.getByRole('button', { name: new RegExp(`^Paquetes de ${type}`) }).click();
        const frame = page.locator('.catalog-families > div').first();
        const inner = frame.locator(':scope > div').last(), row = inner.locator(':scope > div').first();
        const open = row.getByRole('button', { name: /^Ver partida / });
        const contrast = await textContrast(open.locator('span.block'));
        const controls = await Promise.all((await row.getByRole('button', { name: /^(Duplicar partida|Mover de paquete)/ }).all()).map(textContrast));
        const states = await Promise.all((await row.locator('[class~="text-emerald-400"], [class~="text-amber-300"], [class~="text-rose-400"]').all()).map(textContrast));
        if (stage === 'after') { assert.ok(contrast >= 4.5); assert.ok(controls.length === 2 && controls.every(value => value >= 4.5)); assert.ok(states.length > 0 && states.every(value => value >= 4.5)); }
        await photo(`catalogo-${type.toLowerCase()}`, frame.locator('.catalog-family-toggle'), { inner: await geometry(inner), textContrast: contrast, controlContrasts: controls, stateContrasts: states, cardFrame: await geometry(frame) });
      }
      await page.getByRole('button', { name: /^Paquetes de Gastos/ }).click();
      await page.getByRole('button', { name: `Ver partida ${expense.name}`, exact: true }).click();
      const detail = page.getByRole('dialog', { name: 'Detalle de partida', exact: true }); await detail.waitFor();
      const detailFile = `${theme}-detalle.jpg`; await page.screenshot({ path: path.join(output, detailFile), type: 'jpeg', quality: 85, animations: 'disabled' });
      captures.push({ file: detailFile, theme, view: 'detalle', frame: await geometry(detail), textContrast: await textContrast(detail.locator('h2')) });
      await page.keyboard.press('Escape'); await detail.waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(key => localStorage.getItem(key), DATA_KEY), saved);
      assert.equal(await page.evaluate(() => (window as any).surfaceWrites), 0);
      assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
    } finally { await context.close(); }
  }
  const index = await readFile(path.join(dist, 'index.html'), 'utf8');
  const css = index.match(/href="([^"]+\.css)"/)![1];
  await writeFile(path.join(output, 'measurements.json'), JSON.stringify({ stage, sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), viewport: { width: 390, height: 844 }, clock: VISUAL_TIME,
    stylesheetSha256: createHash('sha256').update(await readFile(path.join(dist, css))).digest('hex'), fixturesOnly: true, storageWrites: 0, consoleErrors: 0, externalRequests: 0, captures }, null, 2) + '\n');
  console.log(`${stage}: ${captures.length} capturas reales, sin escrituras ni errores.`);
} finally { await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); }

import express from 'express';
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { DATA_KEY, makeBackup } from '../src/utils/backup';
import { visualFixture, VISUAL_TIME } from './visualFixture';

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const output = path.resolve(arg('output') ?? 'docs/assets/visual-ux/after');
const dist = path.resolve(arg('dist') ?? 'dist');
await mkdir(output, { recursive: true });
const app = express(); app.use(express.static(dist)); app.get('*', (_q, r) => r.sendFile(path.join(dist, 'index.html')));
const server = await new Promise<ReturnType<typeof app.listen>>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, env: { PATH: process.env.PATH!, LANG: 'es_ES.UTF-8', TZ: 'Europe/Madrid' }, args: ['--no-sandbox', '--disable-background-networking', '--disable-sync', '--disable-component-update'] });
const captures: unknown[] = [];
try {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark'] as const) {
    const c = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', colorScheme: theme, serviceWorkers: 'block' });
    const errors: string[] = [], external: string[] = [];
    await c.route('**/*', route => { const u = new URL(route.request().url()); if (u.origin !== origin || u.pathname.startsWith('/api/')) { external.push(u.origin); return route.abort(); } return route.continue(); });
    await c.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: DATA_KEY, value: JSON.stringify({ ...makeBackup(visualFixture(theme)), exportedAt: VISUAL_TIME }) });
    const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.clock.setFixedTime(new Date(VISUAL_TIME)); await p.goto(`${origin}/app`, { waitUntil: 'networkidle' }); await p.getByLabel('Seleccionar periodo contable', { exact: true }).waitFor();
    const before = await p.evaluate(k => localStorage.getItem(k), DATA_KEY);
    for (const [label, slug] of [['Inicio', 'inicio'], ['Movimientos', 'movimientos'], ['Presupuestos', 'planificacion']]) {
      await p.getByRole('navigation', { name: 'Navegación principal' }).filter({ visible: true }).getByRole('button', { name: new RegExp(`^(?:\\d+\\s*)?${label}(?:\\s*\\d+)?$`) }).click();
      await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(100);
      const file = `${width}-${theme}-${slug}.jpg`;
      await p.screenshot({ path: path.join(output, file), type: 'jpeg', quality: 80 });
      const layout = await p.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert.ok(layout.scrollWidth <= width + 1, `${file}: desbordamiento global`);
      captures.push({ file, viewport: { width, height: width === 390 ? 844 : 900 }, theme, module: label, financialSnapshotUnchanged: true, ...layout });
    }
    assert.equal(await p.evaluate(k => localStorage.getItem(k), DATA_KEY), before); assert.deepEqual(errors, []); assert.deepEqual(external, []); await c.close();
  }
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ fixture: 'visualFixture JSON 3.1; exclusivamente ficticia', clock: VISUAL_TIME,
    applicationBase: '66a045e17e310527c790a15ff2fe5dceaaba48a3', sourceHeadAtCapture: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceUncommittedAtCapture: Boolean(execFileSync('git', ['status', '--porcelain', '--', 'src', 'scripts', 'index.html', 'resources', 'public'], { encoding: 'utf8' }).trim()), captures }, null, 2) + '\n');
  console.log('12 capturas reales; sin escrituras, errores ni solicitudes externas.');
} finally { await browser.close(); await new Promise<void>(r => server.close(() => r())); }

import {chooseMovementPartida} from './browserNavigation';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright-core';
import { BUDGET_GROUPS } from '../src/constants/categories';
import { DATA_KEY, type FinanceData, makeBackup, RECOVERY_PREFIX } from '../src/utils/backup';
import { saveSettlement, splitExactly } from '../src/utils/sharedExpenses';
import { STORAGE_LOCK } from '../src/utils/financeStore';
import { transferPair } from '../src/utils/transfers';
import { partidaCatalog } from '../src/utils/partidaSearch';
import type { Transaction } from '../src/types/finance';

const base = (): FinanceData => ({ theme: 'dark', budgetGroups: structuredClone(BUDGET_GROUPS), budgetPlans: [], loans: [], transactions: [],
  contacts: [{ id: 'ana', name: 'Ana', createdAt: '2026-01-01' }, { id: 'bea', name: 'Bea', createdAt: '2026-01-01' }],
  wallets: [{ id: 'bank', name: 'OPENBANK', type: 'BANK', color: '#fff', initialBalance: 1000 }, { id: 'rev', name: 'REVOLUT', type: 'NEOBANK', color: '#fff', initialBalance: 100 }] });
const shared = (): Transaction => ({ id: 'shared', date: '2026-10-08', amount: 60, type: 'GASTO', code: 'V.001.002', categoryName: 'Alimentación', subcategoryName: 'Comer fuera', description: 'Cena de prueba', wallet: 'OPENBANK', processed: true, splitInfo: splitExactly(60, base().contacts, 'bank') });
const normal = (): Transaction => ({ ...shared(), id: 'normal', splitInfo: undefined, amount: 12, description: 'Compra de prueba' });
function withCash(): FinanceData {
  let d: FinanceData = { ...base(), transactions: [shared(), normal()] };
  d = saveSettlement(d, { expenseId: 'shared', contactId: 'ana', amount: 10, date: '2026-10-09', kind: 'cash', processed: true, walletId: 'rev' });
  d = saveSettlement(d, { expenseId: 'shared', contactId: 'bea', amount: 5, date: '2026-10-10', kind: 'offset', processed: true });
  return saveSettlement(d, { expenseId: 'shared', contactId: 'bea', amount: 7, date: '2026-10-11', kind: 'cash', processed: false, walletId: 'bank' });
}
const navigate = (page: Page, name: string) => page.getByRole('button', { name: new RegExp('^(?:\\d+\\s*)?' + name + '(?:\\s*\\d+)?$') }).first().click();
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), DATA_KEY);
const data = async (page: Page) => JSON.parse((await raw(page))!) as FinanceData;
const editor = (page: Page) => page.getByRole('dialog', { name: 'Movimiento', exact: true });
const panel = (page: Page) => page.getByRole('dialog', { name: 'Detalle de partida', exact: true });

async function assertTop(page: Page, name: string) {
  const dialog = page.getByRole('dialog', { name, exact: true }); await dialog.waitFor();
  assert.equal(await page.getByRole('dialog').count(), 1, 'solo la ventana superior es accesible');
  assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true, 'el foco pertenece a la ventana superior');
  assert.equal(await dialog.evaluate(el => {
    const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!hit && el.contains(hit);
  }), true, 'la ventana superior recibe el hit test, sin quedar oculta por el panel');
  assert.equal(await page.locator('#root').evaluate(el => (el as HTMLElement).inert), true);
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  for (let i = 0; i < 4; i++) { await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab'); assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true); }
  return dialog;
}

test('Ampliación UX 2B: catálogo, modalidades y jerarquía de ventanas', { timeout: 180000 }, async t => {
  const listener = createServer(); await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = (listener.address() as { port: number }).port; await new Promise<void>(resolve => listener.close(() => resolve()));
  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { env: { ...process.env, PORT: String(port), NODE_ENV: 'production' }, stdio: 'pipe' });
  let log = ''; server.stdout.on('data', chunk => { log += chunk; }); server.stderr.on('data', chunk => { log += chunk; }); t.after(() => { server.kill(); });
  const url = `http://127.0.0.1:${port}/app`; let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(log);
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, log);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] }); t.after(() => browser.close());
  async function setup(initial: FinanceData, mobile = false) {
    const context = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 1000 } });
    await context.addInitScript(({ key, value }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, value); }, { key: DATA_KEY, value: JSON.stringify(makeBackup(initial)) });
    const page = await context.newPage(); page.setDefaultTimeout(7000); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.clock.setFixedTime(new Date('2026-10-31T12:00:00Z')); await page.goto(url); return { page, close: async () => { await context.close(); assert.deepEqual(errors, []); }, context };
  }
  async function openPanel(page: Page, code = 'V.001.002', income = false) {
    await navigate(page, 'Presupuestos');
    await page.getByRole('tab', { name: 'Catálogo y detalle de partidas', exact: true }).click();
    if (income) await page.getByRole('button', { name: /^Paquetes de Ingresos/ }).click();
    const name = base().budgetGroups.flatMap(g => g.partidas).find(p => p.code === code)!.name;
    const opener = page.getByRole('button', { name: `Ver partida ${name}`, exact: true });
    await opener.focus(); await page.keyboard.press('Enter'); await panel(page).waitFor(); return opener;
  }
  async function newShared(page: Page) {
    await navigate(page, 'Añadir'); const d = editor(page);
    await d.getByLabel('Importe Total (€)', { exact: true }).fill('60'); await d.getByLabel('Concepto', { exact: true }).fill('Cena de interfaz');
    await d.getByLabel('Cartera u Origen', { exact: true }).selectOption('OPENBANK');
    await d.getByLabel('Fecha', { exact: true }).fill('2026-10-08'); await d.getByRole('checkbox', { name: 'Gasto compartido', exact: true }).check();
    await chooseMovementPartida(d);return d;
  }

  await t.test('buscador dinámico, cinco recientes reales, familias/grupos, acentos, tipo y teclado', async () => {
    const initial = base(), catalog = partidaCatalog(initial.budgetGroups), expenseCodes = catalog.filter(c => c.partida.type === 'GASTO').slice(0, 7).map(c => c.partida.code);
    initial.transactions = expenseCodes.map((code, i) => ({ ...normal(), id: `recent-${i}`, code, date: `2026-10-${String(10 + i).padStart(2, '0')}` }));
    initial.transactions.push({ ...normal(), id: 'salary', type: 'INGRESO', code: 'L.001.001', date: '2026-10-20' }, ...transferPair(initial.wallets, { fromWalletId: 'bank', toWalletId: 'rev', amount: 500, date: '2026-11-01', concept: 'Traspaso ficticio', processed: true }));
    initial.budgetGroups = initial.budgetGroups.map(g => ({ ...g, partidas: g.partidas.map(p => p.code === 'V.001.002' && p.type === 'GASTO' ? { ...p, name: 'Restauración personalizada' } : p) }));
    const { page, close } = await setup(initial);
    try {
      const before = await raw(page); await navigate(page, 'Añadir'); const d = editor(page);
      await d.getByLabel('Importe Total (€)').fill('12'); await d.getByLabel('Concepto', { exact: true }).fill('Elección por teclado');
      await d.getByLabel('Cartera u Origen', { exact: true }).selectOption('OPENBANK');
      const trigger = d.getByRole('button', { name: 'Seleccionar partida presupuestaria' }); await trigger.click();
      const recents = d.getByLabel('Partidas recientes'); assert.equal(await recents.getByRole('button').count(), 5);
      for (const code of expenseCodes.slice(2)) assert.ok((await recents.innerText()).includes(initial.budgetGroups.flatMap(g => g.partidas).find(p => p.code === code && p.type === 'GASTO')!.name));
      const search = d.getByRole('combobox', { name: 'Buscar partida' }); await search.fill('MÉDICOS');
      const options = d.getByRole('listbox'); assert.equal(await options.getByRole('option').count(), 1); assert.match(await options.innerText(), /Seguro/);
      await search.fill(''); await d.getByLabel('Familia presupuestaria').selectOption('F_EXP');
      const p = catalog.find(c => c.partida.type === 'GASTO' && c.partida.code === 'F.003.001')!.partida;
      await d.getByLabel('Grupo presupuestario').selectOption(`${p.groupCode}:${p.groupName}`); assert.ok((await options.innerText()).includes(p.groupName));
      await d.getByLabel('Familia presupuestaria').selectOption(''); await search.fill('restauracion personalizada');
      assert.equal(await options.getByRole('option').count(), 1); await search.press('ArrowDown'); await search.press('Enter');
      await search.waitFor({ state: 'hidden' }); assert.match(await trigger.innerText(), /Restauración personalizada/);
      assert.equal(await raw(page), before);
      await d.getByRole('button', { name: 'Ingreso', exact: true }).click(); await trigger.click();
      assert.equal(await d.getByLabel('Partidas recientes').getByRole('button').count(), 1); assert.match(await d.getByLabel('Partidas recientes').innerText(), /Nómina/);
      assert.equal((await d.getByRole('listbox').innerText()).includes('V.001.002'), false);
      await d.getByRole('combobox', { name: 'Buscar partida' }).fill('L.001.001'); await d.getByRole('combobox', { name: 'Buscar partida' }).press('Enter'); await d.locator('button[type=submit]').click(); await d.waitFor({ state: 'hidden' });
      const saved = (await data(page)).transactions[0]; assert.equal(saved.type, 'INGRESO'); assert.equal(saved.code, 'L.001.001');
    } finally { await close(); }
  });

  await t.test('participantes automáticos, tres modalidades, alta/baja de contactos y persistencia de pesos/importes', async () => {
    const { page, close } = await setup(base());
    try {
      let d = await newShared(page); assert.equal(await d.getByRole('button', { name: '+', exact: true }).count(), 0); assert.ok(await d.locator('button[type=submit]').isDisabled());
      await d.getByRole('button', { name: 'Ana', exact: true }).click(); assert.match(await d.getByLabel('Parte de Tú', { exact: true }).innerText(), /30,00/); assert.match(await d.innerText(), /Participantes: 2/);
      await d.getByRole('button', { name: 'Bea', exact: true }).click(); assert.match(await d.getByLabel('Parte de Tú', { exact: true }).innerText(), /20,00/); assert.match(await d.innerText(), /Participantes: 3/);
      await d.getByLabel('Modalidad de reparto').selectOption('weighted'); assert.equal(await d.getByLabel('Peso de Ana', { exact: true }).inputValue(), '1');
      await d.getByLabel('Peso de Ana', { exact: true }).fill('2');
      for (const [name, value] of [['Tú', '15,00'], ['Ana', '30,00'], ['Bea', '15,00']]) assert.ok((await d.getByLabel('Parte de ' + name, { exact: true }).innerText()).includes(value));
      for (const name of ['Tú', 'Ana', 'Bea']) await d.getByLabel('Peso de ' + name, { exact: true }).fill('0');
      assert.match(await d.getByRole('alert').innerText(), /mayor que cero/); assert.ok(await d.locator('button[type=submit]').isDisabled());
      await d.getByLabel('Peso de Tú', { exact: true }).fill('1'); await d.getByLabel('Peso de Ana', { exact: true }).fill('-1'); assert.match(await d.getByRole('alert').innerText(), /no negativos/);
      await d.getByLabel('Peso de Ana', { exact: true }).fill('2'); await d.getByLabel('Peso de Bea', { exact: true }).fill('1');
      await d.getByRole('button', { name: 'Bea', exact: true }).click(); assert.match(await d.getByLabel('Parte de Ana', { exact: true }).innerText(), /40,00/);
      await d.getByRole('button', { name: 'Bea', exact: true }).click(); assert.match(await d.getByLabel('Parte de Ana', { exact: true }).innerText(), /30,00/);
      await d.locator('button[type=submit]').click(); await d.waitFor({ state: 'hidden' });
      let saved = await data(page); const id = saved.transactions[0].id, weighted = structuredClone(saved.transactions[0].splitInfo); assert.equal(makeBackup(saved).version, '2.8');
      await page.reload(); await navigate(page, 'Movimientos'); await page.getByRole('button', { name: /^Editar movimiento Cena de interfaz/ }).click(); d = editor(page);
      assert.equal(await d.getByLabel('Modalidad de reparto').inputValue(), 'weighted'); assert.equal(await d.getByLabel('Peso de Ana', { exact: true }).inputValue(), '2');
      await d.getByLabel('Concepto', { exact: true }).fill('Cena editada'); await d.locator('button[type=submit]').click(); await d.waitFor({ state: 'hidden' }); assert.deepEqual((await data(page)).transactions[0].splitInfo, weighted);
      await page.getByRole('button', { name: /^Editar movimiento Cena editada/ }).click(); d = editor(page); await d.getByLabel('Modalidad de reparto').selectOption('amounts');
      assert.equal(await d.getByLabel('Importe de Tú', { exact: true }).inputValue(), '15'); await d.getByLabel('Importe de Ana', { exact: true }).fill('25');
      assert.equal(await d.getByLabel('Importe de Bea', { exact: true }).count(), 0); assert.match(await d.getByLabel('Parte de Bea', { exact: true }).innerText(), /20,00.*Resto automático/);
      await d.getByRole('button', { name: '+ Nuevo Contacto', exact: true }).click(); await d.getByPlaceholder('Nombre del nuevo contacto...').fill('Carla'); await d.getByRole('button', { name: 'Añadir', exact: true }).click();
      await d.getByPlaceholder('Nombre del nuevo contacto...').waitFor({ state: 'hidden' }); assert.equal(await d.getByLabel('Importe de Bea', { exact: true }).inputValue(), '20'); assert.match(await d.getByLabel('Parte de Carla', { exact: true }).innerText(), /0,00/);
      await d.getByLabel('Importe de Tú', { exact: true }).fill('10'); await d.getByRole('button', { name: 'Ana', exact: true }).click(); assert.match(await d.getByLabel('Parte de Carla', { exact: true }).innerText(), /30,00/);
      await d.locator('button[type=submit]').click(); await d.waitFor({ state: 'hidden' }); saved = await data(page); const carla = saved.contacts.find(c => c.name === 'Carla')!;
      assert.deepEqual(saved.transactions[0].splitInfo!.participants.map(p => p.contactId), ['bea', carla.id]); assert.equal(saved.transactions[0].id, id);
      await page.reload(); await navigate(page, 'Movimientos'); await page.getByRole('button', { name: /^Editar movimiento Cena editada/ }).click(); d = editor(page);
      assert.equal(await d.getByLabel('Modalidad de reparto').inputValue(), 'amounts'); assert.equal(await d.getByLabel('Importe de Tú', { exact: true }).inputValue(), '10');
      await d.getByLabel('Importe Total (€)').fill('80'); assert.match(await d.getByLabel('Parte de Carla', { exact: true }).innerText(), /50,00/);
      await d.getByLabel('Importe de Tú', { exact: true }).fill('90'); assert.match(await d.getByRole('alert').innerText(), /superan/); assert.ok(await d.locator('button[type=submit]').isDisabled());
      await d.getByLabel('Importe de Tú', { exact: true }).fill('10'); await d.getByLabel('Modalidad de reparto').selectOption('equal'); await d.getByLabel('Importe Total (€)').fill('100');
      assert.match(await d.getByLabel('Parte de Tú', { exact: true }).innerText(), /33,34/); await d.locator('button[type=submit]').click(); await d.waitFor({ state: 'hidden' });
      saved = await data(page); assert.deepEqual([saved.transactions[0].splitInfo!.myShare, ...saved.transactions[0].splitInfo!.participants.map(p => p.amount)], [33.34, 33.33, 33.33]); assert.equal(saved.transactions[0].splitInfo!.distribution!.method, 'equal');
    } finally { await close(); }
  });

  await t.test('exportar/restaurar JSON 2.8 conserva modalidades, pesos, importes y liquidaciones con copia previa', async () => {
    const initial = withCash();
    const split = initial.transactions.find(t => t.id === 'shared')!.splitInfo!;
    split.distribution = { method: 'weighted', ownWeight: 1, contactWeights: [{ contactId: 'ana', weight: 2 }, { contactId: 'bea', weight: 1 }] };
    split.myShare = 15; split.totalOwedToMe = 45; split.participants[0].amount = 30; split.participants[1].amount = 15;
    initial.transactions.push({ ...shared(), id: 'manual', splitInfo: { ...shared().splitInfo!, distribution: { method: 'amounts' } } });
    const source = await setup(initial), target = await setup(base());
    try {
      const before = await raw(source.page);
      await source.page.getByRole('button', { name: 'Opciones y datos', exact: true }).click();
      const downloaded = source.page.waitForEvent('download');
      await source.page.getByRole('button', { name: 'Exportar JSON', exact: true }).click();
      const file = await downloaded, content = await readFile((await file.path())!, 'utf8');
      assert.equal(JSON.parse(content).version, '2.8'); assert.equal(await raw(source.page), before);
      const original = await raw(target.page);
      await target.page.locator('input[type=file]').setInputFiles({ name: 'ux-2.8.json', mimeType: 'application/json', buffer: Buffer.from(content) });
      const preview = target.page.getByRole('dialog'); await preview.waitFor(); assert.match(await preview.innerText(), /Formato 2.8/); assert.equal(await raw(target.page), original);
      await preview.getByRole('button', { name: 'Confirmar sustitución', exact: true }).click(); await preview.waitFor({ state: 'hidden' });
      assert.deepEqual((await data(target.page)).transactions, JSON.parse(content).transactions);
      assert.equal(await target.page.evaluate(prefix => Object.keys(localStorage).filter(k => k.startsWith(prefix)).length, RECOVERY_PREFIX), 1);
      await target.page.reload(); await navigate(target.page, 'Movimientos'); await target.page.getByRole('button', { name: /^Editar movimiento Cena de prueba/ }).first().click();
      let d = editor(target.page); assert.equal(await d.getByLabel('Modalidad de reparto').inputValue(), 'weighted'); assert.equal(await d.getByLabel('Peso de Ana', { exact: true }).inputValue(), '2');
      await target.page.keyboard.press('Escape'); await target.page.getByRole('button', { name: /^Editar movimiento Cena de prueba/ }).nth(1).click();
      d = editor(target.page); assert.equal(await d.getByLabel('Modalidad de reparto').inputValue(), 'amounts'); assert.equal(await d.getByLabel('Importe de Tú', { exact: true }).inputValue(), '20');
    } finally { await source.close(); await target.close(); }
  });

  for (const mobile of [false, true]) await t.test(`panel → reparto/editor/alta/borrado: hit test, foco, Escape, Tab y scroll (${mobile ? 'móvil' : 'escritorio'})`, async () => {
    const { page, close } = await setup(withCash(), mobile);
    try {
      if (mobile) assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'sin desbordamiento horizontal en móvil');
      const opener = await openPanel(page), p = panel(page); await assertTop(page, 'Detalle de partida');
      const rect = await p.boundingBox(); assert.ok(rect); assert.ok(mobile ? rect.width <= 390 : rect.x > 0);
      assert.equal(await p.locator('xpath=..').evaluate(el => getComputedStyle(el).backdropFilter), 'none');
      const sharedRow = p.locator('[data-movement-id="shared"]'), normalRow = p.locator('[data-movement-id="normal"]');
      assert.match(await sharedRow.innerText(), /Compartido/); assert.match(await sharedRow.innerText(), /Total pagado: 60,00/); assert.match(await sharedRow.innerText(), /Tu gasto: 20,00/);
      const before = await raw(page), view = sharedRow.getByRole('button', { name: 'Ver reparto', exact: true }); await view.click();
      let top = await assertTop(page, 'Reparto del gasto'); assert.equal(await top.locator('input,select,textarea').count(), 0);
      const ana = top.getByRole('region', { name: 'Participante Ana', exact: true }), bea = top.getByRole('region', { name: 'Participante Bea', exact: true });
      assert.match(await ana.innerText(), /Reintegrado: 10,00/); assert.match(await ana.innerText(), /Pendiente de cobro: 10,00/);
      assert.match(await bea.innerText(), /Compensado: 5,00/); assert.match(await bea.innerText(), /Pendiente de cobro: 15,00/); assert.match(await bea.innerText(), /Pendiente de tramitación/);
      assert.ok((await top.innerText()).includes('REVOLUT')); assert.equal(await raw(page), before);
      await page.keyboard.press('Escape'); await p.waitFor(); assert.equal(await view.evaluate(el => el === document.activeElement), true);
      await normalRow.getByRole('button', { name: 'Editar movimiento', exact: true }).click(); top = await assertTop(page, 'Movimiento');
      if (process.env.UX_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.UX_ARTIFACT_DIR}/editor-sobre-panel-${mobile ? 'movil' : 'escritorio'}.png` });
      const layers = await page.locator('[data-overlay-level]').evaluateAll(els => els.map(el => ({ level: el.getAttribute('data-overlay-level'), z: Number(getComputedStyle(el).zIndex), inert: (el as HTMLElement).inert })));
      assert.ok(layers.find(l => l.level === 'dialog')!.z > layers.find(l => l.level === 'panel')!.z); assert.equal(layers.find(l => l.level === 'panel')!.inert, true);
      await top.getByLabel('Concepto', { exact: true }).fill('Borrador conservado'); await top.getByRole('button', { name: 'Seleccionar partida presupuestaria' }).click(); await top.getByRole('combobox', { name: 'Buscar partida' }).fill('restaurante'); await page.keyboard.press('Escape');
      assert.equal(await editor(page).count(), 1); assert.equal(await top.getByLabel('Concepto', { exact: true }).inputValue(), 'Borrador conservado');
      await page.keyboard.press('Escape'); await p.waitFor(); assert.equal(await raw(page), before);
      await normalRow.getByRole('button', { name: 'Editar movimiento', exact: true }).click(); top = editor(page); await top.getByLabel('Concepto', { exact: true }).fill('Normal editado'); await top.locator('button[type=submit]').click(); await top.waitFor({ state: 'hidden' }); assert.match(await normalRow.innerText(), /Normal editado/);
      await p.getByRole('button', { name: 'Añadir a esta partida', exact: true }).click(); top = await assertTop(page, 'Movimiento'); assert.match(await top.getByRole('button', { name: 'Seleccionar partida presupuestaria' }).innerText(), /Comer fuera/);
      await top.getByLabel('Importe Total (€)').fill('10'); await top.getByLabel('Concepto', { exact: true }).fill('Nuevo desde panel'); await top.getByLabel('Cartera u Origen', { exact: true }).selectOption('OPENBANK'); await top.locator('button[type=submit]').click(); await top.waitFor({ state: 'hidden' });
      const added = (await data(page)).transactions.find(t => t.description === 'Nuevo desde panel')!, row = p.locator(`[data-movement-id="${added.id}"]`);
      await row.getByRole('button', { name: 'Eliminar movimiento', exact: true }).click(); top = await assertTop(page, 'Eliminar movimiento'); const unchanged = await raw(page); await top.getByRole('button', { name: 'Cancelar', exact: true }).click(); assert.equal(await raw(page), unchanged);
      await row.getByRole('button', { name: 'Eliminar movimiento', exact: true }).click(); await page.getByRole('button', { name: 'Confirmar eliminación del movimiento', exact: true }).click(); await p.waitFor(); assert.equal((await data(page)).transactions.some(t => t.id === added.id), false);
      assert.equal(await p.evaluate(el => el.contains(document.activeElement)), true, await page.evaluate(() => document.activeElement?.tagName));
      const originalSplit = structuredClone((await data(page)).transactions.find(t => t.id === 'shared')!.splitInfo);
      await sharedRow.getByRole('button', { name: 'Editar movimiento', exact: true }).click(); top = editor(page); assert.equal(await top.getByLabel('Modalidad de reparto').inputValue(), 'amounts');
      await top.getByLabel('Concepto', { exact: true }).fill('Cena revisada'); await top.locator('button[type=submit]').click(); await top.waitFor({ state: 'hidden' }); assert.deepEqual((await data(page)).transactions.find(t => t.id === 'shared')!.splitInfo, originalSplit);
      await sharedRow.getByRole('button', { name: 'Editar movimiento', exact: true }).click(); top = editor(page); await top.getByLabel('Modalidad de reparto').selectOption('weighted'); await top.getByLabel('Peso de Ana', { exact: true }).fill('2');
      const stable = await raw(page); await top.locator('button[type=submit]').click(); await top.getByRole('alert').waitFor(); assert.match(await top.getByRole('alert').innerText(), /liquidaciones/); assert.equal(await top.getByLabel('Peso de Ana', { exact: true }).inputValue(), '2'); assert.equal(await raw(page), stable);
      await page.keyboard.press('Escape'); await p.waitFor(); await page.keyboard.press('Escape'); assert.equal(await panel(page).count(), 0); assert.equal(await page.locator('#root').evaluate(el => (el as HTMLElement).inert), false); assert.equal(await page.evaluate(() => document.body.style.overflow), ''); assert.equal(await opener.evaluate(el => el === document.activeElement), true);
    } finally { await close(); }
  });

  await t.test('histórico sin migrar: etiqueta, presupuesto real, solo datos verificables y ninguna escritura', async () => {
    const d = base(), old = shared(); delete old.splitInfo!.accountingVersion; delete old.splitInfo!.walletId; delete old.splitInfo!.settlements;
    old.splitInfo!.participants[0] = { ...old.splitInfo!.participants[0], isPaid: true, reimbursementTxId: 'missing-receipt', paidDate: '2026-10-09' }; d.transactions = [old];
    const { page, close } = await setup(d);
    try {
      const before = await raw(page); await openPanel(page); const p = panel(page); assert.match(await p.innerText(), /Tu gasto: 60,00/); assert.match(await p.innerText(), /Histórico sin migrar/);
      await p.getByRole('button', { name: 'Ver reparto', exact: true }).click(); const detail = await assertTop(page, 'Reparto del gasto'); assert.match(await detail.innerText(), /Compartido histórico · pendiente de revisión/); assert.match(await detail.innerText(), /missing-receipt · movimiento no disponible/);
      assert.equal(await detail.locator('input,select,textarea').count(), 0); await page.keyboard.press('Escape'); await p.getByRole('button', { name: 'Editar movimiento', exact: true }).click(); await p.getByRole('alert').waitFor(); assert.match(await p.getByRole('alert').innerText(), /migración/);
      assert.equal(await raw(page), before); assert.equal(await page.evaluate(prefix => Object.keys(localStorage).filter(k => k.startsWith(prefix)).length, RECOVERY_PREFIX), 0);
    } finally { await close(); }
  });

  await t.test('añadir desde partida de ingreso conserva código y tipo', async () => {
    const d = base(); d.transactions = [{ ...normal(), type: 'INGRESO', code: 'L.001.001' }]; const { page, close } = await setup(d);
    try {
      await openPanel(page, 'L.001.001', true); await panel(page).getByRole('button', { name: 'Añadir a esta partida' }).click(); const top = await assertTop(page, 'Movimiento');
      assert.equal(await top.getByRole('button', { name: 'Ingreso', exact: true }).getAttribute('aria-pressed'), 'true'); assert.match(await top.getByRole('button', { name: 'Seleccionar partida presupuestaria' }).innerText(), /Nómina/);
      await top.getByLabel('Importe Total (€)').fill('100'); await top.getByLabel('Concepto', { exact: true }).fill('Ingreso desde panel'); await top.getByLabel('Cartera u Origen', { exact: true }).selectOption('OPENBANK'); await top.locator('button[type=submit]').click(); await top.waitFor({ state: 'hidden' });
      const saved = (await data(page)).transactions.find(t => t.description === 'Ingreso desde panel')!; assert.equal(saved.type, 'INGRESO'); assert.equal(saved.code, 'L.001.001');
    } finally { await close(); }
  });

  for (const method of ['weighted', 'amounts']) for (const failure of ['quota', 'conflict']) await t.test(`${method}/${failure}: retiene campos y modo, bloquea Escape y doble envío durante almacenamiento`, async () => {
    const { page, close, context } = await setup({ ...base(), transactions: [shared()] });
    try {
      await navigate(page, 'Movimientos'); await page.getByRole('button', { name: /^Editar movimiento Cena de prueba/ }).click(); const top = editor(page);
      await top.getByLabel('Modalidad de reparto').selectOption(method);
      if (method === 'weighted') await top.getByLabel('Peso de Ana', { exact: true }).fill('2'); else { await top.getByLabel('Importe de Tú', { exact: true }).fill('15'); await top.getByLabel('Importe de Ana', { exact: true }).fill('25'); }
      const fields = () => top.locator('input,select').evaluateAll(els => els.map(e => ({ value: (e as HTMLInputElement).value, checked: (e as HTMLInputElement).checked }))), draft = await fields();
      await page.evaluate(key => { const original = Storage.prototype.setItem; (window as any).uxSave = { fail: false, attempts: 0 }; Storage.prototype.setItem = function(k, v) { if (k === key) { (window as any).uxSave.attempts++; if ((window as any).uxSave.fail) throw new DOMException('Cuota', 'QuotaExceededError'); } return original.call(this, k, v); }; }, DATA_KEY);
      if (failure === 'quota') await page.evaluate(() => { (window as any).uxSave.fail = true; }); else { const other = await context.newPage(); await other.goto(url); const previous = await raw(other); await other.getByRole('button', { name: /Cambiar a modo/ }).click(); await other.waitForFunction(({ key, previous }) => localStorage.getItem(key) !== previous, { key: DATA_KEY, previous }); await other.close(); }
      const before = await raw(page);
      await page.evaluate(lock => { void navigator.locks.request(lock, async () => { (window as any).uxHeld = true; await new Promise<void>(resolve => { (window as any).releaseUx = resolve; }); }); }, STORAGE_LOCK); await page.waitForFunction(() => (window as any).uxHeld);
      await top.locator('form').evaluate(f => { (f as HTMLFormElement).requestSubmit(); f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); await top.locator('fieldset:disabled').waitFor(); await page.keyboard.press('Escape'); assert.equal(await editor(page).count(), 1);
      assert.deepEqual(await fields(), draft); assert.equal(await raw(page), before); await page.evaluate(() => (window as any).releaseUx()); await top.getByRole('alert').waitFor(); assert.match(await top.getByRole('alert').innerText(), failure === 'quota' ? /No hay espacio/ : /Otra pestaña/); assert.deepEqual(await fields(), draft); assert.equal(await raw(page), before);
      if (failure === 'quota') { await page.evaluate(() => { (window as any).uxSave.fail = false; }); await top.locator('button[type=submit]').click(); await top.waitFor({ state: 'hidden' }); assert.equal(await page.evaluate(() => (window as any).uxSave.attempts), 2); assert.equal((await data(page)).transactions[0].splitInfo!.distribution!.method, method); await page.reload(); assert.equal((await data(page)).transactions[0].splitInfo!.distribution!.method, method); }
    } finally { await close(); }
  });
});

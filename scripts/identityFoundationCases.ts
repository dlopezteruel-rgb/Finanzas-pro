import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build} from 'vite';
import {chromium, type Page} from 'playwright-core';
import {DATA_KEY, serializeSnapshot, makeBackup} from '../src/utils/backup';
import {multilingualCatalogFixture} from './multilingualCatalogFixture';

// Executed inside the existing exclusive nativeFoundation suite; all 46 suites stay intact.
// This is a headless architecture harness, not a login UI or native OS validation.
test('7A.1: identity contracts and disposable demo protect existing browser profiles', {timeout: 120000}, async t => {
  const root = path.resolve(process.env.CI_ARTIFACT_DIR ?? 'ci-artifacts'), out = path.join(root, 'identity-contract-preview');
  await mkdir(out, {recursive: true});
  await build({configFile: false, publicDir: false, logLevel: 'silent', build: {outDir: out, emptyOutDir: true, minify: false,
    lib: {entry: path.resolve('scripts/identityContractEntry.ts'), formats: ['es'], fileName: () => 'contract.js'}}});
  const html = '<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>7A.1 isolated contract harness</title></head><body><main><h1>Identity contract tests</h1><p>Fictitious fixtures only. No identity provider is configured.</p></main></body></html>';
  const app = express(); app.get('/contract', (_q, r) => r.type('html').send(html)); app.use('/__identity', express.static(out)); app.use(express.static(path.resolve('dist'))); app.get('*', (_q, r) => r.sendFile(path.resolve('dist/index.html')));
  const server = await new Promise<ReturnType<typeof app.listen>>(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const origin = `http://127.0.0.1:${(server.address() as {port: number}).port}`;
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox']});
  t.after(() => browser.close()); t.after(() => new Promise<void>(r => server.close(() => r())));
  const rows: {name: string; passed: boolean; detail?: unknown}[] = [];
  const source = (await import('node:child_process')).execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
  const workingTreeDirty = (await import('node:child_process')).execFileSync('git', ['status', '--porcelain'], {encoding: 'utf8'}).trim() !== '';
  t.after(async () => { const dir = path.join(root, 'browser'); await mkdir(dir, {recursive: true}); await writeFile(path.join(dir, 'identity-foundation.json'), JSON.stringify({schemaVersion: 1, source, workingTreeDirty, scope: 'Architecture harness plus unchanged production landing; not real login, native credentials or server authorization.', rows}, null, 2) + '\n'); });
  async function context() { const c = await browser.newContext({viewport: {width: 390, height: 900}, serviceWorkers: 'block'}); await c.addInitScript(() => { (window as any).__name = (f: unknown) => f; }); return c; }
  async function load(page: Page) {
    await page.goto(origin + '/contract'); await page.evaluate(async () => { (window as any).contract = await import(/* @vite-ignore */ String('/__identity/contract.js')); });
  }
  async function guard(page: Page) {
    await page.evaluate(async key => {
      const storage = localStorage, get = Storage.prototype.getItem, set = Storage.prototype.setItem, keyAt = Storage.prototype.key;
      const length = Object.getOwnPropertyDescriptor(Storage.prototype, 'length')!.get!;
      const open = indexedDB.open.bind(indexedDB), transaction = IDBDatabase.prototype.transaction;
      const touched: string[] = []; (window as any).__identityTouched = touched;
      async function readCanary() {
        const local: Record<string, string> = {};
        for (let i = 0; i < length.call(storage); i++) { const k = keyAt.call(storage, i)!; if (k.startsWith('finanzas_pro_')) local[k] = get.call(storage, k)!; }
        const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = open('finanzas-pro-web-v1', 1); r.onerror = () => reject(r.error); r.onsuccess = () => resolve(r.result); });
        try { return await new Promise<any>((resolve, reject) => {
          const names = [...db.objectStoreNames], tx = transaction.call(db, names, 'readonly'), records: Record<string, unknown> = {};
          for (const name of names) { const req = tx.objectStore(name).getAll(); req.onsuccess = () => { records[name] = req.result; }; }
          tx.oncomplete = () => resolve({local, records}); tx.onabort = () => reject(tx.error);
        }); } finally { db.close(); }
      }
      (window as any).__readIdentityCanary = readCanary; (window as any).__beforeIdentityCanary = await readCanary();
      Storage.prototype.getItem = function(k) { if (k.startsWith('finanzas_pro_')) { touched.push('storage-read'); throw Error('FORBIDDEN_PROFILE_READ'); } return get.call(this, k); };
      Storage.prototype.setItem = function(k, v) { if (k.startsWith('finanzas_pro_')) { touched.push('storage-write'); throw Error('FORBIDDEN_PROFILE_WRITE'); } return set.call(this, k, v); };
      indexedDB.open = (() => { touched.push('indexeddb-open'); throw Error('FORBIDDEN_DATABASE'); }) as any;
      indexedDB.deleteDatabase = (() => { touched.push('indexeddb-delete'); throw Error('FORBIDDEN_DATABASE'); }) as any;
      IDBDatabase.prototype.transaction = function() { touched.push('database-transaction'); throw Error('FORBIDDEN_DATABASE'); } as any;
      Object.defineProperty(window, 'Capacitor', {configurable: true, get() { touched.push('native-vault-or-bridge'); throw Error('FORBIDDEN_NATIVE'); }});
      window.fetch = (() => { touched.push('remote-fetch'); throw Error('FORBIDDEN_REMOTE'); }) as any;
      navigator.sendBeacon = (() => { touched.push('beacon'); throw Error('FORBIDDEN_REMOTE'); }) as any;
      (window as any).__legacyRawForAssertion = get.call(storage, key);
    }, DATA_KEY);
  }
  await t.test('production build without demo never mounts an identity/demo entry from alternate landing URLs', async () => {
    const c = await context(); try {
      await c.addInitScript(key => { const get = Storage.prototype.getItem, set = Storage.prototype.setItem; set.call(localStorage, key, 'FICTIONAL_LEGACY_CANARY'); (window as any).__reads = []; (window as any).__writes = [];
        Storage.prototype.getItem = function(k) { if (k.startsWith('finanzas_pro_')) (window as any).__reads.push(k); return get.call(this, k); };
        Storage.prototype.setItem = function(k, v) { if (k.startsWith('finanzas_pro_')) (window as any).__writes.push(k); return set.call(this, k, v); };
        (window as any).__originalCanary = () => get.call(localStorage, key);
      }, DATA_KEY);
      const p = await c.newPage(); for (const url of ['/demo', '/demo?enabled=true', '/?demo=true']) {
        await p.goto(origin + url); await p.locator('#landing-language').waitFor(); const result = await p.evaluate(() => ({reads: (window as any).__reads, writes: (window as any).__writes, canary: (window as any).__originalCanary(), demo: !!(window as any).contract}));
        assert.deepEqual(result, {reads: [], writes: [], canary: 'FICTIONAL_LEGACY_CANARY', demo: false});
      }
      rows.push({name: 'production-no-demo-entry', passed: true});
    } finally { await c.close(); }
  });
  await t.test('offline memory demo never opens an existing confirmed IndexedDB profile, local archive or native vault', async () => {
    const c = await context(); const remote: string[] = [], errors: string[] = []; let guarded = false;
    await c.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== origin || guarded && url.pathname.startsWith('/api/')) { remote.push(url.href); return route.abort(); } return route.continue(); });
    try {
      const raw = serializeSnapshot(makeBackup(multilingualCatalogFixture())); await c.addInitScript(({key, raw}) => { if (!sessionStorage.getItem('identity-fixture-seeded')) { localStorage.setItem(key, raw); sessionStorage.setItem('identity-fixture-seeded', '1'); } }, {key: DATA_KEY, raw});
      const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message)); await p.goto(origin + '/app'); await p.locator('.home-quick').waitFor();
      await p.goto(origin + '/contract'); await guard(p); guarded = true; await p.evaluate(async () => { (window as any).contract = await import(/* @vite-ignore */ String('/__identity/contract.js')); }); await c.setOffline(true);
      const result = await p.evaluate(async () => {
        const w = window as any, api = w.contract, runtime = api.createIdentityFoundation(); await runtime.initialize();
        const policy = () => ({channel: 'private-beta', enabled: true, approvalReference: 'CONTRACT-TEST-ONLY', validUntilMs: Date.now() + 60000});
        const mode = api.createDemoMode(runtime), demo = mode.enter(policy); const before = demo.snapshot(); const changed = await demo.dispatch('record-fictional-expense'); await demo.dispatch('add-fictional-wallet');
        let blocked = false; try { await demo.dispatch('import'); } catch { blocked = true; }
        mode.leave(); const fresh = mode.enter(policy); const reset = fresh.snapshot(); mode.close(); runtime.close();
        const after = await w.__readIdentityCanary(); return {state: runtime.state, before, changed, reset, blocked, touched: w.__identityTouched, beforeCanary: w.__beforeIdentityCanary, afterCanary: after};
      });
      assert.deepEqual(result.touched, []); assert.deepEqual(result.beforeCanary, result.afterCanary); const withoutExportTimestamp = (value: any) => { const {exportedAt, ...financialDocument} = value; return financialDocument; }; assert.deepEqual(withoutExportTimestamp(result.before), withoutExportTimestamp(result.reset)); assert.equal(result.changed.transactions.length, 1); assert.equal(result.changed.transactions[0].amount, 1.23); assert.equal(result.blocked, true); assert.deepEqual(result.state, {status: 'signed-out'}); assert.deepEqual(remote, []); assert.deepEqual(errors, []);
      rows.push({name: 'offline-demo-preserves-confirmed-profile', passed: true, detail: {profileSHA256: createHash('sha256').update(JSON.stringify(result.beforeCanary)).digest('hex'), persistentAccesses: 0, remoteCalls: 0}});
    } finally { await c.close(); }
  });
  await t.test('two tabs never share demo changes or grant B access to A ownership', async () => {
    const c = await context(); try {
      const a = await c.newPage(), b = await c.newPage(); await load(a); await load(b);
      for (const p of [a, b]) await p.evaluate(() => { const w = window as any; w.demo = w.contract.openIsolatedDemo(() => ({channel: 'private-beta', enabled: true, approvalReference: 'CONTRACT-ONLY', validUntilMs: Date.now() + 60000})); });
      await a.evaluate(() => (window as any).demo.dispatch('add-fictional-wallet')); assert.equal(await b.evaluate(() => (window as any).demo.snapshot().wallets.length), 1);
      const decision = await b.evaluate(async () => {
        const w = window as any, now = Date.now(), runtime = w.contract.simulatedIdentity({inspect: async () => ({identity: {applicationSubject: 'application-B', issuer: 'https://issuer.example.invalid', providerSubject: 'provider-B', method: 'google'}, sessionReference: 'test-session', issuedAtMs: now - 100, authenticatedAtMs: now - 100, expiresAtMs: now + 1000})}, () => now);
        await runtime.initialize(); const result = w.contract.realFinancialAccess(runtime.state, {kind: 'account-bound', ownerSubject: 'application-A', profileReference: 'A-profile', bindingRevision: '1'}); runtime.close(); return result;
      });
      assert.deepEqual(decision, {allowed: false, reason: 'OWNER_MISMATCH'}); rows.push({name: 'two-tabs-separate-sandboxes-and-owner-preflight', passed: true});
    } finally { await c.close(); }
  });
  await t.test('revocation and expiry remove simulated projections; browser identifiers never authenticate', async () => {
    const c = await context(); try { const p = await c.newPage(); await load(p);
      const result = await p.evaluate(async () => {
        const api = (window as any).contract, value = {identity: {applicationSubject: 'application-A', issuer: 'https://issuer.example.invalid', providerSubject: 'provider-A', method: 'apple'}, sessionReference: 'test-session', issuedAtMs: 100, authenticatedAtMs: 100, expiresAtMs: 500}; let clock = 200;
        const runtime = api.simulatedIdentity({inspect: async () => value}, () => clock); await runtime.initialize(); clock = 500; const expired = runtime.state; clock = 200; await runtime.initialize(); runtime.markRevoked(); const revoked = runtime.state; runtime.close();
        const real = api.createIdentityFoundation({userId: 'application-A'}); await real.initialize(); const supplied = real.signIn('application-A'); real.close(); return {expired, revoked, supplied};
      }); assert.deepEqual(result, {expired: {status: 'expired'}, revoked: {status: 'revoked'}, supplied: {status: 'error', code: 'PROVIDER_UNCONFIGURED'}}); rows.push({name: 'session-fail-closed-and-no-manual-identity', passed: true});
    } finally { await c.close(); }
  });
  await t.test('retiring beta or navigating away disposes the demo and blocks queued actions', async () => {
    const c = await context(); try { const p = await c.newPage(); await load(p);
      const result = await p.evaluate(async () => {
        const api = (window as any).contract; let policy = {channel: 'private-beta', enabled: true, approvalReference: 'CONTRACT-ONLY', validUntilMs: Date.now() + 60000};
        const demo = api.openIsolatedDemo(() => policy); await demo.dispatch('add-fictional-wallet'); policy = api.disabledDemoPolicy; const closed = !demo.isOpen();
        let refused = false; try { await demo.dispatch('record-fictional-expense'); } catch { refused = true; }
        let denied = true; for (const path of ['/demo', '/app/demo', '/?demo=true', '/%64emo']) denied &&= api.demoRouteDecision(path, api.disabledDemoPolicy) === 'blocked';
        return {closed, refused, denied};
      }); assert.deepEqual(result, {closed: true, refused: true, denied: true}); await p.reload(); assert.equal(await p.evaluate(() => !!(window as any).demo), false); rows.push({name: 'retirement-and-navigation-reset', passed: true});
    } finally { await c.close(); }
  });
  await t.test('auth contract remains buildable without the optional demo or financial persistence modules', async () => {
    const result = await build({configFile: false, publicDir: false, logLevel: 'silent', build: {write: false, outDir: out + '-auth-only', emptyOutDir: false, lib: {entry: path.resolve('src/identity/index.ts'), formats: ['es']}}});
    const outputs = (Array.isArray(result) ? result : [result]).flatMap(r => 'output' in r ? r.output : []);
    const modules = outputs.filter(o => o.type === 'chunk').flatMap(o => Object.keys(o.modules).map(id => id.replaceAll('\\', '/')));
    for (const forbidden of ['/identity/demo.ts', '/identity/demoEntry.ts', '/utils/financeStore.ts', '/platform/web/', '/platform/vault/']) assert.equal(modules.some(id => id.includes(forbidden)), false, forbidden);
    rows.push({name: 'auth-contract-independent-of-demo-and-storage', passed: true});
  });
  await t.test('production bundle contains no identity SDK, simulation or demo implementation', async () => {
    const result = await build({logLevel: 'silent', build: {write: false, outDir: out + '-production-inspection', emptyOutDir: false}}), outputs = (Array.isArray(result) ? result : [result]).flatMap(r => 'output' in r ? r.output : []), modules = outputs.filter(o => o.type === 'chunk').flatMap(o => Object.keys(o.modules));
    assert.equal(modules.some(id => id.replaceAll('\\', '/').includes('/src/identity/')), false);
    for (const sdk of ['@supabase/', 'firebase/auth', '@clerk/', '@auth0/']) assert.equal(modules.some(id => id.includes(sdk)), false);
    rows.push({name: 'product-entry-excludes-unapproved-identity-and-demo-code', passed: true});
  });
});

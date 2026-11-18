import test from 'node:test';
import assert from 'node:assert/strict';
import {createIdentityFoundation, identityRollout, realFinancialAccess} from './index';
import {createDemoMode, disabledDemoPolicy, demoAvailable, demoRouteDecision, openIsolatedDemo} from './demoEntry';
import {simulatedIdentity} from './testing/simulation';
import type {SessionProjection, FinancialOwnership} from './contracts';
import type {DemoPolicy} from './policy';
import {makeBackup, parseBackup} from '../utils/backup';
import {calculateWalletBalances} from '../utils/finance';
const now = 200;
const liveApproval = (): DemoPolicy => ({channel: 'private-beta', enabled: true, approvalReference: 'TEST-CONTRACT-ONLY', validUntilMs: Date.now() + 60000});
const approved = (): DemoPolicy => ({channel: 'private-beta', enabled: true, approvalReference: 'TEST-CONTRACT-ONLY', validUntilMs: 1000});
const projection = (subject = 'application-A'): SessionProjection => ({identity: {applicationSubject: subject, issuer: 'https://issuer.example.invalid', providerSubject: 'opaque-provider-subject', method: 'google'}, sessionReference: 'session-fixture', issuedAtMs: 100, authenticatedAtMs: 50, expiresAtMs: 500});
const owned = (ownerSubject = 'application-A'): FinancialOwnership => ({kind: 'account-bound', ownerSubject, profileReference: 'profile-fixture', bindingRevision: 'binding-1'});
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return {promise, resolve}; }

test('7A.1: initial public foundation has no session, provider or real authentication', async () => {
  const runtime = createIdentityFoundation(); assert.deepEqual(runtime.state, {status: 'signed-out'});
  assert.equal(identityRollout.provider, null); assert.equal(identityRollout.realAuthentication, false);
  assert.equal(identityRollout.localClaim, false); assert.equal(identityRollout.synchronization, false);
  assert.deepEqual(await runtime.initialize(), {status: 'signed-out'}); runtime.close();
});
test('7A.1: a manually supplied user/email/provider cannot authenticate the public factory', async () => {
  const runtime = (createIdentityFoundation as any)({userId: 'application-A', email: 'person@example.invalid', provider: 'google'});
  assert.equal((await runtime.initialize()).status, 'signed-out'); assert.deepEqual(runtime.signIn('application-A'), {status: 'error', code: 'PROVIDER_UNCONFIGURED'});
  assert.equal(realFinancialAccess(runtime.state, owned()).allowed, false); runtime.close();
});
test('7A.1: initialization publishes a state without creating a financial session', async () => {
  const gate = deferred<SessionProjection | null>(); const runtime = simulatedIdentity({inspect: () => gate.promise}, () => now);
  const seen: string[] = []; runtime.subscribe(() => seen.push(runtime.state.status)); const pending = runtime.initialize();
  assert.equal(runtime.state.status, 'initializing'); gate.resolve(null); await pending; assert.deepEqual(seen, ['initializing', 'signed-out']); runtime.close();
});
test('7A.1: stable application identity is independent of method and rotating sessions', async () => {
  let value = projection(); const runtime = simulatedIdentity({inspect: async () => value}, () => now);
  const first = await runtime.initialize(); value = {...projection(), sessionReference: 'rotated-session', identity: {...projection().identity, issuer: 'https://appleid.apple.com', providerSubject: 'different-provider-subject', method: 'apple'}};
  const second = await runtime.initialize(); assert.equal(first.status, 'authenticated'); assert.equal(second.status, 'authenticated');
  if (first.status === 'authenticated' && second.status === 'authenticated') { assert.equal(first.session.identity.applicationSubject, second.session.identity.applicationSubject); assert.notEqual(first.session.identity.providerSubject, second.session.identity.providerSubject); assert.equal(second.assurance, 'simulation-only'); }
  assert.deepEqual(realFinancialAccess(second, owned()), {allowed: false, reason: 'SERVER_AUTHORIZATION_REQUIRED'}); runtime.close();
});
test('7A.1: session expires on access even if no timer or foreground event fired', async () => {
  let clock = 200; const runtime = simulatedIdentity({inspect: async () => projection()}, () => clock); await runtime.initialize();
  clock = 500; assert.deepEqual(runtime.state, {status: 'expired'}); assert.deepEqual(realFinancialAccess(runtime.state, owned()), {allowed: false, reason: 'SESSION_EXPIRED'}); runtime.close();
});
test('7A.1: an already expired provider projection is not accepted as active', async () => {
  const runtime = simulatedIdentity({inspect: async () => ({...projection(), expiresAtMs: 150})}, () => now);
  assert.deepEqual(await runtime.initialize(), {status: 'expired'}); runtime.close();
});
test('7A.1: explicit revocation clears the projection and prevents real access', async () => {
  const runtime = simulatedIdentity({inspect: async () => projection()}, () => now); await runtime.initialize(); runtime.markRevoked();
  assert.deepEqual(runtime.state, {status: 'revoked'}); assert.deepEqual(realFinancialAccess(runtime.state, owned()), {allowed: false, reason: 'SESSION_REVOKED'}); runtime.close();
});
test('7A.1: auth errors never expose credential-bearing provider messages', async () => {
  const secret = 'FICTIONAL_PASSWORD_AND_TOKEN_DO_NOT_PROJECT'; const runtime = simulatedIdentity({inspect: async () => { throw new Error(secret); }}, () => now);
  const state = await runtime.initialize(); assert.deepEqual(state, {status: 'error', code: 'AUTH_UNAVAILABLE'}); assert.equal(JSON.stringify({state, runtime: runtime.state}).includes(secret), false); runtime.close();
});
for (const [name, change] of [
  ['access token', (p: any) => ({...p, accessToken: 'FICTIONAL_SECRET'})],
  ['refresh token', (p: any) => ({...p, refreshToken: 'FICTIONAL_SECRET'})],
  ['password', (p: any) => ({...p, password: 'FICTIONAL_SECRET'})],
  ['email instead of ID', (p: any) => ({...p, identity: {...p.identity, applicationSubject: 'person@example.invalid'}})],
  ['email linking field', (p: any) => ({...p, identity: {...p.identity, email: 'person@example.invalid'}})],
  ['numeric ID', (p: any) => ({...p, identity: {...p.identity, applicationSubject: 123}})],
  ['future issuance', (p: any) => ({...p, issuedAtMs: 300})],
  ['invalid expiry', (p: any) => ({...p, expiresAtMs: Infinity})],
] as const) test('7A.1: projection rejects ' + name + ' without propagating secrets', async () => {
  const runtime = simulatedIdentity({inspect: async () => change(projection())}, () => now); const state = await runtime.initialize();
  assert.deepEqual(state, {status: 'error', code: 'INVALID_PROJECTION'}); assert.equal(JSON.stringify(state).includes('FICTIONAL_SECRET'), false); runtime.close();
});
test('7A.1: a late inspection cannot resurrect a locally cleared or revoked session', async () => {
  for (const revoke of [false, true]) { const gate = deferred<SessionProjection>(); const runtime = simulatedIdentity({inspect: () => gate.promise}, () => now); const pending = runtime.initialize();
    if (revoke) runtime.markRevoked(); else runtime.clearLocalSession(); gate.resolve(projection()); await pending; assert.equal(runtime.state.status, revoke ? 'revoked' : 'signed-out'); runtime.close(); }
});
test('7A.1: obsolete identity A response cannot replace the later identity B', async () => {
  const a = deferred<SessionProjection>(), b = deferred<SessionProjection>(); let call = 0;
  const runtime = simulatedIdentity({inspect: () => ++call === 1 ? a.promise : b.promise}, () => now); const first = runtime.initialize(), second = runtime.initialize();
  b.resolve(projection('application-B')); await second; a.resolve(projection('application-A')); await first;
  const state = runtime.state; assert.equal(state.status, 'authenticated'); if (state.status === 'authenticated') assert.equal(state.session.identity.applicationSubject, 'application-B'); runtime.close();
});
test('7A.1: consumers receive detached projections, not a mutable authorization source', async () => {
  const runtime = simulatedIdentity({inspect: async () => projection()}, () => now); await runtime.initialize(); const state = runtime.state;
  if (state.status === 'authenticated') (state.session.identity as any).applicationSubject = 'attacker';
  const actual = runtime.state; if (actual.status === 'authenticated') assert.equal(actual.session.identity.applicationSubject, 'application-A'); runtime.close();
});
test('7A.1: observer failure never leaks provider data or reopens a closed runtime', async () => {
  const runtime = createIdentityFoundation(); runtime.subscribe(() => { throw new Error('FICTIONAL_LISTENER_SECRET'); }); await runtime.initialize(); runtime.close(); runtime.close();
  await assert.rejects(runtime.initialize(), /IDENTITY_CLOSED/); assert.throws(() => runtime.signIn(), /IDENTITY_CLOSED/); assert.deepEqual(runtime.state, {status: 'signed-out'});
});
test('7A.1: user B and arbitrary browser-built authenticated states never receive A financial data', async () => {
  const runtime = simulatedIdentity({inspect: async () => projection('application-B')}, () => now); await runtime.initialize();
  assert.deepEqual(realFinancialAccess(runtime.state, owned('application-A')), {allowed: false, reason: 'OWNER_MISMATCH'});
  const invented: any = {status: 'authenticated', assurance: 'server-verified', session: projection()};
  assert.deepEqual(realFinancialAccess(invented, owned()), {allowed: false, reason: 'SERVER_AUTHORIZATION_REQUIRED'}); runtime.close();
});
test('7A.1: existing IndexedDB/SQLCipher profiles remain unassigned, never claimed on login', async () => {
  const runtime = simulatedIdentity({inspect: async () => projection()}, () => now); await runtime.initialize();
  for (const engine of ['indexeddb-strict', 'sqlcipher'] as const) assert.deepEqual(realFinancialAccess(runtime.state, {kind: 'unassigned-local', engine, profileReference: 'legacy-fixture'}), {allowed: false, reason: 'LEGACY_CONSENT_REQUIRED'});
  runtime.close();
});
test('7A.1: product default, a single flag, missing approval and expired beta all deny demo', () => {
  const invalid: DemoPolicy[] = [disabledDemoPolicy, {...approved(), channel: 'product'}, {...approved(), enabled: false}, {...approved(), approvalReference: null}, {...approved(), validUntilMs: now}, {...approved(), validUntilMs: NaN}];
  for (const policy of invalid) { assert.equal(demoAvailable(policy, now), false); assert.throws(() => openIsolatedDemo(() => policy, () => now), /DEMO_DISABLED/); }
  assert.equal(demoAvailable(approved(), now), true);
});
test('7A.1: disabled build policy blocks alternate URLs and actions, including a forged feature flag', () => {
  for (const path of ['/demo', '/demo/', '/app/demo', '/?demo=true', '/demo#enabled', '/%64emo', '/sub/demo']) assert.equal(demoRouteDecision(path, disabledDemoPolicy, '/', now), 'blocked');
  assert.equal(demoRouteDecision('/demo', {...disabledDemoPolicy, enabled: true}, '/', now), 'blocked');
  assert.equal(demoRouteDecision('/demo', approved(), '/', now), 'isolated-demo'); assert.equal(demoRouteDecision('/sub/demo', approved(), '/sub/', now), 'isolated-demo');
  assert.equal(demoRouteDecision('/app/demo', approved(), '/', now), 'blocked'); assert.equal(demoRouteDecision('/demo', approved(), '/../', now), 'blocked');
});
test('7A.1: demo owns only curated fictitious data and reuses unchanged domain validation', async () => {
  const demo = openIsolatedDemo(approved, () => now), before = demo.snapshot(); assert.equal(before.wallets.length, 1); assert.deepEqual(before.contacts, []);
  const changed = await demo.dispatch('record-fictional-expense'); assert.equal(changed.transactions[0].amount, 1.23); assert.equal(changed.transactions[0].description, 'OPERACION FICTICIA DEMO');
  assert.equal(Math.round(calculateWalletBalances(changed.wallets, changed.transactions)['DEMO FICTICIA'] * 100), 9877);
  const backup = makeBackup(changed); assert.equal(backup.version, '3.5'); assert.deepEqual(parseBackup(JSON.stringify(backup)).transactions, changed.transactions); demo.close();
});
test('7A.1: independent demos, detached snapshots and full exit/reentry never retain prior changes', async () => {
  const a = openIsolatedDemo(approved, () => now), b = openIsolatedDemo(approved, () => now); const snapshot = a.snapshot(); snapshot.wallets[0].name = 'MANUAL_PRIVATE_VALUE';
  assert.equal(a.snapshot().wallets[0].name, 'DEMO FICTICIA'); await a.dispatch('add-fictional-wallet'); assert.equal(b.snapshot().wallets.length, 1); a.close(); assert.throws(() => a.snapshot(), /DEMO_CLOSED/);
  const replacement = openIsolatedDemo(approved, () => now); assert.equal(replacement.snapshot().wallets.length, 1); b.close(); replacement.close();
});
test('7A.1: queued demo writes are cancelled before the callback when demo closes', async () => {
  const demo = openIsolatedDemo(approved, () => now); const pending = demo.dispatch('add-fictional-wallet'); demo.close(); await assert.rejects(pending, /DEMO_CLOSED/); assert.equal(demo.isOpen(), false);
});
test('7A.1: beta retirement, timeout and policy failure permanently dispose the current demo', async () => {
  for (const failure of ['disabled', 'expired', 'throw']) { let policy = approved(), clock = now, broken = false; const demo = openIsolatedDemo(() => { if (broken) throw new Error('FICTIONAL_POLICY_SECRET'); return policy; }, () => clock);
    await demo.dispatch('add-fictional-wallet'); if (failure === 'disabled') policy = disabledDemoPolicy; else if (failure === 'expired') clock = 1000; else broken = true;
    assert.equal(demo.isOpen(), false); policy = approved(); clock = now; broken = false; await assert.rejects(demo.dispatch('add-fictional-wallet'), /DEMO_CLOSED/); }
});
test('7A.1: demo cannot import, restore, export, synchronize, authenticate or adopt an existing profile', async () => {
  const demo = openIsolatedDemo(approved, () => now); for (const forbidden of ['import', 'restore', 'export', 'synchronize', 'authenticate', 'adopt-profile']) {
    assert.equal(forbidden in demo, false); await assert.rejects(demo.dispatch(forbidden as any), /DEMO_ACTION_BLOCKED/); }
  assert.deepEqual(demo.capabilities, {dataClass: 'fictitious', persistence: 'none', import: false, export: false, synchronization: false, remoteAPI: false, account: false}); demo.close();
});
test('7A.1: lifecycle transitions dispose demo and never convert it into an identity', async () => {
  const runtime = createIdentityFoundation(), mode = createDemoMode(runtime); const demo = mode.enter(liveApproval); assert.deepEqual(mode.state, {status: 'isolated-demo', dataClass: 'fictitious', persistence: 'none'});
  assert.deepEqual(realFinancialAccess(mode.state, owned()), {allowed: false, reason: 'DEMO_CANNOT_ACCESS_REAL_DATA'}); mode.leave(); assert.equal(demo.isOpen(), false); await runtime.initialize(); assert.deepEqual(runtime.state, {status: 'signed-out'}); mode.close(); runtime.close();
});
test('7A.1: no persistent storage, native vault or network is accessed by initialization/demo', async t => {
  const touched: string[] = []; const names = ['window', 'localStorage', 'sessionStorage', 'indexedDB', 'Capacitor', 'fetch'] as const;
  for (const name of names) { const prior = Object.getOwnPropertyDescriptor(globalThis, name); Object.defineProperty(globalThis, name, {configurable: true, get() { touched.push(name); throw new Error('FORBIDDEN_LIVE_CAPABILITY'); }});
    t.after(() => { if (prior) Object.defineProperty(globalThis, name, prior); else delete (globalThis as any)[name]; }); }
  const runtime = createIdentityFoundation(); await runtime.initialize(); const mode = createDemoMode(runtime), demo = mode.enter(liveApproval); await demo.dispatch('record-fictional-expense'); mode.leave(); mode.close(); runtime.close(); assert.deepEqual(touched, []);
});
test('7A.1: changing identity closes demo without transferring its fictional document', async () => {
  const runtime = simulatedIdentity({inspect: async () => projection('application-B')}, () => now), mode = createDemoMode(runtime);
  const demo = mode.enter(liveApproval); await demo.dispatch('add-fictional-wallet'); await runtime.initialize();
  assert.equal(demo.isOpen(), false); assert.equal(mode.state.status, 'authenticated');
  assert.deepEqual(realFinancialAccess(mode.state, owned('application-A')), {allowed: false, reason: 'OWNER_MISMATCH'});
  mode.close(); runtime.close();
});
test('7A.1: removing the demo composition leaves the identity lifecycle usable', async () => {
  const runtime = createIdentityFoundation(), mode = createDemoMode(runtime); const demo = mode.enter(liveApproval); mode.close();
  assert.equal(demo.isOpen(), false); assert.throws(() => mode.enter(liveApproval), /DEMO_MODE_CLOSED/);
  assert.deepEqual(await runtime.initialize(), {status: 'signed-out'}); assert.deepEqual(runtime.signIn(), {status: 'error', code: 'PROVIDER_UNCONFIGURED'}); runtime.close();
});

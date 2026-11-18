import type {IdentityState, SessionProjection, FinancialOwnership, AccessDecision} from './contracts';

/** Internal simulation seam. There is intentionally no real provider implementation. */
export interface SimulationDriver {inspect(signal: AbortSignal): Promise<SessionProjection | null>}
const exactKeys = (value: object, keys: string[]) => Object.keys(value).sort().join('|') === keys.sort().join('|');
function validProjection(value: SessionProjection, now: number): boolean {
  if (!value || !exactKeys(value, ['identity', 'sessionReference', 'issuedAtMs', 'authenticatedAtMs', 'expiresAtMs'])) return false;
  const identity = value.identity;
  return !!identity && exactKeys(identity, ['applicationSubject', 'issuer', 'providerSubject', 'method']) &&
    typeof identity.applicationSubject === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(identity.applicationSubject) &&
    typeof identity.providerSubject === 'string' && identity.providerSubject.length > 0 && identity.providerSubject.length <= 256 &&
    typeof identity.issuer === 'string' && /^https:\/\/[^\s]+$/.test(identity.issuer) && ['email-password', 'google', 'apple'].includes(identity.method) &&
    typeof value.sessionReference === 'string' && value.sessionReference.length > 0 && value.sessionReference.length <= 256 &&
    [value.issuedAtMs, value.authenticatedAtMs, value.expiresAtMs].every(Number.isFinite) &&
    value.authenticatedAtMs <= value.issuedAtMs && value.issuedAtMs <= now && value.expiresAtMs > value.issuedAtMs;
}
export class IdentityCoordinator {
  private current: IdentityState = {status: 'signed-out'};
  private generation = 0;
  private closed = false;
  private abort?: AbortController;
  private listeners = new Set<() => void>();
  constructor(private driver: SimulationDriver | null = null, private now: () => number = Date.now) {}
  get state(): IdentityState {
    if (this.current.status === 'authenticated' && this.current.session.expiresAtMs <= this.now()) this.invalidate({status: 'expired'});
    return structuredClone(this.current);
  }
  subscribe(listener: () => void) { if (this.closed) return () => {}; this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private publish(value: IdentityState) { this.current = value; for (const notify of this.listeners) { try { notify(); } catch { /* An observer cannot reopen a session or expose a driver error. */ } } }
  private invalidate(value: IdentityState) { this.generation++; this.abort?.abort(); this.abort = undefined; this.publish(value); }
  private requireOpen() { if (this.closed) throw new Error('IDENTITY_CLOSED'); }
  async initialize(): Promise<IdentityState> {
    this.requireOpen();
    this.invalidate({status: 'initializing'});
    const generation = this.generation, abort = new AbortController(); this.abort = abort;
    try {
      const value = this.driver ? await this.driver.inspect(abort.signal) : null;
      if (generation !== this.generation) return this.state;
      if (value === null) this.publish({status: 'signed-out'});
      else if (!validProjection(value, this.now())) this.publish({status: 'error', code: 'INVALID_PROJECTION'});
      else if (value.expiresAtMs <= this.now()) this.publish({status: 'expired'});
      else this.publish({status: 'authenticated', assurance: 'simulation-only', session: structuredClone(value)});
    } catch {
      if (generation === this.generation) this.publish({status: 'error', code: 'AUTH_UNAVAILABLE'});
    }
    return this.state;
  }
  /** Explicit disabled-provider result, never a fake sign-in form or invented user. */
  signIn(): IdentityState { this.requireOpen(); this.invalidate({status: 'error', code: 'PROVIDER_UNCONFIGURED'}); return this.state; }
  clearLocalSession() { if (this.closed) return; this.invalidate({status: 'signed-out'}); }
  markRevoked() { if (this.closed) return; this.invalidate({status: 'revoked'}); }
  close() { if (this.closed) return; this.closed = true; this.invalidate({status: 'signed-out'}); this.listeners.clear(); }
}
/** Read-only preflight for a FUTURE server-authorized financial access. Never grants real access. */
export function realFinancialAccess(state: IdentityState, scope: FinancialOwnership): AccessDecision {
  if (state.status === 'isolated-demo') return {allowed: false, reason: 'DEMO_CANNOT_ACCESS_REAL_DATA'};
  if (state.status === 'expired') return {allowed: false, reason: 'SESSION_EXPIRED'};
  if (state.status === 'revoked') return {allowed: false, reason: 'SESSION_REVOKED'};
  if (state.status !== 'authenticated') return {allowed: false, reason: 'SESSION_REQUIRED'};
  if (scope.kind === 'unassigned-local') return {allowed: false, reason: 'LEGACY_CONSENT_REQUIRED'};
  if (scope.kind === 'isolated-demo' || scope.ownerSubject !== state.session.identity.applicationSubject) return {allowed: false, reason: 'OWNER_MISMATCH'};
  return {allowed: false, reason: 'SERVER_AUTHORIZATION_REQUIRED'};
}

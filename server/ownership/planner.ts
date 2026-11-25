import type {AccessRequest, AuthorizationSnapshot, Denial, ExternalSubject, Plan} from './contracts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const revision = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0;
const denials: readonly Denial[] = ['INVALID_REQUEST','SESSION_REQUIRED','SESSION_EXPIRED','SESSION_REVOKED','UNPROVISIONED','RESOURCE_DENIED','REVISION_CONFLICT','UNAVAILABLE','STALE_RESULT'];
const deny = (reason: Denial): Plan => Object.freeze({mode: 'architecture-only', financialAccess: false, eligibility: 'denied', reason});
/** Exact pair; never normalize subjects, collapse issuers, or look up an email. */
export function externalIdentityKey(subject: ExternalSubject): string {
  if (typeof subject.issuer !== 'string' || typeof subject.subject !== 'string') throw Error('INVALID_SUBJECT');
  const url = new URL(subject.issuer);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      url.pathname !== '/' || url.href !== subject.issuer || !subject.subject || subject.subject.length > 256) throw Error('INVALID_SUBJECT');
  return JSON.stringify([subject.issuer, subject.subject]);
}
export function parseAccessRequest(value: unknown): AccessRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join() !== ['action','expectedProfileRevision','operationId','profileId'].sort().join() ||
      typeof v.profileId !== 'string' || !uuid.test(v.profileId) || typeof v.operationId !== 'string' || !uuid.test(v.operationId) ||
      !revision(v.expectedProfileRevision) || typeof v.action !== 'string' || !['read','write','export','restore','financial-operation'].includes(v.action)) return null;
  return {profileId: v.profileId, operationId: v.operationId, expectedProfileRevision: v.expectedProfileRevision, action: v.action as AccessRequest['action']};
}
/** Pure specification, NOT authorization middleware. Always financialAccess=false. */
export function planAccess(snapshot: AuthorizationSnapshot, input: unknown, now: number): Plan {
  const request = parseAccessRequest(input);
  if (!request || !Number.isFinite(now)) return deny('INVALID_REQUEST');
  const session = snapshot.session;
  if (!session) return deny('SESSION_REQUIRED');
  if (!Number.isFinite(session.expiresAtMs) || session.expiresAtMs <= now) return deny('SESSION_EXPIRED');
  if (session.revoked || !revision(session.authorizationEpoch) || !revision(snapshot.currentAuthorizationEpoch) ||
      session.authorizationEpoch !== snapshot.currentAuthorizationEpoch) return deny('SESSION_REVOKED');
  const {binding, user, owner, profile} = snapshot;
  try {
    if (!binding || !user || externalIdentityKey(binding) !== externalIdentityKey(session) ||
        binding.userId !== user.id || !uuid.test(user.id) || !revision(user.revision) || !revision(binding.revision) || user.status !== 'active') return deny('UNPROVISIONED');
  } catch { return deny('UNPROVISIONED'); }
  if (!profile || !owner || profile.id !== request.profileId || owner.profileId !== profile.id ||
      owner.userId !== user.id || profile.status !== 'active' || !revision(profile.revision) || !revision(owner.revision)) return deny('RESOURCE_DENIED');
  if (request.expectedProfileRevision !== profile.revision) return deny('REVISION_CONFLICT');
  return Object.freeze({mode: 'architecture-only', financialAccess: false, eligibility: 'eligible-in-model', reason: 'TRANSACTIONAL_ENFORCEMENT_REQUIRED'});
}

/** Testable stale-response boundary for the future server/UI projection.
 * Ports are deliberately labelled simulations; never wire this to an HTTP allow decision.
 */
export interface SimulationAssessmentPort { assess(request: AccessRequest, signal: AbortSignal): Promise<Plan> }
export class AssessmentCoordinator {
  private generation = 0;
  private abort?: AbortController;
  private closed = false;
  private result: Plan = deny('SESSION_REQUIRED');
  get current(): Plan { return {...this.result}; }
  invalidate(): void { this.generation++; this.abort?.abort(); this.result = deny('SESSION_REQUIRED'); }
  close(): void { this.invalidate(); this.closed = true; }
  constructor(private port: SimulationAssessmentPort) {}
  async assess(input: unknown): Promise<Plan> {
    this.invalidate();
    const generation = this.generation, request = parseAccessRequest(input);
    if (this.closed || !request) return deny('INVALID_REQUEST');
    const abort = new AbortController(); this.abort = abort;
    let result: Plan;
    try {
      result = await this.port.assess(request, abort.signal);
      if (result.mode !== 'architecture-only' || result.financialAccess !== false ||
          !['eligible-in-model','denied'].includes(result.eligibility) ||
          (result.eligibility === 'eligible-in-model' ? result.reason !== 'TRANSACTIONAL_ENFORCEMENT_REQUIRED' : !denials.includes(result.reason as Denial))) result = deny('UNAVAILABLE');
    } catch { result = deny('UNAVAILABLE'); }
    if (generation !== this.generation || this.closed) return deny('STALE_RESULT');
    this.result = {mode: 'architecture-only', financialAccess: false, eligibility: result.eligibility, reason: result.reason}; return this.current;
  }
}

/** Architectural contracts only. A browser object is NEVER proof of authentication. */
export type SignInMethod = 'email-password' | 'google' | 'apple';
export type ProviderCandidate = 'supabase' | 'firebase' | 'clerk' | 'auth0';
export type IdentityProjection = Readonly<{
  /** Assigned by a future trusted application identity registry, never derived from email. */
  applicationSubject: string | null;
  issuer: string;
  providerSubject: string;
  method: SignInMethod | 'unknown';
}>;
export interface ApplicationIdentityRecord {
  applicationSubject: string;
  registryRevision: string;
  bindings: readonly Readonly<{issuer: string; providerSubject: string; method: SignInMethod}>[];
}
export type SessionProjection = Readonly<{
  identity: IdentityProjection;
  sessionReference: string;
  issuedAtMs: number;
  authenticatedAtMs: number;
  expiresAtMs: number;
}>;
export type IdentityState =
  | {status: 'signed-out'}
  | {status: 'initializing'}
  | {status: 'authenticated'; assurance: 'simulation-only' | 'auth0-bff'; session: SessionProjection}
  | {status: 'expired'}
  | {status: 'revoked'}
  | {status: 'error'; code: 'PROVIDER_UNCONFIGURED' | 'INVALID_PROJECTION' | 'AUTH_UNAVAILABLE'}
  | {status: 'isolated-demo'; dataClass: 'fictitious'; persistence: 'none'};

/** Future backend/SDK boundary: not implemented or configured in 7A.1.
 * Its implementation must validate issuer/audience/signature/nonce/session/revocation
 * with the IdP and application server. Decoding browser claims is insufficient.
 * Passwords and provider tokens belong to a separate credential transport, NEVER this projection.
 */
export interface VerifiedIdentityPort {
  inspect(signal: AbortSignal): Promise<SessionProjection | null>;
  beginSignIn(method: SignInMethod): Promise<void>;
  beginRegistration(): Promise<void>;
  beginCredentialChange(): Promise<void>;
  requestEmailVerification(): Promise<void>;
  requestPasswordRecovery(): Promise<void>;
  reauthenticate(): Promise<void>;
  revokeSessions(scope: 'current' | 'all'): Promise<void>;
}
export type FinancialOwnership =
  | {kind: 'unassigned-local'; engine: 'indexeddb-strict' | 'sqlcipher'; profileReference: string}
  | {kind: 'account-bound'; ownerSubject: string; profileReference: string; bindingRevision: string}
  | {kind: 'isolated-demo'};
export type AccessDecision = {allowed: false; reason:
  'SESSION_REQUIRED' | 'SESSION_EXPIRED' | 'SESSION_REVOKED' | 'LEGACY_CONSENT_REQUIRED' |
  'OWNER_MISMATCH' | 'SERVER_AUTHORIZATION_REQUIRED' | 'DEMO_CANNOT_ACCESS_REAL_DATA'};

/** Metadata envelope for a later explicit claim; no financial JSON/schema changes. */
export interface LocalClaimProposal {
  operationId: string;
  profileReference: string;
  expectedFinancialRevision: string;
  expectedBindingRevision: string | null;
  targetApplicationSubject: string;
  previewDigest: string;
  verifiedRecoveryCopyDigest: string;
  explicitConsentReference: string;
}
export interface IdentityLinkProposal {
  operationId: string;
  applicationSubject: string;
  currentReauthenticationReference: string;
  newCredentialVerificationReference: string;
  consentReference: string;
  challengeReference: string;
  expiresAtMs: number;
}
export interface AccountAuthorizationPort {
  /** Must run on a trusted server and enforce ownership, not accept a client owner as authority. */
  authorize(request: {profileReference: string; action: 'read' | 'write' | 'export' | 'restore'; operationId: string}): Promise<{allowed: boolean; decisionReference: string}>;
}

/** Native implementation is blocked until final identifiers, OS cache and callbacks are verified.
 * Implement with the official Auth0/Capacitor system-browser flow, not a WebView credential form.
 * URLs/codes are ephemeral; never log or persist them in financial storage.
 */
export interface NativeIdentityPort extends VerifiedIdentityPort {
  handleAuthorizedCallback(url: URL): Promise<void>;
  resumeAndVerify(): Promise<SessionProjection | null>;
  cancelPendingAuthorization(): Promise<void>;
}

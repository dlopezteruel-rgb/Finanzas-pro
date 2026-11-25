/** 7B.1 design contracts. No implementation here authenticates a caller or opens finance. */
export type Action = 'read' | 'write' | 'export' | 'restore' | 'financial-operation';
export interface ExternalSubject { issuer: string; subject: string }
export interface ApplicationUser { id: string; revision: number; status: 'active' | 'disabled' }
export interface ExternalBinding extends ExternalSubject { userId: string; revision: number }
export interface ProfileOwner { profileId: string; userId: string; revision: number }
export interface ProfileRecord { id: string; revision: number; status: 'active' | 'blocked' }
export interface ServerSession extends ExternalSubject {
  reference: string;
  expiresAtMs: number;
  revoked: boolean;
  authorizationEpoch: number;
}
/** Must be assembled from verified server session + registry within one DB transaction.
 * A cookie projection or browser JSON is not such a snapshot. No real adapter exists yet.
 */
export interface AuthorizationSnapshot {
  session: ServerSession | null;
  currentAuthorizationEpoch: number;
  binding: ExternalBinding | null;
  user: ApplicationUser | null;
  profile: ProfileRecord | null;
  owner: ProfileOwner | null;
}
export interface AccessRequest {
  profileId: string;
  action: Action;
  expectedProfileRevision: number;
  operationId: string;
}
export type Denial = 'INVALID_REQUEST' | 'SESSION_REQUIRED' | 'SESSION_EXPIRED' |
  'SESSION_REVOKED' | 'UNPROVISIONED' | 'RESOURCE_DENIED' | 'REVISION_CONFLICT' |
  'UNAVAILABLE' | 'STALE_RESULT';
export type Plan = Readonly<{
  mode: 'architecture-only';
  financialAccess: false;
  eligibility: 'eligible-in-model' | 'denied';
  reason: Denial | 'TRANSACTIONAL_ENFORCEMENT_REQUIRED';
}>;
/** Future transaction contract: verification, locks, CAS, receipt and audit must commit
 * together. Neither this interface nor Plan is a capability or a bearer credential.
 */
export interface RegistryTransaction {
  findBinding(subject: ExternalSubject): Promise<ExternalBinding | null>;
  insertUserAndBinding(input: {user: ApplicationUser; binding: ExternalBinding;
    expectedRegistryRevision: number; operationId: string}): Promise<void>;
  readAuthorizationSnapshot(profileId: string): Promise<AuthorizationSnapshot>;
}
export interface RegistryRepository {
  serializable<T>(operation: (transaction: RegistryTransaction) => Promise<T>): Promise<T>;
}

/** Minimal, non-sensitive audit shape; never log provider tokens or financial content. */
export interface AuthorizationEvent {
  decisionId: string;
  operationId: string;
  actorId: string | null;
  profileId: string | null;
  action: Action;
  outcome: 'denied' | 'eligible-in-model';
  observedRevision: number | null;
}
export interface OperationReceipt {
  operationId: string;
  actorId: string;
  kind: 'provision-user' | 'create-profile';
  fingerprint: string;
  resultingRegistryRevision: number;
}
/** Extension of the same transaction, not an independently committing connection. */
export interface AuditedRegistryTransaction extends RegistryTransaction {
  readRegistryRevision(): Promise<number>;
  compareAndSwapRegistryRevision(expected: number, next: number): Promise<void>;
  findReceipt(operationId: string): Promise<OperationReceipt | null>;
  appendReceipt(receipt: OperationReceipt): Promise<void>;
  appendDecision(event: AuthorizationEvent): Promise<void>;
}

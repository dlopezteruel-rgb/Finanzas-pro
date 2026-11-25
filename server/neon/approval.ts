import {createHash} from 'node:crypto';

export class NeonFailure extends Error {
  constructor(readonly code: 'STAGE_B_NOT_AUTHORIZED' | 'TARGET_REFUSED' | 'CONFIGURATION' | 'CLIENT_FAILED' | 'RESULT_UNKNOWN', readonly sqlState?: string) {
    super(`NEON_${code}`);
  }
}

export interface ReviewedTarget {
  projectId: string;
  branchId: string;
  branchName: 'development';
  endpointId: string;
  directHost: string;
  pooledHost: string;
  database: 'neondb';
  region: 'aws-eu-central-1';
}

/** Public metadata obtained independently from the control plane, NOT from a DB URL. */
export interface ControlPlaneEvidence {
  project: {id: string; region_id: string};
  branch: {id: string; project_id: string; name: string; default: boolean};
  endpoints: {id: string; project_id: string; branch_id: string; host: string; type: string}[];
  fetchedAt: string;
}

export function validateTarget(target: ReviewedTarget): void {
  const keys = ['branchId','branchName','database','directHost','endpointId','pooledHost','projectId','region'];
  if (!target || Object.keys(target).sort().join() !== keys.join() || target.branchName !== 'development' || target.database !== 'neondb' || target.region !== 'aws-eu-central-1') throw new NeonFailure('TARGET_REFUSED');
  if (!/^[a-z0-9-]{3,100}$/.test(target.projectId) || !/^br-[a-z0-9-]{3,100}$/.test(target.branchId) || !/^ep-[a-z0-9-]{3,100}$/.test(target.endpointId)) throw new NeonFailure('TARGET_REFUSED');
  const suffix = target.directHost.slice(target.endpointId.length);
  // Exact approved hosts, never wildcard authorization or a hostname supplied by a URL.
  if (!/^\.(?:c-\d+\.)?eu-central-1\.aws\.neon\.tech$/.test(suffix) || target.directHost !== target.endpointId + suffix || target.pooledHost !== target.endpointId + '-pooler' + suffix) throw new NeonFailure('TARGET_REFUSED');
}

export function validateControlPlane(target: ReviewedTarget, evidence: ControlPlaneEvidence, now = Date.now()): void {
  validateTarget(target);
  const timestamp = Date.parse(evidence?.fetchedAt);
  const endpoint = evidence?.endpoints?.filter(e => e.id === target.endpointId);
  if (!Number.isFinite(timestamp) || timestamp > now || now - timestamp > 300000 || evidence.project?.id !== target.projectId || evidence.project?.region_id !== target.region || evidence.branch?.id !== target.branchId || evidence.branch?.project_id !== target.projectId || evidence.branch?.name !== 'development' || evidence.branch?.default !== false || endpoint?.length !== 1) throw new NeonFailure('TARGET_REFUSED');
  const e = endpoint[0];
  if (e.project_id !== target.projectId || e.branch_id !== target.branchId || e.host !== target.directHost || e.type !== 'read_write') throw new NeonFailure('TARGET_REFUSED');
}

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Stage A product/operational gate. No environment flag or example file grants approval.
 * Stage B requires an owner-reviewed source change with exact public target/plan hashes,
 * followed by fresh independent control-plane verification. This is not authentication.
 */
export function requireStageBAuthorization(): void {
  throw new NeonFailure('STAGE_B_NOT_AUTHORIZED');
}

export async function openRemoteValidation(): Promise<void> {
  // Deliberately BEFORE credential reads, DNS, control-plane fetches or libpq processes.
  requireStageBAuthorization();
}

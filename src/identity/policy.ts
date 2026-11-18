/** Deployment governance for a FICTITIOUS sandbox, never authorization to real data. */
export type DemoPolicy = Readonly<{
  channel: 'product' | 'private-beta';
  enabled: boolean;
  approvalReference: string | null;
  validUntilMs: number;
}>;
export const disabledDemoPolicy: DemoPolicy = Object.freeze({channel: 'product', enabled: false, approvalReference: null, validUntilMs: 0});
export const identityRollout = Object.freeze({phase: '7A.1', provider: null, realAuthentication: false, localClaim: false, synchronization: false, demo: disabledDemoPolicy});
export function demoAvailable(policy: DemoPolicy, now = Date.now()): boolean {
  return !!policy && policy.channel === 'private-beta' && policy.enabled === true &&
    typeof policy.approvalReference === 'string' && policy.approvalReference.trim().length > 0 &&
    Number.isFinite(policy.validUntilMs) && policy.validUntilMs > now;
}
/** Future demo entry must consult this AND the controller's action guards.
 * This is not registered in React/Express in 7A.1 and never gates the legacy /app.
 * Build/runtime flags are governance only; isolation comes from the memory-only dependency graph.
 */
export function demoRouteDecision(pathname: string, policy: DemoPolicy, base = '/', now = Date.now()): 'isolated-demo' | 'blocked' {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base)) return 'blocked';
  return pathname === base + 'demo' && demoAvailable(policy, now) ? 'isolated-demo' : 'blocked';
}

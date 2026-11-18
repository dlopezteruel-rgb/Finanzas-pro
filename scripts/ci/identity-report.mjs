/** Additional fail-closed gate; does not change any existing finance/P0/axe check. */
export const identityCases = [
  'production-no-demo-entry',
  'offline-demo-preserves-confirmed-profile',
  'two-tabs-separate-sandboxes-and-owner-preflight',
  'session-fail-closed-and-no-manual-identity',
  'retirement-and-navigation-reset',
  'auth-contract-independent-of-demo-and-storage',
  'product-entry-excludes-unapproved-identity-and-demo-code',
];
export function validateIdentityReport(report, source) {
  if (report?.schemaVersion !== 1 || report.source !== source || report.workingTreeDirty !== false ||
      !Array.isArray(report.rows) || report.rows.length !== identityCases.length ||
      report.rows.some((row, index) => row.name !== identityCases[index] || row.passed !== true)) {
    throw Error('All seven 7A.1 identity/demo contract cases must pass on the clean checked-out SHA.');
  }
  return {passed: true, source, cases: report.rows.length, realAuthentication: false, nativeRuntimeValidated: false};
}

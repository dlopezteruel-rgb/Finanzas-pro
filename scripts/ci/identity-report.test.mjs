import test from 'node:test';
import assert from 'node:assert/strict';
import {identityCases, validateIdentityReport} from './identity-report.mjs';
const source = 'fixture-checkout';
const complete = () => ({schemaVersion: 1, source, workingTreeDirty: false, rows: identityCases.map(name => ({name, passed: true}))});
test('7A.1 CI accepts complete architectural evidence without claiming real authentication', () => {
  assert.deepEqual(validateIdentityReport(complete(), source), {passed: true, source, cases: 7, realAuthentication: false, nativeRuntimeValidated: false});
});
test('7A.1 CI rejects missing, failed, duplicate, reordered, dirty and wrong-SHA contract evidence', () => {
  const cases = [null, {...complete(), rows: []}, {...complete(), source: 'other'}, {...complete(), workingTreeDirty: true}, {...complete(), schemaVersion: 2},
    {...complete(), rows: complete().rows.map((r, i) => i === 2 ? {...r, passed: false} : r)},
    {...complete(), rows: complete().rows.map((r, i) => i === 2 ? complete().rows[1] : r)}, {...complete(), rows: complete().rows.reverse()}];
  for (const report of cases) assert.throws(() => validateIdentityReport(report, source));
});

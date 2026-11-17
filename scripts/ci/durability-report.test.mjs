import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateDurabilityReport} from './durability-report.mjs';
const evidence=JSON.parse(readFileSync(new URL('../../docs/web-001-evidence/corrected-20.json',import.meta.url),'utf8'));
test('P0 gate accepts the preserved complete real twenty-profile evidence',()=>{assert.equal(validateDurabilityReport(evidence,evidence.sourceCommit).repetitions,20);});
for(const [name,change]of [
 ['missing observation',r=>r.results.pop()],
 ['failure',r=>r.results[1].passed=false],
 ['legacy backend',r=>r.backend='legacy'],
 ['nineteen repetitions',r=>r.repetitions=19],
 ['reused profile',r=>r.results[2].profileId=r.results[1].profileId],
 ['lost confirmed snapshot',r=>r.results[1].observation.observedSnapshotHash='0'.repeat(64)],
 ['changed identities',r=>r.results[1].observation.recoveredWalletIds=[]],
 ['duplicate operation',r=>r.results[1].observation.newWalletCount=2],
 ['wrong source',r=>r.sourceCommit='0'.repeat(40)]
])test(`P0 gate fails closed: ${name}`,()=>{const report=structuredClone(evidence);change(report);assert.throws(()=>validateDurabilityReport(report,evidence.sourceCommit),/Mandatory P0/);});

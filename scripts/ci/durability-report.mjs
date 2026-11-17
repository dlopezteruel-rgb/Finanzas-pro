/** A green browser battery must include independently recoverable confirmed snapshots. */
export function validateDurabilityReport(report,sha){
 const reject=message=>{throw new Error(`Mandatory P0 WEB-001 durability gate: ${message}`);};
 if(report.backend!=='indexeddb'||report.sourceCommit!==sha||report.repetitions<20||!report.browser?.version)reject('wrong backend, source SHA, browser, or insufficient repetitions');
 const results=report.results;if(!Array.isArray(results)||results.length!==report.repetitions+2)reject('missing observations');
 const critical=results.filter(r=>r.scenario==='after-confirmed-save');
 if(critical.length!==report.repetitions||new Set(critical.map(r=>r.profileId)).size!==critical.length)reject('independent profiles required');
 for(const r of results){
  const o=r.observation;
  if(!r.passed||!r.confirmedRevisionPreserved||!o)reject('failed or unobserved scenario');
  if(!/^[a-f0-9]{64}$/.test(o.confirmedSnapshotHash)||o.observedSnapshotHash!==o.confirmedSnapshotHash||o.confirmedRevision!==o.recoveredRevision||JSON.stringify(o.confirmedWalletIds)!==JSON.stringify(o.recoveredWalletIds))reject('complete snapshot/revision/identities mismatch');
  if(r.scenario==='after-confirmed-save'&&(o.newWalletCount!==1||o.priorSnapshotRetained||!Number.isFinite(o.confirmationToKillMs)||o.confirmationToKillMs<0))reject('confirmed operation missing or duplicate');
 }
 for(const scenario of ['graceful-after-confirmed-save','before-write-lock-callback'])if(results.filter(r=>r.scenario===scenario).length!==1)reject('control missing');
 return {passed:true,backend:report.backend,sourceCommit:sha,repetitions:critical.length,controls:2,browser:report.browser.version};
}

export function validateCrashControls(report,sha){
 const expected=['migration-during-prepare','migration-after-prepare-commit','migration-during-activation','migration-after-activation-commit','financial-during-transaction','financial-after-commit-before-response','restore-during-transaction','restore-after-commit-before-response'];
 if(report.sourceCommit!==sha||!report.browser||report.results?.length!==expected.length||expected.some(s=>report.results.filter(r=>r.scenario===s&&r.passed&&r.callerSettledBeforeKill===false&&/^[a-f0-9]{64}$/.test(r.recoveredHash)).length!==1)||new Set(report.results.map(r=>r.profileId)).size!==expected.length)throw Error('Mandatory P0 WEB-001 crash boundary controls missing, failed, duplicated or wrong source.');
 return {passed:true,sourceCommit:sha,controls:expected.length,browser:report.browser};
}

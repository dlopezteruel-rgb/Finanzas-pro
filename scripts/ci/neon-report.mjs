export function validateNeonPreparation(r,sha,{dockerRequired=false}={}) {
  const reject=()=>{throw Error('Neon stage A evidence incomplete, unsafe or incorrectly attributed');};
  if(!r||r.source!==sha||r.workingTreeDirty!==false||r.stage!=='A'||r.passed!==true||r.cleanupComplete!==true||r.neonTested!==false||r.pgBouncerTested!==false||r.remoteAuthorized!==false||r.financialAccess!==false||r.engine!=='PostgreSQL18'||!/^psql \(PostgreSQL\) 18\./.test(r.client??'')||r.channelBinding!=='require'||r.requireAuth!=='scram-sha-256'||r.sslMode!=='verify-full'||r.tests?.length!==21||new Set(r.tests).size!==21)reject();
  if(dockerRequired&&r.mode!=='docker')reject();
  return {passed:true,source:sha,cases:21,neonTested:false,pgBouncerTested:false,remoteAuthorized:false};
}

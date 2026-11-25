export function validatePostgresReport(r,sha,{dockerRequired=false}={}){
 const invalid=()=>{throw Error('PostgreSQL18 real fixture/report incomplete, unsafe or wrong source');};
 if(!r||r.source!==sha||r.workingTreeDirty!==false||r.passed!==true||r.cleanupComplete!==true||r.fixtureOnly!==true||r.postgresReal!==true||r.neonTested!==false||r.financialAccess!==false||!/^PostgreSQL 18\./.test(r.version??'')||!Array.isArray(r.tests)||r.tests.length!==23||new Set(r.tests).size!==23||!r.migrations?.length)invalid();
 if(dockerRequired&&r.mode!=='docker')invalid();
 for(const key of ['migrator','runtime']){const role=r.roles?.[key];if(!role||['rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolreplication','rolinherit'].some(k=>role[k]!==false))invalid();}
 return {passed:true,source:sha,realPostgres:true,neonTested:false,cases:23};
}

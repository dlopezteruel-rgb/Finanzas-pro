import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {startLab} from '../postgres/lab';
import {direct} from '../../server/postgres/database';
import {sqlFile,migrationPlan,registryChecksum,adminPreflightPlan,verifyAdminPreflight} from '../../server/neon/plans';
import {newFixtures,createFixtures,isolationProbe,reuseProbe,forgedReceipt,mutateFixture,cleanupFixtures,FixtureOperation} from '../../server/neon/fixtures';
import {verifyPrivileges} from '../../server/neon/privileges';
import {localTestConnection,strictEnvironment} from '../../server/neon/libpq';
import {fixtureClients} from './localClient';
import {NeonFailure} from '../../server/neon/approval';
import {preparedValidation} from '../../server/neon/validation';

const json = (text: string) => {
  const rows = text.split('\n').filter(s => s.startsWith('{'));
  assert.equal(rows.length,1,'exactly one structured observation required');
  return JSON.parse(rows[0]);
};

test('7B.2A.1 official libpq18 strict channel binding and reviewed plans on isolated PostgreSQL18',{timeout:300000},async t => {
  const lab = await startLab();
  let cleanup = false;
  t.after(async () => {await lab.stop();cleanup = true;});
  const {query,version,launcher} = await fixtureClients(lab);
  const results: string[] = [];
  const check = async (name: string, action: () => Promise<void>) => t.test(name,async () => {await action();results.push(name);});
  const admin = query('admin'), migrator = query('migrator'), runtime = query('runtime');
  const fixtures = newFixtures(), sentinel = newFixtures();
  const bootstrap = await sqlFile('bootstrap'), diagnostic = await sqlFile('privileges'), migration = await migrationPlan();
  await check('official psql18 connects with verify-full require channel binding and required SCRAM',async () => {
    assert.match(version,/^psql \(PostgreSQL\) 18\./);
    const r = json(await admin("SELECT json_build_object('version',current_setting('server_version_num'),'ssl',(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()));"));
    assert.match(r.version,/^18\d{4}$/);assert.equal(r.ssl,true);
    verifyAdminPreflight(json(await admin(adminPreflightPlan)));
  });
  await check('Neon-specific SQL creates restricted NOLOGIN roles without passwords or memberships',async () => {
    await admin(bootstrap);
    const r = json(await admin("SELECT json_build_object('roles',(SELECT count(*) FROM pg_roles WHERE rolname IN('finanzas_migrator','finanzas_runtime') AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls),'memberships',(SELECT count(*) FROM pg_auth_members WHERE member IN('finanzas_migrator'::regrole,'finanzas_runtime'::regrole)));"));
    assert.equal(r.roles,2);assert.equal(r.memberships,0);
    // Fixture credentials only. Real-owner credential setup is interactive, outside this runner.
    const c = await direct(lab.config,'admin');
    try {for (const role of ['migrator','runtime'] as const) {
      const target = lab.config.connections[role];
      const sql = await c.query("SELECT format('ALTER ROLE %I LOGIN PASSWORD %L',$1::text,$2::text)",[target.user,target.password]);
      await c.query(sql.rows[0].format);
    }} finally {await c.end();}
  });
  await check('repeating bootstrap does not rotate working restricted credentials',async () => {await admin(bootstrap);assert.equal(json(await migrator("SELECT json_build_object('role',current_user); ")).role,'finanzas_migrator');});
  await check('same registry SQL applies atomically through libpq and repeats concurrently',async () => {
    await migrator(migration);await Promise.all([migrator(migration),migrator(migration)]);
    const r = json(await migrator("SELECT json_build_object('count',count(*),'hash',max(sha256)) FROM finanzas.schema_migrations;"));
    assert.equal(r.count,1);assert.equal(r.hash,registryChecksum);
  });
  await check('real effective role schema table function and column privileges pass restrictive verifier',async () => {verifyPrivileges(json(await runtime(diagnostic)));});
  await check('unknown ledger drift refuses migration without silently repairing it',async () => {
    await migrator("UPDATE finanzas.schema_migrations SET sha256=repeat('0',64);");
    await assert.rejects(migrator(migration));
    assert.equal(json(await migrator("SELECT json_build_object('hash',sha256) FROM finanzas.schema_migrations;")).hash,'0'.repeat(64));
    await migrator(`UPDATE finanzas.schema_migrations SET sha256='${registryChecksum}';`);
  });
  await check('fixtures are identifiable isolated metadata and do not import financial documents',async () => {
    await migrator(createFixtures(fixtures));await migrator(createFixtures(sentinel));
    assert.equal(json(await migrator("SELECT json_build_object('profiles',count(*)) FROM finanzas.profile;")).profiles,4);
  });
  await check('runtime A and B cannot read or modify the other profile',async () => {await runtime(isolationProbe(fixtures,'a'));await runtime(isolationProbe(fixtures,'b'));});
  await check('transaction-local context resets after COMMIT ROLLBACK and actor changes',async () => {await runtime(reuseProbe(fixtures));});
  await check('WITH CHECK rejects a forged cross-owner receipt',async () => {await assert.rejects(runtime(forgedReceipt(fixtures)),e => e instanceof NeonFailure && e.sqlState === '42501');});
  await check('CAS receipt and audit commit atomically and replay without duplicates',async () => {
    const change = {fixture:fixtures,revision:0,label:'7B2A1-FICTIONAL-FIRST'};
    const operation = new FixtureOperation(change);await operation.commit(runtime);assert.equal(operation.phase,'confirmed');
    await runtime(mutateFixture(change));
    const r = json(await migrator(`SELECT json_build_object('revision',(SELECT revision FROM finanzas.profile WHERE id='${fixtures.p}'),'receipts',(SELECT count(*) FROM finanzas.operation_receipt WHERE operation_id='${fixtures.operation}'),'events',(SELECT count(*) FROM finanzas.authorization_event WHERE operation_id='${fixtures.operation}'));`));
    assert.deepEqual(r,{revision:1,receipts:1,events:1});
  });
  await check('two real libpq connections contend through SERIALIZABLE CAS',async () => {
    const requests = ['ONE','TWO'].map(label => ({fixture:{...fixtures,operation:randomUUID()},revision:1,label:'7B2A1-FICTIONAL-'+label}));
    const r = await Promise.allSettled(requests.map(change => runtime(mutateFixture(change))));
    assert.equal(r.filter(v => v.status === 'fulfilled').length,1);assert.equal(r.filter(v => v.status === 'rejected').length,1);
    for(const v of r)if(v.status==='rejected')assert.equal(v.reason.sqlState,'40001');
    assert.equal(json(await migrator(`SELECT json_build_object('revision',revision) FROM finanzas.profile WHERE id='${fixtures.p}';`)).revision,2);
  });
  await check('real transaction rollback preserves revision and has no new receipt',async () => {
    const change = {fixture:{...fixtures,operation:randomUUID()},revision:2,label:'7B2A1-FICTIONAL-ROLLBACK'};
    await runtime(mutateFixture(change).replace(/COMMIT;\n$/,'ROLLBACK;\n'));
    const r = json(await migrator(`SELECT json_build_object('revision',(SELECT revision FROM finanzas.profile WHERE id='${fixtures.p}'),'receipts',(SELECT count(*) FROM finanzas.operation_receipt WHERE operation_id='${change.fixture.operation}'));`));
    assert.deepEqual(r,{revision:2,receipts:0});
  });
  await check('a real COMMIT followed by response failure blocks replay and reconciles only its receipt',async () => {
    const operation = new FixtureOperation({fixture:{...fixtures,operation:randomUUID()},revision:2,label:'7B2A1-FICTIONAL-RESPONSE-LOST'});
    let mutations = 0;
    const failAfterCommit = (sql: string) => {mutations++;return runtime(sql+'\nSELECT 1/0;\n');};
    await assert.rejects(operation.commit(failAfterCommit));assert.equal(operation.phase,'unknown');assert.equal(mutations,1);
    await assert.rejects(operation.commit(failAfterCommit));assert.equal(mutations,1);
    await operation.reconcile(runtime);assert.equal(operation.phase,'confirmed');
    assert.equal(json(await migrator(`SELECT json_build_object('revision',revision) FROM finanzas.profile WHERE id='${fixtures.p}';`)).revision,3);
  });
  await check('strict libpq refuses unknown CA wrong hostname and unavailable connection',async () => {
    await assert.rejects(query('runtime',lab.cert+'/missing-ca')('SELECT 1;'));
    const c = lab.config.connections.runtime;
    const env = strictEnvironment(localTestConnection({host:'127.0.0.1',port:lab.port,user:String(c.user),database:'neondb',password:String(c.password)}),lab.cert+'/ca.crt');
    await assert.rejects(launcher('SELECT 1;',{...env,PGHOST:'wrong-host.invalid',PGHOSTADDR:'127.0.0.1'}));
    // Docker fixture maps its internal port; use an explicitly invalid DB name instead there.
    if (lab.mode === 'local-binaries') await assert.rejects(query('runtime',undefined,{port:1})('SELECT 1;'));
    else await assert.rejects(launcher('SELECT 1;',{...env,PGDATABASE:'nonexistent_fixture'}));
  });
  await check('transitive memberships and SET ROLE reachability are refused even without INHERIT',async () => {
    await admin('CREATE ROLE fixture_privileged NOLOGIN; CREATE ROLE fixture_middle NOLOGIN; GRANT fixture_privileged TO fixture_middle WITH INHERIT FALSE,SET TRUE; GRANT fixture_middle TO finanzas_runtime WITH INHERIT FALSE,SET TRUE;');
    try {const report = json(await runtime(diagnostic));assert.ok(report.memberships.some((r: any) => r.role === 'fixture_privileged'));assert.throws(() => verifyPrivileges(report));assert.equal(json(await runtime("SET ROLE fixture_privileged; SELECT json_build_object('role',current_user);")).role,'fixture_privileged');await assert.rejects(admin(bootstrap));}
    finally {await admin('REVOKE fixture_middle FROM finanzas_runtime; DROP ROLE fixture_middle; DROP ROLE fixture_privileged;');}
  });
  await check('cleanup refuses a drifted marker without modifying the fixture graph',async () => {
    await migrator(`UPDATE finanzas.profile SET label='UNREVIEWED-MARKER',revision=revision+1 WHERE id='${fixtures.q}';`);
    await assert.rejects(migrator(cleanupFixtures(fixtures)));
    assert.equal(json(await migrator(`SELECT json_build_object('count',count(*)) FROM finanzas.profile WHERE id IN('${fixtures.p}','${fixtures.q}');`)).count,2);
    await migrator(`UPDATE finanzas.profile SET label='7B2A1-FICTIONAL-RESTORED',revision=revision+1 WHERE id='${fixtures.q}';`);
  });
  await check('explicit scoped cleanup preserves a separate sentinel fixture set',async () => {
    await migrator(cleanupFixtures(fixtures));assert.equal(json(await migrator(`SELECT json_build_object('count',count(*)) FROM finanzas.profile WHERE id IN('${sentinel.p}','${sentinel.q}');`)).count,2);
    await migrator(cleanupFixtures(sentinel));
  });
  await check('independent prepared runner executes its direct and pooled callback contracts on local aliases only',async () => {
    const journal:string[]=[];
    const result=await preparedValidation({adminDirect:admin,migratorDirect:migrator,runtimeDirect:runtime,runtimePooled:runtime},true,newFixtures(),async change=>{journal.push(change.fixture.operation);});
    assert.equal(journal.length,5);assert.equal(new Set(journal).size,5);
    assert.equal(result.completed.length,13);assert.equal(result.transportUnverified,true);assert.equal(result.postCommitFailure,'checked');
    assert.equal(result.backendReuseObserved,true);assert.equal(result.pooledContext.length,5);
    await migrator(cleanupFixtures(result.fixture));
  });
  const availableWithTls = async () => {const c=await direct(lab.config,'admin');try{assert.equal((await c.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0].ssl,true);}finally{await c.end();}};
  await check('libpq require rejects TLS password authentication without channel binding',async () => {await lab.setAuthenticationForTests('password');await availableWithTls();await assert.rejects(admin('SELECT 1;'));});
  await check('libpq require rejects trust authentication then accepts restored SCRAM PLUS',async () => {await lab.setAuthenticationForTests('trust');await availableWithTls();await assert.rejects(admin('SELECT 1;'));await lab.setAuthenticationForTests('scram-sha-256');assert.equal(json(await admin("SELECT json_build_object('ok',true);")).ok,true);});
  t.after(async () => {
    const out = path.resolve(process.env.NEON_ARTIFACT_DIR ?? 'ci-artifacts/neon');await mkdir(out,{recursive:true});
    const report = {source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTreeDirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim() !== '',stage:'A',neonTested:false,pgBouncerTested:false,remoteAuthorized:false,financialAccess:false,engine:'PostgreSQL18',client:version,mode:lab.mode,channelBinding:'require',requireAuth:'scram-sha-256',sslMode:'verify-full',method:'official libpq required policy; real PG18 positive and password/trust negative controls; deterministic post-COMMIT response-failure injection; direct/pooled callbacks use local aliases, NOT PgBouncer',tests:results,cleanupComplete:cleanup,passed:results.length === 21 && cleanup};
    await writeFile(out+'/libpq-local.json',JSON.stringify(report,null,2)+'\n');assert.equal(results.length,21);assert.equal(cleanup,true);
  });
});

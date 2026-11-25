import {randomUUID} from 'node:crypto';
import {NeonFailure,validateTarget,type ReviewedTarget} from './approval';
import {sqlFile} from './plans';
import {verifyPrivileges} from './privileges';
import {newFixtures,createFixtures,isolationProbe,reuseProbe,forgedReceipt,mutateFixture,FixtureOperation,type FixtureSet,type FixtureChange} from './fixtures';

type Query = (sql: string) => Promise<string>;
export interface ValidationClients {adminDirect: Query; migratorDirect: Query; runtimeDirect: Query; runtimePooled: Query}
const observation = (text: string) => {
  const rows = text.split('\n').filter(r => r.startsWith('{'));
  if (rows.length !== 1) throw new NeonFailure('RESULT_UNKNOWN');
  return JSON.parse(rows[0]);
};

/** Pure request plan; neither fetches control-plane data nor trusts a pasted DB URL. */
export function controlPlaneRequestPlan(target: ReviewedTarget): string[] {
  validateTarget(target);
  const base = `https://console.neon.tech/api/v2/projects/${encodeURIComponent(target.projectId)}`;
  return [base,`${base}/branches/${encodeURIComponent(target.branchId)}`,`${base}/endpoints`];
}

/** Shared scenario runner. Callbacks must come from a separately authorized transport.
 * Never imports the local laboratory, opens sockets, loads credentials, grants access or
 * labels its observations as Neon/PgBouncer proof. Stage A CLI denies remote execution.
 * Fixture creation is explicit; cleanup is a separate, separately approved operation.
 */
export async function preparedValidation(clients: ValidationClients, injectPostCommitFailure: boolean, fixture: FixtureSet = newFixtures(), journal: (proposal:FixtureChange)=>Promise<void> = async()=>{}) {
  const completed: string[] = [];
  for (const [name,query] of Object.entries(clients)) {
    const role = name.startsWith('admin') ? 'neondb_owner' : name.startsWith('migrator') ? 'finanzas_migrator' : 'finanzas_runtime';
    const r = observation(await query("SELECT json_build_object('login',session_user,'role',current_user,'database',current_database(),'version',current_setting('server_version_num'));"));
    if (r.login !== role || r.role !== role || r.database !== 'neondb' || !/^18\d{4}$/.test(r.version)) throw new NeonFailure('TARGET_REFUSED');
    completed.push(name+'-preflight');
  }
  verifyPrivileges(observation(await clients.runtimeDirect(await sqlFile('privileges'))));
  completed.push('effective-privileges');
  await clients.migratorDirect(createFixtures(fixture));completed.push('fixtures-created');
  await clients.runtimeDirect(isolationProbe(fixture,'a'));
  await clients.runtimePooled(isolationProbe(fixture,'b'));completed.push('rls-A-B');
  const pooledContext=(await clients.runtimePooled(reuseProbe(fixture))).split('\n').filter(r=>r.startsWith('{')).map(r=>JSON.parse(r));
  const backendReuseObserved=pooledContext.some((row,i)=>row.actor===null&&pooledContext.slice(0,i).some(prior=>prior.actor!==null&&prior.pid===row.pid));
  if(pooledContext.length!==5||!backendReuseObserved)throw new NeonFailure('RESULT_UNKNOWN');
  completed.push('transaction-context-reuse');
  try {await clients.runtimeDirect(forgedReceipt(fixture));throw new NeonFailure('TARGET_REFUSED');}
  catch (error) {if (!(error instanceof NeonFailure) || error.sqlState !== '42501') throw error;}
  completed.push('with-check-denial');
  const first = {fixture,revision:0,label:'7B2A1-FICTIONAL-PREPARED'};
  await journal(first);
  const saved = new FixtureOperation(first);await saved.commit(clients.runtimeDirect);
  await clients.runtimePooled(mutateFixture(first));completed.push('durable-receipt-and-replay');
  const changes = ['DIRECT','POOLED'].map(label => ({fixture:{...fixture,operation:randomUUID()},revision:1,label:'7B2A1-FICTIONAL-'+label}));
  for(const change of changes)await journal(change);
  const outcomes = await Promise.allSettled([clients.runtimeDirect(mutateFixture(changes[0])),clients.runtimePooled(mutateFixture(changes[1]))]);
  if (outcomes.filter(o => o.status === 'fulfilled').length !== 1 || outcomes.some(o => o.status === 'rejected' && (!(o.reason instanceof NeonFailure) || o.reason.sqlState !== '40001'))) throw new NeonFailure('RESULT_UNKNOWN');
  completed.push('serializable-cas');
  const rollback = {fixture:{...fixture,operation:randomUUID()},revision:2,label:'7B2A1-FICTIONAL-PREPARED-ROLLBACK'};
  await journal(rollback);
  await clients.runtimePooled(mutateFixture(rollback).replace(/COMMIT;\n$/,'ROLLBACK;\n'));
  const state = observation(await clients.migratorDirect(`SELECT json_build_object('revision',(SELECT revision FROM finanzas.profile WHERE id='${fixture.p}'),'receipt',(SELECT count(*) FROM finanzas.operation_receipt WHERE operation_id='${rollback.fixture.operation}'));`));
  if (state.revision !== 2 || state.receipt !== 0) throw new NeonFailure('RESULT_UNKNOWN');
  completed.push('rollback');
  if (injectPostCommitFailure) {
    const operation = new FixtureOperation({fixture:{...fixture,operation:randomUUID()},revision:2,label:'7B2A1-FICTIONAL-PREPARED-UNCERTAIN'});
    await journal(operation.change);
    try {await operation.commit(sql => clients.runtimeDirect(sql+'\nSELECT 1/0;\n'));throw new NeonFailure('RESULT_UNKNOWN');}
    catch (error) {if (operation.phase !== 'unknown' || !(error instanceof NeonFailure) || error.code !== 'RESULT_UNKNOWN') throw error;}
    await operation.reconcile(clients.runtimePooled);completed.push('post-commit-receipt-reconciliation');
  }
  return {fixture,completed,pooledContext,backendReuseObserved,postCommitFailure:injectPostCommitFailure?'checked':'not-executed',transportUnverified:true as const};
}

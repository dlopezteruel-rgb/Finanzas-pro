import {randomUUID} from 'node:crypto';
import {NeonFailure,sha256} from './approval';

export interface FixtureSet {run: string; a: string; b: string; p: string; q: string; operation: string}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const tables = ['app_user','external_identity','profile','profile_owner','authorization_event','operation_receipt'];
export const newFixtures = (): FixtureSet => ({run:randomUUID(),a:randomUUID(),b:randomUUID(),p:randomUUID(),q:randomUUID(),operation:randomUUID()});
export function validateFixtures(f: FixtureSet): void {
  if (!f || Object.keys(f).sort().join() !== ['a','b','operation','p','q','run'].join() || !Object.values(f).every(v => typeof v === 'string' && uuid.test(v)) || new Set(Object.values(f)).size !== 6) throw new NeonFailure('CONFIGURATION');
}
const begin = (actor?: string) => `BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='10s';
${actor ? `SELECT set_config('finanzas.actor_id','${actor}',true);` : ''}
`;
const insist = (condition: string) => `DO $assert$ BEGIN IF NOT (${condition}) THEN RAISE EXCEPTION 'FIXTURE_ASSERTION_FAILED'; END IF; END $assert$;\n`;

export function createFixtures(f: FixtureSet): string {
  validateFixtures(f);
  return begin() + insist("current_user='finanzas_migrator' AND session_user='finanzas_migrator'") + `
INSERT INTO finanzas.app_user(id) VALUES('${f.a}'),('${f.b}');
INSERT INTO finanzas.external_identity(issuer,subject,user_id) VALUES
 ('https://7b2a1-fixtures.invalid/','${f.run}-A','${f.a}'),('https://7b2a1-fixtures.invalid/','${f.run}-B','${f.b}');
INSERT INTO finanzas.profile(id,label) VALUES('${f.p}','7B2A1-FICTIONAL-${f.run}-A'),('${f.q}','7B2A1-FICTIONAL-${f.run}-B');
INSERT INTO finanzas.profile_owner(profile_id,user_id) VALUES('${f.p}','${f.a}'),('${f.q}','${f.b}');
COMMIT;\n`;
}

export function isolationProbe(f: FixtureSet, actor: 'a' | 'b'): string {
  validateFixtures(f);
  const own = actor === 'a' ? f.p : f.q, other = actor === 'a' ? f.q : f.p;
  return begin(f[actor]) + insist("current_user='finanzas_runtime' AND session_user='finanzas_runtime'") +
    insist(`(SELECT count(*)=1 FROM finanzas.profile WHERE id='${own}')`) +
    insist(`(SELECT count(*)=0 FROM finanzas.profile WHERE id='${other}')`) +
    `UPDATE finanzas.profile SET label='7B2A1-FICTIONAL-ATTACK',revision=revision+1 WHERE id='${other}';\n` +
    insist(`(SELECT count(*)=0 FROM finanzas.profile WHERE id='${other}')`) + 'COMMIT;\n';
}

/** One connection, multiple transactions. Must also pass through real PgBouncer in stage B. */
export function reuseProbe(f: FixtureSet): string {
  validateFixtures(f);
  const record = (stage:string) => `SELECT json_build_object('stage','${stage}','pid',pg_backend_pid(),'actor',finanzas.current_actor());\n`;
  let sql = isolationProbe(f,'a') + begin(f.a) + record('actor-A') + 'COMMIT;\n';
  for (const end of ['COMMIT','ROLLBACK']) {
    sql += begin() + insist("finanzas.current_actor() IS NULL");
    for (const table of tables) sql += insist(`(SELECT count(*)=0 FROM finanzas.${table})`);
    sql += record('no-context-'+end) + end + ';\n' + begin(f.b) + insist(`(SELECT count(*)=1 FROM finanzas.profile WHERE id='${f.q}')`) + record('actor-B-'+end) + 'ROLLBACK;\n';
  }
  return sql;
}

export function forgedReceipt(f: FixtureSet): string {
  validateFixtures(f);
  return begin(f.a) + `INSERT INTO finanzas.operation_receipt(operation_id,actor_id,profile_id,action,fingerprint,result_revision)
VALUES('${f.operation}','${f.a}','${f.q}','write',decode(repeat('00',32),'hex'),0);COMMIT;\n`;
}

export interface FixtureChange {fixture: FixtureSet; revision: number; label: string}
export function changeFingerprint(change: FixtureChange): string {
  validateFixtures(change.fixture);
  if (!Number.isSafeInteger(change.revision) || change.revision < 0 || !/^7B2A1-FICTIONAL-[A-Za-z0-9 -]{1,150}$/.test(change.label)) throw new NeonFailure('CONFIGURATION');
  return sha256(JSON.stringify([change.fixture.a,change.fixture.p,change.revision,change.label]));
}

export function mutateFixture(change: FixtureChange): string {
  const fingerprint = changeFingerprint(change), f = change.fixture;
  return begin(f.a) + `DO $operation$
DECLARE receipt finanzas.operation_receipt%ROWTYPE; new_revision bigint;
BEGIN
 SELECT * INTO receipt FROM finanzas.operation_receipt WHERE operation_id='${f.operation}';
 IF FOUND THEN
  IF receipt.actor_id<>'${f.a}' OR receipt.profile_id<>'${f.p}' OR receipt.action<>'write' OR receipt.fingerprint<>decode('${fingerprint}','hex') THEN RAISE EXCEPTION 'OPERATION_REUSED'; END IF;
 ELSE
  UPDATE finanzas.profile SET label='${change.label}',revision=revision+1 WHERE id='${f.p}' AND revision=${change.revision} RETURNING revision INTO new_revision;
  IF NOT FOUND THEN RAISE EXCEPTION 'CAS_CONFLICT' USING ERRCODE='40001'; END IF;
  INSERT INTO finanzas.operation_receipt(operation_id,actor_id,profile_id,action,fingerprint,result_revision)
   VALUES('${f.operation}','${f.a}','${f.p}','write',decode('${fingerprint}','hex'),new_revision);
  INSERT INTO finanzas.authorization_event(operation_id,actor_id,profile_id,action,outcome)
   VALUES('${f.operation}','${f.a}','${f.p}','write','confirmed');
 END IF;
END $operation$;
COMMIT;\n`;
}

export function receiptProbe(change: FixtureChange): string {
  const fingerprint = changeFingerprint(change), f = change.fixture;
  return begin(f.a) + `SELECT json_build_object('confirmed',count(*)=1,'revision',max(result_revision))
FROM finanzas.operation_receipt WHERE operation_id='${f.operation}' AND actor_id='${f.a}' AND profile_id='${f.p}' AND action='write' AND fingerprint=decode('${fingerprint}','hex');COMMIT;\n`;
}

export function cleanupFixtures(f: FixtureSet): string {
  validateFixtures(f);
  return begin() + insist("current_user='finanzas_migrator' AND session_user='finanzas_migrator'") +
    insist(`(SELECT count(*)=2 FROM finanzas.profile WHERE id IN('${f.p}','${f.q}') AND label LIKE '7B2A1-FICTIONAL-%')`) +
    insist(`(SELECT count(*)=2 FROM finanzas.external_identity WHERE user_id IN('${f.a}','${f.b}') AND issuer='https://7b2a1-fixtures.invalid/' AND subject IN('${f.run}-A','${f.run}-B'))`) +
    insist(`NOT EXISTS(SELECT 1 FROM finanzas.external_identity WHERE user_id IN('${f.a}','${f.b}') AND NOT(issuer='https://7b2a1-fixtures.invalid/' AND subject IN('${f.run}-A','${f.run}-B')))`) +
    insist(`NOT EXISTS(SELECT 1 FROM finanzas.profile_owner WHERE (user_id IN('${f.a}','${f.b}') OR profile_id IN('${f.p}','${f.q}')) AND NOT((profile_id='${f.p}' AND user_id='${f.a}') OR (profile_id='${f.q}' AND user_id='${f.b}')))`) + `
DELETE FROM finanzas.authorization_event WHERE profile_id IN('${f.p}','${f.q}') AND actor_id IN('${f.a}','${f.b}');
DELETE FROM finanzas.operation_receipt WHERE profile_id IN('${f.p}','${f.q}') AND actor_id IN('${f.a}','${f.b}');
DELETE FROM finanzas.external_identity WHERE issuer='https://7b2a1-fixtures.invalid/' AND subject IN('${f.run}-A','${f.run}-B') AND user_id IN('${f.a}','${f.b}');
DELETE FROM finanzas.profile_owner WHERE (profile_id='${f.p}' AND user_id='${f.a}') OR(profile_id='${f.q}' AND user_id='${f.b}');
DELETE FROM finanzas.profile WHERE id IN('${f.p}','${f.q}') AND label LIKE '7B2A1-FICTIONAL-%';
DELETE FROM finanzas.app_user WHERE id IN('${f.a}','${f.b}');COMMIT;\n`;
}

export class FixtureOperation {
  phase: 'ready' | 'pending' | 'unknown' | 'confirmed' = 'ready';
  readonly change: FixtureChange;
  constructor(change: FixtureChange) {
    changeFingerprint(change);
    this.change = Object.freeze({...change,fixture:Object.freeze({...change.fixture})});
  }
  async commit(query: (sql: string) => Promise<string>): Promise<void> {
    if (this.phase !== 'ready') throw new NeonFailure('RESULT_UNKNOWN');
    this.phase = 'pending';
    try { await query(mutateFixture(this.change)); await this.check(query); }
    catch { this.phase = 'unknown'; throw new NeonFailure('RESULT_UNKNOWN'); }
  }
  private async check(query: (sql: string) => Promise<string>) {
    const lines = (await query(receiptProbe(this.change))).split('\n').filter(s => s.startsWith('{'));
    if (lines.length !== 1) throw new NeonFailure('RESULT_UNKNOWN');
    const r = JSON.parse(lines[0]);
    if (r.confirmed !== true || Number(r.revision) !== this.change.revision + 1) throw new NeonFailure('RESULT_UNKNOWN');
    this.phase = 'confirmed';
  }
  async reconcile(query: (sql: string) => Promise<string>): Promise<void> {
    if (this.phase !== 'unknown') throw new NeonFailure('RESULT_UNKNOWN');
    // Receipt lookup only: never repeat mutation because a response was lost.
    await this.check(query);
  }
}

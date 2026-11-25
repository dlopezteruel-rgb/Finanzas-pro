import {NeonFailure} from './approval';

export function verifyPrivileges(report: any, expectedLogin = 'finanzas_runtime'): void {
  const reject = () => { throw new NeonFailure('TARGET_REFUSED'); };
  if (!report || report.login !== expectedLogin || report.role !== expectedLogin || report.database !== 'neondb' || !/^18\d{4}$/.test(report.serverVersion) || report.ssl?.enabled !== true || !Array.isArray(report.roles) || !Array.isArray(report.memberships)) reject();
  for (const name of ['finanzas_runtime','finanzas_migrator']) {
    const matches = report.roles.filter((r: any) => r.name === name);
    if (matches.length !== 1 || ['superuser','bypassrls','createDb','createRole','replication','inherit'].some(k => matches[0][k] !== false) || report.memberships.some((m: any) => m.start === name)) reject();
  }
  if (['databaseCreate','temp','publicCreate'].some(k => report.runtimeDdl?.[k] !== false) || ['databases','schemas','objects','functions'].some(k => Number(report.runtimeOwnership?.[k]) !== 0) || !Array.isArray(report.executableDefiners) || report.executableDefiners.length) reject();
  const domain = ['registry_state','app_user','external_identity','profile','profile_owner','authorization_event','operation_receipt','schema_migrations'];
  if (!Array.isArray(report.domain) || report.domain.length !== domain.length || new Set(report.domain.map((r: any) => r.table)).size !== domain.length || !Array.isArray(report.columns)) reject();
  for (const name of domain) {
    const t = report.domain.find((r: any) => r.table === name);
    if (!t || t.owner !== 'finanzas_migrator' || name !== 'schema_migrations' && (t.rls !== true || t.force !== true) || t.runtimeDelete !== false || t.runtimeUpdate !== false) reject();
    if (t.runtimeSelect !== !['registry_state','schema_migrations'].includes(name) || t.runtimeInsert !== ['authorization_event','operation_receipt'].includes(name)) reject();
  }
  for (const c of report.columns) if (c.update !== (c.table === 'profile' && ['label','revision'].includes(c.column))) reject();
  for (const column of ['label','revision']) if (report.columns.filter((c: any) => c.table === 'profile' && c.column === column && c.update === true).length !== 1) reject();
}

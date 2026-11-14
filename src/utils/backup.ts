import {hasCustomCatalog,validateCatalog} from './budgetCatalog';
import {validateCatalogNames} from './catalogNames';
import { validateSubitems, validateSubitemSnapshot, subitemContent, normalizedSubitemBreakdowns } from './budgetSubitems';
import { validateIntelligent } from './intelligentValidation';
import { assertSharedIntegrity, isStructuredShared, sharedMigrationReport } from './sharedExpenses';
import { assertTransferIntegrity, legacyTransferReport } from './transfers';
import { hasAutomation, carryLines, combineLines } from './planningBasis';
import { validateAutomation } from './planningAutomationValidation';
import { planningLines, planningTotals, safeCents, assertMonth } from './planning';
import { BudgetGroup, BudgetPlan, Contact, Loan, Transaction, Wallet, PlanningMonth, PlanningAutomation, PlanningApproval, PlanningLine, IntelligentFinance, BudgetSubitems, CatalogNames } from '../types/finance';

export interface FinanceData {
  catalogNames?: CatalogNames;
  budgetSubitems?: BudgetSubitems;
  theme: 'dark' | 'light';
  transactions: Transaction[];
  budgetPlans: BudgetPlan[];
  planningMonths?: PlanningMonth[];
  planningAutomation?: PlanningAutomation;
  intelligentFinance?: IntelligentFinance;
  budgetGroups: BudgetGroup[];
  contacts: Contact[];
  loans: Loan[];
  wallets: Wallet[];
  defaultWalletId?: string | null;
}
export interface Backup extends FinanceData {
  version: '2.5' | '2.6' | '2.7' | '2.8' | '2.9' | '3.0' | '3.1' | '3.2' | '3.3' | '3.4' | '3.5';
  exportedAt: string;
}
export const DATA_KEY = 'finanzas_pro_data_v1';
export const RECOVERY_PREFIX = 'finanzas_pro_recovery_';
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

function invalid(path: string, message: string): never {
  throw new Error(`${path}: ${message}`);
}
function object(value: unknown, path: string): asserts value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path, 'debe ser un objeto.');
}
function fields(value: Record<string, any>, required: string[], optional: string[], path: string) {
  for (const key of required) if (!Object.hasOwn(value, key)) invalid(`${path}.${key}`, 'falta este campo.');
  for (const key of Object.keys(value)) if (![...required, ...optional].includes(key)) invalid(`${path}.${key}`, 'campo no reconocido.');
}
function string(value: unknown, path: string, allowEmpty = false): asserts value is string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) invalid(path, 'debe ser un texto válido.');
}
function optionalStrings(value: Record<string, any>, keys: string[], path: string) {
  for (const key of keys) if (Object.hasOwn(value, key)) string(value[key], `${path}.${key}`, true);
}
function number(value: unknown, path: string, min = 0, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || (integer && !Number.isInteger(value))) {
    invalid(path, `debe ser un número ${integer ? 'entero ' : ''}válido, mayor o igual que ${min}.`);
  }
}
function bool(value: unknown, path: string) {
  if (typeof value !== 'boolean') invalid(path, 'debe ser true o false.');
}
export function isISODate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function date(value: unknown, path: string) {
  if (!isISODate(value)) invalid(path, 'debe ser una fecha real con formato AAAA-MM-DD.');
}
function movementType(value: unknown, path: string) {
  if (value !== 'GASTO' && value !== 'INGRESO') invalid(path, 'debe ser GASTO o INGRESO.');
}
function array(value: unknown, path: string, validate: (item: any, path: string) => void) {
  if (!Array.isArray(value)) invalid(path, 'debe ser una lista.');
  value.forEach((item, i) => { object(item, `${path}[${i}]`); validate(item, `${path}[${i}]`); });
}
function unique(values: string[], path: string) {
  if (new Set(values).size !== values.length) invalid(path, 'contiene identificadores duplicados.');
}

export function normalizedLines(items: PlanningLine[] = []) {
  return JSON.stringify(items.map(l=>({type:l.type,code:l.code,amountCents:l.amountCents})).sort((a,b)=>`${a.type}:${a.code}`.localeCompare(`${b.type}:${b.code}`)));
}
export function validateApproval(value: unknown, p: string, advanced: boolean, subitems = false): asserts value is PlanningApproval {
  object(value,p); const a=value;
  fields(a,['number','revision','approvedAt','lines','totals'],[...(advanced?['baseLines','carryLines']:[]),...(subitems?['subitemBreakdowns']:[])],p);
  for(const key of ['number','revision']) { number(a[key],`${p}.${key}`,1,true);safeCents(a[key]); }
  if (typeof a.approvedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(a.approvedAt) || !Number.isFinite(Date.parse(a.approvedAt)) || new Date(a.approvedAt).toISOString() !== a.approvedAt) invalid(p,'fecha de aprobación inválida.');
  const lines=(items:unknown,path:string,carry=false)=>{
    array(items,path,(line,q)=>{fields(line,['type','code','amountCents'],[],q);movementType(line.type,`${q}.type`);string(line.code,`${q}.code`);safeCents(line.amountCents);if(!line.amountCents || (carry && line.type!=='GASTO'))invalid(q,'línea monetaria inválida.');});
    unique((items as PlanningLine[]).map(l=>`${l.type}:${l.code}`),path);
  };
  lines(a.lines,`${p}.lines`);
  object(a.totals,`${p}.totals`);fields(a.totals,['income','expenses','savings','available','margin','balance'],[],`${p}.totals`);
  const totals=planningTotals(a.lines,a.totals.savings);
  for(const k of Object.keys(totals) as (keyof typeof totals)[])if(totals[k]!==a.totals[k])invalid(p,'totales inconsistentes con la fotografía.');
  if(Object.hasOwn(a,'baseLines') || Object.hasOwn(a,'carryLines')) {
    lines(a.baseLines,`${p}.baseLines`);lines(a.carryLines,`${p}.carryLines`,true);
    if(normalizedLines(combineLines(a.baseLines,a.carryLines))!==normalizedLines(a.lines))invalid(p,'base + arrastre no coincide con la fotografía efectiva.');
  }
  if(Object.hasOwn(a,'subitemBreakdowns')) validateSubitemSnapshot(a.subitemBreakdowns,a.baseLines ?? a.lines);
}

/** Validate every collection before exposing any of it to application state. */
export function validateBackup(value: unknown): asserts value is Backup {
  object(value, 'Archivo');
  fields(value, ['version', 'exportedAt', 'theme', 'transactions', 'budgetPlans', 'budgetGroups', 'contacts', 'loans', 'wallets'], ['3.3','3.4','3.5'].includes(value.version) ? ['planningMonths','planningAutomation','intelligentFinance','defaultWalletId','budgetSubitems',...(value.version==='3.5'?['catalogNames']:[])] : value.version === '3.2' ? ['planningMonths','planningAutomation','intelligentFinance','defaultWalletId'] : value.version === '3.1' ? ['planningMonths','planningAutomation','intelligentFinance'] : value.version === '3.0' ? ['planningMonths','planningAutomation'] : value.version === '2.9' ? ['planningMonths'] : [], 'Archivo');
  if (!['2.5', '2.6', '2.7', '2.8', '2.9', '3.0', '3.1', '3.2', '3.3', '3.4','3.5'].includes(value.version)) invalid('version', 'versión no compatible. Se admiten los formatos 2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 3.1, 3.2, 3.3, 3.4 y 3.5; no se ha modificado ningún dato.');
  if (typeof value.exportedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value.exportedAt) || !isISODate(value.exportedAt.slice(0, 10)) || !Number.isFinite(Date.parse(value.exportedAt))) invalid('exportedAt', 'fecha de exportación inválida.');
  if (value.theme !== 'dark' && value.theme !== 'light') invalid('theme', 'debe ser dark o light.');
  array(value.transactions, 'transactions', (t, p) => {
    fields(t, ['id', 'date', 'amount', 'type', 'code', 'categoryName', 'subcategoryName', 'description', 'wallet', 'processed'], ['loanId', 'notes', 'splitInfo', ...(['3.3','3.4','3.5'].includes(value.version) ? ['subitemId'] : []), ...(['3.1','3.2','3.3','3.4','3.5'].includes(value.version) ? ['recurrence','obligationSettlement'] : []), ...(value.version !== '2.5' ? ['transfer'] : []), ...(['2.7', '2.8', '2.9', '3.0', '3.1', '3.2', '3.3', '3.4','3.5'].includes(value.version) ? ['reimbursement'] : [])], p);
    for (const k of ['id', 'code', 'categoryName', 'subcategoryName', 'description', 'wallet']) string(t[k], `${p}.${k}`);
    date(t.date, `${p}.date`); number(t.amount, `${p}.amount`, 0.01); movementType(t.type, `${p}.type`); bool(t.processed, `${p}.processed`);
    optionalStrings(t, ['loanId', 'notes'], p);
    if (Object.hasOwn(t, 'reimbursement')) {
      object(t.reimbursement, `${p}.reimbursement`);
      fields(t.reimbursement, ['expenseId', 'settlementId', 'contactId', 'walletId'], [], `${p}.reimbursement`);
      for (const key of ['expenseId', 'settlementId', 'contactId', 'walletId']) string(t.reimbursement[key], `${p}.reimbursement.${key}`);
    }
    if (Object.hasOwn(t, 'transfer')) {
      object(t.transfer, `${p}.transfer`);
      fields(t.transfer, ['id', 'fromWalletId', 'toWalletId', 'leg', 'concept'], [], `${p}.transfer`);
      for (const key of ['id', 'fromWalletId', 'toWalletId', 'leg']) string(t.transfer[key], `${p}.transfer.${key}`);
      string(t.transfer.concept, `${p}.transfer.concept`, true);
    }
    if (Object.hasOwn(t, 'splitInfo')) {
      const s = t.splitInfo; object(s, `${p}.splitInfo`);
      fields(s, ['isShared', 'totalParticipants', 'myShare', 'totalOwedToMe', 'participants'], ['2.7', '2.8', '2.9', '3.0', '3.1', '3.2', '3.3', '3.4','3.5'].includes(value.version) ? ['accountingVersion', 'walletId', 'settlements', ...(['2.8', '2.9', '3.0', '3.1', '3.2', '3.3', '3.4','3.5'].includes(value.version) ? ['distribution'] : [])] : [], `${p}.splitInfo`);
      bool(s.isShared, `${p}.splitInfo.isShared`); number(s.totalParticipants, `${p}.splitInfo.totalParticipants`, 2, true);
      number(s.myShare, `${p}.splitInfo.myShare`); number(s.totalOwedToMe, `${p}.splitInfo.totalOwedToMe`);
      array(s.participants, `${p}.splitInfo.participants`, (participant, q) => {
        fields(participant, ['contactId', 'contactName', 'amount', 'isPaid'], ['paidDate', 'reimbursementTxId'], q);
        string(participant.contactId, `${q}.contactId`); string(participant.contactName, `${q}.contactName`);
        number(participant.amount, `${q}.amount`); bool(participant.isPaid, `${q}.isPaid`);
        if (Object.hasOwn(participant, 'paidDate')) date(participant.paidDate, `${q}.paidDate`);
        optionalStrings(participant, ['reimbursementTxId'], q);
      });
      if (['accountingVersion', 'walletId', 'settlements', 'distribution'].some(k => Object.hasOwn(s, k))) {
        if (s.accountingVersion !== '2.7') invalid(`${p}.splitInfo.accountingVersion`, 'modelo no compatible.');
        string(s.walletId, `${p}.splitInfo.walletId`);
        array(s.settlements, `${p}.splitInfo.settlements`, (settlement, q) => {
          fields(settlement, ['id', 'contactId', 'amount', 'date', 'processed', 'kind'], ['walletId', 'transactionId'], q);
          string(settlement.id, `${q}.id`); string(settlement.contactId, `${q}.contactId`);
          number(settlement.amount, `${q}.amount`, 0.01); date(settlement.date, `${q}.date`); bool(settlement.processed, `${q}.processed`);
          if (!['cash', 'offset'].includes(settlement.kind)) invalid(`${q}.kind`, 'tipo de liquidación inválido.');
          optionalStrings(settlement, ['walletId', 'transactionId'], q);
        });
      }
      unique(s.participants.map((p: { contactId: string }) => p.contactId), `${p}.splitInfo.participants`);
    }
  });
  array(value.budgetPlans, 'budgetPlans', (plan, p) => {
    fields(plan, ['monthYear', 'code', 'type', 'plannedAmount'], [], p);
    if (typeof plan.monthYear !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(plan.monthYear)) invalid(`${p}.monthYear`, 'periodo inválido; usa AAAA-MM.');
    string(plan.code, `${p}.code`); movementType(plan.type, `${p}.type`); number(plan.plannedAmount, `${p}.plannedAmount`);
  });
  array(value.budgetGroups, 'budgetGroups', (group, p) => {
    fields(group, ['code', 'name', 'type', 'partidas'], ['3.4','3.5'].includes(value.version)?['archived','deleted']:[], p);
    string(group.code, `${p}.code`); string(group.name, `${p}.name`); movementType(group.type, `${p}.type`);
    array(group.partidas, `${p}.partidas`, (partida, q) => {
      fields(partida, ['code', 'name', 'groupCode', 'groupName', 'type', 'keywords'], ['description',...(['3.4','3.5'].includes(value.version)?['archived','deleted']:[])], q);
      for (const k of ['code', 'name', 'groupCode', 'groupName']) string(partida[k], `${q}.${k}`);
      movementType(partida.type, `${q}.type`);
      if (partida.type !== group.type) invalid(`${q}.type`, 'no coincide con el tipo del paquete.');
      optionalStrings(partida, ['description'], q);
      if (!Array.isArray(partida.keywords)) invalid(`${q}.keywords`, 'debe ser una lista de textos.');
      partida.keywords.forEach((keyword: unknown, i: number) => string(keyword, `${q}.keywords[${i}]`, true));
    });
  });
  array(value.contacts, 'contacts', (contact, p) => {
    fields(contact, ['id', 'name', 'createdAt'], ['phoneOrEmail', 'avatarColor', 'notes'], p);
    string(contact.id, `${p}.id`); string(contact.name, `${p}.name`); date(contact.createdAt, `${p}.createdAt`);
    optionalStrings(contact, ['phoneOrEmail', 'avatarColor', 'notes'], p);
  });
  array(value.loans, 'loans', (loan, p) => {
    fields(loan, ['id', 'name', 'entity', 'principal', 'interestRate', 'totalTermMonths', 'startDate', 'monthlyPayment', 'wallet', 'code'], ['notes'], p);
    for (const k of ['id', 'name', 'entity', 'wallet', 'code']) string(loan[k], `${p}.${k}`);
    number(loan.principal, `${p}.principal`, 0.01); number(loan.interestRate, `${p}.interestRate`);
    number(loan.totalTermMonths, `${p}.totalTermMonths`, 1, true); number(loan.monthlyPayment, `${p}.monthlyPayment`);
    date(loan.startDate, `${p}.startDate`); optionalStrings(loan, ['notes'], p);
  });
  array(value.wallets, 'wallets', (wallet, p) => {
    fields(wallet, ['id', 'name', 'type', 'initialBalance', 'color'], ['ibanOrDetails'], p);
    for (const k of ['id', 'name', 'color']) string(wallet[k], `${p}.${k}`);
    if (!['BANK', 'NEOBANK', 'CASH', 'SAVINGS', 'INVESTMENT'].includes(wallet.type)) invalid(`${p}.type`, 'tipo de cartera inválido.');
    number(wallet.initialBalance, `${p}.initialBalance`, -Number.MAX_VALUE); optionalStrings(wallet, ['ibanOrDetails'], p);
  });
  if (value.version === '3.2' || (['3.3','3.4','3.5'].includes(value.version) && Object.hasOwn(value,'defaultWalletId'))) {
    if (!Object.hasOwn(value, 'defaultWalletId')) invalid('defaultWalletId', '3.2 requiere la preferencia (ID o null).');
    if (value.defaultWalletId !== null) {
      string(value.defaultWalletId, 'defaultWalletId');
      if (!value.wallets.some((w: Wallet) => w.id === value.defaultWalletId)) invalid('defaultWalletId', 'la cartera no existe.');
    }
  }
  const checked = value as unknown as Backup;
  for (const k of ['transactions', 'contacts', 'loans', 'wallets'] as const) unique(checked[k].map(item => item.id), k);
  if (value.version === '3.0' || (['3.1','3.2','3.3','3.4','3.5'].includes(value.version) && (Object.hasOwn(value,'planningAutomation') || hasAutomation(checked)))) validateAutomation(checked, (a,p,advanced) => validateApproval(a,p,advanced,['3.3','3.4','3.5'].includes(value.version)));
  if (value.version === '2.9' || (['3.0','3.1','3.2','3.3','3.4','3.5'].includes(value.version) && Object.hasOwn(value,'planningMonths'))) {
    if (!Array.isArray(value.planningMonths) || !value.planningMonths.length) invalid('planningMonths', '2.9 requiere metadatos mensuales no vacíos.');
    array(value.planningMonths, 'planningMonths', (meta, p) => {
      fields(meta, ['monthYear', 'savingsCents', 'revision'], ['approval'], p);
      string(meta.monthYear, `${p}.monthYear`); assertMonth(meta.monthYear);
      safeCents(meta.savingsCents); number(meta.revision, `${p}.revision`, 1, true); safeCents(meta.revision);
      // Legacy months retain their original validation until explicitly planned.
      const baseLines = planningLines(checked.budgetPlans, meta.monthYear);
      const adjustments = carryLines(checked, meta.monthYear);
      const lines = combineLines(baseLines, adjustments);
      planningTotals(lines, meta.savingsCents);
      if (Object.hasOwn(meta, 'approval')) {
        const a = meta.approval;
        validateApproval(a, `${p}.approval`, ['3.0','3.1','3.2','3.3','3.4','3.5'].includes(value.version),['3.3','3.4','3.5'].includes(value.version));
        if(a.revision===meta.revision && ['3.3','3.4','3.5'].includes(value.version)) {
          if(normalizedSubitemBreakdowns(a.subitemBreakdowns ?? [])!==normalizedSubitemBreakdowns(subitemContent(checked,meta.monthYear))) invalid(p,'la distribución aprobada vigente no coincide con la previsión actual.');
        }
        if (a.revision > meta.revision) invalid(p, 'la aprobación no puede superar la revisión actual.');
        if (a.revision === meta.revision && (a.totals.savings !== meta.savingsCents || normalizedLines(a.lines) !== normalizedLines(lines))) invalid(p, 'la aprobación vigente no coincide con la previsión actual.');
        if (a.revision === meta.revision && adjustments.length && (!a.baseLines || normalizedLines(a.baseLines)!==normalizedLines(baseLines) || normalizedLines(a.carryLines)!==normalizedLines(adjustments))) invalid(p,'La aprobación debe distinguir base y arrastre vigente.');
      }
    });
    unique(checked.planningMonths!.map(m => m.monthYear), 'planningMonths');
  }
  if(value.version==='3.3'&&!Object.hasOwn(value,'budgetSubitems'))invalid('budgetSubitems','3.3 requiere el registro de identidades y previsiones mensuales.');
  validateCatalog(checked);
  validateCatalogNames(checked);
  validateSubitems(checked);
  assertTransferIntegrity(checked.transactions, checked.wallets);
  assertSharedIntegrity(checked);
  if(value.version === '3.1' && !value.intelligentFinance) invalid('intelligentFinance','3.1 requiere el registro de metadatos nuevo.');
  validateIntelligent(checked);
  unique(checked.wallets.map(w => w.name.trim().toUpperCase()), 'wallets.name');
  unique(checked.budgetGroups.map(g => g.code), 'budgetGroups');
  unique(checked.budgetGroups.flatMap(g => g.partidas.map(p => `${p.type}:${p.code}`)), 'budgetGroups.partidas');
  unique(checked.budgetPlans.map(p => `${p.monthYear}:${p.type}:${p.code}`), 'budgetPlans');
}

export function makeBackup(data: FinanceData): Backup {
  const { planningMonths, planningAutomation, ...base } = data;
  return { ...base, ...(planningMonths?.length ? { planningMonths } : {}), ...(planningAutomation && [planningAutomation.rules,planningAutomation.carryovers,planningAutomation.origins,planningAutomation.history].some(a=>a?.length) ? {planningAutomation} : {}), version: data.catalogNames !== undefined ? '3.5' : hasCustomCatalog(data) ? '3.4' : data.budgetSubitems !== undefined ? '3.3' : data.defaultWalletId !== undefined ? '3.2' : data.intelligentFinance ? '3.1' : hasAutomation(data) ? '3.0' : planningMonths?.length ? '2.9' : data.transactions.some(t => t.splitInfo?.distribution) ? '2.8' : data.transactions.some(t => isStructuredShared(t) || t.reimbursement) ? '2.7' : data.transactions.some(t => t.transfer) ? '2.6' : '2.5', exportedAt: new Date().toISOString() };
}
export function parseBackup(content: string): Backup {
  if (new Blob([content]).size > MAX_BACKUP_BYTES) throw new Error('El archivo supera el límite de 10 MB.');
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { throw new Error('El archivo no contiene un JSON válido.'); }
  validateBackup(parsed);
  return parsed;
}

/** Legacy applications can export orphaned links. Warn and preserve, never repair silently. */
export function backupWarnings(data: FinanceData): string[] {
  const warnings: string[] = [];
  if(data.catalogNames)warnings.push('JSON 3.5: nombres de catálogo de sistema elegidos explícitamente. Las copias anteriores conservan sus nombres; utiliza la copia recuperable previa para volver atrás.');
  if(hasCustomCatalog(data))warnings.push('JSON 3.4: catálogo personalizable, archivo e identidades retiradas. Para volver a una versión anterior restaura la copia recuperable completa previa.');
  if(data.budgetSubitems)warnings.push('JSON 3.3: subítems, previsiones mensuales y fotografías. Las versiones anteriores no lo leen: conserva la copia recuperable completa previa.');
  if(data.defaultWalletId !== undefined) warnings.push('JSON 3.2: incluye la cartera predeterminada por ID. Para volver a una versión anterior utiliza la copia recuperable completa previa.');
  if(data.intelligentFinance)warnings.push('JSON 3.1: reglas, ocurrencias y compromisos. Para volver a una versión anterior restaura la copia recuperable previa completa.');
  if(hasAutomation(data))warnings.push('JSON 3.0: contiene automatización e historial. Las versiones antiguas no lo leen; utiliza la copia recuperable completa previa para volver atrás.');
  if (data.planningMonths?.length) warnings.push('JSON 2.9: incluye objetivos y últimas aprobaciones mensuales. Las versiones anteriores de la aplicación no pueden leerlo; utiliza la copia recuperable anterior para volver atrás.');
  const shared = sharedMigrationReport(data);
  if (shared.candidates.length || shared.issues.length) warnings.push('Gastos compartidos históricos sin migrar: conservan el gasto total y el tratamiento anterior de ingresos. Revisa la migración para aplicar la parte propia y excluir los reintegros confirmados.');
  warnings.push(...shared.issues);
  const legacy = legacyTransferReport(data.transactions, data.wallets);
  if (legacy.pairs.length) warnings.push(`${legacy.pairs.length} traspasos históricos inequívocos: sus importes se excluyen de ingresos y gastos, sin reescribir los originales.`);
  if (legacy.migratablePairs.length) warnings.push(`${legacy.migratablePairs.length} pares pueden vincularse desde el aviso de traspasos históricos, tras revisar y confirmar la copia previa.`);
  if (legacy.missingWalletPairs.length) warnings.push(`${legacy.missingWalletPairs.length} pares históricos sin carteras existentes: se excluyen de ingresos y gastos, pero no se pueden vincular. Se conservan los originales sin crear carteras ni contrapartidas.`);
  if (legacy.unresolved.length) warnings.push(`${legacy.unresolved.length} registros de posibles traspasos históricos sin correspondencia inequívoca. Se conservan intactos y mantienen sus cálculos anteriores. Su edición individual está bloqueada; requieren revisión manual con una copia de seguridad.`);

  const partidas = new Set(data.budgetGroups.flatMap(g => g.partidas.map(p => `${p.type}:${p.code}`)));
  if (data.transactions.some(t => !partidas.has(`${t.type}:${t.code}`)) || data.budgetPlans.some(p => !partidas.has(`${p.type}:${p.code}`))) warnings.push('Hay movimientos o presupuestos con partidas que no figuran en el catálogo. Se conservarán sin cambiar sus cálculos.');
  const wallets = new Set(data.wallets.map(w => w.name));
  if (data.transactions.some(t => !t.transfer && !isStructuredShared(t) && !t.reimbursement && !wallets.has(t.wallet)) || data.loans.some(l => !wallets.has(l.wallet))) warnings.push('Hay referencias a carteras que no existen en esta copia.');
  const loans = new Set(data.loans.map(l => l.id));
  if (data.transactions.some(t => t.loanId && !loans.has(t.loanId))) warnings.push('Hay movimientos vinculados a préstamos que no existen en esta copia.');
  const contacts = new Set(data.contacts.map(c => c.id));
  const txs = new Set(data.transactions.map(t => t.id));
  if (data.transactions.some(t => t.splitInfo?.participants.some(p => !contacts.has(p.contactId) || (!isStructuredShared(t) && p.reimbursementTxId && !txs.has(p.reimbursementTxId))))) warnings.push('Hay participantes o reintegros sin su referencia correspondiente.');
  return warnings;
}

export type StorageAccess = Pick<Storage, 'getItem' | 'setItem' | 'key' | 'length'>;

export class StorageConflictError extends Error {
  constructor() {
    super('Otra pestaña ha cambiado los datos. No se ha guardado esta operación. Recarga para trabajar con la última versión.');
  }
}

export function assertStorageRevision(storage: StorageAccess, expected: string | null) {
  if (storage.getItem(DATA_KEY) !== expected) throw new StorageConflictError();
}

// Internal revision is not exported. Downloads use 2.6 only when structured transfers exist.
export function serializeSnapshot(data: FinanceData): string {
  return JSON.stringify({ ...makeBackup(data), revision: crypto.randomUUID() });
}

export function parseSnapshot(content: string): FinanceData {
  const snapshot = JSON.parse(content);
  const { revision, ...backup } = snapshot;
  if (revision !== undefined && (typeof revision !== 'string' || !revision)) throw new Error('Revisión local inválida.');
  validateBackup(backup);
  return backup;
}

/** One active key makes replacement atomic; a failed write never applies React state. */
export function commitRestoration(storage: StorageAccess, current: FinanceData, next: Backup, expected?: string | null): FinanceData {
  validateBackup(next);
  if (expected !== undefined) assertStorageRevision(storage, expected);
  const serialized = serializeSnapshot(next);
  const recovery = JSON.stringify(makeBackup(current));
  const key = `${RECOVERY_PREFIX}${new Date().toISOString()}_${crypto.randomUUID()}`;
  storage.setItem(key, recovery);
  if (storage.getItem(key) !== recovery) throw new Error('No se pudo verificar la copia de recuperación.');
  if (expected !== undefined) assertStorageRevision(storage, expected);
  storage.setItem(DATA_KEY, serialized);
  return next;
}

export function recoveryCopies(storage: StorageAccess): { key: string; content: string }[] {
  const copies: { key: string; content: string }[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(RECOVERY_PREFIX)) {
      const content = storage.getItem(key);
      if (content) copies.push({ key, content });
    }
  }
  return copies.sort((a, b) => b.key.localeCompare(a.key));
}

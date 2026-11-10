import type { FinanceData } from './backup';
import type { IntelligentFinance } from '../types/finance';
import { realDate } from './financialCalendar';
import { safeCents } from './planningMoney';

export const EMPTY_INTELLIGENT: IntelligentFinance = { recurringRules: [], occurrences: [], obligations: [] };
export const intelligent = (data: FinanceData): IntelligentFinance => data.intelligentFinance ?? EMPTY_INTELLIGENT;
const fail = (message: string): never => { throw new Error(`Finanzas inteligentes: ${message}`); };
function shape(v: any, required: string[], optional: string[] = []) {
  if (!v || typeof v !== 'object' || Array.isArray(v) || required.some(k=>!Object.hasOwn(v,k)) || Object.keys(v).some(k=>![...required,...optional].includes(k))) fail('campos inválidos o no reconocidos.');
}
function list(v: any, max: number): asserts v is any[] { if (!Array.isArray(v) || v.length>max) fail(`lista inválida o superior al límite ${max}.`); }
function text(v: any) { if (typeof v!=='string'||!v.trim()||v.length>500||/[\u0000-\u001f]/.test(v)) fail('texto inválido (máximo 500 caracteres).'); }
function id(v: any): asserts v is string { text(v); if(v.length>160)fail('identificador demasiado largo.'); }
function date(v: any) { if(!realDate(v))fail('fecha real requerida (0001–9999).'); }
function boolean(v: any) { if(typeof v!=='boolean')fail('estado inválido.'); }
function positive(v: any) { safeCents(v);if(!v||Math.round(v/100*100)!==v)fail('importe positivo representable en céntimos requerido.'); }
function distinct(v: string[]) { if(new Set(v).size!==v.length)fail('identificadores duplicados.'); }

/** Strict 3.1 validation on load, import and every write. No repair or inference. */
export function validateIntelligent(data: FinanceData) {
  const raw=data.intelligentFinance;
  if (!raw) {
    if(data.transactions.some(t=>t.recurrence||t.obligationSettlement))fail('enlaces sin su registro persistente.');
    return;
  }
  shape(raw,['recurringRules','occurrences','obligations']);
  list(raw.recurringRules,1000);list(raw.occurrences,20000);list(raw.obligations,5000);
  const wallets=new Set(data.wallets.map(w=>w.id)),contacts=new Set(data.contacts.map(c=>c.id));
  for(const r of raw.recurringRules) {
    shape(r,['id','concept','type','amountCents','code','categoryName','subcategoryName','walletId','frequency','startDate','day','active'],['endDate','deleted']);
    id(r.id);if(r.id.includes('@'))fail('el ID de regla no puede incluir @.');
    for(const k of ['concept','code','categoryName','subcategoryName'] as const)text(r[k]);positive(r.amountCents);
    if(!['GASTO','INGRESO'].includes(r.type)||!['monthly','quarterly','yearly'].includes(r.frequency))fail('tipo o frecuencia inválidos.');
    id(r.walletId);if(!wallets.has(r.walletId))fail('cartera de regla inexistente.');
    date(r.startDate);if(r.endDate!==undefined){date(r.endDate);if(r.endDate<r.startDate)fail('fin anterior al inicio.');}
    if(!Number.isInteger(r.day)||r.day<1||r.day>31)fail('día fuera de 1–31.');
    boolean(r.active);if(r.deleted!==undefined){boolean(r.deleted);if(r.deleted&&r.active)fail('regla eliminada activa.');}
  }
  distinct(raw.recurringRules.map(r=>r.id));distinct(raw.occurrences.map(o=>o.id));distinct(raw.obligations.map(o=>o.id));
  const rules=new Set(raw.recurringRules.map(r=>r.id));
  const txs=new Map(data.transactions.map(t=>[t.id,t]));
  const linked=new Set<string>();
  for(const o of raw.occurrences) {
    shape(o,['id','ruleId','dueDate','status'],['transactionId']);id(o.id);id(o.ruleId);date(o.dueDate);
    if(!rules.has(o.ruleId)||o.id!==`${o.ruleId}@${o.dueDate}`||!['registered','skipped'].includes(o.status))fail('identidad de ocurrencia inválida.');
    if(o.status==='skipped'){if(o.transactionId!==undefined)fail('ocurrencia omitida con movimiento.');continue;}
    id(o.transactionId);const tx=txs.get(o.transactionId);
    if(!tx||linked.has(tx.id)||tx.recurrence?.occurrenceId!==o.id||tx.recurrence.ruleId!==o.ruleId||tx.recurrence.dueDate!==o.dueDate)fail('ocurrencia y movimiento deben permanecer vinculados.');
    linked.add(tx!.id);
  }
  const settlements=new Set<string>();
  for(const o of raw.obligations) {
    shape(o,['id','direction','counterparty','concept','principalCents','date','cancelled','settlements'],['dueDate']);id(o.id);text(o.concept);positive(o.principalCents);date(o.date);boolean(o.cancelled);
    if(!['receivable','payable'].includes(o.direction))fail('dirección de compromiso inválida.');
    shape(o.counterparty,['name'],['contactId']);text(o.counterparty.name);
    if(o.counterparty.contactId!==undefined){id(o.counterparty.contactId);if(!contacts.has(o.counterparty.contactId))fail('contacto del compromiso inexistente.');}
    if(o.dueDate!==undefined){date(o.dueDate);if(o.dueDate<o.date)fail('vencimiento anterior al compromiso.');}
    list(o.settlements,1000);let reserved=0;
    for(const s of o.settlements) {
      shape(s,['id','amountCents','date','kind','processed','note'],['walletId','transactionId']);id(s.id);positive(s.amountCents);date(s.date);boolean(s.processed);
      if(typeof s.note!=='string'||s.note.length>500)fail('nota de liquidación inválida.');
      if(s.date<o.date||settlements.has(s.id)||!['bank','adjustment'].includes(s.kind)||o.cancelled)fail('liquidación duplicada, cancelada o inválida.');
      settlements.add(s.id);reserved=safeCents(reserved+s.amountCents);
      if(s.kind==='adjustment'){if(!s.processed||s.walletId!==undefined||s.transactionId!==undefined)fail('ajuste sin banco inválido.');continue;}
      id(s.walletId);id(s.transactionId);const tx=txs.get(s.transactionId);
      if(!wallets.has(s.walletId)||!tx||linked.has(tx.id)||tx.obligationSettlement?.obligationId!==o.id||tx.obligationSettlement.settlementId!==s.id||tx.obligationSettlement.walletId!==s.walletId||tx.amount!==s.amountCents/100||tx.date!==s.date||tx.processed!==s.processed||tx.type!==(o.direction==='receivable'?'INGRESO':'GASTO'))fail('liquidación y banco inconsistentes.');
      linked.add(tx!.id);
    }
    if(reserved>o.principalCents)fail('cobros/pagos superiores al principal (incluidos pendientes).');
  }
  for(const tx of data.transactions) {
    if(tx.recurrence) {
      shape(tx.recurrence,['ruleId','occurrenceId','dueDate','walletId']);id(tx.recurrence.walletId);
      if(!wallets.has(tx.recurrence.walletId)||!linked.has(tx.id)||tx.transfer||tx.loanId||tx.reimbursement||tx.splitInfo||tx.obligationSettlement)fail('movimiento periódico incompatible o huérfano.');
    }
    if(tx.obligationSettlement){shape(tx.obligationSettlement,['obligationId','settlementId','walletId']);if(!linked.has(tx.id)||tx.transfer||tx.loanId||tx.reimbursement||tx.splitInfo||tx.recurrence)fail('flujo de principal incompatible o huérfano.');}
  }
}

/** Historical identities and payment histories cannot be removed by unrelated forms. */
export function assertIntelligentTransition(before: FinanceData, after: FinanceData) {
  const old=intelligent(before),next=intelligent(after);
  for(const r of old.recurringRules)if(!next.recurringRules.some(n=>n.id===r.id))fail('elimina reglas mediante una baja trazable.');
  for(const o of old.occurrences) {
    const n=next.occurrences.find(n=>n.id===o.id);
    if(!n||n.ruleId!==o.ruleId||n.dueDate!==o.dueDate||n.status!==o.status||n.transactionId!==o.transactionId)fail('no se puede reescribir o eliminar una identidad de ocurrencia.');
  }
  for(const o of old.obligations) {
    const n=next.obligations.find(n=>n.id===o.id);
    if(o.settlements.length && (!n||n.principalCents!==o.principalCents||n.direction!==o.direction||n.date!==o.date||JSON.stringify(n.counterparty)!==JSON.stringify(o.counterparty)||n.cancelled!==o.cancelled))fail('compromiso con historial: principal, contraparte y dirección protegidos.');
    for(const s of o.settlements) {
      const ns=n?.settlements.find(x=>x.id===s.id);
      // Processing a pending bank movement is the only mutable history field.
      if(!ns||JSON.stringify({...ns,processed:s.processed})!==JSON.stringify(s))fail('el historial de liquidaciones es inmutable.');
    }
  }
  for(const t of before.transactions) {
    const n=after.transactions.find(x=>x.id===t.id);
    if(t.recurrence&&JSON.stringify({...t.recurrence,walletId:undefined})!==JSON.stringify(n?.recurrence?{...n.recurrence,walletId:undefined}:undefined))fail('conserva el origen del movimiento periódico.');
    if(t.obligationSettlement&&JSON.stringify(t.obligationSettlement)!==JSON.stringify(n?.obligationSettlement))fail('conserva el vínculo de liquidación.');
  }
}

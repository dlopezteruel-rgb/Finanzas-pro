import React, { useEffect, useMemo, useState } from 'react';
import type { FinanceData } from '../utils/backup';
import type { BudgetPartida, MonthlyBudgetRow, PlanningLine, PlanningTotals } from '../types/finance';
import type { SaveResult } from '../utils/saveResult';
import { annualPlanning, parsePlanningMoney, planningKey, planningLines, planningScope, planningStatus, planningTotals, planCents, safeCents, planningMoneyInput, formatPlanningCents } from '../utils/planning';
import { calculateMonthlyBudgetRows, calculateMonthlySummary, formatCurrency } from '../utils/finance';
import { useAsyncForm } from '../utils/useAsyncForm';
import { SafeDialog } from './SafeDialog';

const money = formatPlanningCents;
const labels: Record<keyof PlanningTotals, string> = { income: 'Ingresos previstos', expenses: 'Gastos previstos', savings: 'Ahorro objetivo', available: 'Disponible para gastar', margin: 'Margen por asignar', balance: 'Balance previsto' };
function Totals({ totals }: { totals: PlanningTotals }) {
  return <dl className="planning-totals">{(Object.keys(labels) as (keyof PlanningTotals)[]).map(key => <div key={key}><dt>{labels[key]}</dt><dd>{money(totals[key])}</dd></div>)}</dl>;
}
interface Props {
  data: FinanceData;
  month: string;
  onMonth: (month: string) => void;
  onSave: (edits: PlanningLine[], savings: number, scope: string, approve: boolean, deficit: boolean) => Promise<SaveResult>;
  onDirty: (dirty: boolean, saving: boolean) => void;
  onDetail: (partida: BudgetPartida, row: MonthlyBudgetRow) => void;
}
export function PlanningView({ data, month, onMonth, onSave, onDirty, onDetail }: Props) {
  // Preserve unknown historical plans as editable rows rather than dropping them.
  const catalog = data.budgetGroups.flatMap(g => g.partidas);
  const known = new Set(catalog.map(planningKey));
  const missing: BudgetPartida[] = data.budgetPlans.filter(p => p.monthYear === month && !known.has(planningKey(p))).map(p => ({ ...p, name: `Partida histórica ${p.code}`, groupName: 'Fuera del catálogo', groupCode: 'historical', keywords: [] }));
  const partidas = [...catalog, ...missing];
  const initialFields = Object.fromEntries(partidas.map(p => [planningKey(p), String(data.budgetPlans.find(b => b.monthYear === month && planningKey(b) === planningKey(p))?.plannedAmount ?? 0)]));
  const initialSavings = planningMoneyInput(data.planningMonths?.find(m => m.monthYear === month)?.savingsCents ?? 0);
  const [fields, setFields] = useState(initialFields);
  const [savings, setSavings] = useState(initialSavings);
  const [base, setBase] = useState(() => ({ fields: initialFields, savings: initialSavings, scope: planningScope(data, month) }));
  const [review, setReview] = useState(false);
  const [acceptDeficit, setAcceptDeficit] = useState(false);
  const [notice, setNotice] = useState('');
  const [annual, setAnnual] = useState(false);
  const submission = useAsyncForm();
  const dirty = savings !== base.savings || JSON.stringify(fields) !== JSON.stringify(base.fields);
  useEffect(() => { onDirty(dirty, submission.saving); }, [dirty, submission.saving, onDirty]);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => { if (dirty || submission.saving) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty, submission.saving]);
  // Changes from another UI refresh an untouched editor; local edits stay visible.
  const scope = planningScope(data, month);
  useEffect(() => {
    if (!dirty && scope !== base.scope) {
      setFields(initialFields); setSavings(initialSavings); setBase({ fields: initialFields, savings: initialSavings, scope });
    }
  }, [scope]);
  const errors: Record<string, string> = {};
  const edits: PlanningLine[] = [];
  for (const p of partidas) {
    try { edits.push({ type: p.type, code: p.code, amountCents: parsePlanningMoney(fields[planningKey(p)] ?? '0') }); }
    catch (error) { errors[planningKey(p)] = (error as Error).message; }
  }
  let totals: PlanningTotals | null = null, savingsError = '', totalError = '';
  try {
    const cents = parsePlanningMoney(savings);
    if (!Object.keys(errors).length) totals = planningTotals(edits, cents);
  } catch (error) { savingsError = (error as Error).message; }
  if (!totals && !savingsError && !Object.keys(errors).length) totalError = 'No se pueden calcular los totales.';
  const valid = !!totals && !Object.keys(errors).length && !savingsError;
  const deficit = !!totals && (totals.margin < 0 || totals.savings > totals.income);
  const rows = calculateMonthlyBudgetRows(month, data.transactions, data.budgetPlans, partidas);
  const summary = calculateMonthlySummary(month, data.transactions, data.budgetPlans, partidas);
  const currentMeta = data.planningMonths?.find(m => m.monthYear === month);
  const yearRows = useMemo(() => {
    try {
      const rows = annualPlanning(data, month.slice(0, 4));
      for (const key of Object.keys(labels) as (keyof PlanningTotals)[]) rows.reduce((sum, r) => safeCents(sum + r.totals[key], false), 0);
      return rows;
    } catch { return null; }
  }, [data, month]);
  const commit = (approve: boolean) => {
    if (!valid || !totals) return;
    const savedFields = { ...fields }, savedSavings = savings;
    void submission.submit(() => onSave(edits, totals.savings, base.scope, approve, acceptDeficit), () => {
      // Canonical persisted fields may differ (e.g. Spanish input); rebuild next render.
      setBase({ fields: savedFields, savings: savedSavings, scope: base.scope });
      setReview(false); setNotice(approve ? 'Previsión aprobada.' : 'Borrador guardado.');
    });
  };
  const discard = () => { setFields(initialFields); setSavings(initialSavings); setBase({ fields: initialFields, savings: initialSavings, scope }); submission.clearError(); setNotice('Borrador local descartado.'); };
  const names = new Map(partidas.map(p => [planningKey(p), p.name]));
  return <section className="planning space-y-4" aria-label="Planificación financiera">
    <div className="planning-card space-y-3">
      <h1 className="text-xl font-bold">Planificación financiera</h1>
      <p>Ingresos, ahorro objetivo y distribución de gastos. El ahorro objetivo no modifica movimientos ni saldos.</p>
      <div className="flex flex-wrap gap-3 items-center">
        <label>Mes de planificación <input aria-label="Mes de planificación" type="month" min="0001-01" max="9999-12" value={month} disabled={submission.saving} onChange={e => { if (/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) onMonth(e.target.value); }} /></label>
        <button type="button" aria-pressed={annual} onClick={() => setAnnual(!annual)}>{annual ? 'Ocultar resumen anual' : 'Ver resumen anual'}</button>
      </div>
      <p role="status">{dirty ? 'Cambios locales sin guardar · ' : ''}{planningStatus(data, month)}</p>
      {currentMeta?.approval && <p>Última aprobación n.º {currentMeta.approval.number} · {new Date(currentMeta.approval.approvedAt).toLocaleString('es-ES')}</p>}
      <label className="block">Ahorro objetivo (€) <input aria-label="Ahorro objetivo (€)" inputMode="decimal" value={savings} aria-invalid={!!savingsError} aria-describedby={savingsError ? 'planning-savings-error' : undefined} disabled={submission.saving} onChange={e => { setSavings(e.target.value); setNotice(''); submission.clearError(); }} /></label>
      {savingsError && <p id="planning-savings-error" role="alert">{savingsError}</p>}
      {totals ? <Totals totals={totals} /> : <p role="alert">Corrige los importes para calcular y guardar los totales. {totalError}</p>}
      {deficit && <p role="alert">Advertencia: déficit de asignación o ahorro objetivo superior a los ingresos. No se corregirán los importes automáticamente.</p>}
      <p>Balance real / ahorro realizado: <strong>{formatCurrency(summary.balanceReal)}</strong>. Solo movimientos procesados, con las reglas contables vigentes.</p>
      {submission.error && <p role="alert">{submission.error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={!valid || submission.saving} onClick={() => commit(false)}>Guardar borrador</button>
        <button disabled={submission.saving || !dirty} onClick={discard}>Descartar cambios</button>
        <button disabled={!valid || submission.saving} onClick={() => { submission.clearError(); setAcceptDeficit(false); setReview(true); }}>Revisar y aprobar previsión</button>
      </div>
    </div>
    {annual && <div className="planning-card overflow-x-auto"><h2 className="text-lg font-bold">Resumen anual {month.slice(0,4)}</h2>
      {yearRows ? <><p>Cobertura {yearRows.filter(r => r.status !== 'Sin plan').length}/12 meses. Suma parcial de meses planificados; no incluye cambios locales sin guardar.</p>
        <table><caption>Previsiones mensuales guardadas</caption><thead><tr><th>Mes</th>{Object.values(labels).map(label => <th key={label}>{label}</th>)}<th>Estado</th></tr></thead><tbody>
          {yearRows.map(r => <tr key={r.monthYear}><th><button onClick={() => onMonth(r.monthYear)}>{r.monthYear}</button></th>{(Object.keys(labels) as (keyof PlanningTotals)[]).map(k => <td key={k}>{money(r.totals[k])}</td>)}<td>{r.status}</td></tr>)}
        </tbody><tfoot><tr><th>Total planificado</th>{(Object.keys(labels) as (keyof PlanningTotals)[]).map(k => <td key={k}>{money(yearRows.filter(r => r.status !== 'Sin plan').reduce((sum,r) => sum+r.totals[k],0))}</td>)}<td>Parcial si cobertura &lt; 12</td></tr></tfoot></table></> : <p role="alert">Hay importes históricos con más de dos decimales o totales fuera del rango seguro. Revísalos antes de calcular el resumen anual.</p>}
    </div>}
    {(['INGRESO', 'GASTO'] as const).map(type => <div className="planning-card space-y-3" key={type}><h2 className="text-lg font-bold">{type === 'INGRESO' ? 'Ingresos' : 'Gastos'}</h2>
      {[...data.budgetGroups.filter(g => g.type === type), ...(missing.some(p => p.type === type) ? [{ code: 'historical', name: 'Fuera del catálogo', type, partidas: missing.filter(p => p.type === type) }] : [])].map(group => {
        const groupEdits = edits.filter(l => group.partidas.some(p => planningKey(p) === planningKey(l)));
        const groupValid = group.partidas.every(p => !errors[planningKey(p)]);
        const groupExecuted = group.partidas.reduce((sum,p) => sum + Math.round((rows.find(r => planningKey(r) === planningKey(p))?.ejecutado ?? 0)*100),0);
        return <fieldset key={group.code} disabled={submission.saving} className="space-y-2"><legend className="font-bold">{group.name}</legend>
          {group.partidas.map(p => { const key=planningKey(p), row=rows.find(r => planningKey(r)===key)!;
            const cents=edits.find(l => planningKey(l)===key)?.amountCents;
            return <div className="planning-row" key={key}>
              <label htmlFor={`plan-${key}`}>{p.name}</label>
              <div><input id={`plan-${key}`} aria-label={`Previsto ${type} ${p.name}`} inputMode="decimal" value={fields[key] ?? '0'} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `error-${key}` : undefined} onChange={e => { setFields(prev => ({ ...prev, [key]: e.target.value })); setNotice(''); submission.clearError(); }} />
                {errors[key] && <p id={`error-${key}`} role="alert">{errors[key]}</p>}</div>
              <span>Ejecutado: {formatCurrency(row.ejecutado)}</span><span>Diferencia: {cents === undefined ? '—' : money(cents - Math.round(row.ejecutado*100))}</span>
              <button onClick={() => onDetail(p,row)} type="button" aria-label={`Detalle ${p.name}`}>Detalle</button>
            </div>;
          })}
          <p className="font-bold">Total {group.name}: previsto {groupValid ? money(groupEdits.reduce((n,l)=>n+l.amountCents,0)) : 'pendiente de corregir'} · ejecutado {money(groupExecuted)} · diferencia {groupValid ? money(groupEdits.reduce((n,l)=>n+l.amountCents,0)-groupExecuted) : '—'}</p>
        </fieldset>;
      })}
    </div>)}
    {currentMeta?.approval && <details className="planning-card"><summary>Comparar con la última aprobación</summary><Totals totals={currentMeta.approval.totals} /><p>Fotografía n.º {currentMeta.approval.number}, revisión {currentMeta.approval.revision}. Los importes siguientes son inmutables.</p>
      <table><thead><tr><th>Partida</th><th>Aprobado</th><th>Previsto actual guardado</th></tr></thead><tbody>{[...new Map([...currentMeta.approval.lines, ...planningLines(data.budgetPlans,month)].map(l => [planningKey(l),l])).values()].map(l => <tr key={planningKey(l)}><th>{l.type} · {names.get(planningKey(l)) ?? l.code}</th><td>{money(currentMeta.approval!.lines.find(a => planningKey(a)===planningKey(l))?.amountCents ?? 0)}</td><td>{money(planCents(data.budgetPlans.find(p => p.monthYear===month && planningKey(p)===planningKey(l))?.plannedAmount ?? 0))}</td></tr>)}</tbody></table>
    </details>}
    {review && totals && <SafeDialog title="Revisar y aprobar previsión" onCancel={() => { if (!submission.saving) setReview(false); }}><div className="planning space-y-3">
      <p>Periodo {month}. Se guardarán todos los importes, el objetivo y la fotografía aprobada en una sola operación.</p><Totals totals={totals} />
      {deficit && <><p role="alert">Existe déficit: el margen es negativo o el ahorro supera los ingresos.</p><label><input type="checkbox" checked={acceptDeficit} disabled={submission.saving} onChange={e => setAcceptDeficit(e.target.checked)} /> Acepto aprobar conscientemente esta previsión con déficit</label></>}
      <details><summary>Desglose de la aprobación</summary>{edits.filter(l => l.amountCents>0).map(l => <p key={planningKey(l)}>{l.type} · {names.get(planningKey(l))}: {money(l.amountCents)}</p>)}</details>
      {submission.error && <p role="alert">{submission.error}</p>}
      <div className="flex gap-2"><button disabled={submission.saving} onClick={() => setReview(false)}>Cancelar</button><button disabled={submission.saving || (deficit && !acceptDeficit)} onClick={() => commit(true)}>{submission.saving ? 'Guardando…' : 'Confirmar aprobación'}</button></div>
    </div></SafeDialog>}
  </section>;
}

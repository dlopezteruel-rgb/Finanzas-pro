import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { FinanceData } from '../utils/backup';
import type { BudgetPartida, MonthlyBudgetRow, PlanningLine, PlanningTotals } from '../types/finance';
import type { SaveResult } from '../utils/saveResult';
import { annualPlanning, planningKey, planningLines, planningScope, planningStatus, safeCents, planningMoneyInput, formatPlanningCents } from '../utils/planning';
import { calculateMonthlySummary, formatCurrency } from '../utils/finance';
import { PlanningAutomationPanel } from './PlanningAutomationPanel';
import type { AutomationPreview } from '../utils/planningAutomation';
import { carryLines, combineLines, planningBudgetRows } from '../utils/planningBasis';
import { useAsyncForm } from '../utils/useAsyncForm';
import { ChartSlot } from './charts/ChartSlot';
import { PlanningSection } from './PlanningSection';
import { PlanningLiveSummary } from './PlanningLiveSummary';
import { planningDraftPreview } from './planningPreview';
import { carryIsStale } from '../utils/planningCarry';
import { SafeDialog } from './SafeDialog';

const money = formatPlanningCents;
const labels: Record<keyof PlanningTotals, string> = { income: 'Ingresos previstos', expenses: 'Gastos previstos', savings: 'Ahorro objetivo', available: 'Disponible para gastar', margin: 'Margen por asignar', balance: 'Balance previsto' };
function Totals({ totals }: { totals: PlanningTotals | null }) {
  return <dl className="planning-totals">{(Object.keys(labels) as (keyof PlanningTotals)[]).map(key => <div key={key}><dt>{labels[key]}</dt><dd>{totals ? money(totals[key]) : '—'}</dd></div>)}</dl>;
}
interface Props {
  data: FinanceData;
  month: string;
  onMonth: (month: string) => void;
  onSave: (edits: PlanningLine[], savings: number, scope: string, approve: boolean, deficit: boolean) => Promise<SaveResult>;
  onDirty: (dirty: boolean, saving: boolean) => void;
  onAutomation: (preview: AutomationPreview) => Promise<SaveResult>;
  onDetail: (partida: BudgetPartida, row: MonthlyBudgetRow) => void;
}
export function PlanningView({ data, month, onMonth, onSave, onDirty, onDetail, onAutomation }: Props) {
  // Preserve unknown historical plans as editable rows rather than dropping them.
  const catalog = data.budgetGroups.flatMap(g => g.partidas);
  const known = new Set(catalog.map(planningKey));
  const historicPlans = [...data.budgetPlans,...carryLines(data,month).map(l=>({monthYear:month,code:l.code,type:l.type,plannedAmount:0}))];
  const missing: BudgetPartida[] = [...new Map(historicPlans.filter(p => p.monthYear === month && !known.has(planningKey(p))).map(p => ({ ...p, name: `Partida histórica ${p.code}`, groupName: 'Fuera del catálogo', groupCode: 'historical', keywords: [] })).map(p=>[planningKey(p),p])).values()];
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isOpen = (key: string) => expanded[key] ?? true;
  const toggle = (key: string) => setExpanded(previous => ({ ...previous, [key]: !(previous[key] ?? true) }));
  const submission = useAsyncForm();
  const [automationBusy,setAutomationBusy]=useState(false);
  const [carryReview,setCarryReview]=useState<{id:string}|null>(null);
  const dirty = savings !== base.savings || JSON.stringify(fields) !== JSON.stringify(base.fields);
  useLayoutEffect(() => { onDirty(dirty, submission.saving || automationBusy); }, [dirty, submission.saving, automationBusy, onDirty]);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => { if (dirty || submission.saving || automationBusy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty, submission.saving, automationBusy]);
  // Changes from another UI refresh an untouched editor; local edits stay visible.
  const scope = planningScope(data, month);
  useEffect(() => {
    if (!dirty && scope !== base.scope) {
      setFields(initialFields); setSavings(initialSavings); setBase({ fields: initialFields, savings: initialSavings, scope });
    }
  }, [scope]);
  const adjustments=carryLines(data,month);
  const preview=planningDraftPreview(partidas.map(p=>({type:p.type,code:p.code,input:fields[planningKey(p)] ?? '0'})),savings,adjustments);
  const {edits,errors,totals,savingsError,totalError}=preview;
  const valid = !!totals && !Object.keys(errors).length && !savingsError;
  const deficit = !!totals && (totals.margin < 0 || totals.savings > totals.income);
  const rows = planningBudgetRows(data,month,partidas);
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
      <h2 className="text-xl font-bold">Planificación financiera</h2>
      <p>Ingresos, ahorro objetivo y distribución de gastos. El ahorro objetivo no modifica movimientos ni saldos.</p>
      <div className="flex flex-wrap gap-3 items-center">
        <label>Mes de planificación <input aria-label="Mes de planificación" type="month" min="0001-01" max="9999-12" value={month} disabled={submission.saving} onChange={e => { if (/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) onMonth(e.target.value); }} /></label>
        <button type="button" aria-pressed={annual} onClick={() => setAnnual(!annual)}>{annual ? 'Ocultar resumen anual' : 'Ver resumen anual'}</button>
      </div>
      <p role="status">{dirty ? 'Cambios locales sin guardar · ' : ''}{planningStatus(data, month)}</p>
      {currentMeta?.approval && <p>Última aprobación n.º {currentMeta.approval.number} · {new Date(currentMeta.approval.approvedAt).toLocaleString('es-ES')}</p>}
      <label className="block">Ahorro objetivo (€) <input aria-label="Ahorro objetivo (€)" inputMode="decimal" value={savings} aria-invalid={!!savingsError} aria-describedby={savingsError ? 'planning-savings-error' : undefined} disabled={submission.saving} onChange={e => { setSavings(e.target.value); setNotice(''); submission.clearError(); }} /></label>
      {savingsError && <p id="planning-savings-error" role="alert">{savingsError}</p>}

      {!totals && <p role="alert">Corrige los importes para calcular y guardar los totales. {totalError}</p>}
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
    <div className="planning-workbench">
      <PlanningLiveSummary preview={preview} dirty={dirty}/>
      <div className="planning-partidas">
    {(['INGRESO', 'GASTO'] as const).map(type => {
      const title = type === 'INGRESO' ? 'Ingresos' : 'Gastos';
      const blockKey = `block:${type}`;
      const groups = [...data.budgetGroups.filter(g => g.type === type).map(g => ({ ...g, key: `family:${type}:${g.code}` })),
        ...(missing.some(p => p.type === type) ? [{ key: `historical:${type}`, name: 'Fuera del catálogo', partidas: missing.filter(p => p.type === type) }] : [])];
      const stats = (items: BudgetPartida[]) => {
        const keys = new Set(items.map(planningKey));
        const effectiveEdits=combineLines(edits,carryLines(data,month));
        const invalidCount = items.filter(p => errors[planningKey(p)]).length;
        let planned: number | null = null;
        if (!invalidCount) try { planned = effectiveEdits.filter(l => keys.has(planningKey(l))).reduce((sum, l) => safeCents(sum + l.amountCents), 0); } catch { /* Keep invalid totals explicit. */ }
        const executed = rows.filter(r => keys.has(planningKey(r))).reduce((sum, r) => sum + Math.round(r.ejecutado * 100), 0);
        const deviation = planned === null ? '' : type === 'GASTO' && executed > planned
          ? `Desviación: el ejecutado supera el previsto en ${money(executed - planned)}.`
          : type === 'INGRESO' && executed < planned ? `Pendiente de ingresar respecto al previsto: ${money(planned - executed)}.` : '';
        const carried=adjustments.filter(l=>keys.has(planningKey(l))).reduce((sum,l)=>safeCents(sum+l.amountCents),0);
        return { planned, executed, invalidCount, count: items.length, warning: deviation, carried };
      };
      const blockStats = stats(partidas.filter(p => p.type === type));
      const deficitWarning = totals && (type === 'INGRESO' ? totals.savings > totals.income : totals.margin < 0)
        ? type === 'INGRESO' ? 'Advertencia: ahorro objetivo superior a los ingresos previstos.' : 'Advertencia: margen por asignar negativo.' : '';
      return <PlanningSection key={type} title={title} open={isOpen(blockKey)} onToggle={() => toggle(blockKey)}
        {...blockStats} warning={[blockStats.warning, deficitWarning].filter(Boolean).join(' ')}
        onAll={open => setExpanded(previous => ({ ...previous, [blockKey]: open, ...Object.fromEntries(groups.map(g => [g.key, open])) }))}>
        {groups.map(group => <PlanningSection key={group.key} title={group.name} family open={isOpen(group.key)} onToggle={() => toggle(group.key)} {...stats(group.partidas)}>
          <fieldset disabled={submission.saving} className="space-y-2" aria-label={`Importes de ${group.name}`}>
            {group.partidas.map(p => { const key = planningKey(p), row = rows.find(r => planningKey(r) === key)!;
              const carries=data.planningAutomation?.carryovers.filter(c=>c.toMonth===month&&c.code===p.code&&p.type==='GASTO') ?? [];
              const cents = errors[key]?undefined:combineLines(edits,carryLines(data,month)).find(l => planningKey(l) === key)?.amountCents ?? 0;
              return <div className="planning-row" key={key}>
                <label htmlFor={`plan-${key}`}>{p.name}<span className="planning-base-label">Presupuesto base (€)</span></label>
                <div><input id={`plan-${key}`} aria-label={`Previsto ${type} ${p.name}`} inputMode="decimal" value={fields[key] ?? '0'} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `error-${key}` : undefined} onChange={e => { setFields(prev => ({ ...prev, [key]: e.target.value })); setNotice(''); submission.clearError(); }} />
                  {errors[key] && <p id={`error-${key}`} role="alert">{errors[key]}</p>}</div>
                <span>Ejecutado: {formatCurrency(row.ejecutado)}</span><span>Diferencia: {cents === undefined ? '—' : money(cents - Math.round(row.ejecutado * 100))}</span>
                <button onClick={() => onDetail(p, row)} type="button" aria-label={`Detalle ${p.name}`}>Detalle</button>
                {carries.length>0&&<div className="planning-carry" role="group" aria-label={`Arrastre de ${p.name}`}>
                  {carries.map(c=><div key={c.id}><p><strong>+{money(c.amountCents)}</strong> arrastrados de {new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric',timeZone:'Europe/Madrid'}).format(new Date(`${c.fromMonth}-15T12:00:00Z`))} <span>({c.fromMonth})</span></p>
                    {carryIsStale(data,c)&&<p role="status" className="planning-warning">Arrastre potencialmente desactualizado. Revisa el origen; el ajuste no se ha recalculado.</p>}
                    <button type="button" disabled={dirty||submission.saving||automationBusy} onClick={()=>setCarryReview({id:c.id})}>Revisar arrastre de {p.name}</button>
                  </div>)}
                  <p>Presupuesto efectivo: <strong>{cents===undefined?'Pendiente de corregir':money(cents)}</strong> · Base editable + arrastre guardado</p>
                  {dirty&&<p>Guarda o descarta el borrador antes de revisar el arrastre.</p>}
                </div>}
              </div>;
            })}
          </fieldset>
        </PlanningSection>)}
      </PlanningSection>;
    })}
      </div>
    </div>
    <PlanningAutomationPanel data={data} month={month} blocked={dirty||submission.saving} onBusy={setAutomationBusy} onApply={onAutomation} requestCarryReview={carryReview}/>
    <ChartSlot data={data} month={month} kind="planning"/>
    {annual && <div className="planning-card overflow-x-auto"><h2 className="text-lg font-bold">Resumen anual {month.slice(0,4)}</h2>
      {yearRows ? <><p>Cobertura {yearRows.filter(r => r.status !== 'Sin plan').length}/12 meses. Suma parcial de meses planificados; no incluye cambios locales sin guardar.</p>
        <table><caption>Previsiones mensuales guardadas</caption><thead><tr><th>Mes</th>{Object.values(labels).map(label => <th key={label}>{label}</th>)}<th>Base gastos</th><th>Arrastre</th><th>Ejecutado propio</th><th>Procedencia registrada</th><th>Estado</th></tr></thead><tbody>
          {yearRows.map(r => <tr key={r.monthYear}><th><button onClick={() => onMonth(r.monthYear)}>{r.monthYear}</button></th>{(Object.keys(labels) as (keyof PlanningTotals)[]).map(k => <td key={k}>{money(r.totals[k])}</td>)}<td>{money(r.baseExpenses)}</td><td>{money(r.carryoverCents)}</td><td>{formatCurrency(r.executed)}</td><td>{r.origins.map(o=>o==='copy'?'Copiada':o==='rule'?'Regla':'Manual').join(' / ')||(r.status==='Sin plan'?'—':'Manual')}</td><td>{r.status}</td></tr>)}
        </tbody><tfoot><tr><th>Total planificado</th>{(Object.keys(labels) as (keyof PlanningTotals)[]).map(k => <td key={k}>{money(yearRows.filter(r => r.status !== 'Sin plan').reduce((sum,r) => sum+r.totals[k],0))}</td>)}<td colSpan={5}>Parcial si cobertura &lt; 12</td></tr></tfoot></table></> : <p role="alert">Hay importes históricos con más de dos decimales o totales fuera del rango seguro. Revísalos antes de calcular el resumen anual.</p>}
    </div>}
    {currentMeta?.approval && <details className="planning-card"><summary>Comparar con la última aprobación</summary><Totals totals={currentMeta.approval.totals} /><p>Fotografía n.º {currentMeta.approval.number}, revisión {currentMeta.approval.revision}. Los importes siguientes son inmutables.</p>
      <table><thead><tr><th>Partida</th><th>Aprobado</th><th>Previsto actual guardado</th></tr></thead><tbody>{[...new Map([...currentMeta.approval.lines, ...combineLines(planningLines(data.budgetPlans,month),carryLines(data,month))].map(l => [planningKey(l),l])).values()].map(l => <tr key={planningKey(l)}><th>{l.type} · {names.get(planningKey(l)) ?? l.code}</th><td>{money(currentMeta.approval!.lines.find(a => planningKey(a)===planningKey(l))?.amountCents ?? 0)}</td><td>{money(combineLines(planningLines(data.budgetPlans,month),carryLines(data,month)).find(p=>planningKey(p)===planningKey(l))?.amountCents ?? 0)}</td></tr>)}</tbody></table>
    </details>}
    {review && totals && <SafeDialog title="Revisar y aprobar previsión" onCancel={() => { if (!submission.saving) setReview(false); }}><div className="planning space-y-3">
      <p>Periodo {month}. Se guardarán todos los importes, el objetivo y la fotografía aprobada en una sola operación.</p><Totals totals={totals} />
      {deficit && <><p role="alert">Existe déficit: el margen es negativo o el ahorro supera los ingresos.</p><label><input type="checkbox" checked={acceptDeficit} disabled={submission.saving} onChange={e => setAcceptDeficit(e.target.checked)} /> Acepto aprobar conscientemente esta previsión con déficit</label></>}
      <details><summary>Desglose de la aprobación</summary><p>Previsión efectiva: incluye base y ajustes de arrastre guardados.</p>{combineLines(edits,carryLines(data,month)).map(l => <p key={planningKey(l)}>{l.type} · {names.get(planningKey(l))}: {money(l.amountCents)}</p>)}</details>
      {submission.error && <p role="alert">{submission.error}</p>}
      <div className="flex gap-2"><button disabled={submission.saving} onClick={() => setReview(false)}>Cancelar</button><button disabled={submission.saving || (deficit && !acceptDeficit)} onClick={() => commit(true)}>{submission.saving ? 'Guardando…' : 'Confirmar aprobación'}</button></div>
    </div></SafeDialog>}
  </section>;
}

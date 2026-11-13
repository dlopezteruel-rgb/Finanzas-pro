import {planningOwnedText} from '../i18n/planningMessages';
import { useI18n, I18nText, type MessageKey } from "../i18n";
import {planningStatusText} from '../i18n/presenters';
import { PlanningSubitems } from './PlanningSubitems';
import { subitemContent, subitemSum } from '../utils/budgetSubitems';
import React, { useEffect, useId, useLayoutEffect, useMemo, useState } from 'react';
import type { FinanceData } from '../utils/backup';
import type { BudgetPartida, MonthlyBudgetRow, PlanningLine, PlanningTotals, MonthlySubitemPlan } from '../types/finance';
import type { SaveResult } from '../utils/saveResult';
import { annualPlanning, planningKey, planningLines, planningScope, planningStatus, safeCents, parsePlanningMoney, planningMoneyInput, formatPlanningCents } from '../utils/planning';
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
const labels = { income: 'planning.metric.income', expenses: 'planning.metric.expenses', savings: 'planning.metric.savings', available: 'planning.metric.available', margin: 'planning.metric.margin', balance: 'planning.metric.balance' } as const satisfies Record<keyof PlanningTotals, MessageKey>;

function Totals({ totals }: { totals: PlanningTotals | null }) {
  const { t: uiText } = useI18n();
  return <dl className="planning-totals">{(Object.keys(labels) as (keyof PlanningTotals)[]).map(key => <div key={key}><dt>{uiText(labels[key])}</dt><dd>{totals ? money(totals[key]) : '—'}</dd></div>)}</dl>;
}
interface Props {
  data: FinanceData;
  month: string;
  onMonth: (month: string) => void;
  onSave: (edits: PlanningLine[], savings: number, scope: string, approve: boolean, deficit: boolean, subitems?: MonthlySubitemPlan[]) => Promise<SaveResult>;
  onDirty: (dirty: boolean, saving: boolean) => void;
  onRegisterNavigationSave?: (save: (()=>Promise<boolean>) | null) => void;
  onAutomation: (preview: AutomationPreview) => Promise<SaveResult>;
  onDetail: (partida: BudgetPartida, row: MonthlyBudgetRow) => void;
}
export function PlanningView({ data, month, onMonth, onSave, onDirty, onDetail, onAutomation, onRegisterNavigationSave }: Props) {
  const { t: uiText } = useI18n();
  const statusText = (status: string) => planningStatusText(status,uiText);
  // Preserve unknown historical plans as editable rows rather than dropping them.
  const catalog = data.budgetGroups.filter(g=>!g.deleted).flatMap(g=>g.partidas.filter(p=>!p.deleted).map(p=>({...p,archived:!!g.archived||!!p.archived}))).filter(p=>!p.archived||data.budgetPlans.some(b=>b.monthYear===month&&planningKey(b)===planningKey(p))||data.transactions.some(t=>t.date.startsWith(month)&&planningKey(t)===planningKey(p)));
  const known = new Set(catalog.map(planningKey));
  const historicPlans = [...data.budgetPlans,...carryLines(data,month).map(l=>({monthYear:month,code:l.code,type:l.type,plannedAmount:0}))];
  const missing: BudgetPartida[] = [...new Map(historicPlans.filter(p => p.monthYear === month && !known.has(planningKey(p))).map((p,index) => ({ ...p, name: data.transactions.find(t => planningKey(t) === planningKey(p))?.subcategoryName ?? `Partida histórica ${index + 1}`, groupName: 'Fuera del catálogo', groupCode: 'historical', keywords: [] })).map(p=>[planningKey(p),p])).values()];
  const partidas = [...catalog, ...missing];
  const initialFields = Object.fromEntries(partidas.map(p => [planningKey(p), String(data.budgetPlans.find(b => b.monthYear === month && planningKey(b) === planningKey(p))?.plannedAmount ?? 0)]));
  const initialSavings = planningMoneyInput(data.planningMonths?.find(m => m.monthYear === month)?.savingsCents ?? 0);
  const initialBreakdowns:Record<string,Record<string,string>>=Object.fromEntries(subitemContent(data,month).map(m=>[planningKey(m),Object.fromEntries(m.lines.map(l=>[l.subitemId,planningMoneyInput(l.amountCents)]))]));
  const [breakdowns,setBreakdowns]=useState(initialBreakdowns);
  const [fields, setFields] = useState(initialFields);
  const [savings, setSavings] = useState(initialSavings);
  const [base, setBase] = useState(() => ({ fields: initialFields, breakdowns:initialBreakdowns, savings: initialSavings, scope: planningScope(data, month) }));
  const [review, setReview] = useState(false);
  const [acceptDeficit, setAcceptDeficit] = useState(false);
  const [notice, setNotice] = useState<'planning.approvedNotice' | 'planning.draftNotice' | 'planning.discardNotice' | 'planning.correctBeforeContinue' | ''>('');
  const [annual, setAnnual] = useState(false);
  const [editorTab, setEditorTab] = useState<'GASTO' | 'INGRESO' | 'multi'>('GASTO');
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const editorId = useId();
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => { setMobile(media.matches); if (!media.matches) setEditorTab(tab => tab === 'multi' ? 'GASTO' : tab); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const editorTabs = [...(['GASTO', 'INGRESO'] as const).map(id => ({id, name: uiText(id === 'GASTO' ? "planning.gastos" : "planning.ingresos")})), ...(mobile ? [{id: 'multi' as const, name: uiText("planning.multi")}] : [])];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isOpen = (key: string) => expanded[key] ?? true;
  const toggle = (key: string) => setExpanded(previous => ({ ...previous, [key]: !(previous[key] ?? true) }));
  const submission = useAsyncForm();
  const [automationBusy,setAutomationBusy]=useState(false);
  const [carryReview,setCarryReview]=useState<{id:string}|null>(null);
  const dirty = savings !== base.savings || JSON.stringify(fields) !== JSON.stringify(base.fields) || JSON.stringify(breakdowns)!==JSON.stringify(base.breakdowns);
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
      setBreakdowns(initialBreakdowns); setFields(initialFields); setSavings(initialSavings); setBase({ fields: initialFields, breakdowns:initialBreakdowns, savings: initialSavings, scope });
    }
  }, [scope]);
  const adjustments=carryLines(data,month);
  const breakdownDrafts:MonthlySubitemPlan[]=[],calculated:Record<string,string>={};
  for(const [key,values] of Object.entries(breakdowns)) {
    const parent=partidas.find(p=>planningKey(p)===key);
    if(!parent)continue;
    try {
      const lines=Object.entries(values).map(([subitemId,input])=>({subitemId,amountCents:parsePlanningMoney(input)}));
      calculated[key]=planningMoneyInput(subitemSum(lines));
      breakdownDrafts.push({monthYear:month,type:parent.type,code:parent.code,lines});
    }catch{calculated[key]='Importes de subítems pendientes de corregir';}
  }
  const preview=planningDraftPreview(partidas.map(p=>({type:p.type,code:p.code,input:calculated[planningKey(p)] ?? fields[planningKey(p)] ?? '0'})),savings,adjustments);
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
    void submission.submit(() => onSave(edits, totals.savings, base.scope, approve, acceptDeficit,breakdownDrafts), () => {
      // Canonical persisted fields may differ (e.g. Spanish input); rebuild next render.
      setBase({ fields: savedFields, breakdowns, savings: savedSavings, scope: base.scope });
      setReview(false); setNotice(approve ? "planning.approvedNotice" : "planning.draftNotice");
    });
  };
  const discard = () => { setBreakdowns(initialBreakdowns); setFields(initialFields); setSavings(initialSavings); setBase({ fields: initialFields, breakdowns:initialBreakdowns, savings: initialSavings, scope }); submission.clearError(); setNotice("planning.discardNotice"); };
  useLayoutEffect(()=>{
    onRegisterNavigationSave?.(async()=>{
      if(!valid||!totals||submission.saving||automationBusy){setNotice("planning.correctBeforeContinue");return false;}
      let saved=false;
      await submission.submit(()=>onSave(edits,totals.savings,base.scope,false,false,breakdownDrafts),()=>{saved=true;setBase({fields:{...fields},breakdowns,savings,scope:base.scope});setNotice("planning.draftNotice");});
      return saved;
    });
    return ()=>onRegisterNavigationSave?.(null);
  });
  const names = new Map(partidas.map(p => [planningKey(p), p.name]));
  return <section className="planning space-y-4" aria-label={uiText("planning.planificacion_financiera")}>
    <div className="planning-card space-y-3">
      <h2 className="text-xl font-bold">{uiText("planning.planificacion_financiera")}</h2>
      <p>{uiText("planning.ingresos_ahorro_objetivo_y_distribucion_de_gastos_el_ahorro")}</p>
      <div className="flex flex-wrap gap-3 items-center">
        <label>{uiText("planning.mes_de_planificacion")}<input aria-label={uiText("planning.mes_de_planificacion_358662")} type="month" min="0001-01" max="9999-12" value={month} disabled={submission.saving} onChange={e => { if (/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) onMonth(e.target.value); }} /></label>
        <button type="button" aria-pressed={annual} onClick={() => setAnnual(!annual)}>{annual ? uiText("planning.ocultar_resumen_anual") : uiText("planning.ver_resumen_anual")}</button>
      </div>
      <p role="status">{dirty ? uiText("planning.cambios_locales_sin_guardar", {status: statusText(planningStatus(data,month))}) : statusText(planningStatus(data,month))}</p>
      {currentMeta?.approval && <p><I18nText id="planning.ultima_aprobacion_n" values={{ number: (currentMeta.approval.number), content: (new Date(currentMeta.approval.approvedAt).toLocaleString('es-ES')) }} /></p>}
      <label className="planning-savings-label">{uiText("planning.ahorro_objetivo")}<input aria-label={uiText("planning.ahorro_objetivo_a54274")} inputMode="decimal" value={savings} aria-invalid={!!savingsError} aria-describedby={savingsError ? 'planning-savings-error' : undefined} disabled={submission.saving} onChange={e => { setSavings(e.target.value); setNotice(''); submission.clearError(); }} /></label>
      {savingsError && <p id="planning-savings-error" role="alert">{planningOwnedText(savingsError,uiText)}</p>}

      {!totals && <p role="alert"><I18nText id="planning.corrige_los_importes_para_calcular_y_guardar_los_totales" values={{ totalError: (totalError ? planningOwnedText(totalError,uiText) : totalError) }} /></p>}
      {deficit && <p role="alert">{uiText("planning.advertencia_deficit_de_asignacion_o_ahorro_objetivo_superior_a")}</p>}
      <p><I18nText id="planning.balance_real_ahorro_realizado_solo_movimientos_procesados_con_las" values={{ balanceReal: (<strong>{formatCurrency(summary.balanceReal)}</strong>) }} /></p>
      <Totals totals={totals}/>
      {submission.error && <p role="alert">{planningOwnedText(submission.error,uiText)}</p>}
      {notice && <p role="status">{uiText(notice)}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={!valid || submission.saving} onClick={() => commit(false)}>{uiText("planning.guardar_borrador")}</button>
        <button disabled={submission.saving || !dirty} onClick={discard}>{uiText("planning.descartar_cambios")}</button>
        <button disabled={!valid || submission.saving} onClick={() => { submission.clearError(); setAcceptDeficit(false); setReview(true); }}>{uiText("planning.revisar_y_aprobar_prevision")}</button>
      </div>
    </div>
    <div className="planning-editor-layout">
      <div className="planning-editor-tabs budget-tabs" role="tablist" aria-label={uiText("planning.areas_de_planificacion")}>
        {editorTabs.map((tab, index) => <button type="button" key={tab.id} id={`${editorId}-tab-${tab.id}`} role="tab" aria-selected={editorTab === tab.id}
          aria-controls={`${editorId}-panel-${tab.id}`} tabIndex={editorTab === tab.id ? 0 : -1} onClick={() => setEditorTab(tab.id)}
          onKeyDown={event => {
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? editorTabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % editorTabs.length : event.key === 'ArrowLeft' ? (index + editorTabs.length - 1) % editorTabs.length : null;
            if (next !== null) { event.preventDefault(); document.getElementById(`${editorId}-tab-${editorTabs[next].id}`)?.focus(); }
          }}>{tab.name}{tab.id !== 'multi' && partidas.some(p => p.type === tab.id && errors[planningKey(p)]) ? uiText("planning.revisar_importes") : ''}</button>)}
      </div>
      <div className="planning-multiperiod" id={`${editorId}-panel-multi`} role={mobile ? 'tabpanel' : undefined} aria-labelledby={mobile ? `${editorId}-tab-multi` : undefined} hidden={mobile && editorTab !== 'multi'}>
        <details open><summary>{uiText("planning.planificacion_multiperiodo")}</summary>
          <PlanningAutomationPanel data={data} month={month} blocked={dirty||submission.saving} onBusy={setAutomationBusy} onApply={onAutomation} requestCarryReview={carryReview}/>
        </details>
      </div>
    <div className="planning-workbench" hidden={mobile && editorTab === 'multi'}>
      <PlanningLiveSummary preview={preview} dirty={dirty}/>
      <div className="planning-partidas">
    {(['INGRESO', 'GASTO'] as const).map(type => {
      const title = type === 'INGRESO' ? uiText("planning.ingresos") : uiText("planning.gastos");
      const blockKey = `block:${type}`;
      const groups = [...data.budgetGroups.filter(g => g.type === type&&!g.deleted).map(g => ({ ...g, partidas:catalog.filter(p=>g.partidas.some(i=>planningKey(i)===planningKey(p))), key: `family:${type}:${g.code}` })),
        ...(missing.some(p => p.type === type) ? [{ key: `historical:${type}`, name: 'Fuera del catálogo', partidas: missing.filter(p => p.type === type) }] : [])];
      const stats = (items: BudgetPartida[]) => {
        const keys = new Set(items.map(planningKey));
        const effectiveEdits=combineLines(edits,carryLines(data,month));
        const invalidCount = items.filter(p => errors[planningKey(p)]).length;
        let planned: number | null = null;
        if (!invalidCount) try { planned = effectiveEdits.filter(l => keys.has(planningKey(l))).reduce((sum, l) => safeCents(sum + l.amountCents), 0); } catch { /* Keep invalid totals explicit. */ }
        const executed = rows.filter(r => keys.has(planningKey(r))).reduce((sum, r) => sum + Math.round(r.ejecutado * 100), 0);
        const deviation = planned === null ? '' : type === 'GASTO' && executed > planned
          ? uiText("planning.desviacion_el_ejecutado_supera_el_previsto_en", { money: money(executed - planned) })
          : type === 'INGRESO' && executed < planned ? uiText("planning.pendiente_de_ingresar_respecto_al_previsto", { money: money(planned - executed) }) : '';
        const carried=adjustments.filter(l=>keys.has(planningKey(l))).reduce((sum,l)=>safeCents(sum+l.amountCents),0);
        return { planned, executed, invalidCount, count: items.length, warning: deviation, carried };
      };
      const blockStats = stats(partidas.filter(p => p.type === type));
      const deficitWarning = totals && (type === 'INGRESO' ? totals.savings > totals.income : totals.margin < 0)
        ? type === 'INGRESO' ? uiText("planning.advertencia_ahorro_objetivo_superior_a_los_ingresos_previstos") : uiText("planning.advertencia_margen_por_asignar_negativo") : '';
      return <div key={type} id={`${editorId}-panel-${type}`} role="tabpanel" aria-labelledby={`${editorId}-tab-${type}`} hidden={editorTab !== type}>
      <PlanningSection title={title} open={isOpen(blockKey)} onToggle={() => toggle(blockKey)}
        {...blockStats} warning={[blockStats.warning, deficitWarning].filter(Boolean).join(' ')}
        onAll={open => setExpanded(previous => ({ ...previous, [blockKey]: open, ...Object.fromEntries(groups.map(g => [g.key, open])) }))}>
        {groups.map(group => <PlanningSection key={group.key} title={group.name} family open={isOpen(group.key)} onToggle={() => toggle(group.key)} {...stats(group.partidas)}>
          <fieldset disabled={submission.saving} className="space-y-2" aria-label={uiText("planning.importes_de", { name: group.name })}>
            {group.partidas.map(p => { const key = planningKey(p), row = rows.find(r => planningKey(r) === key)!;
              const carries=data.planningAutomation?.carryovers.filter(c=>c.toMonth===month&&c.code===p.code&&p.type==='GASTO') ?? [];
              const cents = errors[key]?undefined:combineLines(edits,carryLines(data,month)).find(l => planningKey(l) === key)?.amountCents ?? 0;
              return <div className="planning-row" key={key}>
                <label htmlFor={`plan-${key}`}>{p.name}{p.archived?uiText("planning.archivada"):''}<span className="planning-base-label">{uiText("planning.presupuesto_base")}</span></label>
                <div><input id={`plan-${key}`} aria-label={uiText("planning.previsto", { type: uiText(type === "GASTO" ? "planning.expenseType" : "planning.incomeType"), name: p.name })} inputMode="decimal" readOnly={!!p.archived||breakdowns[key]!==undefined} value={calculated[key]!==undefined ? planningOwnedText(calculated[key],uiText) : fields[key] ?? '0'} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `error-${key}` : undefined} onChange={e => { setFields(prev => ({ ...prev, [key]: e.target.value })); setNotice(''); submission.clearError(); }} />
                  {errors[key] && <p id={`error-${key}`} role="alert">{planningOwnedText(errors[key],uiText)}</p>}</div>
                <span><I18nText id="planning.ejecutado" values={{ ejecutado: (formatCurrency(row.ejecutado)) }} /></span><span><I18nText id="planning.diferencia" values={{ content: (cents === undefined ? '—' : money(cents - Math.round(row.ejecutado * 100))) }} /></span>
                <button onClick={() => onDetail(p, row)} type="button" aria-label={uiText("planning.detalle_06a921", { name: p.name })}>{uiText("planning.detalle")}</button>
                {!p.archived&&<PlanningSubitems data={data} partida={p} month={month} value={breakdowns[key]} onChange={value=>{setBreakdowns(prev=>({...prev,[key]:value}));setNotice('');submission.clearError();}}/>}
                {carries.length>0&&<div className="planning-carry" role="group" aria-label={uiText("planning.arrastre_de", { name: p.name })}>
                  {carries.map(c=><div key={c.id}><p><I18nText id="planning.arrastrados_de" values={{ amountCents: (<strong>+{money(c.amountCents)}</strong>), content: (new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric',timeZone:'Europe/Madrid'}).format(new Date(`${c.fromMonth}-15T12:00:00Z`))), fromMonth: (<span>({c.fromMonth})</span>) }} /></p>
                    {carryIsStale(data,c)&&<p role="status" className="planning-warning">{uiText("planning.arrastre_potencialmente_desactualizado_revisa_el_origen_el_ajuste_no")}</p>}
                    <button type="button" disabled={dirty||submission.saving||automationBusy} onClick={()=>setCarryReview({id:c.id})}><I18nText id="planning.revisar_arrastre_de" values={{ name: (p.name) }} /></button>
                  </div>)}
                  <p><I18nText id="planning.presupuesto_efectivo_base_editable_arrastre_guardado" values={{ content: (<strong>{cents===undefined?uiText("planning_section.pendiente_de_corregir"):money(cents)}</strong>) }} /></p>
                  {dirty&&<p>{uiText("planning.guarda_o_descarta_el_borrador_antes_de_revisar_el")}</p>}
                </div>}
              </div>;
            })}
          </fieldset>
        </PlanningSection>)}
      </PlanningSection></div>;
    })}
      </div>
    </div>
    </div>
    <ChartSlot data={data} month={month} kind="planning"/>
    {annual && <div className="planning-card overflow-x-auto"><h2 className="text-lg font-bold"><I18nText id="planning.resumen_anual" values={{ content: (month.slice(0,4)) }} /></h2>
      {yearRows ? <><p><I18nText id="planning.cobertura_12_meses_suma_parcial_de_meses_planificados_no" values={{ length: (yearRows.filter(r => r.status !== 'Sin plan').length) }} /></p>
        <table><caption>{uiText("planning.previsiones_mensuales_guardadas")}</caption><thead><tr><th>{uiText("planning.mes")}</th>{Object.values(labels).map(label => <th key={label}>{uiText(label)}</th>)}<th>{uiText("planning.base_gastos")}</th><th>{uiText("planning.arrastre")}</th><th>{uiText("planning.ejecutado_propio")}</th><th>{uiText("planning.procedencia_registrada")}</th><th>{uiText("planning.estado")}</th></tr></thead><tbody>
          {yearRows.map(r => <tr key={r.monthYear}><th><button onClick={() => onMonth(r.monthYear)}>{r.monthYear}</button></th>{(Object.keys(labels) as (keyof PlanningTotals)[]).map(k => <td key={k}>{money(r.totals[k])}</td>)}<td>{money(r.baseExpenses)}</td><td>{money(r.carryoverCents)}</td><td>{formatCurrency(r.executed)}</td><td>{r.origins.map(o=>o==='copy'?uiText("planning.copiada"):o==='rule'?uiText("planning.regla"):uiText("planning.manual")).join(' / ')||(r.status==='Sin plan'?'—':uiText("planning.manual"))}</td><td>{statusText(r.status)}</td></tr>)}
        </tbody><tfoot><tr><th>{uiText("planning.total_planificado")}</th>{(Object.keys(labels) as (keyof PlanningTotals)[]).map(k => <td key={k}>{money(yearRows.filter(r => r.status !== 'Sin plan').reduce((sum,r) => sum+r.totals[k],0))}</td>)}<td colSpan={5}>{uiText("planning.parcial_si_cobertura_12")}</td></tr></tfoot></table></> : <p role="alert">{uiText("planning.hay_importes_historicos_con_mas_de_dos_decimales_o")}</p>}
    </div>}
    {currentMeta?.approval && <details className="planning-card"><summary>{uiText("planning.comparar_con_la_ultima_aprobacion")}</summary><Totals totals={currentMeta.approval.totals} /><p><I18nText id="planning.fotografia_n_revision_los_importes_siguientes_son_inmutables" values={{ number: (currentMeta.approval.number), revision: (currentMeta.approval.revision) }} /></p>
      {currentMeta.approval.subitemBreakdowns===undefined?<p>{uiText("planning.esta_aprobacion_no_contiene_un_desglose_historico_de_subitems")}</p>:currentMeta.approval.subitemBreakdowns.map(b=><div key={planningKey(b)}><h3><I18nText id="planning.desglose_aprobado" values={{ content: (names.get(planningKey(b)) ?? uiText("planning.partida_historica")) }} /></h3>{b.lines.map(l=><p key={l.subitemId}>{l.name}: {money(l.amountCents)}</p>)}</div>)}
      <table><thead><tr><th>{uiText("planning.partida")}</th><th>{uiText("planning.aprobado")}</th><th>{uiText("planning.previsto_actual_guardado")}</th></tr></thead><tbody>{[...new Map([...currentMeta.approval.lines, ...combineLines(planningLines(data.budgetPlans,month),carryLines(data,month))].map(l => [planningKey(l),l])).values()].map(l => <tr key={planningKey(l)}><th>{uiText(l.type === "GASTO" ? "planning.expenseType" : "planning.incomeType")} · {names.get(planningKey(l)) ?? uiText("planning.partida_historica")}</th><td>{money(currentMeta.approval!.lines.find(a => planningKey(a)===planningKey(l))?.amountCents ?? 0)}</td><td>{money(combineLines(planningLines(data.budgetPlans,month),carryLines(data,month)).find(p=>planningKey(p)===planningKey(l))?.amountCents ?? 0)}</td></tr>)}</tbody></table>
    </details>}
    {review && totals && <SafeDialog title={uiText("planning.revisar_y_aprobar_prevision")} onCancel={() => { if (!submission.saving) setReview(false); }}><div className="planning space-y-3">
      <p><I18nText id="planning.periodo_se_guardaran_todos_los_importes_el_objetivo_y" values={{ month: (month) }} /></p><Totals totals={totals} />
      {deficit && <><p role="alert">{uiText("planning.existe_deficit_el_margen_es_negativo_o_el_ahorro")}</p><label><input type="checkbox" checked={acceptDeficit} disabled={submission.saving} onChange={e => setAcceptDeficit(e.target.checked)} />{uiText("planning.acepto_aprobar_conscientemente_esta_prevision_con_deficit")}</label></>}
      <details><summary>{uiText("planning.desglose_de_la_aprobacion")}</summary><p>{uiText("planning.prevision_efectiva_incluye_base_y_ajustes_de_arrastre_guardados")}</p>{combineLines(edits,carryLines(data,month)).map(l => <p key={planningKey(l)}>{uiText(l.type === "GASTO" ? "planning.expenseType" : "planning.incomeType")} · {names.get(planningKey(l))}: {money(l.amountCents)}</p>)}{breakdownDrafts.map(b=><div key={planningKey(b)}>{b.lines.map(l=><p key={l.subitemId}>{data.budgetSubitems?.items.find(i=>i.id===l.subitemId)?.name}: {money(l.amountCents)}</p>)}</div>)}</details>
      {submission.error && <p role="alert">{planningOwnedText(submission.error,uiText)}</p>}
      <div className="flex gap-2"><button disabled={submission.saving} onClick={() => setReview(false)}>{uiText("planning.cancelar")}</button><button disabled={submission.saving || (deficit && !acceptDeficit)} onClick={() => commit(true)}>{submission.saving ? uiText("planning.guardando") : uiText("planning.confirmar_aprobacion")}</button></div>
    </div></SafeDialog>}
  </section>;
}

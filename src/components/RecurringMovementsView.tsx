import {storageOwnedText} from '../i18n/storageMessages';

import {ruleReviewText,movementFrequencyText,type RuleReview} from '../i18n/bankingReviews';
import {useI18n, I18nText } from "../i18n";
import {classificationCatalog} from '../utils/budgetCatalog';
import React, { useMemo, useState } from "react";
import type { FinanceData } from "../utils/backup";
import type { RecurringMovementRule, Transaction } from "../types/finance";
import { intelligent } from "../utils/intelligentValidation";
import {
  applyOccurrenceBatch,
  nextRuleDate,
  occurrencePreviews,
  occurrenceScope,
  removeMovementRule,
  saveMovementRule,
  type OccurrenceBatch,
} from "../utils/recurringMovements";
import type { FinanceMutation } from "../utils/financeStore";
import type { SaveResult } from "../utils/saveResult";
import { parsePlanningMoney, planningMoneyInput } from "../utils/planningMoney";
import { madridDate, realDate } from "../utils/financialCalendar";
import { FinanceReview } from "./FinanceReview";
import { SafeDialog } from "./SafeDialog";
import { initialWalletId } from '../utils/defaultWallet';


export function RecurringMovementsView({
  data,
  month,
  focusedOccurrenceId,
  mutate,
  onEdit,
}: {
  data: FinanceData;
  month: string;
  focusedOccurrenceId?: string | null;
  mutate: (fn: FinanceMutation) => Promise<SaveResult>;
  onEdit: (t: Transaction) => void;
}) {
  const { t: uiText } = useI18n();
  const formatting = useI18n();
  const { formatCents: money , formatDate } = formatting;
  const [first, setFirst] = useState(month),
    [last, setLast] = useState(month);
  const [draft, setDraft] = useState<RecurringMovementRule | null>(null),
    [amount, setAmount] = useState(""),
    [error, setError] = useState("");
  const [review, setReview] = useState<{
    presentation: RuleReview;
    apply: (d: FinanceData) => FinanceData;
  } | null>(null);
  const focusedRowRef = React.useRef<HTMLTableRowElement>(null);
  const pendingFocusId = React.useRef<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]),
    [batch, setBatch] = useState<OccurrenceBatch | null>(null),
    [ack, setAck] = useState(false);
  const txById = new Map(data.transactions.map((t) => [t.id, t]));
  const state = intelligent(data),
    partidas = useMemo(() => {
      const active=classificationCatalog(data.budgetGroups);
      const historical=state.recurringRules.filter(r=>r.id===draft?.id&&!active.some(p=>p.type===r.type&&p.code===r.code)).map(r=>({type:r.type,code:r.code,name:r.subcategoryName,groupName:r.categoryName,groupCode:'historical',keywords:[]}));
      return [...active,...historical];
    }, [data,draft?.id]);
  const linkedDate = focusedOccurrenceId
    ? state.occurrences.find(o => o.id === focusedOccurrenceId)?.dueDate ?? focusedOccurrenceId.slice(-10)
    : null;
  React.useEffect(() => {
    pendingFocusId.current = focusedOccurrenceId ?? null;
    if (!focusedOccurrenceId || !realDate(linkedDate)) return;
    const targetMonth = linkedDate.slice(0, 7);
    setFirst(targetMonth);
    setLast(targetMonth);
    setSelected([]);
  }, [focusedOccurrenceId, linkedDate]);

  let rows: ReturnType<typeof occurrencePreviews> = [],
    rangeError = "";
  try {
    rows = occurrencePreviews(data, first, last);
  } catch (e) {
    rangeError = (e as Error).message;
  }
  React.useEffect(() => {
    if (!focusedOccurrenceId || pendingFocusId.current !== focusedOccurrenceId || !rows.some(r => r.id === focusedOccurrenceId)) return;
    const row = focusedRowRef.current;
    if (row) {
      pendingFocusId.current = null;
      row.focus({ preventScroll: true });
      row.scrollIntoView({ block: 'center' });
    }
  }, [focusedOccurrenceId, rows]);

  const create = () => {
    const p = partidas[0];
    if (!p || !data.wallets.length) {
      setError("Crea primero una cartera y una partida.");
      return;
    }
    setAmount("");
    setError("");
    setDraft({
      id: crypto.randomUUID(),
      concept: "",
      type: p.type,
      amountCents: 0,
      code: p.code,
      categoryName: p.groupName,
      subcategoryName: p.name,
      walletId: initialWalletId(data.wallets, data.defaultWalletId),
      frequency: "monthly",
      startDate: madridDate(),
      day: 1,
      active: true,
    });
  };
  const reviewRule = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const rule = { ...draft!, amountCents: parsePlanningMoney(amount) };
      saveMovementRule(data, rule);
      setError("");
      setReview({
        presentation: {kind:"save",concept:rule.concept,amountCents:rule.amountCents,frequency:rule.frequency,day:rule.day,wallet:data.wallets.find((w)=>w.id===rule.walletId)?.name??""},
        apply: (d) => saveMovementRule(d, rule),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <section className="finance-module" aria-label={uiText("recurring_movements.movimientos_periodicos")}>
      <div className="finance-heading">
        <div>
          <h1>{uiText("recurring_movements.movimientos_periodicos")}</h1>
          <p>{uiText("recurring_movements.nominas_alquileres_seguros_y_suscripciones_cada_ocurrencia_requiere_confirmacion")}</p>
        </div>
        <button onClick={create}>{uiText("recurring_movements.nueva_regla_periodica")}</button>
      </div>
      {error && !draft && <p role="alert">{storageOwnedText(error,uiText)}</p>}
      <div className="finance-grid">
        {state.recurringRules
          .filter((r) => !r.deleted)
          .map((r) => (
            <article className="planning-card" key={r.id}>
              <h2>{r.concept}</h2>
              <p><I18nText id="recurring_movements.dia" values={{ type: (uiText(r.type==='INGRESO'?'movement_proposal.ingreso':'movement_proposal.gasto')), amountCents: (money(r.amountCents)), content: (" "), content_02b32: (movementFrequencyText(r.frequency,uiText)), day: (r.day) }} /></p>
              <p>
                {data.wallets.find((w) => w.id === r.walletId)?.name} ·{" "}
                {r.subcategoryName}
              </p>
              <p><I18nText id="recurring_movements.proxima" values={{ content: (r.active ? uiText("recurring_movements.activa") : uiText("recurring_movements.pausada")), content_52109: (" "), content_7ecad: (nextRuleDate(r, madridDate()) ?? uiText("recurring_movements.sin_proxima_fecha")) }} /></p>
              <div className="finance-actions">
                <button
                  onClick={() => {
                    setError("");
                    setDraft(r);
                    setAmount(planningMoneyInput(r.amountCents));
                  }}
                ><I18nText id="recurring_movements.editar" values={{ concept: (r.concept) }} /></button>
                <button
                  onClick={() =>
                    setReview({
                      presentation: {kind:r.active?"pause":"reactivate",concept:r.concept},
                      apply: (d) =>
                        saveMovementRule(d, { ...r, active: !r.active }),
                    })
                  }
                >
                  {r.active ? uiText("recurring_movements.pausar") : uiText("recurring_movements.reactivar")} {r.concept}
                </button>
                <button
                  onClick={() =>
                    setReview({
                      presentation: {kind:"delete",concept:r.concept},
                      apply: (d) => removeMovementRule(d, r.id),
                    })
                  }
                ><I18nText id="recurring_movements.eliminar" values={{ concept: (r.concept) }} /></button>
              </div>
            </article>
          ))}
      </div>
      {!state.recurringRules.some((r) => !r.deleted) && (
        <p>{uiText("recurring_movements.no_hay_reglas_periodicas_la_planificacion_presupuestaria_se_gestiona")}</p>
      )}
      <div className="planning-card">
        <h2>{uiText("recurring_movements.proximos_movimientos_vista_previa")}</h2>
        <p>{uiText("recurring_movements.consulta_hasta_12_meses_confirma_como_maximo_500_ocurrencias")}</p>
        <div className="finance-actions">
          <label>{uiText("recurring_movements.desde")}<input
              aria-label={uiText("recurring_movements.ocurrencias_desde")}
              type="month"
              min="0001-01"
              max="9999-12"
              value={first}
              onChange={(e) => {
                setFirst(e.target.value);
                setSelected([]);
              }}
            />
          </label>
          <label>{uiText("recurring_movements.hasta")}<input
              aria-label={uiText("recurring_movements.ocurrencias_hasta")}
              type="month"
              min="0001-01"
              max="9999-12"
              value={last}
              onChange={(e) => {
                setLast(e.target.value);
                setSelected([]);
              }}
            />
          </label>
          <button
            onClick={() =>
              setSelected(
                rows
                  .filter((r) => r.status === "proposed")
                  .slice(0, 500)
                  .map((r) => r.id),
              )
            }
          >{uiText("recurring_movements.seleccionar_propuestas")}</button>
        </div>
        {rangeError && <p role="alert">{storageOwnedText(rangeError,uiText)}</p>}
        <div className="finance-table">
          <table>
            <caption>{uiText("recurring_movements.ocurrencias_del_periodo")}</caption>
            <thead>
              <tr>
                <th>{uiText("recurring_movements.seleccion")}</th>
                <th>{uiText("recurring_movements.fecha_concepto")}</th>
                <th>{uiText("recurring_movements.importe_cuenta")}</th>
                <th>{uiText("debts_workspace.estado")}</th>
                <th>{uiText("recurring_movements.revision")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}
                  ref={r.id === focusedOccurrenceId ? focusedRowRef : undefined}
                  tabIndex={r.id === focusedOccurrenceId ? -1 : undefined}
                  aria-label={r.id === focusedOccurrenceId ? uiText("recurring_movements.ocurrencia_seleccionada", { concept: r.rule.concept, dueDate: formatDate(r.dueDate, {day:'2-digit',month:'2-digit',year:'numeric'}) }) : undefined}
                  data-focused-occurrence={r.id === focusedOccurrenceId ? 'true' : undefined}
                  className={r.id === focusedOccurrenceId ? 'ring-2 ring-inset ring-sky-400 bg-sky-500/10' : undefined}>
                  <td>
                    {r.status === "proposed" && (
                      <input
                        type="checkbox"
                        aria-label={uiText("recurring_movements.seleccionar", { concept: r.rule.concept, dueDate: formatDate(r.dueDate, {day:'2-digit',month:'2-digit',year:'numeric'}) })}
                        checked={selected.includes(r.id)}
                        onChange={(e) =>
                          setSelected((prev) =>
                            e.target.checked
                              ? [...prev, r.id]
                              : prev.filter((id) => id !== r.id),
                          )
                        }
                      />
                    )}
                  </td>
                  <td>
                    <time dateTime={r.dueDate}>{formatDate(r.dueDate, {day:'2-digit',month:'2-digit',year:'numeric'})}</time>
                    <br />
                    {txById.get(r.transactionId ?? "")?.description ??
                      r.rule.concept}
                    {r.transactionId &&
                      txById.get(r.transactionId)?.date !== r.dueDate && (
                        <p><I18nText id="recurring_movements.fecha_editada" values={{ formatDate: (formatDate(txById.get(r.transactionId)?.date, {day:'2-digit',month:'2-digit',year:'numeric'})) }} /></p>
                      )}
                  </td>
                  <td>
                    {money(
                      r.transactionId
                        ? Math.round(txById.get(r.transactionId)!.amount * 100)
                        : r.rule.amountCents,
                    )}
                    <br />
                    {
                      data.wallets.find(
                        (w) =>
                          w.id ===
                          (txById.get(r.transactionId ?? "")?.recurrence
                            ?.walletId ?? r.rule.walletId),
                      )?.name
                    }
                  </td>
                  <td>
                    {r.status === "skipped"
                      ? uiText("recurring_movements.omitido")
                      : r.status === "proposed"
                        ? uiText("recurring_movements.proximo_propuesta")
                        : data.transactions.find(
                              (t) => t.id === r.transactionId,
                            )?.processed
                          ? uiText("debts_workspace.tramitado")
                          : uiText("debts_workspace.pendiente")}
                  </td>
                  <td>
                    {r.collisions.length > 0 && (
                      <p><I18nText id="recurring_movements.coincidencia_manual_no_se_fusionara" values={{ content: (r.collisions.join(", ")) }} /></p>
                    )}
                    {r.transactionId && (
                      <button
                        onClick={() =>
                          onEdit(
                            data.transactions.find(
                              (t) => t.id === r.transactionId,
                            )!,
                          )
                        }
                      >{uiText("recurring_movements.revisar_movimiento")}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && !rangeError && <p>{uiText("recurring_movements.sin_ocurrencias_en_este_periodo")}</p>}
        <div className="finance-actions">
          {(["register", "skip"] as const).map((action) => (
            <button
              key={action}
              disabled={!selected.length || !!rangeError}
              onClick={() => {
                setAck(false);
                setBatch({
                  first,
                  last,
                  ids: selected,
                  scope: occurrenceScope(data),
                  action,
                  acknowledgeCollisions: false,
                });
              }}
            >
              {action === "register"
                ? uiText("recurring_movements.revisar_registro_pendiente")
                : uiText("recurring_movements.revisar_omision")}
            </button>
          ))}
        </div>
      </div>
      {draft && (
        <SafeDialog
          title={uiText("recurring_movements.regla_de_movimiento_periodico")}
          onCancel={() => {
            if (!review) setDraft(null);
          }}
        >
          <form className="finance-form" onSubmit={reviewRule}>
            <label>{uiText("debts_workspace.concepto")}<input
                required
                maxLength={500}
                value={draft.concept}
                onChange={(e) =>
                  setDraft({ ...draft, concept: e.target.value })
                }
              />
            </label>
            <label>{uiText("recurring_movements.importe")}<input
                aria-label={uiText("recurring_movements.importe_periodico")}
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>{uiText("recurring_movements.partida")}<select
                aria-label={uiText("recurring_movements.partida_periodica")}
                value={`${draft.type}:${draft.code}`}
                onChange={(e) => {
                  const p = partidas.find(
                    (p) => `${p.type}:${p.code}` === e.target.value,
                  )!;
                  setDraft({
                    ...draft,
                    type: p.type,
                    code: p.code,
                    categoryName: p.groupName,
                    subcategoryName: p.name,
                  });
                }}
              >
                {partidas.map((p) => (
                  <option
                    value={`${p.type}:${p.code}`}
                    key={`${p.type}:${p.code}`}
                  >
                    {p.type} · {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>{uiText("recurring_movements.cartera")}<select
                aria-label={uiText("recurring_movements.cartera_periodica")} required
                value={draft.walletId}
                onChange={(e) =>
                  setDraft({ ...draft, walletId: e.target.value })
                }
              >
                <option value="" disabled>{uiText("debts_workspace.selecciona_una_cartera")}</option>{data.wallets.map((w) => (
                  <option value={w.id} key={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label>{uiText("recurring_movements.frecuencia")}<select
                value={draft.frequency}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    frequency: e.target
                      .value as RecurringMovementRule["frequency"],
                  })
                }
              >
                <option value="monthly">{uiText("recurring_movements.mensual")}</option>
                <option value="quarterly">{uiText("recurring_movements.trimestral")}</option>
                <option value="yearly">{uiText("recurring_movements.anual")}</option>
              </select>
            </label>
            <label>{uiText("recurring_movements.dia_del_mes")}<input
                type="number"
                min="1"
                max="31"
                required
                value={draft.day}
                onChange={(e) =>
                  setDraft({ ...draft, day: Number(e.target.value) })
                }
              />
            </label>
            <p>{uiText("recurring_movements.si_no_existe_el_dia_elegido_se_usa_el")}</p>
            <label>{uiText("recurring_movements.inicio")}<input
                type="date"
                min="0001-01-01"
                max="9999-12-31"
                required
                value={draft.startDate}
                onChange={(e) =>
                  setDraft({ ...draft, startDate: e.target.value })
                }
              />
            </label>
            <label>{uiText("recurring_movements.fin_opcional")}<input
                type="date"
                min={draft.startDate}
                max="9999-12-31"
                value={draft.endDate ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, endDate: e.target.value || undefined })
                }
              />
            </label>
            {error && <p role="alert">{storageOwnedText(error,uiText)}</p>}
            <div className="finance-actions">
              <button type="button" onClick={() => setDraft(null)}>{uiText("debts_workspace.cancelar")}</button>
              <button type="submit">{uiText("recurring_movements.revisar_regla")}</button>
            </div>
          </form>
        </SafeDialog>
      )}
      {review && (
        <FinanceReview
          title={uiText("recurring_movements.confirmar_regla_periodica")}
          onCancel={() => setReview(null)}
          onConfirm={() => mutate(review.apply)}
          onSuccess={() => {
            setReview(null);
            setDraft(null);
          }}
        >
          <p>{ruleReviewText(review.presentation,uiText,formatting)}</p>
        </FinanceReview>
      )}
      {batch && (
        <FinanceReview
          title={uiText("recurring_movements.confirmar_ocurrencias")}
          onCancel={() => setBatch(null)}
          onConfirm={() =>
            mutate((d) =>
              applyOccurrenceBatch(d, { ...batch, acknowledgeCollisions: ack }),
            )
          }
          onSuccess={() => {
            setBatch(null);
            setSelected([]);
          }}
          disabled={
            batch.action === "register" &&
            rows.some(
              (r) => batch.ids.includes(r.id) && r.collisions.length > 0,
            ) &&
            !ack
          }
        >
          <p>
            {batch.action === "register"
              ? uiText("recurring_movements.crear_movimientos_pendientes_no_modifica_el_saldo_bancario")
              : uiText("recurring_movements.omitir_ocurrencias_conserva_su_identidad_para_no_volver_a")}
          </p>
          {rows
            .filter((r) => batch.ids.includes(r.id))
            .map((r) => (
              <p key={r.id}>
                <time dateTime={r.dueDate}>{formatDate(r.dueDate, {day:'2-digit',month:'2-digit',year:'numeric'})}</time> · {r.rule.concept} · {money(r.rule.amountCents)} ·{" "}
                {data.wallets.find((w) => w.id === r.rule.walletId)?.name}
              </p>
            ))}
          {rows.some(
            (r) => batch.ids.includes(r.id) && r.collisions.length > 0,
          ) && (
            <label>
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />{uiText("recurring_movements.he_revisado_las_coincidencias_manuales_y_autorizo_crear_movimientos")}</label>
          )}
        </FinanceReview>
      )}
    </section>
  );
}

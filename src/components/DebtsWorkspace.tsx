import {storageOwnedText} from '../i18n/storageMessages';

import {debtReviewText,type DebtReview} from '../i18n/bankingReviews';
import {useI18n, I18nText } from "../i18n";
import { initialWalletId } from '../utils/defaultWallet';
import React, { useState } from "react";
import type { FinanceData } from "../utils/backup";
import type { FinanceMutation } from "../utils/financeStore";
import type { SaveResult } from "../utils/saveResult";
import type { PersonalObligation, PersonalSettlement } from "../types/finance";
import { intelligent } from "../utils/intelligentValidation";
import {
  cancelObligation,
  obligationOverview,
  remainingCents,
  reservedCents,
  saveObligation,
  settleObligation,
} from "../utils/personalObligations";
import { parsePlanningMoney, planningMoneyInput } from "../utils/planningMoney";
import { madridDate } from "../utils/financialCalendar";
import { SafeDialog } from "./SafeDialog";
import { FinanceReview } from "./FinanceReview";

export function DebtsWorkspace({
  data,
  mutate,
  loans,
  onContacts,
  onMovement,
}: {
  data: FinanceData;
  mutate: (fn: FinanceMutation) => Promise<SaveResult>;
  loans: React.ReactNode;
  onContacts: () => void;
  onMovement: (id: string) => void;
}) {
  const { t: uiText } = useI18n();
  const formatting = useI18n();
  const { formatCents: money , formatDate } = formatting;
  const [direction, setDirection] = useState<"receivable" | "payable">(
      "payable",
    ),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState("");
  const [draft, setDraft] = useState<PersonalObligation | null>(null),
    [amount, setAmount] = useState(""),
    [error, setError] = useState("");
  const [pay, setPay] = useState<{
      id: string;
      input: PersonalSettlement;
      walletChoice?: string;
    } | null>(null),
    [payAmount, setPayAmount] = useState("");
  const [review, setReview] = useState<{
    presentation: DebtReview;
    apply: (d: FinanceData) => FinanceData;
  } | null>(null);
  const today = madridDate(),
    state = intelligent(data),
    rows = obligationOverview(data, today);
  const matching = rows.filter(
    (r) =>
      r.direction === direction &&
      (filter === "all" ||
        (filter === "open" && !r.closed) ||
        (filter === "closed" && r.closed) ||
        (filter === "overdue" && r.overdueCents > 0)) &&
      `${r.name} ${r.concept}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const totals = (dir: string) =>
    rows
      .filter((r) => r.direction === dir)
      .reduce((n, r) => n + r.remainingCents, 0);
  const create = () => {
    setAmount("");
    setError("");
    setDraft({
      id: crypto.randomUUID(),
      direction,
      counterparty: { name: "" },
      concept: "",
      principalCents: 0,
      date: today,
      cancelled: false,
      settlements: [],
    });
  };
  const propose = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const next = { ...draft!, principalCents: parsePlanningMoney(amount) };
      saveObligation(data, next);
      setError("");
      setReview({
        presentation: {kind:"obligation",direction:next.direction,amountCents:next.principalCents,name:next.counterparty.name,concept:next.concept},
        apply: (d) => saveObligation(d, next),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const proposePayment = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const input = {
        ...pay!.input,
        amountCents: parsePlanningMoney(payAmount),
      };
      settleObligation(data, pay!.id, input);
      setError("");
      setReview({
        presentation: {kind:"settlement",amountCents:input.amountCents,date:input.date,method:input.kind,processed:input.processed},
        apply: (d) => settleObligation(d, pay!.id, input),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <section className="finance-module" aria-label={uiText("debts_workspace.deudas_y_cobros")}>
      <div className="finance-heading">
        <div>
          <h1>{uiText("debts_workspace.deudas_y_cobros")}</h1>
          <p><I18nText id="debts_workspace.me_deben_debo_cantidades_separadas_del_saldo_liquido" values={{ money: (money(totals("receivable"))), content: (" "), money_f4cc9: (money(totals("payable"))) }} /></p>
        </div>
        <button onClick={create}>{uiText("debts_workspace.nuevo_compromiso_personal")}</button>
      </div>
      <div className="finance-actions" role="group" aria-label={uiText("debts_workspace.direccion_de_deuda")}>
        <button
          aria-pressed={direction === "receivable"}
          onClick={() => setDirection("receivable")}
        >{uiText("debts_workspace.me_deben")}</button>
        <button
          aria-pressed={direction === "payable"}
          onClick={() => setDirection("payable")}
        >{uiText("debts_workspace.debo")}</button>
        <label>{uiText("debts_workspace.estado")}<select
            aria-label={uiText("debts_workspace.estado_de_deudas")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">{uiText("debts_workspace.todos")}</option>
            <option value="open">{uiText("debts_workspace.pendientes")}</option>
            <option value="overdue">{uiText("debts_workspace.vencidos")}</option>
            <option value="closed">{uiText("debts_workspace.saldados_cancelados")}</option>
          </select>
        </label>
        <label>{uiText("debts_workspace.contacto_o_concepto")}<input
            aria-label={uiText("debts_workspace.buscar_deuda")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <p><I18nText id="debts_workspace.vencido_en_este_bloque_los_gastos_compartidos_sin_vencimiento" values={{ content: (" "), money: (money(
          rows
            .filter((r) => r.direction === direction)
            .reduce((n, r) => n + r.overdueCents, 0),
        )) }} /></p>
      <div className="finance-grid">
        {matching.map((r) => (
          <article className="planning-card" key={`${r.source}:${r.id}`}>
            <h2>
              {r.name} · {r.concept}
            </h2>
            <p>
              {r.source === "shared"
                ? uiText("debts_workspace.gasto_compartido")
                : r.source === "loan"
                  ? uiText("debts_workspace.prestamo_existente")
                  : uiText("debts_workspace.compromiso_personal")}{" "}
              · {r.closed ? uiText("debts_workspace.saldado_cancelado") : uiText("debts_workspace.pendiente")} ·{" "}
              {money(r.remainingCents)}
            </p>
            <p><I18nText id="debts_workspace.vencimiento" values={{ content: (r.dueDate ? formatDate(r.dueDate,{day:"2-digit",month:"2-digit",year:"numeric"}) : uiText("debts_workspace.sin_fecha")), content_a0286: (r.overdueCents > 0 ? uiText("debts_workspace.vencido", { overdueCents: money(r.overdueCents) }) : "") }} /></p>
            {r.source === "shared" && (
              <button onClick={onContacts}>{uiText("debts_workspace.revisar_reparto_y_liquidaciones_en_contactos")}</button>
            )}
            {r.source === "loan" && (
              <p>{uiText("debts_workspace.cuotas_calculos_e_historial_en_prestamos_existentes_mas_abajo")}</p>
            )}
            {r.source === "personal" &&
              (() => {
                const o = state.obligations.find((o) => o.id === r.id)!;
                return (
                  <>
                    <p><I18nText id="debts_workspace.principal_reservado_pendiente" values={{ principalCents: (money(o.principalCents)), content: (" "), money: (money(
                        o.settlements
                          .filter((s) => !s.processed)
                          .reduce((n, s) => n + s.amountCents, 0),
                      )) }} /></p>
                    <div className="finance-actions">
                      {!r.closed && (
                        <button
                          disabled={reservedCents(o) >= o.principalCents}
                          onClick={() => {
                            setError("");
                            setPayAmount("");
                            setPay({
                              id: o.id,
                              input: {
                                id: crypto.randomUUID(),
                                amountCents: 0,
                                date: today,
                                kind: "adjustment",
                                processed: true,
                                note: "",
                              },
                            });
                          }}
                        >
                          {direction === "receivable"
                            ? uiText("debts_workspace.registrar_cobro_parcial")
                            : uiText("debts_workspace.registrar_pago_parcial")}
                        </button>
                      )}
                      <button
                        disabled={!!o.settlements.length || o.cancelled}
                        onClick={() => {
                          setError("");
                          setDraft(o);
                          setAmount(planningMoneyInput(o.principalCents));
                        }}
                      >{uiText("debts_workspace.editar_compromiso")}</button>
                      <button
                        disabled={!!o.settlements.length || o.cancelled}
                        onClick={() =>
                          setReview({
                            presentation: {kind:"cancel",concept:o.concept},
                            apply: (d) => cancelObligation(d, o.id),
                          })
                        }
                      >{uiText("debts_workspace.cancelar_compromiso")}</button>
                    </div>
                    <details>
                      <summary><I18nText id="debts_workspace.historial_de_liquidaciones" values={{ length: (o.settlements.length) }} /></summary>
                      {!o.settlements.length && <p>{uiText("debts_workspace.sin_liquidaciones")}</p>}
                      {o.settlements.map((s) => (
                        <div key={s.id}>
                          <p>
                            {formatDate(s.date, {day:'2-digit',month:'2-digit',year:'numeric'})} · {money(s.amountCents)} ·{" "}
                            {s.kind === "bank" ? uiText("debts_workspace.banco") : uiText("debts_workspace.ajuste_sin_banco")} ·{" "}
                            {s.processed ? uiText("debts_workspace.tramitado") : uiText("debts_workspace.pendiente")} · {s.note}
                          </p>
                          {s.transactionId && (
                            <button
                              onClick={() => onMovement(s.transactionId!)}
                            >{uiText("debts_workspace.revisar_movimiento_de_liquidacion")}</button>
                          )}
                        </div>
                      ))}
                    </details>
                    {o.settlements.length > 0 && (
                      <p>{uiText("debts_workspace.principal_contraparte_y_liquidaciones_protegidos_por_historial_las_correcciones")}</p>
                    )}
                  </>
                );
              })()}
          </article>
        ))}
      </div>
      {!matching.length && <p>{uiText("debts_workspace.no_hay_deudas_en_este_filtro")}</p>}
      {direction === "payable" && (
        <section aria-label={uiText("debts_workspace.prestamos_existentes")}>
          <h2>{uiText("debts_workspace.prestamos_existentes")}</h2>
          {loans}
        </section>
      )}
      {draft && (
        <SafeDialog
          title={uiText("debts_workspace.compromiso_personal")}
          onCancel={() => {
            if (!review) setDraft(null);
          }}
        >
          <form className="finance-form" onSubmit={propose}>
            <label>{uiText("debts_workspace.direccion")}<select
                value={draft.direction}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    direction: e.target
                      .value as PersonalObligation["direction"],
                  })
                }
              >
                <option value="receivable">{uiText("debts_workspace.me_deben")}</option>
                <option value="payable">{uiText("debts_workspace.debo")}</option>
              </select>
            </label>
            <label>{uiText("debts_workspace.contacto_opcional")}<select
                value={draft.counterparty.contactId ?? ""}
                onChange={(e) => {
                  const c = data.contacts.find((c) => c.id === e.target.value);
                  setDraft({
                    ...draft,
                    counterparty: {
                      name: c?.name ?? "",
                      ...(c ? { contactId: c.id } : {}),
                    },
                  });
                }}
              >
                <option value="">{uiText("debts_workspace.contraparte_independiente")}</option>
                {data.contacts.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>{uiText("debts_workspace.contraparte")}<input
                required
                maxLength={500}
                value={draft.counterparty.name}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    counterparty: {
                      ...draft.counterparty,
                      name: e.target.value,
                    },
                  })
                }
              />
            </label>
            <label>{uiText("debts_workspace.concepto")}<input
                required
                maxLength={500}
                value={draft.concept}
                onChange={(e) =>
                  setDraft({ ...draft, concept: e.target.value })
                }
              />
            </label>
            <label>{uiText("debts_workspace.principal")}<input
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>{uiText("debts_workspace.fecha_del_compromiso")}<input
                required
                type="date"
                min="0001-01-01"
                max="9999-12-31"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </label>
            <label>{uiText("debts_workspace.vencimiento_opcional")}<input
                type="date"
                min={draft.date}
                max="9999-12-31"
                value={draft.dueDate ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, dueDate: e.target.value || undefined })
                }
              />
            </label>
            {error && <p role="alert">{storageOwnedText(error,uiText)}</p>}
            <div className="finance-actions">
              <button type="button" onClick={() => setDraft(null)}>{uiText("debts_workspace.cancelar")}</button>
              <button type="submit">{uiText("debts_workspace.revisar_compromiso")}</button>
            </div>
          </form>
        </SafeDialog>
      )}
      {pay && (
        <SafeDialog
          title={uiText("debts_workspace.liquidacion_personal")}
          onCancel={() => {
            if (!review) setPay(null);
          }}
        >
          <form className="finance-form" onSubmit={proposePayment}>
            <p>{uiText("debts_workspace.no_registres_un_nuevo_movimiento_si_ya_existe_en")}</p>
            <label>{uiText("debts_workspace.importe_a_liquidar")}<input
                required
                inputMode="decimal"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </label>
            <label>{uiText("debts_workspace.fecha_de_liquidacion")}<input
                required
                type="date"
                min="0001-01-01"
                max="9999-12-31"
                value={pay.input.date}
                onChange={(e) =>
                  setPay({
                    ...pay,
                    input: { ...pay.input, date: e.target.value },
                  })
                }
              />
            </label>
            <label>{uiText("debts_workspace.modalidad")}<select
                aria-label={uiText("debts_workspace.modalidad_de_liquidacion")}
                value={pay.input.kind}
                onChange={(e) => {
                  const kind = e.target.value as PersonalSettlement["kind"];
                  setPay({
                    ...pay,
                    input: {
                      ...pay.input,
                      kind,
                      processed: kind === "adjustment",
                      walletId:
                        kind === "bank" ? pay.walletChoice ?? initialWalletId(data.wallets, data.defaultWalletId) : undefined,
                    },
                  });
                }}
              >
                <option value="adjustment">{uiText("debts_workspace.ajuste_sin_banco_compensacion_explicita")}</option>
                <option value="bank">{uiText("debts_workspace.crear_movimiento_de_devolucion_de_principal")}</option>
              </select>
            </label>
            {pay.input.kind === "bank" && (
              <>
                <label>{uiText("debts_workspace.cartera_de_liquidacion")}<select
                    aria-label={uiText("debts_workspace.cartera_de_liquidacion")} required
                    value={pay.input.walletId ?? ""}
                    onChange={(e) =>
                      setPay({
                        ...pay,
                        walletChoice: e.target.value,
                        input: { ...pay.input, walletId: e.target.value },
                      })
                    }
                  >
                    <option value="" disabled>{uiText("debts_workspace.selecciona_una_cartera")}</option>{data.wallets.map((w) => (
                      <option value={w.id} key={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={pay.input.processed}
                    onChange={(e) =>
                      setPay({
                        ...pay,
                        input: { ...pay.input, processed: e.target.checked },
                      })
                    }
                  />{uiText("debts_workspace.ya_tramitado_aplicar_al_saldo_bancario_tras_confirmar")}</label>
              </>
            )}
            <label>{uiText("debts_workspace.nota_de_liquidacion")}<input
                maxLength={500}
                value={pay.input.note}
                onChange={(e) =>
                  setPay({
                    ...pay,
                    input: { ...pay.input, note: e.target.value },
                  })
                }
              />
            </label>
            {error && <p role="alert">{storageOwnedText(error,uiText)}</p>}
            <div className="finance-actions">
              <button type="button" onClick={() => setPay(null)}>{uiText("debts_workspace.cancelar")}</button>
              <button type="submit">{uiText("debts_workspace.revisar_liquidacion")}</button>
            </div>
          </form>
        </SafeDialog>
      )}
      {review && (
        <FinanceReview
          title={uiText("debts_workspace.confirmar_compromiso_o_liquidacion")}
          onCancel={() => setReview(null)}
          onConfirm={() => mutate(review.apply)}
          onSuccess={() => {
            setReview(null);
            setDraft(null);
            setPay(null);
          }}
        >
          <p>{debtReviewText(review.presentation,uiText,formatting)}</p>
        </FinanceReview>
      )}
    </section>
  );
}

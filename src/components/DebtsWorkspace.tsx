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
import {
  formatPlanningCents as money,
  parsePlanningMoney,
  planningMoneyInput,
} from "../utils/planningMoney";
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
    text: string;
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
        text: `${next.direction === "receivable" ? "Me deben" : "Debo"} ${money(next.principalCents)} · ${next.counterparty.name} · ${next.concept}. Este compromiso no modifica el banco ni crea ingresos/gastos.`,
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
        text: `Liquidación de ${money(input.amountCents)} · ${input.date} · ${input.kind === "bank" ? `Movimiento bancario ${input.processed ? "tramitado" : "pendiente"}; devolución de principal, sin ingreso/gasto económico.` : "Ajuste sin movimiento bancario. Declaro que esta liquidación no debe volver a registrarse contra la cuenta."}`,
        apply: (d) => settleObligation(d, pay!.id, input),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <section className="finance-module" aria-label="Deudas y cobros">
      <div className="finance-heading">
        <div>
          <h1>Deudas y cobros</h1>
          <p>
            Me deben: {money(totals("receivable"))} · Debo:{" "}
            {money(totals("payable"))}. Cantidades separadas del saldo líquido.
          </p>
        </div>
        <button onClick={create}>Nuevo compromiso personal</button>
      </div>
      <div className="finance-actions" aria-label="Dirección de deuda">
        <button
          aria-pressed={direction === "receivable"}
          onClick={() => setDirection("receivable")}
        >
          Me deben
        </button>
        <button
          aria-pressed={direction === "payable"}
          onClick={() => setDirection("payable")}
        >
          Debo
        </button>
        <label>
          Estado
          <select
            aria-label="Estado de deudas"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="open">Pendientes</option>
            <option value="overdue">Vencidos</option>
            <option value="closed">Saldados / cancelados</option>
          </select>
        </label>
        <label>
          Contacto o concepto
          <input
            aria-label="Buscar deuda"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <p>
        Vencido en este bloque:{" "}
        {money(
          rows
            .filter((r) => r.direction === direction)
            .reduce((n, r) => n + r.overdueCents, 0),
        )}
        . Los gastos compartidos sin vencimiento no se consideran vencidos.
      </p>
      <div className="finance-grid">
        {matching.map((r) => (
          <article className="planning-card" key={`${r.source}:${r.id}`}>
            <h2>
              {r.name} · {r.concept}
            </h2>
            <p>
              {r.source === "shared"
                ? "Gasto compartido"
                : r.source === "loan"
                  ? "Préstamo existente"
                  : "Compromiso personal"}{" "}
              · {r.closed ? "Saldado / cancelado" : "Pendiente"} ·{" "}
              {money(r.remainingCents)}
            </p>
            <p>
              Vencimiento: {r.dueDate ?? "Sin fecha"}
              {r.overdueCents > 0 ? ` · Vencido ${money(r.overdueCents)}` : ""}
            </p>
            {r.source === "shared" && (
              <button onClick={onContacts}>
                Revisar reparto y liquidaciones en Contactos
              </button>
            )}
            {r.source === "loan" && (
              <p>
                Cuotas, cálculos e historial en Préstamos existentes, más abajo.
              </p>
            )}
            {r.source === "personal" &&
              (() => {
                const o = state.obligations.find((o) => o.id === r.id)!;
                return (
                  <>
                    <p>
                      Principal: {money(o.principalCents)} · Reservado
                      pendiente:{" "}
                      {money(
                        o.settlements
                          .filter((s) => !s.processed)
                          .reduce((n, s) => n + s.amountCents, 0),
                      )}
                    </p>
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
                            ? "Registrar cobro parcial"
                            : "Registrar pago parcial"}
                        </button>
                      )}
                      <button
                        disabled={!!o.settlements.length || o.cancelled}
                        onClick={() => {
                          setError("");
                          setDraft(o);
                          setAmount(planningMoneyInput(o.principalCents));
                        }}
                      >
                        Editar compromiso
                      </button>
                      <button
                        disabled={!!o.settlements.length || o.cancelled}
                        onClick={() =>
                          setReview({
                            text: `Cancelar ${o.concept}. Se conserva el registro y no hay movimiento bancario.`,
                            apply: (d) => cancelObligation(d, o.id),
                          })
                        }
                      >
                        Cancelar compromiso
                      </button>
                    </div>
                    <details>
                      <summary>
                        Historial de liquidaciones ({o.settlements.length})
                      </summary>
                      {!o.settlements.length && <p>Sin liquidaciones.</p>}
                      {o.settlements.map((s) => (
                        <div key={s.id}>
                          <p>
                            {s.date} · {money(s.amountCents)} ·{" "}
                            {s.kind === "bank" ? "Banco" : "Ajuste sin banco"} ·{" "}
                            {s.processed ? "Tramitado" : "Pendiente"} · {s.note}
                          </p>
                          {s.transactionId && (
                            <button
                              onClick={() => onMovement(s.transactionId!)}
                            >
                              Revisar movimiento de liquidación
                            </button>
                          )}
                        </div>
                      ))}
                    </details>
                    {o.settlements.length > 0 && (
                      <p>
                        Principal, contraparte y liquidaciones protegidos por
                        historial. Las correcciones requieren un compromiso
                        explícito independiente; no se borra el histórico.
                      </p>
                    )}
                  </>
                );
              })()}
          </article>
        ))}
      </div>
      {!matching.length && <p>No hay deudas en este filtro.</p>}
      {direction === "payable" && (
        <section aria-label="Préstamos existentes">
          <h2>Préstamos existentes</h2>
          {loans}
        </section>
      )}
      {draft && (
        <SafeDialog
          title="Compromiso personal"
          onCancel={() => {
            if (!review) setDraft(null);
          }}
        >
          <form className="finance-form" onSubmit={propose}>
            <label>
              Dirección
              <select
                value={draft.direction}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    direction: e.target
                      .value as PersonalObligation["direction"],
                  })
                }
              >
                <option value="receivable">Me deben</option>
                <option value="payable">Debo</option>
              </select>
            </label>
            <label>
              Contacto opcional
              <select
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
                <option value="">Contraparte independiente</option>
                {data.contacts.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Contraparte
              <input
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
            <label>
              Concepto
              <input
                required
                maxLength={500}
                value={draft.concept}
                onChange={(e) =>
                  setDraft({ ...draft, concept: e.target.value })
                }
              />
            </label>
            <label>
              Principal (€)
              <input
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Fecha del compromiso
              <input
                required
                type="date"
                min="0001-01-01"
                max="9999-12-31"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </label>
            <label>
              Vencimiento opcional
              <input
                type="date"
                min={draft.date}
                max="9999-12-31"
                value={draft.dueDate ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, dueDate: e.target.value || undefined })
                }
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <div className="finance-actions">
              <button type="button" onClick={() => setDraft(null)}>
                Cancelar
              </button>
              <button type="submit">Revisar compromiso</button>
            </div>
          </form>
        </SafeDialog>
      )}
      {pay && (
        <SafeDialog
          title="Liquidación personal"
          onCancel={() => {
            if (!review) setPay(null);
          }}
        >
          <form className="finance-form" onSubmit={proposePayment}>
            <p>
              No registres un nuevo movimiento si ya existe en tu banco. Usa
              ajuste sin banco para reflejar un cobro/pago ya registrado, o crea
              aquí una única devolución de principal.
            </p>
            <label>
              Importe a liquidar (€)
              <input
                required
                inputMode="decimal"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </label>
            <label>
              Fecha de liquidación
              <input
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
            <label>
              Modalidad
              <select
                aria-label="Modalidad de liquidación"
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
                <option value="adjustment">
                  Ajuste sin banco / compensación explícita
                </option>
                <option value="bank">
                  Crear movimiento de devolución de principal
                </option>
              </select>
            </label>
            {pay.input.kind === "bank" && (
              <>
                <label>
                  Cartera de liquidación
                  <select
                    aria-label="Cartera de liquidación" required
                    value={pay.input.walletId ?? ""}
                    onChange={(e) =>
                      setPay({
                        ...pay,
                        walletChoice: e.target.value,
                        input: { ...pay.input, walletId: e.target.value },
                      })
                    }
                  >
                    <option value="" disabled>Selecciona una cartera</option>{data.wallets.map((w) => (
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
                  />
                  Ya tramitado: aplicar al saldo bancario tras confirmar
                </label>
              </>
            )}
            <label>
              Nota de liquidación
              <input
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
            {error && <p role="alert">{error}</p>}
            <div className="finance-actions">
              <button type="button" onClick={() => setPay(null)}>
                Cancelar
              </button>
              <button type="submit">Revisar liquidación</button>
            </div>
          </form>
        </SafeDialog>
      )}
      {review && (
        <FinanceReview
          title="Confirmar compromiso o liquidación"
          onCancel={() => setReview(null)}
          onConfirm={() => mutate(review.apply)}
          onSuccess={() => {
            setReview(null);
            setDraft(null);
            setPay(null);
          }}
        >
          <p>{review.text}</p>
        </FinanceReview>
      )}
    </section>
  );
}

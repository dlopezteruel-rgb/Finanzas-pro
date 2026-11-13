import {useI18n} from "../i18n";
import React, { useMemo, useState } from "react";
import type { FinanceData } from "../utils/backup";
import { treasuryProjection } from "../utils/treasury";
import { madridDate, shiftMonth } from "../utils/financialCalendar";

const sourceNames = {
  pending: "Registrado pendiente",
  recurring: "Propuesta periódica",
  personal: "Compromiso personal",
  loan: "Cuota estimada",
};
export function TreasuryView({
  data,
  navigate,
}: {
  data: FinanceData;
  navigate: (source: string, id: string) => void;
}) {
  const { formatCents: money , formatDate } = useI18n();
  const [from, setFrom] = useState(() => madridDate()),
    [days, setDays] = useState(30);
  const result = useMemo(() => {
    try {
      return { value: treasuryProjection(data, from, days) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [data, from, days]);
  return (
    <section className="finance-module" aria-label="Previsión de tesorería">
      <h1>Próximos 30 días · Tesorería</h1>
      <p>
        Estimación informativa sobre el saldo líquido actual. Las propuestas y
        los créditos no son dinero disponible. Consultar esta vista no modifica
        cuentas.
      </p>
      <div className="finance-actions">
        <label>
          Fecha inicial
          <input
            aria-label="Fecha inicial de tesorería"
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Horizonte
          <select
            aria-label="Horizonte de tesorería"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={30}>30 días</option>
            <option value={90}>90 días / por meses</option>
          </select>
        </label>
        <button onClick={() => setFrom(madridDate())}>Desde hoy</button>
        <button
          disabled={!shiftMonth(from.slice(0, 7), 1)}
          onClick={() => {
            const next = shiftMonth(from.slice(0, 7), 1);
            if (next) setFrom(`${next}-01`);
          }}
        >
          Próximo mes
        </button>
      </div>
      {result.error && <p role="alert">{result.error}</p>}
      {result.value &&
        (() => {
          const p = result.value;
          return (
            <>
              <p>
                {p.from} — {p.to}. No incluye efectivo de inversiones ni cobros
                sin vencimiento.
              </p>
              <dl className="finance-grid">
                {[
                  ["Saldo líquido actual", p.liquidCents],
                  ["Entradas esperadas", p.incomeCents],
                  ["Salidas esperadas", p.expenseCents],
                  ["Saldo proyectado", p.projectedCents],
                  ["Mínimo orientativo", p.minimumCents],
                  [
                    "Cobros sin fecha (fuera del cálculo)",
                    p.undatedReceivableCents,
                  ],
                  [
                    "Pagos sin fecha (fuera del cálculo)",
                    p.undatedPayableCents,
                  ],
                ].map(([label, value]) => (
                  <div className="planning-card" key={label}>
                    <dt>{label}</dt>
                    <dd>{money(value as number)}</dd>
                  </div>
                ))}
              </dl>
              {p.warnings.map((w) => (
                <p role="status" key={w}>
                  {w}
                </p>
              ))}
              <div className="finance-table">
                <table>
                  <caption>Proyección por vencimiento</caption>
                  <thead>
                    <tr>
                      <th>Fecha / fuente</th>
                      <th>Concepto / certeza</th>
                      <th>Flujo</th>
                      <th>Saldo estimado</th>
                      <th>Origen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.events.map((e) => (
                      <tr key={e.id}>
                        <td>
                          {formatDate(e.date, {day:'2-digit',month:'2-digit',year:'numeric'})}
                          {e.overdue ? " · Vencido" : ""}
                          <br />
                          {sourceNames[e.source]}
                        </td>
                        <td>
                          {e.concept}
                          <br />
                          {e.certainty === "registered"
                            ? "Registrado"
                            : e.certainty === "proposed"
                              ? "Sin registrar"
                              : "Estimado"}
                        </td>
                        <td>{money(e.amountCents)}</td>
                        <td>{money(e.projectedCents!)}</td>
                        <td>
                          <button
                            onClick={() => navigate(e.source, e.originId)}
                          >
                            Revisar origen
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!p.events.length && (
                <p>Sin flujos conocidos en este horizonte.</p>
              )}
              <div className="finance-table">
                <table>
                  <caption>Proyección por meses del horizonte</caption>
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th>Entradas</th>
                      <th>Salidas</th>
                      <th>Saldo final estimado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.months.map((m) => (
                      <tr key={m.month}>
                        <td>{m.month}</td>
                        <td>{money(m.incomeCents)}</td>
                        <td>{money(m.expenseCents)}</td>
                        <td>{money(m.projectedCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => navigate("planning", "")}>
                Revisar planificación guardada (separada del flujo)
              </button>
            </>
          );
        })()}
    </section>
  );
}

import {storageOwnedText} from '../i18n/storageMessages';
import {treasuryWarningText,treasuryConceptText} from '../i18n/bankingMessages';
import {useI18n, I18nText } from "../i18n";
import React, { useMemo, useState } from "react";
import type { FinanceData } from "../utils/backup";
import { treasuryProjection } from "../utils/treasury";
import { madridDate, shiftMonth } from "../utils/financialCalendar";

const sourceNames = {
  pending: "treasury.source.pending",
  recurring: "treasury.source.recurring",
  personal: "treasury.source.personal",
  loan: "treasury.source.loan",
} as const;
export function TreasuryView({
  data,
  navigate,
}: {
  data: FinanceData;
  navigate: (source: string, id: string) => void;
}) {
  const { t: uiText } = useI18n();
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
    <section className="finance-module" aria-label={uiText("treasury.prevision_de_tesoreria")}>
      <h1>{uiText("treasury.proximos_30_dias_tesoreria")}</h1>
      <p>{uiText("treasury.estimacion_informativa_sobre_el_saldo_liquido_actual_las_propuestas")}</p>
      <div className="finance-actions">
        <label>{uiText("treasury.fecha_inicial")}<input
            aria-label={uiText("treasury.fecha_inicial_de_tesoreria")}
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>{uiText("treasury.horizonte")}<select
            aria-label={uiText("treasury.horizonte_de_tesoreria")}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={30}>{uiText("treasury.30_dias")}</option>
            <option value={90}>{uiText("treasury.90_dias_por_meses")}</option>
          </select>
        </label>
        <button onClick={() => setFrom(madridDate())}>{uiText("treasury.desde_hoy")}</button>
        <button
          disabled={!shiftMonth(from.slice(0, 7), 1)}
          onClick={() => {
            const next = shiftMonth(from.slice(0, 7), 1);
            if (next) setFrom(`${next}-01`);
          }}
        >{uiText("treasury.proximo_mes")}</button>
      </div>
      {result.error && <p role="alert">{storageOwnedText(result.error,uiText)}</p>}
      {result.value &&
        (() => {
          const p = result.value;
          return (
            <>
              <p><I18nText id="treasury.no_incluye_efectivo_de_inversiones_ni_cobros_sin_vencimiento" values={{ from: (formatDate(p.from,{day:"2-digit",month:"2-digit",year:"numeric"})), to: (formatDate(p.to,{day:"2-digit",month:"2-digit",year:"numeric"})) }} /></p>
              <dl className="finance-grid">
                {[
                  [uiText("treasury.metric.liquid"), p.liquidCents],
                  [uiText("treasury.metric.income"), p.incomeCents],
                  [uiText("treasury.metric.expense"), p.expenseCents],
                  [uiText("treasury.metric.projected"), p.projectedCents],
                  [uiText("treasury.metric.minimum"), p.minimumCents],
                  [
                    uiText("treasury.metric.undatedReceivable"),
                    p.undatedReceivableCents,
                  ],
                  [
                    uiText("treasury.metric.undatedPayable"),
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
                  {treasuryWarningText(w,data,p.from,uiText,formatDate)}
                </p>
              ))}
              <div className="finance-table">
                <table>
                  <caption>{uiText("treasury.proyeccion_por_vencimiento")}</caption>
                  <thead>
                    <tr>
                      <th>{uiText("treasury.fecha_fuente")}</th>
                      <th>{uiText("treasury.concepto_certeza")}</th>
                      <th>{uiText("treasury.flujo")}</th>
                      <th>{uiText("treasury.saldo_estimado")}</th>
                      <th>{uiText("treasury.origen")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.events.map((e) => (
                      <tr key={e.id}>
                        <td>
                          {formatDate(e.date, {day:'2-digit',month:'2-digit',year:'numeric'})}
                          {e.overdue ? uiText("treasury.vencido") : ""}
                          <br />
                          {uiText(sourceNames[e.source])}
                        </td>
                        <td>
                          {treasuryConceptText(e,data,p.from,uiText,formatDate)}
                          <br />
                          {e.certainty === "registered"
                            ? uiText("treasury.registrado")
                            : e.certainty === "proposed"
                              ? uiText("treasury.sin_registrar")
                              : uiText("treasury.estimado")}
                        </td>
                        <td>{money(e.amountCents)}</td>
                        <td>{money(e.projectedCents!)}</td>
                        <td>
                          <button
                            onClick={() => navigate(e.source, e.originId)}
                          >{uiText("treasury.revisar_origen")}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!p.events.length && (
                <p>{uiText("treasury.sin_flujos_conocidos_en_este_horizonte")}</p>
              )}
              <div className="finance-table">
                <table>
                  <caption>{uiText("treasury.proyeccion_por_meses_del_horizonte")}</caption>
                  <thead>
                    <tr>
                      <th>{uiText("treasury.mes")}</th>
                      <th>{uiText("treasury.entradas")}</th>
                      <th>{uiText("treasury.salidas")}</th>
                      <th>{uiText("treasury.saldo_final_estimado")}</th>
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
              <button onClick={() => navigate("planning", "")}>{uiText("treasury.revisar_planificacion_guardada_separada_del_flujo")}</button>
            </>
          );
        })()}
    </section>
  );
}

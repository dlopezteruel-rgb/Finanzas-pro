import { useI18n } from "../i18n";
import React, { useState } from "react";
import { SafeDialog } from "./SafeDialog";
import {
  currentMonth,
  monthLabel,
  MONTH_NAMES,
  shiftMonth,
} from "../utils/financialCalendar";

export function PeriodSelector({
  month,
  periods,
  onChange,
}: {
  month: string;
  periods: string[];
  onChange: (month: string) => void;
}) {
  const { t: uiText } = useI18n();
  const [open, setOpen] = useState(false),
    [year, setYear] = useState(month.slice(0, 4)),
    [number, setNumber] = useState(month.slice(5));
  const previous = shiftMonth(month, -1),
    next = shiftMonth(month, 1);
  return (
    <div className="period-selector">
      <button
        aria-label={uiText("period_selector.mes_anterior")}
        disabled={!previous}
        onClick={() => previous && onChange(previous)}
      >
        ‹
      </button>
      <select
        aria-label={uiText("period_selector.seleccionar_periodo_contable")}
        title={monthLabel(month)}
        value={month}
        onChange={(e) => onChange(e.target.value)}
      >
        {[
          ...new Set([
            month,
            ...periods.filter((p) => /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(p)),
          ]),
        ]
          .sort()
          .reverse()
          .map((p) => (
            <option key={p} value={p}>
              {monthLabel(p, true)}
            </option>
          ))}
      </select>
      <button
        aria-label={uiText("period_selector.mes_siguiente")}
        disabled={!next}
        onClick={() => next && onChange(next)}
      >
        ›
      </button>
      <button
        aria-label={uiText("period_selector.elegir_mes_y_ano")}
        onClick={() => {
          setYear(month.slice(0, 4));
          setNumber(month.slice(5));
          setOpen(true);
        }}
      >{uiText("period_selector.fecha")}</button>
      <button
        aria-label={uiText("period_selector.ir_al_mes_actual")}
        onClick={() => onChange(currentMonth())}
      >{uiText("period_selector.hoy")}</button>
      {open && (
        <SafeDialog title={uiText("period_selector.elegir_mes_y_ano")} onCancel={() => setOpen(false)}>
          <form
            className="finance-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (/^[0-9]{1,4}$/.test(year) && Number(year) >= 1) {
                onChange(`${year.padStart(4, "0")}-${number}`);
                setOpen(false);
              }
            }}
          >
            <label>{uiText("period_selector.mes")}<select
                aria-label={uiText("period_selector.mes")}
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              >
                {MONTH_NAMES.map((m, i) => (
                  <option value={String(i + 1).padStart(2, "0")} key={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label>{uiText("period_selector.ano")}<input
                aria-label={uiText("period_selector.ano")}
                type="number"
                min="1"
                max="9999"
                required
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </label>
            <p>{uiText("period_selector.rango_0001_9999_puedes_consultar_periodos_sin_actividad")}</p>
            <button type="button" onClick={() => setOpen(false)}>{uiText("confirm_clear.cancelar")}</button>
            <button type="submit">{uiText("period_selector.consultar_periodo")}</button>
          </form>
        </SafeDialog>
      )}
    </div>
  );
}

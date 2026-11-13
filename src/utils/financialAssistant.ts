import type {translate} from "../i18n/messages";
import type { FinanceData } from "./backup";
import { annualPlanning, planningStatus } from "./planning";
import { planningBudgetRows, planningCatalog } from "./planningBasis";
import { economicTransactions } from "./transfers";
import { intelligent } from "./intelligentValidation";
import { obligationOverview } from "./personalObligations";
import { treasuryProjection } from "./treasury";
import { madridDate } from "./financialCalendar";
import {
  assertMonth,
  formatPlanningCents as defaultAdviceMoney,
  safeCents,
  parsePlanningMoney,
} from "./planningMoney";

/** Optional UI presentation only. Existing two-argument/API output stays Spanish and byte-compatible.
 * Recognition, parsing, arithmetic and read models below are unchanged. */
export interface LocalAdvicePresentation {
  text: typeof translate;
  money: (cents: number) => string;
  date: (iso: string) => string;
  month: (isoMonth: string) => string;
  status: (status: string) => string;
  number: (value: number) => string;
  warning: (text: string) => string;
  itemName?: (item: Pick<FinancialAssistantContext['partidas'][number],'type'|'code'|'name'>) => string;
}

/** A computed read model, not a new source of saved financial truth. */
export function financialAssistantContext(
  data: FinanceData,
  month: string,
  today = madridDate(),
) {
  assertMonth(month);
  const planning = annualPlanning(data, month.slice(0, 4)).find(
      (m) => m.monthYear === month,
    )!,
    meta = data.planningMonths?.find((m) => m.monthYear === month);
  const rows = planningBudgetRows(
    data,
    month,
    planningCatalog(
      data,
      data.budgetGroups.flatMap((g) => g.partidas),
    ),
  );
  const economic = economicTransactions(data.transactions).filter(
    (t) => t.date.slice(0, 7) === month,
  );
  const partidas = rows
    .map((r) => ({
      code: r.code,
      name: r.name,
      type: r.type,
      baseCents: Math.round((r.basePrevisto ?? r.previsto) * 100),
      carryCents: Math.round((r.arrastre ?? 0) * 100),
      effectiveCents: Math.round(r.previsto * 100),
      executedCents: Math.round(r.ejecutado * 100),
      pendingCents: economic
        .filter((t) => !t.processed && t.type === r.type && t.code === r.code)
        .reduce((n, t) => safeCents(n + Math.round(t.amount * 100)), 0),
      remainingCents: Math.round(r.resto * 100),
    }))
    .filter((r) => r.effectiveCents || r.executedCents || r.pendingCents);
  const obligations = obligationOverview(data, today),
    projection = treasuryProjection(data, today),
    rules = intelligent(data).recurringRules.filter((r) => !r.deleted);
  return {
    month,
    asOf: today,
    currency: "EUR",
    units: "integer cents",
    status: planningStatus(data, month),
    totals: planning.totals,
    approval: meta?.approval
      ? {
          number: meta.approval.number,
          approvedAt: meta.approval.approvedAt,
          current: meta.approval.revision === meta.revision,
          totals: meta.approval.totals,
        }
      : null,
    partidas,
    obligations: {
      receivableCents: obligations
        .filter((o) => o.direction === "receivable")
        .reduce((n, o) => safeCents(n + o.remainingCents), 0),
      payableCents: obligations
        .filter((o) => o.direction === "payable")
        .reduce((n, o) => safeCents(n + o.remainingCents), 0),
      overdueCents: obligations.reduce(
        (n, o) => safeCents(n + o.overdueCents),
        0,
      ),
    },
    recurring: {
      active: rules.filter((r) => r.active).length,
      paused: rules.filter((r) => !r.active).length,
      expectedIncomeCents: projection.events
        .filter((e) => e.source === "recurring" && e.amountCents > 0)
        .reduce((n, e) => safeCents(n + e.amountCents), 0),
      expectedExpenseCents: projection.events
        .filter((e) => e.source === "recurring" && e.amountCents < 0)
        .reduce((n, e) => safeCents(n - e.amountCents), 0),
    },
    treasury: {
      from: projection.from,
      to: projection.to,
      liquidCents: projection.liquidCents,
      projectedCents: projection.projectedCents,
      minimumCents: projection.minimumCents,
      events: projection.events.map((e) => ({
        date: e.date,
        source: e.source,
        certainty: e.certainty,
        amountCents: e.amountCents,
      })),
      warnings: projection.warnings,
    },
  };
}
export type FinancialAssistantContext = ReturnType<
  typeof financialAssistantContext
>;
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const table = (head: string, rows: string[]) => `${head}\n${rows.join("\n")}`;
/** Supported numerical advice is local and deterministic, including offline operation. */
export function localFinancialAdvice(
  c: FinancialAssistantContext,
  message: string,
  ui?: LocalAdvicePresentation,
): string | null {
  const money=ui?.money??defaultAdviceMoney;
  const text = normalize(message),
    prefix = (ui?.text("assistant.advice.prefix",{month:(ui?.month(c.month)??c.month),status:(ui?.status(c.status)??c.status),asOf:(ui?.date(c.asOf)??c.asOf)})??`### Datos guardados · ${c.month}\nEstado: ${c.status}. Importes económicos del mes; tesorería a ${c.asOf}.\n`);
  if (/disponib|liquid|tesorer/.test(text))
    return (ui?.text("assistant.advice.liquidity",{prefix:prefix,liquid:money(c.treasury.liquidCents),to:(ui?.date(c.treasury.to)??c.treasury.to),projected:money(c.treasury.projectedCents),minimum:money(c.treasury.minimumCents),margin:money(c.totals.margin),receivable:money(c.obligations.receivableCents),payable:money(c.obligations.payableCents),warnings:(ui?c.treasury.warnings.map(ui.warning).join("\n"):c.treasury.warnings.join("\n"))})??`${prefix}Saldo líquido actual: **${money(c.treasury.liquidCents)}**. Saldo estimado hasta ${c.treasury.to}: **${money(c.treasury.projectedCents)}**. Mínimo estimado: ${money(c.treasury.minimumCents)}.\nMargen de planificación tras ahorro objetivo: ${money(c.totals.margin)}. No es saldo bancario. Créditos pendientes (${money(c.obligations.receivableCents)}) y deudas (${money(c.obligations.payableCents)}) están separados del efectivo.\n${c.treasury.warnings.join("\n")}`);
  if (/cobro|pago|vencim|deud|prestam|periodic/.test(text))
    return (ui?.text("assistant.advice.obligations",{prefix:prefix,receivable:money(c.obligations.receivableCents),payable:money(c.obligations.payableCents),overdue:money(c.obligations.overdueCents),active:(ui?.number(c.recurring.active)??c.recurring.active),paused:(ui?.number(c.recurring.paused)??c.recurring.paused),income:money(c.recurring.expectedIncomeCents),expenses:money(c.recurring.expectedExpenseCents),flows:c.treasury.events.length
        ? table(
            (ui?.text("assistant.advice.flowsTable")??"| Fecha | Fuente | Flujo previsto |\n| :--- | :--- | :--- |"),
            c.treasury.events
              .slice(0, 60)
              .map(
                (e) =>
                  `| ${(ui?.date(e.date)??e.date)} | ${e.source === "pending" ? (ui?.text("assistant.advice.pendingSource")??"Movimiento pendiente") : e.source === "recurring" ? (ui?.text("assistant.advice.unrecordedSource")??"Propuesta sin registrar") : e.source === "personal" ? (ui?.text("assistant.advice.personalSource")??"Compromiso") : (ui?.text("assistant.advice.instalmentSource")??"Cuota estimada")} | ${money(e.amountCents)} |`,
              ),
          )
        : (ui?.text("assistant.advice.noFlows")??"Sin flujos fechados conocidos para los próximos 30 días."),limitNotice:c.treasury.events.length > 60 ? (ui?.text("assistant.advice.firstFlows")??"Se muestran los primeros 60 flujos; consulta Tesorería para el detalle completo.") : ""})??`${prefix}Me deben: ${money(c.obligations.receivableCents)}. Debo: ${money(c.obligations.payableCents)}. Vencido orientativo: ${money(c.obligations.overdueCents)}.\nReglas activas: ${c.recurring.active}; pausadas: ${c.recurring.paused}. Propuestas periódicas: ingresos ${money(c.recurring.expectedIncomeCents)}, gastos ${money(c.recurring.expectedExpenseCents)}.\n${
      c.treasury.events.length
        ? table(
            "| Fecha | Fuente | Flujo previsto |\n| :--- | :--- | :--- |",
            c.treasury.events
              .slice(0, 60)
              .map(
                (e) =>
                  `| ${e.date} | ${e.source === "pending" ? "Movimiento pendiente" : e.source === "recurring" ? "Propuesta sin registrar" : e.source === "personal" ? "Compromiso" : "Cuota estimada"} | ${money(e.amountCents)} |`,
              ),
          )
        : "Sin flujos fechados conocidos para los próximos 30 días."
    }\n${c.treasury.events.length > 60 ? "Se muestran los primeros 60 flujos; consulta Tesorería para el detalle completo." : ""}\nLos cobros sin vencimiento no tienen fecha estimada. Consulta Deudas y Tesorería para revisar fuentes.`);
  if (/arrastr/.test(text))
    return `${prefix}${table(
      (ui?.text("assistant.advice.carryTable")??"| Partida | Base | Arrastre | Efectivo |\n| :--- | :--- | :--- | :--- |"),
      c.partidas
        .filter((r) => r.carryCents)
        .map(
          (r) =>
            `| ${ui?.itemName?.(r)??r.name} | ${money(r.baseCents)} | ${money(r.carryCents)} | ${money(r.effectiveCents)} |`,
        ),
    )}\n${c.partidas.some((r) => r.carryCents) ? (ui?.text("assistant.advice.carryNotice")??"Efectivo = base + arrastre. El arrastre no es un ingreso bancario.") : (ui?.text("assistant.advice.noCarry")??"No hay arrastres guardados en este periodo.")}`;
  if (
    /alerta|sobrepas|exced|desvia|presupuesto.*super|partida.*presupuesto/.test(
      text,
    )
  ) {
    const exceeded = c.partidas.filter(
      (r) =>
        r.type === "GASTO" &&
        (r.executedCents > r.effectiveCents ||
          (r.effectiveCents > 0 && r.executedCents >= r.effectiveCents * 0.9)),
    );
    return (ui?.text("assistant.advice.alerts",{prefix:prefix,table:exceeded.length
        ? table(
            (ui?.text("assistant.advice.alertsTable")??"| Partida | Base + arrastre | Tramitado propio | Pendiente propio | Desviación |\n| :--- | :--- | :--- | :--- | :--- |"),
            exceeded.map(
              (r) =>
                `| ${ui?.itemName?.(r)??r.name} | ${money(r.baseCents)} + ${money(r.carryCents)} | ${money(r.executedCents)} | ${money(r.pendingCents)} | ${money(r.executedCents - r.effectiveCents)} |`,
            ),
          )
        : (ui?.text("assistant.advice.noAlerts")??"No hay partidas de gasto al 90 % o por encima del presupuesto guardado.")})??`${prefix}${
      exceeded.length
        ? table(
            "| Partida | Base + arrastre | Tramitado propio | Pendiente propio | Desviación |\n| :--- | :--- | :--- | :--- | :--- |",
            exceeded.map(
              (r) =>
                `| ${ui?.itemName?.(r)??r.name} | ${money(r.baseCents)} + ${money(r.carryCents)} | ${money(r.executedCents)} | ${money(r.pendingCents)} | ${money(r.executedCents - r.effectiveCents)} |`,
            ),
          )
        : "No hay partidas de gasto al 90 % o por encima del presupuesto guardado."
    }\nLa desviación compara el gasto económico propio tramitado con el presupuesto efectivo; los pendientes se muestran separados.`);
  }
  if (/ahorr|reduc|recort/.test(text)) {
    if (c.totals.income <= 0)
      return (ui?.text("assistant.advice.noIncome",{prefix:prefix})??`${prefix}No hay ingresos previstos suficientes guardados para calcular cómo distribuirlos o alcanzar un ahorro. Guarda primero ingresos, gastos y objetivo en Planificación.`);
    const match = text.match(/\d[\d.,]*/);
    let requested = c.totals.savings;
    try {
      if (match) requested = parsePlanningMoney(match[0]);
    } catch {
      return (ui?.text("assistant.advice.ambiguousTarget",{prefix:prefix})??`${prefix}Escribe un objetivo inequívoco, por ejemplo 1500 o 1.500,00 €. No se ha realizado ninguna modificación.`);
    }
    if (!Number.isSafeInteger(requested))
      return (ui?.text("assistant.advice.unsafeTarget",{prefix:prefix})??`${prefix}El objetivo solicitado supera el rango de cálculo. Usa un importe en céntimos válido.`);
    const extra = /mas|extra|adicional/.test(text),
      needed = extra ? requested : Math.max(0, requested - c.totals.balance);
    let left = needed;
    const suggestions: string[] = [];
    for (const r of c.partidas
      .filter((r) => r.type === "GASTO")
      .sort(
        (a, b) =>
          b.remainingCents -
          b.pendingCents -
          (a.remainingCents - a.pendingCents),
      )) {
      const candidate = Math.min(
        left,
        Math.max(0, r.remainingCents - r.pendingCents),
      );
      if (!candidate) continue;
      suggestions.push(
        (ui?.text("assistant.advice.suggestion",{name:ui?.itemName?.(r)??r.name,candidate:money(candidate),available:money(r.remainingCents - r.pendingCents)})??`- ${ui?.itemName?.(r)??r.name}: reducir hasta ${money(candidate)} de ${money(r.remainingCents - r.pendingCents)} todavía no ejecutados ni pendientes.`),
      );
      left -= candidate;
      if (left === 0) break;
    }
    return (ui?.text("assistant.advice.savings",{prefix:prefix,income:money(c.totals.income),expenses:money(c.totals.expenses),savings:money(c.totals.savings),balance:money(c.totals.balance),simulation:extra ? (ui?.text("assistant.advice.additionalSavings",{requested:money(requested)})??`Simulación de ahorro adicional: ${money(requested)}.`) : (ui?.text("assistant.advice.requestedSavings",{requested:money(requested),needed:money(needed)})??`Objetivo consultado: ${money(requested)}; reducción necesaria frente al balance previsto: ${money(needed)}.`),suggestions:needed === 0 ? (ui?.text("assistant.advice.targetReached")??"El balance previsto ya alcanza este objetivo; depende de que se cumplan ingresos y gastos.") : suggestions.join("\n") || (ui?.text("assistant.advice.noUncommittedMargin")??"No hay margen de gasto no comprometido suficiente en las partidas guardadas."),uncovered:left > 0 ? (ui?.text("assistant.advice.uncovered",{left:money(left)})??`Quedan ${money(left)} sin cubrir: faltan ingresos o es necesario revisar compromisos.`) : ""})??`${prefix}Ingreso previsto: ${money(c.totals.income)}; gasto efectivo previsto: ${money(c.totals.expenses)}; ahorro objetivo guardado: ${money(c.totals.savings)}; balance previsto: ${money(c.totals.balance)}.\n${extra ? `Simulación de ahorro adicional: ${money(requested)}.` : `Objetivo consultado: ${money(requested)}; reducción necesaria frente al balance previsto: ${money(needed)}.`}\n${needed === 0 ? "El balance previsto ya alcanza este objetivo; depende de que se cumplan ingresos y gastos." : suggestions.join("\n") || "No hay margen de gasto no comprometido suficiente en las partidas guardadas."}\n${left > 0 ? `Quedan ${money(left)} sin cubrir: faltan ingresos o es necesario revisar compromisos.` : ""}\nSon opciones matemáticas sobre previsiones, no una valoración de qué gasto es prescindible. No se han modificado presupuestos ni registrado movimientos.`);
  }
  if (
    /distribu|repart.*ingres|ingres.*previst|planific|balance|resumen/.test(
      text,
    )
  )
    return (ui?.text("assistant.advice.summary",{prefix:prefix,income:money(c.totals.income),expenses:money(c.totals.expenses),savings:money(c.totals.savings),margin:money(c.totals.margin),approval:c.approval ? (ui?.text("assistant.advice.approval",{number:(ui?.number(c.approval.number)??c.approval.number),approvedAt:(ui?.date(c.approval.approvedAt)??c.approval.approvedAt),status:c.approval.current ? (ui?.text("assistant.advice.current")??"vigente") : (ui?.text("assistant.advice.laterChanges")??"hay cambios posteriores")})??`Última aprobación #${c.approval.number}: ${c.approval.approvedAt}; ${c.approval.current ? "vigente" : "hay cambios posteriores"}.`) : (ui?.text("assistant.advice.noApproval")??"No existe aprobación guardada."),table:table(
      (ui?.text("assistant.advice.summaryTable")??"| Partida | Base | Arrastre | Efectivo | Tramitado propio | Pendiente propio |\n| :--- | :--- | :--- | :--- | :--- | :--- |"),
      c.partidas.map(
        (r) =>
          `| ${ui?.itemName?.(r)??r.name} | ${money(r.baseCents)} | ${money(r.carryCents)} | ${money(r.effectiveCents)} | ${money(r.executedCents)} | ${money(r.pendingCents)} |`,
      ),
    )})??`${prefix}Ingresos previstos: ${money(c.totals.income)}; gastos efectivos: ${money(c.totals.expenses)}; ahorro objetivo: ${money(c.totals.savings)}; margen tras objetivo: ${money(c.totals.margin)}.\n${c.approval ? `Última aprobación #${c.approval.number}: ${c.approval.approvedAt}; ${c.approval.current ? "vigente" : "hay cambios posteriores"}.` : "No existe aprobación guardada."}\n${table(
      "| Partida | Base | Arrastre | Efectivo | Tramitado propio | Pendiente propio |\n| :--- | :--- | :--- | :--- | :--- | :--- |",
      c.partidas.map(
        (r) =>
          `| ${ui?.itemName?.(r)??r.name} | ${money(r.baseCents)} | ${money(r.carryCents)} | ${money(r.effectiveCents)} | ${money(r.executedCents)} | ${money(r.pendingCents)} |`,
      ),
    )}\nLos importes se calculan desde Planificación y movimientos guardados; las propuestas periódicas no son gasto registrado.`);
  return null;
}
/** Existing endpoint receives aggregates only: no contacts, wallets, transaction IDs or backups. */
export function assistantServiceContext(c: FinancialAssistantContext) {
  return {
    month: c.month,
    asOf: c.asOf,
    status: c.status,
    units: c.units,
    totals: c.totals,
    approval: c.approval,
    partidas: c.partidas.slice(0, 100),
    obligations: c.obligations,
    recurring: c.recurring,
    treasury: {
      ...c.treasury,
      events: c.treasury.events.slice(0, 60),
      warnings: c.treasury.warnings.map((w) =>
        w.includes("Préstamo")
          ? "Existe una cuota con información histórica que requiere revisión."
          : w.includes("Movimiento")
            ? "Existe un movimiento con cartera no disponible."
            : w.includes("Regla")
              ? "Existe una coincidencia manual sin enlace inequívoco."
              : w,
      ),
    },
  };
}

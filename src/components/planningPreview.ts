import type { PlanningLine } from '../types/finance';
import { parsePlanningMoney, planningKey, planningTotals, safeCents } from '../utils/planning';
import { combineLines } from '../utils/planningBasis';

/** Presentation adapter for the local editor. Uses the domain functions; never persists. */
export function planningDraftPreview(
  inputs: { type: PlanningLine['type']; code: string; input: string }[],
  savingsInput: string,
  adjustments: PlanningLine[],
) {
  const errors: Record<string, string> = {};
  const edits: PlanningLine[] = [];
  for (const line of inputs) {
    const key = planningKey(line);
    try {
      const amountCents = parsePlanningMoney(line.input);
      safeCents(amountCents + (adjustments.find(a => planningKey(a) === key)?.amountCents ?? 0));
      edits.push({ type: line.type, code: line.code, amountCents });
    } catch (error) { errors[key] = (error as Error).message; }
  }
  let savingsCents = 0, savingsError = '', totalError = '';
  let baseTotals: ReturnType<typeof planningTotals> | null = null;
  let totals: ReturnType<typeof planningTotals> | null = null;
  try { savingsCents = parsePlanningMoney(savingsInput); }
  catch (error) { savingsError = (error as Error).message; }
  if (!savingsError && !Object.keys(errors).length) {
    try {
      const base = planningTotals(edits, savingsCents);
      const effective = planningTotals(combineLines(edits, adjustments), savingsCents);
      baseTotals = base;
      totals = effective;
    } catch (error) { totalError = (error as Error).message; }
  }
  const carryCents = adjustments.reduce((sum, line) => safeCents(sum + line.amountCents), 0);
  return { edits, errors, savingsError, totalError, baseTotals, totals, carryCents };
}

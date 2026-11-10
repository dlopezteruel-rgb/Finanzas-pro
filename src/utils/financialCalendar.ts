import { assertMonth } from "./planningMoney";
import { monthNumber } from "./planningCalendar";

export const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
export function madridDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}
export const currentMonth = (now = new Date()) => madridDate(now).slice(0, 7);
export function shiftMonth(month: string, delta: number): string | null {
  const n = monthNumber(month) + delta;
  if (!Number.isInteger(delta) || n < 12 || n > 119999) return null;
  return `${String(Math.floor(n / 12)).padStart(4, "0")}-${String((n % 12) + 1).padStart(2, "0")}`;
}
export function monthLabel(month: string): string {
  assertMonth(month);
  return `${MONTH_NAMES[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
}
export function daysInMonth(month: string): number {
  assertMonth(month);
  const [y, m] = month.split("-").map(Number);
  return m === 2
    ? y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
      ? 29
      : 28
    : [4, 6, 9, 11].includes(m)
      ? 30
      : 31;
}
export function realDate(date: unknown): date is string {
  if (
    typeof date !== "string" ||
    !/^(?!0000)\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date)
  )
    return false;
  return (
    Number(date.slice(8)) >= 1 &&
    Number(date.slice(8)) <= daysInMonth(date.slice(0, 7))
  );
}
export function dateAtDay(month: string, day: number): string {
  if (!Number.isInteger(day) || day < 1 || day > 31)
    throw new Error("Día inválido.");
  return `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, "0")}`;
}
export function addDays(date: string, days: number): string {
  if (!realDate(date) || !Number.isInteger(days))
    throw new Error("Fecha inválida.");
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  const result = d.toISOString().slice(0, 10);
  return realDate(result) ? result : days > 0 ? "9999-12-31" : "0001-01-01";
}

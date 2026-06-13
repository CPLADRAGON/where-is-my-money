import { CATEGORIES, PILLARS, type Pillar } from "./taxonomy";
import type { IncomeByMonth, Transaction } from "./types";

export interface DateRange {
  /** "all" or "month" or "custom". */
  mode: "all" | "month" | "custom";
  month?: string; // YYYY-MM when mode === "month"
  start?: string; // YYYY-MM-DD when mode === "custom"
  end?: string;
}

export function inRange(t: Transaction, range: DateRange): boolean {
  if (range.mode === "all") return true;
  if (range.mode === "month") return t.month === range.month;
  if (range.mode === "custom") {
    if (range.start && t.date < range.start) return false;
    if (range.end && t.date > range.end) return false;
    return true;
  }
  return true;
}

export function filterTx(tx: Transaction[], range: DateRange): Transaction[] {
  return tx.filter((t) => inRange(t, range));
}

export function totalSpent(tx: Transaction[]): number {
  return tx.reduce((a, t) => a + t.amount, 0);
}

export function spentByPillar(tx: Transaction[]): Record<Pillar, number> {
  const out = { "Fixed Needs": 0, "Variable Wants": 0, "Future Savings": 0 } as Record<Pillar, number>;
  for (const t of tx) out[t.pillar] += t.amount;
  return out;
}

export interface SubRow {
  sub: string;
  pillar: Pillar;
  amount: number;
}

export function spentBySub(tx: Transaction[]): SubRow[] {
  const map = new Map<string, number>();
  for (const t of tx) map.set(t.sub, (map.get(t.sub) ?? 0) + t.amount);
  const rows: SubRow[] = [];
  for (const pillar of PILLARS) {
    for (const sub of CATEGORIES[pillar]) {
      const amount = map.get(sub) ?? 0;
      if (amount > 0) rows.push({ sub, pillar, amount });
    }
  }
  return rows.sort((a, b) => b.amount - a.amount);
}

/** Income within a range: sum of monthly income for months touched by range. */
export function incomeInRange(
  detected: IncomeByMonth,
  overrides: IncomeByMonth,
  months: string[],
  range: DateRange
): number {
  const eff = (m: string) => overrides[m] ?? detected[m] ?? 0;
  if (range.mode === "month") return eff(range.month ?? "");
  if (range.mode === "all") return months.reduce((a, m) => a + eff(m), 0);
  // custom: include any month bucket that overlaps the [start, end] range
  const startM = range.start?.slice(0, 7);
  const endM = range.end?.slice(0, 7);
  return months
    .filter((m) => (!startM || m >= startM) && (!endM || m <= endM))
    .reduce((a, m) => a + eff(m), 0);
}

export interface MonthlyPoint {
  month: string;
  spent: number;
  income: number;
}

export function monthlyTrend(
  tx: Transaction[],
  months: string[],
  detected: IncomeByMonth,
  overrides: IncomeByMonth
): MonthlyPoint[] {
  const spentMap = new Map<string, number>();
  for (const t of tx) spentMap.set(t.month, (spentMap.get(t.month) ?? 0) + t.amount);
  return months.map((m) => ({
    month: m,
    spent: spentMap.get(m) ?? 0,
    income: overrides[m] ?? detected[m] ?? 0,
  }));
}

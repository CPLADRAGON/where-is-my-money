import {
  CATEGORIES,
  SPENDING_PILLARS,
  TARGETS,
  isSpending,
  type BudgetBucket,
  type SpendingPillar,
} from "./taxonomy";
import type { IncomeByMonth, Transaction } from "./types";

export interface DateRange {
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

/** Spending rows only (transfers excluded). */
export function spendingRows(tx: Transaction[]): Transaction[] {
  return tx.filter((t) => isSpending(t.pillar));
}

export function transferRows(tx: Transaction[]): Transaction[] {
  return tx.filter((t) => !isSpending(t.pillar));
}

/** Total spent = sum of spending rows (excludes transfers). */
export function totalSpent(tx: Transaction[]): number {
  return spendingRows(tx).reduce((a, t) => a + t.amount, 0);
}

/** Total moved via transfers (savings/investment + personal). */
export function totalTransfers(tx: Transaction[]): number {
  return transferRows(tx).reduce((a, t) => a + t.amount, 0);
}

/** Money explicitly moved to savings/investment accounts. */
export function totalInvested(tx: Transaction[]): number {
  return tx
    .filter((t) => t.pillar === "Transfer" && /Savings/.test(t.sub))
    .reduce((a, t) => a + t.amount, 0);
}

export function spentByPillar(tx: Transaction[]): Record<SpendingPillar, number> {
  const out = { "Fixed Needs": 0, "Variable Wants": 0 } as Record<
    SpendingPillar,
    number
  >;
  for (const t of spendingRows(tx)) out[t.pillar as SpendingPillar] += t.amount;
  return out;
}

export interface SubRow {
  sub: string;
  pillar: SpendingPillar;
  amount: number;
}

export function spentBySub(tx: Transaction[]): SubRow[] {
  const map = new Map<string, number>();
  for (const t of spendingRows(tx)) {
    map.set(t.sub, (map.get(t.sub) ?? 0) + t.amount);
  }
  const rows: SubRow[] = [];
  for (const pillar of SPENDING_PILLARS) {
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
  const startM = range.start?.slice(0, 7);
  const endM = range.end?.slice(0, 7);
  return months
    .filter((m) => (!startM || m >= startM) && (!endM || m <= endM))
    .reduce((a, m) => a + eff(m), 0);
}

export interface BudgetRow {
  bucket: BudgetBucket;
  amount: number;
  /** Share of income (0..1+). */
  actual: number;
  target: number;
  onTrack: boolean;
}

/**
 * The 50/30/20 view as a share of INCOME:
 *   Needs   = Fixed Needs spending
 *   Wants   = Variable Wants spending
 *   Savings = Income − total spending (the residual you kept)
 */
export function budgetBreakdown(
  tx: Transaction[],
  income: number
): { rows: BudgetRow[]; savings: number; savingsRate: number } {
  const byPillar = spentByPillar(tx);
  const needs = byPillar["Fixed Needs"];
  const wants = byPillar["Variable Wants"];
  const spent = needs + wants;
  const savings = income - spent;
  const denom = income > 0 ? income : 1;

  const rows: BudgetRow[] = [
    {
      bucket: "Needs",
      amount: needs,
      actual: needs / denom,
      target: TARGETS.Needs,
      onTrack: needs / denom <= TARGETS.Needs,
    },
    {
      bucket: "Wants",
      amount: wants,
      actual: wants / denom,
      target: TARGETS.Wants,
      onTrack: wants / denom <= TARGETS.Wants,
    },
    {
      bucket: "Savings",
      amount: savings,
      actual: savings / denom,
      target: TARGETS.Savings,
      onTrack: savings / denom >= TARGETS.Savings,
    },
  ];
  return { rows, savings, savingsRate: income > 0 ? savings / income : 0 };
}

export interface MonthlyPoint {
  month: string;
  spent: number;
  income: number;
  saved: number;
}

export function monthlyTrend(
  tx: Transaction[],
  months: string[],
  detected: IncomeByMonth,
  overrides: IncomeByMonth
): MonthlyPoint[] {
  const spentMap = new Map<string, number>();
  for (const t of spendingRows(tx)) {
    spentMap.set(t.month, (spentMap.get(t.month) ?? 0) + t.amount);
  }
  return months.map((m) => {
    const inc = overrides[m] ?? detected[m] ?? 0;
    const spent = spentMap.get(m) ?? 0;
    return { month: m, spent, income: inc, saved: inc - spent };
  });
}

/** A step in the "where your income went" flow. */
export interface FlowStep {
  label: string;
  amount: number;
  color: string;
}

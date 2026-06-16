import { CATEGORIES, SPENDING_PILLARS, isSpending, type SpendingPillar } from "./taxonomy";
import type { Transaction } from "./types";

export interface BudgetRow {
  sub: string;
  pillar: SpendingPillar;
  cap: number; // monthly cap (SGD)
  spent: number; // average monthly spend across the months present in `tx`
  pct: number; // spent / cap (0 when cap is 0)
  over: boolean; // spent > cap
}

function ownerPillar(sub: string): SpendingPillar {
  return SPENDING_PILLARS.find((p) => CATEGORIES[p].includes(sub)) ?? "Variable Wants";
}

/**
 * Evaluate per-sub-category monthly budgets against the supplied (already
 * range-filtered) transactions. Spend is normalized to a per-month figure by
 * dividing by the number of distinct months present, so a monthly cap is
 * comparable whether the dashboard shows one month, a custom range, or "all".
 * Only sub-categories with a positive cap are returned; rows are sorted by the
 * most over-budget first.
 */
export function computeBudgets(
  tx: Transaction[],
  budgets: Record<string, number>
): BudgetRow[] {
  const spending = tx.filter((t) => isSpending(t.pillar));
  const monthsPresent = new Set(spending.map((t) => t.month));
  const divisor = Math.max(1, monthsPresent.size);

  const totalBySub = new Map<string, number>();
  for (const t of spending) {
    totalBySub.set(t.sub, (totalBySub.get(t.sub) ?? 0) + t.amount);
  }

  const rows: BudgetRow[] = [];
  for (const [sub, cap] of Object.entries(budgets)) {
    if (!(cap > 0)) continue;
    const spent = Math.round(((totalBySub.get(sub) ?? 0) / divisor) * 100) / 100;
    const pct = cap > 0 ? spent / cap : 0;
    rows.push({ sub, pillar: ownerPillar(sub), cap, spent, pct, over: spent > cap });
  }
  rows.sort((a, b) => b.pct - a.pct);
  return rows;
}

/** Convenience: count of budgeted categories currently over their cap. */
export function overBudgetCount(rows: BudgetRow[]): number {
  return rows.filter((r) => r.over).length;
}

import type { IncomeByMonth, Transaction } from "./types";

/** Union two transaction lists by stable id; existing rows win on collision. */
export function mergeTransactions(
  existing: Transaction[],
  incoming: Transaction[]
): Transaction[] {
  const byId = new Map<string, Transaction>();
  for (const t of existing) byId.set(t.id, t);
  for (const t of incoming) if (!byId.has(t.id)) byId.set(t.id, t);
  return Array.from(byId.values());
}

/** Sum unique income deposits per month. */
export function recomputeIncome(
  deposits: Record<string, { month: string; amount: number }>
): IncomeByMonth {
  const out: IncomeByMonth = {};
  for (const { month, amount } of Object.values(deposits)) {
    out[month] = (out[month] ?? 0) + amount;
  }
  return out;
}

/** Sorted unique union of month strings. */
export function mergeMonths(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b])).sort();
}

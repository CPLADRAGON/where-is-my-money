import type { IncomeByMonth, Transaction } from "./types";
import type { NormalizedRow } from "./parsers/types";
import { applyPurchaseFirst } from "./parsers/dedup";
import { isSpending } from "./taxonomy";

/**
 * Union two transaction lists by stable id; existing rows win on collision.
 * Also runs corpus-wide purchase-first dedup so a credit/BNPL purchase is only
 * counted once even when its bank repayment is imported later (different source,
 * different session).
 */
export function mergeTransactions(
  existing: Transaction[],
  incoming: Transaction[]
): Transaction[] {
  const all = [...existing, ...incoming];
  const rows = all.map(toRow);
  const deduped = applyPurchaseFirst(rows, []);
  const dedupedRowById = new Map<string, NormalizedRow>();
  all.forEach((t, i) => dedupedRowById.set(t.id, deduped[i]));

  const byId = new Map<string, Transaction>();
  for (const t of existing) byId.set(t.id, t);
  for (const t of incoming) if (!byId.has(t.id)) byId.set(t.id, t);

  for (const [id, t] of byId) {
    const d = dedupedRowById.get(id);
    if (!d) continue;
    if (!t.tags?.includes("bnpl") && d.direction === "TRANSFER" && isSpending(t.pillar)) {
      byId.set(id, {
        ...t,
        pillar: "Transfer",
        sub: /Savings|Investment/.test(t.sub) ? t.sub : "Personal Transfer",
        tags: d.tags,
      });
    } else if (d.tags?.length) {
      byId.set(id, { ...t, tags: d.tags });
    }
  }

  return Array.from(byId.values());
}

/** Map a Transaction to the dedup module's NormalizedRow (loses the tx id). */
function toRow(t: Transaction): NormalizedRow {
  return {
    source: t.source ?? "OCBC",
    currency: (t.currency as "SGD" | "CNY") || "SGD",
    date: t.date,
    timestamp: t.date,
    rawCategory: t.description,
    counterparty: t.counterparty ?? "",
    amount: t.nativeAmount ?? t.amount,
    direction: t.pillar && !isSpending(t.pillar) ? "TRANSFER" : "EXPENSE",
    paymentMethod: t.paymentMethod ?? "",
    tags: t.tags ?? [],
  };
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

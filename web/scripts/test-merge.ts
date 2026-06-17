import { parseDetected } from "../src/lib/banks";
import { DEMO_CSV } from "../src/lib/demo";
import { mergeTransactions, recomputeIncome, mergeMonths } from "../src/lib/merge";
import type { Transaction } from "../src/lib/types";

let pass = 0, fail = 0;
function eq(actual: unknown, expected: unknown, msg: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? "PASS" : "FAIL", "-", msg);
  if (ok) pass++;
  else fail++;
}

// --- Parser: income deposits are fingerprinted + stable across parses ---
const a = parseDetected(DEMO_CSV);
const b = parseDetected(DEMO_CSV);
eq(
  a.incomeDeposits.map((d) => d.id),
  b.incomeDeposits.map((d) => d.id),
  "income deposit ids are stable across parses"
);
eq(a.incomeDeposits.length > 0, true, "demo CSV produces at least one income deposit");
eq(
  a.transactions.map((t) => t.id),
  b.transactions.map((t) => t.id),
  "transaction ids are stable across parses"
);

// --- Merge helpers ---
function tx(id: string, month: string, sub = "Shopping"): Transaction {
  return {
    id, date: `${month}-05`, month, description: id, merchantKey: id,
    amount: 10, pillar: "Variable Wants", sub, provenance: "rule",
  };
}

// Union by id: overlap deduped, distinct kept.
const existing = [tx("a", "2026-05"), tx("b", "2026-05")];
const incoming = [tx("b", "2026-05"), tx("c", "2026-06")];
const merged = mergeTransactions(existing, incoming);
eq(merged.map((t) => t.id).sort(), ["a", "b", "c"], "transactions union by id (overlap deduped)");

// Income recompute groups by month; distinct deposit ids sum, same id doesn't double.
eq(
  recomputeIncome({ d1: { month: "2026-05", amount: 3000 }, d2: { month: "2026-06", amount: 3200 } }),
  { "2026-05": 3000, "2026-06": 3200 },
  "income recompute groups by month"
);
eq(
  recomputeIncome({ d1: { month: "2026-05", amount: 3000 }, d1b: { month: "2026-05", amount: 3000 } })["2026-05"],
  6000,
  "distinct deposit ids sum within a month"
);

// Month union sorted + unique.
eq(mergeMonths(["2026-06", "2026-05"], ["2026-05", "2026-07"]), ["2026-05", "2026-06", "2026-07"], "month union sorted unique");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

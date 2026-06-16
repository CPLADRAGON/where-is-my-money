import { computeBudgets, overBudgetCount } from "../src/lib/budgets";
import type { Transaction } from "../src/lib/types";

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    date: p.date ?? "2026-05-10",
    month: (p.date ?? "2026-05-10").slice(0, 7),
    description: p.description ?? "TEST",
    merchantKey: p.merchantKey ?? "TEST",
    amount: p.amount ?? 10,
    pillar: p.pillar ?? "Variable Wants",
    sub: p.sub ?? "Shopping",
    provenance: p.provenance ?? "rule",
  };
}

let pass = 0, fail = 0;
function eq(actual: unknown, expected: unknown, msg: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? "PASS" : "FAIL", "-", msg);
  if (ok) pass++;
  else fail++;
}

// Two months: May Dining 50 + Shopping 20; June Dining 130. Plus a transfer.
const data: Transaction[] = [
  tx({ sub: "Dining Out/Cafes", pillar: "Variable Wants", amount: 50, date: "2026-05-05" }),
  tx({ sub: "Shopping", pillar: "Variable Wants", amount: 20, date: "2026-05-08" }),
  tx({ sub: "Dining Out/Cafes", pillar: "Variable Wants", amount: 130, date: "2026-06-05" }),
  tx({ sub: "Savings / Investment", pillar: "Transfer", amount: 500, date: "2026-06-15" }),
];

const budgets = { "Dining Out/Cafes": 100, Shopping: 50, Travel: 0 };

// Across both months: Dining total 180 / 2 distinct months = 90 avg; Shopping 20/2 = 10.
const rows = computeBudgets(data, budgets);
eq(rows.length, 2, "only positive-cap subs returned (Travel cap 0 excluded)");
eq(rows[0].sub, "Dining Out/Cafes", "most over-budget first (highest pct)");
eq(rows[0].spent, 90, "Dining avg monthly spend = 90");
eq(rows[0].pct, 0.9, "Dining pct = 0.9");
eq(rows[0].over, false, "Dining not over at 90/100");
eq(rows[0].pillar, "Variable Wants", "Dining pillar derived from taxonomy");
eq(rows[1].sub, "Shopping", "Shopping second");
eq(rows[1].spent, 10, "Shopping avg monthly spend = 10");
eq(overBudgetCount(rows), 0, "nobody over budget across both months");

// Single month (June only): divisor 1, Dining 130 > cap 100 -> over.
const june = data.filter((t) => t.month === "2026-06");
const juneRows = computeBudgets(june, budgets);
eq(juneRows[0].sub, "Dining Out/Cafes", "June: Dining present");
eq(juneRows[0].spent, 130, "June Dining spend = 130 (divisor 1)");
eq(juneRows[0].over, true, "June Dining over cap 100");
eq(overBudgetCount(juneRows), 1, "one category over in June");

// Empty budgets -> no rows.
eq(computeBudgets(data, {}), [], "no budgets configured -> empty");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

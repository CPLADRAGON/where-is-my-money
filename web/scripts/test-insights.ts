import { computeInsights } from "../src/lib/insights";
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

// May: Dining 50, Shopping 20 (spent 70). June: Dining 130, Groceries 10 (spent 140).
const data: Transaction[] = [
  tx({ sub: "Dining Out/Cafes", pillar: "Variable Wants", amount: 50, date: "2026-05-05" }),
  tx({ sub: "Shopping", pillar: "Variable Wants", amount: 20, date: "2026-05-08" }),
  tx({ sub: "Dining Out/Cafes", pillar: "Variable Wants", amount: 130, date: "2026-06-05" }),
  tx({ sub: "Basic Groceries", pillar: "Fixed Needs", amount: 10, date: "2026-06-09" }),
  // a transfer that must be ignored
  tx({ sub: "Personal Transfer", pillar: "Transfer", amount: 500, date: "2026-06-15" }),
];

const ins = computeInsights(data, ["2026-05", "2026-06"]);
if (!ins) {
  console.log("FAIL - insights should not be null");
  process.exit(1);
}

eq(ins.currentMonth, "2026-06", "current month is the latest");
eq(ins.previousMonth, "2026-05", "previous month");
eq(ins.currentSpent, 140, "current spent excludes transfers");
eq(ins.previousSpent, 70, "previous spent");
eq(ins.spentDelta, 70, "spent delta = +70");
eq(ins.spentDeltaPct, 1, "spent delta pct = +100%");
eq(ins.topMovers[0].sub, "Dining Out/Cafes", "biggest mover is Dining");
eq(ins.topMovers[0].delta, 80, "Dining delta = +80");
eq(
  ins.topMovers.find((m) => m.sub === "Shopping")?.delta,
  -20,
  "Shopping dropped to 0 -> delta -20"
);
eq(ins.biggestCategory, { sub: "Dining Out/Cafes", amount: 130 }, "biggest current category");
eq(computeInsights(data, ["2026-06"]), null, "single month -> null");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

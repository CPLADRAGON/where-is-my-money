import { mergeTransactions } from "../src/lib/merge";
import type { Transaction } from "../src/lib/types";
const tx = (p: Partial<Transaction>): Transaction => ({
  id: p.id ?? "1", date: p.date ?? "2026-08-01", month: (p.date ?? "2026-08-01").slice(0, 7),
  description: "x", merchantKey: "x", amount: p.amount ?? 10, pillar: p.pillar ?? "Variable Wants",
  sub: p.sub ?? "Shopping", provenance: "rule", ...p,
});
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
const purchase = tx({ id: "P1", counterparty: "美团", amount: 105.79, tags: ["bnpl"], sub: "Dining Out/Cafes" });
const repayment = tx({ id: "R1", counterparty: "MEITUAN", amount: 105.79, pillar: "Variable Wants", sub: "Shopping" });
const merged = mergeTransactions([repayment], [purchase]);
ok(merged.find((t) => t.id === "R1")?.pillar === "Transfer", "repayment becomes Transfer on merge");
ok(merged.find((t) => t.id === "P1")?.pillar !== "Transfer", "purchase stays spending");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

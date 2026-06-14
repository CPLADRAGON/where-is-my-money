import { parseFilter, serializeFilter, applyFilter, type TxFilter } from "../src/lib/filters";
import type { Transaction } from "../src/lib/types";

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    date: p.date ?? "2026-03-10",
    month: (p.date ?? "2026-03-10").slice(0, 7),
    description: p.description ?? "TEST",
    merchantKey: p.merchantKey ?? "TEST",
    amount: p.amount ?? 10,
    pillar: p.pillar ?? "Variable Wants",
    sub: p.sub ?? "Shopping",
    provenance: p.provenance ?? "rule",
  };
}

const data: Transaction[] = [
  tx({ id: "a", pillar: "Fixed Needs", sub: "Transport", amount: 2, date: "2026-03-01" }),
  tx({ id: "b", pillar: "Variable Wants", sub: "Shopping", amount: 50, date: "2026-03-15", provenance: "default" }),
  tx({ id: "c", pillar: "Transfer", sub: "Personal Transfer", amount: 100, date: "2026-04-02", description: "TO JOHN" }),
  tx({ id: "d", pillar: "Variable Wants", sub: "Dining Out/Cafes", amount: 20, date: "2026-04-20" }),
];

let pass = 0, fail = 0;
function eq(actual: unknown, expected: unknown, msg: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? "PASS" : "FAIL", "-", msg);
  if (ok) pass++;
  else fail++;
}
const ids = (rows: Transaction[]) => rows.map((r) => r.id);

eq(ids(applyFilter(data, { sort: "date_desc" })), ["d", "c", "b", "a"], "default sort date_desc");
eq(ids(applyFilter(data, { sort: "amount_desc" })), ["c", "b", "d", "a"], "sort amount_desc");
eq(ids(applyFilter(data, { pillar: "Variable Wants", sort: "date_desc" })), ["d", "b"], "filter pillar");
eq(ids(applyFilter(data, { sub: "Transport", sort: "date_desc" })), ["a"], "filter sub");
eq(ids(applyFilter(data, { month: "2026-04", sort: "date_desc" })), ["d", "c"], "filter month");
eq(ids(applyFilter(data, { type: "transfer", sort: "date_desc" })), ["c"], "filter type transfer");
eq(ids(applyFilter(data, { type: "spending", sort: "date_desc" })), ["d", "b", "a"], "filter type spending");
eq(ids(applyFilter(data, { review: true, sort: "date_desc" })), ["b"], "filter review preset");
eq(ids(applyFilter(data, { q: "john", sort: "date_desc" })), ["c"], "search by description");

eq(
  serializeFilter({ pillar: "Variable Wants", month: "2026-03", sort: "date_desc" }),
  "pillar=Variable+Wants&month=2026-03",
  "serialize omits default sort"
);
const parsed = parseFilter(new URLSearchParams("pillar=Transfer&type=transfer&review=1&sort=amount_asc"));
eq(parsed, { sort: "amount_asc", pillar: "Transfer", type: "transfer", review: true } as TxFilter, "parse params");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

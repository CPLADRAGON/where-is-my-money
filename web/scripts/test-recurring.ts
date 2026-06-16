import { detectRecurring, monthlyCommitment } from "../src/lib/recurring";
import type { Transaction } from "../src/lib/types";

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    date: p.date ?? "2026-04-01",
    month: (p.date ?? "2026-04-01").slice(0, 7),
    description: p.description ?? p.merchantKey ?? "TEST",
    merchantKey: p.merchantKey ?? "TEST",
    amount: p.amount ?? 10,
    pillar: p.pillar ?? "Variable Wants",
    sub: p.sub ?? "Shopping",
    provenance: p.provenance ?? "rule",
  };
}

const data: Transaction[] = [
  // Spotify: stable, monthly, 3 months -> subscription
  tx({ merchantKey: "SPOTIFY AB", sub: "Subscriptions", amount: 10.98, date: "2026-04-05" }),
  tx({ merchantKey: "SPOTIFY AB", sub: "Subscriptions", amount: 10.98, date: "2026-05-05" }),
  tx({ merchantKey: "SPOTIFY AB", sub: "Subscriptions", amount: 10.98, date: "2026-06-05" }),
  // Foodpanda: varies, monthly, 3 months -> frequent
  tx({ merchantKey: "FOODPANDA SG", sub: "Dining Out/Cafes", amount: 22.4, date: "2026-04-10" }),
  tx({ merchantKey: "FOODPANDA SG", sub: "Dining Out/Cafes", amount: 18.9, date: "2026-05-10" }),
  tx({ merchantKey: "FOODPANDA SG", sub: "Dining Out/Cafes", amount: 25.3, date: "2026-06-10" }),
  // Uniqlo: only 2 months -> excluded
  tx({ merchantKey: "UNIQLO", sub: "Shopping", amount: 59.9, date: "2026-05-08" }),
  tx({ merchantKey: "UNIQLO", sub: "Shopping", amount: 39.9, date: "2026-06-08" }),
  // Kopi: stable amount but high frequency (~fortnightly, 2/month) -> frequent
  tx({ merchantKey: "KOPI", sub: "Dining Out/Cafes", amount: 5, date: "2026-04-03" }),
  tx({ merchantKey: "KOPI", sub: "Dining Out/Cafes", amount: 5, date: "2026-04-17" }),
  tx({ merchantKey: "KOPI", sub: "Dining Out/Cafes", amount: 5, date: "2026-05-01" }),
  tx({ merchantKey: "KOPI", sub: "Dining Out/Cafes", amount: 5, date: "2026-05-15" }),
  tx({ merchantKey: "KOPI", sub: "Dining Out/Cafes", amount: 5, date: "2026-06-01" }),
  tx({ merchantKey: "KOPI", sub: "Dining Out/Cafes", amount: 5, date: "2026-06-15" }),
  // Transfers excluded from recurring entirely
  tx({ merchantKey: "JOHN TAN", pillar: "Transfer", sub: "Personal Transfer", amount: 25, date: "2026-04-20" }),
  tx({ merchantKey: "JOHN TAN", pillar: "Transfer", sub: "Personal Transfer", amount: 25, date: "2026-05-20" }),
  tx({ merchantKey: "JOHN TAN", pillar: "Transfer", sub: "Personal Transfer", amount: 25, date: "2026-06-20" }),
];

let pass = 0, fail = 0;
function eq(actual: unknown, expected: unknown, msg: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? "PASS" : "FAIL", "-", msg);
  if (ok) pass++;
  else fail++;
}

const g = detectRecurring(data);
const subKeys = g.subscriptions.map((s) => s.key);
const freqKeys = g.frequent.map((s) => s.key);

eq(subKeys, ["SPOTIFY AB"], "spotify is the only subscription");
eq(freqKeys.includes("FOODPANDA SG"), true, "foodpanda (varies) is frequent");
eq(freqKeys.includes("KOPI"), true, "high-frequency kopi is frequent not subscription");
eq(subKeys.includes("UNIQLO") || freqKeys.includes("UNIQLO"), false, "2-month merchant excluded");
eq(subKeys.includes("JOHN TAN") || freqKeys.includes("JOHN TAN"), false, "transfers excluded");
eq(g.subscriptions[0].cadence, "Monthly", "spotify cadence is Monthly");
eq(g.subscriptions[0].name, "Spotify Ab", "name is prettified");
eq(g.subscriptions[0].nextExpected, "2026-07-06", "spotify next expected = last + median gap");
eq(Math.round(monthlyCommitment(g) * 100) / 100, 10.98, "monthly commitment = sum of subscription avgs");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

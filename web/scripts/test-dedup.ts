import { applyPurchaseFirst } from "../src/lib/parsers/dedup";
import type { NormalizedRow } from "../src/lib/parsers/types";
const r = (p: Partial<NormalizedRow>): NormalizedRow => ({
  source: "WECHAT", currency: "CNY", date: "2026-08-24", timestamp: "2026-08-24 12:00:00",
  rawCategory: "", counterparty: "X", amount: 10, direction: "EXPENSE",
  paymentMethod: "零钱", tags: [], ...p,
});
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
// purchase on 美团月付 (bnpl) + later bank repayment to 美团
const purchase = r({ source: "ALIPAY", counterparty: "美团", amount: 105.79, date: "2026-08-01", tags: ["bnpl"], paymentMethod: "花呗", sourceId: "P1" });
const repayment = r({ source: "OCBC", counterparty: "MEITUAN", amount: 105.79, date: "2026-08-20", direction: "EXPENSE", paymentMethod: "OCBC Debit" });
const out = applyPurchaseFirst([purchase, repayment], []);
ok(out.find((x) => x.counterparty === "MEITUAN")?.direction === "TRANSFER", "repayment -> TRANSFER when purchase present");
ok(out.find((x) => x.sourceId === "P1")?.direction === "EXPENSE", "purchase stays EXPENSE");
const orphan = r({ source: "OCBC", counterparty: "MEITUAN", amount: 88, date: "2026-08-21", direction: "EXPENSE", paymentMethod: "OCBC Debit" });
const out2 = applyPurchaseFirst([orphan], []);
ok(out2[0].direction === "EXPENSE" && out2[0].tags.includes("needs_review"), "orphan repayment stays spend + needs_review");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

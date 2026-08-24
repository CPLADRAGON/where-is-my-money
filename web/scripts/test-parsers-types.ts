import type { NormalizedRow, SourceFileResult } from "../src/lib/parsers/types";
const row: NormalizedRow = {
  source: "ALIPAY", currency: "CNY", date: "2026-08-24", timestamp: "2026-08-24 21:55:05",
  rawCategory: "美团", counterparty: "深圳市小规模企业", amount: 105.79,
  direction: "EXPENSE", paymentMethod: "花呗", tags: [],
};
const r: SourceFileResult = { source: row.source, bankId: "alipay", bankLabel: "Alipay", encoding: "gb18030", rows: [row] };
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
ok(row.paymentMethod === "花呗", "paymentMethod preserved");
ok(r.rows.length === 1 && r.source === "ALIPAY", "SourceFileResult holds rows");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

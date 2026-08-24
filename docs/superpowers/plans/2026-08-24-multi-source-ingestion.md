# Multi-Source Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the web app accept multiple bank/payment files in one import, auto-detect source + encoding per file, normalize all sources into one schema, convert CNY↔SGD for a user-chosen view currency, and stop double-counting BNPL/credit purchases against their bank repayments.

**Architecture:** A new `web/src/lib/parsers/` pipeline (Approach B) reads raw bytes, classifies source, decodes, parses into rich `NormalizedRow[]`, extends categorization with Chinese keywords, converts currency at render against a view-currency setting, and de-duplicates purchase-vs-repayment across sources. It bridges down to the existing app `Transaction`/`ParseResult` so selectors/dashboard/UI stay compatible. The existing `lib/banks/` is retired after migration.

**Tech Stack:** Next.js 16 / TypeScript / Tailwind v4; PapaParse, SheetJS (`xlsx`) for `.xlsx`; Zustand + IndexedDB; `TextDecoder` for GB18030; standalone `tsx` test scripts (there is no jest/test runner).

**Spec:** `docs/superpowers/specs/2026-08-24-multi-source-ingestion-design.md` — the plan argues from it; executors read both.

## Global Constraints

- Data stays **100% client-side** — no backend/API routes; bank CSVs, `.xlsx`, generated workbooks, and `sample data/` are gitignored. **Never commit real financial data**; only sanitized fixtures (merchant names + order-ids redacted) may be committed.
- `pillar` (Fixed Needs / Variable Wants) + `sub` stay the source of truth for budgets/savings-rate/50-30-20. `normalizedCategory` is a **derived display label**, never a second category system.
- New `Transaction` fields are **optional** (`source?`, `currency?`, `nativeAmount?`, `counterparty?`, `paymentMethod?`, `tags?`, `isDuplicate?`) so existing consumers and test fixtures keep compiling; only the new pipeline populates them.
- Tests use the repo convention: standalone `npx tsx scripts/test-*.ts`, `PASS`/`FAIL` lines, `process.exit(1)` on any fail.
- First-slice sources: **OCBC CSV, WeChat (.xlsx/.csv), Alipay (.csv GB18030), Meituan (.csv)**. **Douyin and OCBC PDF are deferred.**
- **Income is converted to the view currency (default SGD) at import** using the then-current rate and stored in `detectedIncome` as a plain number. Spending/transfers are fully re-based at render. (Income re-basing per-view is a documented follow-up.)
- Amounts: transactions store **native** `amount` + `currency`; conversion is linear (single rate applied to a value).

---

### Task 1: Parser types

**Files:**
- Create: `web/src/lib/parsers/types.ts`
- Test: `web/scripts/test-parsers-types.ts` (exists to lock the shape; kept tiny)

**Interfaces:**
- Consumes: nothing.
- Produces: `Source`, `Direction`, `NormalizedRow`, `SourceFileResult`, `DecodedFile`.

```ts
// web/src/lib/parsers/types.ts
export type Source = "OCBC" | "WECHAT" | "ALIPAY" | "MEITUAN";
export type Direction = "EXPENSE" | "INCOME" | "TRANSFER";

export interface NormalizedRow {
  source: Source;
  currency: "SGD" | "CNY";
  date: string;          // ISO YYYY-MM-DD (drives the app's month bucket)
  timestamp: string;     // full ISO; === date for OCBC
  rawCategory: string;   // raw product/description text
  counterparty: string;  // payee / merchant name
  amount: number;        // positive, native currency
  direction: Direction;
  paymentMethod: string;
  tags: string[];        // e.g. ['bnpl','repayment']
  sourceId?: string;     // order/merchant id, for cross-source dedup
}

export interface SourceFileResult {
  source: Source;
  bankId: string;    // 'ocbc' | 'wechat' | 'alipay' | 'meituan'
  bankLabel: string; // human name
  encoding: string;  // 'utf-8' | 'gb18030' | 'xlsx' | 'utf-16'
  rows: NormalizedRow[];
}

export interface DecodedFile {
  text: string;
  encoding: string;
}
```

- [ ] **Step 1: Add the type-only test**

```ts
// web/scripts/test-parsers-types.ts
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
```

- [ ] **Step 2: Run — expect FAIL (module missing)**

Run: `cd web && npx tsx scripts/test-parsers-types.ts`
Expected: error resolving `../src/lib/parsers/types`.

- [ ] **Step 3: Create `types.ts`** with the exact code above.

- [ ] **Step 4: Run — expect PASS**

Run: `cd web && npx tsx scripts/test-parsers-types.ts`
Expected: `PASS` twice, `0 failed`.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/parsers/types.ts web/scripts/test-parsers-types.ts
git commit -m "feat(parsers): unified NormalizedRow + SourceFileResult types"
```

---

### Task 2: Text decoding (encoding sniffer)

**Files:**
- Create: `web/src/lib/parsers/encoding.ts`
- Test: `web/scripts/test-encoding.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `decodeBytes(bytes: ArrayBuffer): DecodedFile`; `sniffEncoding(bytes: Uint8Array): "utf-8" | "gb18030" | "utf-16"`.

Decode precedence: UTF-8 BOM → `utf-8`; UTF-16 BOM (`FF FE`/`FE FF`) → `utf-16`; else try `TextDecoder("utf-8", { fatal: true })` → if it throws, use `gb18030`. Strip a leading UTF-8 BOM from the result.

- [ ] **Step 1: Failing test**

```ts
// web/scripts/test-encoding.ts
import { decodeBytes, sniffEncoding } from "../src/lib/parsers/encoding";
const enc = new TextEncoder();
const bom = new Uint8Array([0xef,0xbb,0xbf, ...enc.encode("美团")]);
const gbk = new Uint8Array([0xc3,0xc0,0xd0,0xb2]); // "美团" in GBK
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
ok(sniffEncoding(bom) === "utf-8", "UTF-8 BOM detected");
ok(sniffEncoding(new Uint8Array([0xff,0xfe])) === "utf-16", "UTF-16 BOM detected");
ok(sniffEncoding(gbk) === "gb18030", "invalid-UTF-8 falls back to gb18030");
const d = decodeBytes(bom.buffer);
ok(d.encoding === "utf-8", "decode returns utf-8");
ok(d.text.includes("美团"), "BOM stripped, text decoded");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 2: Run — expect FAIL.** `cd web && npx tsx scripts/test-encoding.ts` → module missing.

- [ ] **Step 3: Implement**

```ts
// web/src/lib/parsers/encoding.ts
export function sniffEncoding(bytes: Uint8Array): "utf-8" | "gb18030" | "utf-16" {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "utf-8";
  if (bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))) return "utf-16";
  try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); return "utf-8"; }
  catch { return "gb18030"; }
}

export function decodeBytes(bytes: ArrayBuffer): { text: string; encoding: string } {
  const u8 = new Uint8Array(bytes);
  const encoding = sniffEncoding(u8);
  const text = new TextDecoder(
    encoding === "gb18030" ? "gb18030" : "utf-8"
  ).decode(u8);
  return { text: text.replace(/^﻿/, ""), encoding };
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git add web/src/lib/parsers/encoding.ts web/scripts/test-encoding.ts && git commit -m "feat(parsers): UTF-8/GB18030/UTF-16 decode + BOM sniff"`

---

### Task 3: Alipay parser

**Files:**
- Create: `web/src/lib/parsers/alipay.ts`
- Test: `web/scripts/test-alipay.ts`

**Interfaces:**
- Consumes: `NormalizedRow` from Task 1; `parseAmount` from `web/src/lib/banks/helpers.ts` (already exists).
- Produces: `parseAlipay(text: string): NormalizedRow[]`.

Decodes to a **string** first (caller runs `decodeBytes`). Preamble includes account metadata + summaries, then a `------` line, then header `交易时间,交易对方,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注`. Map: `收/支` `支出`→EXPENSE, `收入`→INCOME, `不计收支`→TRANSFER (tag `savings-or-transfer`); `amount` = `金额`; `paymentMethod` = `收/付款方式`; `rawCategory` = `商品说明`; `counterparty` = `交易对方`; `sourceId` = `交易订单号`; `date`/`timestamp` = `交易时间` (slice `date` to `YYYY-MM-DD`). Add `bnpl` tag when `收/付款方式` contains 花呗.

- [ ] **Step 1: Failing test**

```ts
// web/scripts/test-alipay.ts
import { parseAlipay } from "../src/lib/parsers/alipay";
const csv = `---------------------
支付宝交易记录明细查询
支付宝账户：65-xxx
共107笔记录
支出：43笔 5339.84元
------------------------支付宝...------------------------
交易时间,交易对方,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注
2026-08-24 21:55:05,深圳市小规模科技有限公司,szz***@bytedance.com,美团外卖订单,支出,105.79,花呗,交易成功,2026082423001403041435513033,, 
2026-08-24 06:07:22,余额宝,,余额宝-收益,不计收支,0.25,余额宝,交易成功,20260824363327858041,,`;
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
const rows = parseAlipay(csv);
ok(rows.length === 2, "two data rows parsed");
ok(rows[0].source === "ALIPAY" && rows[0].currency === "CNY", "source+currency");
ok(rows[0].direction === "EXPENSE" && rows[0].amount === 105.79, "expense amount");
ok(rows[0].paymentMethod === "花呗" && rows[0].tags.includes("bnpl"), "花呗 -> bnpl tag");
ok(rows[0].rawCategory.includes("美团外卖"), "rawCategory = 商品说明");
ok(rows[0].counterparty.includes("深圳"), "counterparty = 交易对方");
ok(rows[0].date === "2026-08-24", "date ISO");
ok(rows[1].direction === "TRANSFER", "不计收支 -> TRANSFER");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement `parseAlipay`.** Use `splitLines`, find the header row index where a line starts with `交易时间`, then `Papa.parse` the sliced remainder with `header:true`. Iterate rows, skip empty, build `NormalizedRow`. Reuse `parseAmount` (strips `¥`, commas, handles negatives). Derive `date = t.timestamp.slice(0,10)`.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat(parsers): Alipay (GB18030) parser -> NormalizedRow[]`

---

### Task 4: WeChat parser (`.xlsx` and `.csv`)

**Files:**
- Create: `web/src/lib/parsers/wechat.ts`
- Test: `web/scripts/test-wechat.ts`

**Interfaces:**
- Consumes: `NormalizedRow`; `parseAmount`; `decodeBytes`; SheetJS (`import * as XLSX from "xlsx"`). `sniffEncoding` not needed for xlsx.
- Produces: `parseWechatText(text: string): NormalizedRow[]` and `parseWechatXlsx(bytes: ArrayBuffer): NormalizedRow[]`.

The `.csv` variant has preamble, then a `交易时间,交易类型,...` header. The `.xlsx` has preamble rows + `----------------------微信支付` on one row, and the header on the **next** row: `交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注`. Data rows: map `收/支` `支出`→EXPENSE, `收入`→INCOME; `金额(元)`→amount; `商品`→rawCategory; `交易对方`→counterparty; `支付方式`→paymentMethod; `交易单号`→sourceId; `date` from 交易时间. Add tag `transfer` when 交易类型 is a neutral/存取 type (充值/提现/零钱通转入转出/理财通) → direction `TRANSFER`. Add `bnpl` when paymentMethod is 花呗/分付/信用支付.

- [ ] **Step 1: Failing test**

```ts
// web/scripts/test-wechat.ts
import { parseWechatText, parseWechatXlsx } from "../src/lib/parsers/wechat";
import * as XLSX from "xlsx";
const csv = `微信支付账单明细
微信昵称：[CPLADRAGON]
----------------------微信支付
交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注
2026-08-15 18:23:34,商户消费,OCTOBOX,Powered by NETS,支出,8.40,零钱,支付成功,42000032392026081501886424,N0260815182326520617,/
2026-08-13 16:58:02,转账,钇龙,转账备注:祝儿子旅途愉快,收入,1666,,已存入零钱,10000500012026081301283295,,`;
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
const rows = parseWechatText(csv);
ok(rows.length === 2, "two rows");
ok(rows[0].source === "WECHAT" && rows[0].currency === "CNY", "source+currency");
ok(rows[0].direction === "EXPENSE" && rows[0].amount === 8.4, "expense");
ok(rows[0].counterparty === "OCTOBOX", "counterparty");
ok(rows[0].paymentMethod === "零钱", "paymentMethod");
ok(rows[0].date === "2026-08-15", "date");
// .xlsx path: build a workbook buffer in-test
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
  ["微信支付账单明细"],["微信昵称：[X]"],
  ["----------------------微信支付", ""],
  ["交易时间","交易类型","交易对方","商品","收/支","金额(元)","支付方式","当前状态","交易单号","商户单号","备注"],
  ["2026-08-16 21:10:28","微信红包","Des Rosiers","/","收入","1.01","/","已存入零钱","10000398010136081670313317","10000398012026081670313317","/"],
]);
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
const xrows = parseWechatXlsx(buf);
ok(xrows.length === 1 && xrows[0].direction === "INCOME" && xrows[0].amount === 1.01, "xlsx parsed as income");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.** For text: find header row index (starts with `交易时间`), `Papa.parse` remainder. For xlsx: `XLSX.read(bytes, { type: "array" })`, take first sheet, `XLSX.utils.sheet_to_json(sheet, { header: 1 })` into an array of arrays, find the row whose cell `[0] === "交易时间"`, map from there. Share a `mapWechatRow(cells)` helper for both.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat(parsers): WeChat Pay parser (xlsx + csv)`

---

### Task 5: Meituan parser

**Files:**
- Create: `web/src/lib/parsers/meituan.ts`
- Test: `web/scripts/test-meituan.ts`

**Interfaces:**
- Consumes: `NormalizedRow`; `parseAmount`.
- Produces: `parseMeituan(text: string): NormalizedRow[]`.

Header row 19 (`【美团交易账单明细列表】` on row 18). Columns: `交易创建时间,交易成功时间,交易类型,订单标题,收/支,支付方式,订单金额,实付金额,交易单号,商家单号,备注`. `amount` = **`实付金额`** (strip `¥`). `rawCategory` = `订单标题`; `counterparty` = the segment before the first `-` in 订单标题, else the full title; `paymentMethod` = `支付方式`; `sourceId` = `交易单号`; `date` from 交易成功时间 (fallback 交易创建时间). Add `bnpl` tag when `支付方式` contains `月付`; `TRANSFER` when 收/支 is 不计收支/中性.

- [ ] **Step 1: Failing test**

```ts
// web/scripts/test-meituan.ts
import { parseMeituan } from "../src/lib/parsers/meituan";
const csv = `美团交易账单明细
共：16笔记录
【美团交易账单明细列表】
交易创建时间,交易成功时间,交易类型,订单标题,收/支,支付方式,订单金额,实付金额,交易单号,商家单号,备注
2026-08-13 17:17:10,2026-08-13 17:17:25,支付,袁记云饺-袁记云饺代金券,支出,美团月付,¥73.60,¥73.37,260813112007016700,1M7U2WY0NMA04386,/
2026-08-12 19:34:12,2026-08-12 19:34:20,支付,PHO THE ONE福万越南餐厅,支出,微信支付,¥72.00,¥71.95,260812112007016700,1M7RNHLNTA704386,/`;
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
const rows = parseMeituan(csv);
ok(rows.length === 2, "two rows");
ok(rows[0].source === "MEITUAN" && rows[0].currency === "CNY", "source+currency");
ok(rows[0].amount === 73.37, "amount = 实付金额 (not 订单金额)");
ok(rows[0].paymentMethod === "美团月付" && rows[0].tags.includes("bnpl"), "美团月付 -> bnpl");
ok(rows[0].counterparty === "袁记云饺", "counterparty from 订单标题 before dash");
ok(rows[1].counterparty === "PHO THE ONE福万越南餐厅", "no dash -> full title");
ok(rows[0].date === "2026-08-13", "date from 交易成功时间");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.** Find header row (starts with `交易创建时间`), `Papa.parse` remainder, map columns.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat(parsers): Meituan (含美团月付) parser`

---

### Task 6: OCBC parser (migrate from banks/)

**Files:**
- Create: `web/src/lib/parsers/ocbc.ts`
- Defer-remove: `web/src/lib/banks/ocbc.ts` (kept until Task 12 wiring; delete there)
- Test: `web/scripts/test-ocbc.ts`

**Interfaces:**
- Consumes: `NormalizedRow`; `parseAmount`, `normalizeText`, `parseDate`, `splitLines` from `web/src/lib/banks/helpers.ts`; `detectTransfer` logic is re-exposed from `web/src/lib/categorize.ts` (Task 9 extends it).
- Produces: `parseOcbc(text: string): NormalizedRow[]`.

Same parsing as the existing `ocbcAdapter`, but emit `NormalizedRow` with `source: "OCBC"`, `currency: "SGD"`, `paymentMethod: "OCBC Debit"`, `counterparty` = `merchantKeyFrom(description)`, `direction`: `DEPOSIT` → INCOME (tag via income keyword), `Withdrawal` → EXPENSE unless `detectTransfer`/`INVESTMENT_RE` matches → TRANSFER. `date` from `Transaction date` (DD/MM/YYYY), `timestamp` = date.

- [ ] **Step 1: Failing test**

```ts
// web/scripts/test-ocbc.ts
import { parseOcbc } from "../src/lib/parsers/ocbc";
const csv = `Account details for: TEST
Transaction History
Transaction date,Value date,Description,Withdrawals(SGD),Deposits(SGD)
12/08/2026,12/08/2026,DEBIT PURCHASE  xx-1767 BK BURGER 313446,8.40,
12/08/2026,13/08/2026,GIRO - SALARY INFINEON,,3200.00
15/08/2026,15/08/2026,FAST PAYMENT to JACK SMITH,50.00,`;
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
const rows = parseOcbc(csv);
ok(rows[0].source === "OCBC" && rows[0].currency === "SGD", "source+currency");
ok(rows[0].direction === "EXPENSE" && rows[0].amount === 8.4, "withdrawal -> expense");
ok(rows[0].paymentMethod === "OCBC Debit", "paymentMethod");
ok(rows[0].date === "2026-08-12", "DD/MM/YYYY -> ISO");
ok(rows[1].direction === "INCOME" && rows[1].amount === 3200, "deposit -> income");
ok(rows[2].direction === "TRANSFER", "FAST PAYMENT to person -> transfer");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.** Port the existing `ocbcAdapter.parse` and map to `NormalizedRow`. For direction: if `Deposits>0` and income keyword → INCOME; else if `Withdrawals>0` and `detectTransfer(description)` → TRANSFER; else if `Withdrawals>0` → EXPENSE.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat(parsers): OCBC CSV parser (migrated from banks/)`

---

### Task 7: Classifier (StatementClassifier)

**Files:**
- Create: `web/src/lib/parsers/classifier.ts`
- Test: `web/scripts/test-classifier.ts`

**Interfaces:**
- Consumes: `sniffEncoding`, `decodeBytes` (Task 2); `Source`, `SourceFileResult` partial data (Task 1).
- Produces: `classifyFile(bytes: ArrayBuffer, name: string): { kind: "classified"; source: Source; bankId: string; bankLabel: string; encoding: string } | { kind: "unknown" }`.

`classifyFile`: use the file **name extension** as a hint, then confirm with header text:
- `.xlsx` → look at decoded sheet header for `交易时间,交易类型` or `微信支付账单明细` → WECHAT; else unknown.
- `.csv` → decode (UTF-8/GB18030), inspect first lines: `Transaction date...Withdrawals(SGD)` → OCBC; `支付宝交易记录明细`/`交易时间,交易对方,对方账号` → ALIPAY; `美团交易账单明细` → MEITUAN; `微信支付账单明细`/`交易时间,交易类型` → WECHAT.
- No signature → `unknown`.

- [ ] **Step 1: Failing test**

```ts
// web/scripts/test-classifier.ts
import { classifyFile } from "../src/lib/parsers/classifier";
const enc = new TextEncoder();
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
const alipay = new TextEncoder().encode("支付宝交易记录明细查询\n交易时间,交易对方,对方账号,商品说明,收/支,金额\n");
const ocbc = enc.encode("Transaction History\nTransaction date,Value date,Description,Withdrawals(SGD),Deposits(SGD)\n");
const wechat = enc.encode("微信支付账单明细\n交易时间,交易类型,交易对方\n");
const meituan = enc.encode("美团交易账单明细列表\n交易创建时间,交易成功时间\n");
ok(classifyFile(alipay.buffer, "alipay.csv").source === "ALIPAY", "alipay detected");
ok(classifyFile(ocbc.buffer, "ocbc.csv").source === "OCBC", "ocbc detected");
ok(classifyFile(wechat.buffer, "wechat.csv").source === "WECHAT", "wechat detected");
ok(classifyFile(meituan.buffer, "meituan.csv").source === "MEITUAN", "meituan detected");
ok(classifyFile(new Uint8Array([0x00]).buffer, "junk.bin").kind === "unknown", "unknown -> j.bin");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement `classifyFile`.** For `.xlsx`, decode a short prefix is insufficient — read the workbook via `XLSX` to check the header; for other sources decode text and `splitLines`, then match signatures in priority order (OCBC before WeChat before Alipay before Meituan). Return `{ kind: "classified", ... }` or `{ kind: "unknown" }`.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat(parsers): StatementClassifier (per-file source+encoding detection)`

---

### Task 8: Categorization for Chinese sources

**Files:**
- Modify: `web/src/lib/categorize.ts` (add Chinese keyword rules + CJK-safe merchant key)
- Test: `web/scripts/test-categorize-cn.ts`

**Interfaces:**
- Consumes: existing `categorize`, `merchantKeyFrom`.
- Produces: extended `RULES` (Chinese keywords → canonical pillar/sub), CJK-preserving `merchantKeyFrom`.

- [ ] **Step 1: Failing test**

```ts
// web/scripts/test-categorize-cn.ts
import { categorize, merchantKeyFrom } from "../src/lib/categorize";
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
const r1 = categorize("美团外卖订单", "美团", {});
ok(r1.sub === "Dining Out/Cafes", "美团 -> Dining Out/Cafes");
const r2 = categorize("滴滴出行", "滴滴", {});
ok(r2.sub === "Transport", "滴滴 -> Transport");
const r3 = categorize("拼多多订单", "拼多多", {});
ok(r3.sub === "Shopping", "拼多多 -> Shopping");
const r4 = categorize("饿了么订单", "饿了么", {});
ok(r4.sub === "Dining Out/Cafes", "饿了么 -> Dining Out/Cafes");
ok(merchantKeyFrom("美团外卖订单") === "美团外卖", "CJK merchant key preserved");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.** Add rules to `RULES` (before the `default`): 美团|饿了么|星巴克|喜茶|瑞幸|麦当劳|肯德基|茶百道|蜜雪 → Dining Out/Cafes; 滴滴|高德|地铁|公交|铁路|12306|哈啰 → Transport; 拼多多|淘宝|京东|唯品会|得物|优衣库|无印良品 → Shopping; 优酷|腾讯视频|爱奇艺|网易云|QQ音乐|哔哩哔哩 → Subscriptions; 携程|去哪儿|飞猪|同程|12306 → Travel. Then alter `merchantKeyFrom`: replace the char class `/[^A-Z0-9 ]+/g` with `/[^A-Z0-9一-鿿 ]+/g` so CJK survives (drop the `toUpperCase`-dependent `[A-Z]` matches? keep `toUpperCase` — it's a no-op for CJK). Ensure the `TO|FROM` extraction doesn't strip CJK (regex `[A-Z][A-Z .'&-]{2,40}` only matches Latin; that's fine).

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat(categorize): Chinese keyword rules + CJK-safe merchant key`

---

### Task 9: Build/bridge pipeline

**Files:**
- Create: `web/src/lib/parsers/index.ts`
- Test: `web/scripts/test-pipeline.ts`

**Interfaces:**
- Consumes: Tasks 1–8 (`classifyFile`, per-source `parse*`, `NormalizedRow`, `categorize`, `merchantKeyFrom`, `recomputeIncome`/`mergeMonths` from `web/src/lib/merge.ts`, `IShared` helpers), `INCOME_KEYWORDS`-like detection.
- Produces: `parseBatch(files: { bytes: ArrayBuffer; name: string }[]): BatchResult` and `bridgeToApp(files: SourceFileResult[]): { transactions: Transaction[]; incomeByMonth: IncomeByMonth; incomeDeposits: IncomeDeposit[]; months: string[]; bankLabel: string; stats: {...} }`.

`parseBatch` returns per-file `SourceFileResult[]` for the UI, plus per-file errors. `bridgeToApp` reuses the existing `buildParseResult`-equivalent logic: for each `NormalizedRow`, run `categorize` (Task 8) → `pillar`/`sub`; income rows (INCOME + income keyword) → `incomeDeposits`/`incomeByMonth`; `TRANSFER` rows → pillar `Transfer` sub from `detectTransfer` handled in `categorize`; produce app `Transaction[]` with the optional fields populated (`source`, `currency`, `nativeAmount`, `counterparty`, `paymentMethod`, `tags`, `isDuplicate`). Income is converted to SGD at this point (see Global Constraints).

- [ ] **Step 1: Failing test**

```ts
// web/scripts/test-pipeline.ts
import { parseAlipay } from "../src/lib/parsers/alipay";
import { bridgeToApp } from "../src/lib/parsers";
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };

const csv = `支付宝交易记录明细查询
共2笔记录
----------------支付宝----------------
交易时间,交易对方,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注
2026-08-24 21:55:05,深圳市小规模科技有限公司,szz@x,美团外卖订单,支出,105.79,花呗,交易成功,123,,
2026-08-24 06:07:22,余额宝,,余额宝-收益,不计收支,0.25,余额宝,交易成功,456,,`;

const rows = parseAlipay(csv);
const sf = { source: "ALIPAY" as const, bankId: "alipay", bankLabel: "Alipay", encoding: "gb18030", rows };
const out = bridgeToApp([sf]);

ok(out.transactions.length === 1, "only the expense bridges to a transaction (transfer/income handled separately)");
const t = out.transactions[0];
ok(t.sub === "Dining Out/Cafes", "美团外卖 -> Dining Out/Cafes via extended rules");
ok(t.currency === "CNY" && t.nativeAmount === 105.79, "native currency + amount preserved");
ok(t.source === "ALIPAY" && t.paymentMethod === "花呗", "source + paymentMethod carried onto Transaction");
ok(t.tags?.includes("bnpl"), "花呗 -> bnpl tag on Transaction");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

> Invariant asserted by the test: `TRANSFER` rows (`不计收支`) do **not** become spending transactions — they are handled by the transfer/income path out of the bridge, so the app's spending count is correct.

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement `parseBatch` + `bridgeToApp`.** `bridgeToApp` loops normalized rows; for each: if `direction === "INCOME"` → income path; else you can ignore income deposits and build a `Transaction` (categorize sets pillar/sub for spending; TRANSFER rows get pillar `Transfer` via `detectTransfer`). Populate optional fields. Deduplicate income with the existing deposit fingerprint approach. Aggregate `months`, `bankLabel` (single or "Multiple sources").
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat(parsers): build + bridge pipeline (NormalizedRow[] -> app ParseResult)`

---

### Task 10: Currency (FX fetch/cache + view-currency)

**Files:**
- Create: `web/src/lib/currency.ts`
- Test: `web/scripts/test-currency.ts`

**Interfaces:**
- Consumes: none (Zustand for the rates store).
- Produces: `Rates = Record<string, number>` (currency → SGD per 1 unit), `useRatesStore`, `getRate(rates, currency)`, `convert(value, from, to, rates): number`, `useViewCurrency()`, `setViewCurrency`, `fetchRates()`, `displayCurrency`, plus helper `toDisplay(t: { amount: number; currency?: string }, rates, display): number`.

Default display currency = `SGD`. `fetchRates` is a client-side fetch to a public endpoint (e.g. a free FX API) returning `{ CNY: 0.186, USD: 1.34, ... }`; on failure, keep the last cached value. For tests, `fetchRates` is mocked/injected, so test only `convert` and `toDisplay`.

- [ ] **Step 1: Failing test**

```ts
// web/scripts/test-currency.ts
import { convert, toDisplay } from "../src/lib/currency";
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
const rates = { CNY: 0.186, SGD: 1 };
ok(convert(100, "CNY", "SGD", rates) === 18.6, "convert CNY->SGD");
ok(convert(18.6, "SGD", "CNY", rates) === 100, "inverse via 1/rate");
ok(toDisplay({ amount: 100, currency: "CNY" }, rates, "SGD") === 18.6, "toDisplay converts");
ok(toDisplay({ amount: 8.4, currency: "SGD" }, rates, "SGD") === 8.4, "same currency passthrough");
ok(toDisplay({ amount: 55 }, rates, "SGD") === 55, "no currency defaults to SGD view");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.** `convert(v, from, to, rates)`: if `from === to` return `v`; `rate = rates[from] ?? 1`; if `to === "SGD"` return `v * rate`; else return `v / (rates[to] ?? 1)`. `toDisplay(t, rates, display)` uses `convert(t.amount, t.currency ?? "SGD", display, rates)`. Store rates in a `zustand` persist store with `displayCurrency` + `rates` + `ratesUpdatedAt`.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat(currency): FX convert + view-currency store`

---

### Task 11: Purchase-first dedup

**Files:**
- Create: `web/src/lib/parsers/dedup.ts`
- Test: `web/scripts/test-dedup.ts`

**Interfaces:**
- Consumes: `NormalizedRow`, `Direction`.
- Produces: `applyPurchaseFirst(rows: NormalizedRow[], existing: NormalizedRow[]): NormalizedRow[]` — returns `rows` with repayments that have a matching purchase in `rows ∪ existing` turned into `TRANSFER` + `isDuplicate` equivalent (the bridge reads `tags`).

`applyPurchaseFirst`:
1. Identify **repayment rows**: `direction === "TRANSFER"` OR a `repayment` tag, AND counterparty/paymentMethod matches a credit/BNPL issuer regex (`美团|月付|支付宝|花呗|微信还款|credit|信用卡|花'); call them candidate repayments.
2. Identify **purchase rows**: `direction === "EXPENSE"` with a `bnpl` tag OR issuer-match and `sourceId` present.
3. For each candidate repayment, find a purchase where `counterparty` (or a normalized issuer key) matches AND (`sourceId` matches OR `amount` is within a tolerance AND the purchase `date <= repayment date` within a window). On match → set the repayment `direction = "TRANSFER"`, push `repayment` tag (deduped), and keep the purchase as EXPENSE. For installments/lumped repayments, match by aggregate `amount` per issuer.
4. No match → leave as-is (EXPENSE) with `needs_review` tag.

- [ ] **Step 1: Failing test**

```ts
// web/scripts/test-dedup.ts
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
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.** Build issuer key from `counterparty` (uppercase, strip `CO./P/LTD`, normalize CJK by matching known issuer words). Match by sourceId first; else by amount tolerance (±0.5) + issuer key + `purchase.date <= repayment.date`. Never mutate a purchase; only push tags on the repayment.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat(parsers): purchase-first anti-double-counting`

---

### Task 12: Wire into the store (multi-source + dedup at merge)

**Files:**
- Modify: `web/src/lib/store.ts` (optional `Transaction` fields already in types; add rates store usage, dedup on merge, `source`/`currency` carried through)
- Modify: `web/src/lib/types.ts` (`Transaction` optional fields: `source?`, `currency?`, `nativeAmount?`, `counterparty?`, `paymentMethod?`, `tags?`, `isDuplicate?`)
- Modify: `web/src/lib/merge.ts` (call `applyPurchaseFirst` against existing transactions on merge)
- Test: `web/scripts/test-store-merge.ts`

**Interfaces:**
- Consumes: Tasks 10, 11; `mergeTransactions`.
- Produces: `mergeTransactions(existing, incoming)` now applies purchase-first dedup across the corpus before union.

- [ ] **Step 1: Failing test**

```ts
// web/scripts/test-store-merge.ts
import { mergeTransactions } from "../src/lib/merge";
import type { Transaction } from "../src/lib/types";
const tx = (p: Partial<Transaction>): Transaction => ({
  id: p.id ?? "1", date: p.date ?? "2026-08-01", month: "2026-08", description: "x", merchantKey: "x",
  amount: p.amount ?? 10, pillar: p.pillar ?? "Variable Wants", sub: p.sub ?? "Shopping",
  provenance: "rule", ...p,
});
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
const purchase = tx({ id: "P1", counterparty: "美团", amount: 105.79, tags: ["bnpl"], sub: "Dining Out/Cafes" });
const repayment = tx({ id: "R1", counterparty: "MEITUAN", amount: 105.79, pillar: "Variable Wants", sub: "Shopping" });
const merged = mergeTransactions([repayment], [purchase]);
// after dedup the repayment's pillar flips to Transfer so it doesn't double count
ok(merged.find((t) => t.id === "R1")?.pillar === "Transfer", "repayment becomes Transfer on merge");
ok(merged.find((t) => t.id === "P1")?.pillar !== "Transfer", "purchase stays spending");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.** In `mergeTransactions`, before unioning, run corpus-level `applyPurchaseFirst` over `[...existing, ...incoming]` (mapping `Transaction` ↔ `NormalizedRow` via the optional fields), then union by `id`. Add the optional fields to the `Transaction` interface in `types.ts`. Persist the new fields naturally through `store` (they ride on `Transaction`).
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat(store): corpus-wide purchase-first dedup on merge + optional multi-currency fields`

---

### Task 13: View-currency in selectors

**Files:**
- Modify: `web/src/lib/selectors.ts` (spend/transfer/income sums use `toDisplay` against the active view currency)
- Test: `web/scripts/test-selectors-currency.ts`

**Interfaces:**
- Consumes: `toDisplay`, `useRatesStore` (Task 10).
- Produces: `totalSpent`, `spentByPillar`, `spentBySub`, `monthlyTrend`, `budgetBreakdown` accept an optional `{ rates, displayCurrency }`; defaults to `{ rates: { SGD: 1 }, displayCurrency: "SGD" }`.

- [ ] **Step 1: Failing test**

```ts
// web/scripts/test-selectors-currency.ts
import { totalSpent } from "../src/lib/selectors";
import type { Transaction } from "../src/lib/types";
const tx = (p: Partial<Transaction>): Transaction => ({ id: "1", date: "2026-08-01", month: "2026-08", description: "x", merchantKey: "x", amount: 10, pillar: "Variable Wants", sub: "Shopping", provenance: "rule", ...p });
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
const rates = { CNY: 0.186, SGD: 1 };
ok(totalSpent([tx({ amount: 100, currency: "CNY" })], rates, "SGD") === 18.6, "CNY spent converted to SGD view");
ok(totalSpent([tx({ amount: 8.4 })], rates, "SGD") === 8.4, "SGD passthrough");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.** Add an optional second/third arg `(rates, displayCurrency)` to the sum functions; replace bare `t.amount` accumulation with `toDisplay(t, rates, displayCurrency)`. Default params keep existing callers working.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat(selectors): view-currency conversion in spend/transfer/income sums`

---

### Task 14: Import UI — read bytes, per-file detection, error cards

**Files:**
- Modify: `web/src/components/Dropzone.tsx` (read `ArrayBuffer`, accept `.csv,.xlsx`; emit `{ bytes, name }`)
- Modify: `web/src/app/page.tsx` (`handleFiles` uses `parseBatch`; per-file detection summary + error cards; pass missing-to-wizard to `/import/map`)
- Modify: `web/src/lib/importStore.ts` (hold pending file bytes, not text, for the wizard)
- Test: manual (UI) + extend `web/scripts/e2e.ts` (Task 16); no unit test here.

**Interfaces:**
- Consumes: `parseBatch` (Task 9).
- Produces: `handleFiles(files: { bytes: ArrayBuffer; name: string }[])` drives the UI.

- [ ] **Step 1: Update `Dropzone`** to read `f.arrayBuffer()` (not `.text()`), and change `accept` to `.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx`. Update the `onFiles` prop type to `{ bytes: ArrayBuffer; name: string }[]`. Update the copy "bank CSVs" → "bank CSV / Excel files".

- [ ] **Step 2: Update `page.tsx` `handleFiles`.** Replace the `parseDetected` loop with `parseBatch(files.map(f => ({ bytes: f.bytes, name: f.name })))`. Render a per-file row in the summary: `name → detected source → encoding → n rows → income/expense/transfer`. For files the classifier can't detect (`unknown`), route them to `/import/map` (wizard) as before; for files with a parse error, show a per-file error card with a "Skip" action instead of aborting the whole batch.

- [ ] **Step 3: Screenshot the import page** (with a mixed drop of the available sanitized fixtures) to confirm the per-file summary renders and no doubled spending appears on the dashboard. This is a manual/visual check.

- [ ] **Step 4: Commit** — `feat(import): bytes ingestion + per-file detection summary + error cards`

---

### Task 15: i18n strings

**Files:**
- Modify: `web/src/lib/i18n.tsx` (add `en`/`zh` keys for the new per-file summary, error-card buttons, "Unknown source", "View currency", "Detected source" labels)
- No unit test (strings only). Verify keys render on `/import` and in `/settings`.

- [ ] **Step 1: Add keys** to both dictionaries (e.g. `import.perFile`, `import.detected`, `import.unknownSource`, `import.skipFile`, `settings.viewCurrency`, `settings.fxStale`).
- [ ] **Step 2: Run `npm run dev`** and eyeball `/` and `/settings` in both languages.
- [ ] **Step 3: Commit** — `feat(i18n): per-file ingest + view-currency strings (en/zh)`

---

### Task 16: E2E + sanitized fixtures

**Files:**
- Create: `web/src/lib/parsers/__fixtures__/` (sanitized string constants — no real merchant/order-ids) OR embed in the scripts
- Modify: `web/scripts/fixtures.ts` (shared sanitized fixtures) and `web/scripts/e2e.ts` (add a mixed-batch import flow)
- Test: `web/scripts/test-fixtures.ts` (parses each sanitized fixture and asserts counts/dedup — these run in CI)

**Interfaces:**
- Consumes: everything.
- Produces: committed, privacy-safe sample data + a regression e2e.

- [ ] **Step 1: Author sanitized fixtures.** For each source, a small CSV/`aoa_to_sheet`-built `.xlsx` fixture with **fake** merchants (e.g. `美团外卖`, `滴滴出行`) and **fake** order-ids (`ORDER-000001`). Keep the real column headers/encoding so coverage is faithful.

- [ ] **Step 2: Write `test-fixtures.ts`.** `parseBatch` the fixtures; assert: Alipay `支出`=N rows EXPENSE + `不计收支`=M TRANSFER; Meituan `实付金额` used; a WeChat `.xlsx`+`.csv` pair; OCBC deposit→income; and **a purchase-first case**: an Alipay 花呗 purchase + an OCBC repayment of the same amount → after merge, exactly one is spending and the repayment is `Transfer`.

- [ ] **Step 3: Extend `e2e.ts`.** After the existing demo-data flow, drag/drop the mixed fixtures and assert the dashboard `Spent` total equals the **deduped** total (no doubled spending).

- [ ] **Step 4: Run** `npx tsx scripts/test-fixtures.ts` (PASS) and (with the dev server up) `npx tsx scripts/e2e.ts` (exit 0, no console errors).
- [ ] **Step 5: Commit** — `test(import): sanitized fixtures + mixed-batch e2e`

---

### Task 17: Retire the old `banks/` wiring

**Files:**
- Delete: `web/src/lib/banks/index.ts`, `web/src/lib/banks/ocbc.ts` (keeping `helpers.ts` — reused by `parsers/`) — or keep `helpers.ts` moved to `web/src/lib/parsers/helpers.ts`
- Modify: any remaining import of `@/lib/banks` (e.g. `web/src/app/import/map/page.tsx` uses `parseMapped`; keep `parseMapped`/`previewCsv` in `parsers/`)
- Test: run the full suite.

- [ ] **Step 1: Move `banks/helpers.ts` → `parsers/helpers.ts`** and update imports in `parsers/*`.
- [ ] **Step 2: Re-export `parseMapped`/`previewCsv`** from `parsers/index.ts` so the column-mapping wizard page keeps working.
- [ ] **Step 3: Run** `npx tsx scripts/test-*.ts` for all + `npm run build`. Delete `banks/index.ts`/`banks/ocbc.ts`.
- [ ] **Step 4: Commit** — `refactor(parsers): retire banks/ adapter in favour of parsers/ single path`

---

## Self-Review notes

- **Spec coverage:** all five design sections map to tasks: §1 data flow → T1–T9,T12–14; §2 schema/mapping → T1,T3–T6,T9; §3 currency/views → T10,T13; §4 dedup → T11,T12,T16; §5 classifier/UI/testing → T7,T14,T15,T16.
- **Known limitation documented:** income is converted to the view currency at import (re-basing per-view is deferred) — noted in Global Constraints.
- **Type consistency:** `NormalizedRow`, `SourceFileResult`, `Direction`, `Source` are defined once (T1) and referenced consistently; `convert`/`toDisplay` (T10) signatures match use in T13.
- **No placeholders:** every Task has concrete code + a concrete run command; the one illustrative snippet in T9 is flagged for the executor to make real.

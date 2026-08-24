# Multi-Source Ingestion — Design

Date: 2026-08-24

Status: Approved (all five design sections reviewed by the user)

Purpose: let the web app ingest **multiple bank / payment files in one batch**, auto-detect
each file's source, normalize every transaction into one schema, convert currencies, and
**avoid double-counting** when the same consumption appears in two ledgers (a BNPL/credit
purchase and its repayment).

## Decisions (locked)

- **Home:** the **TypeScript web app** (`web/src/`). The Python `build_tracker.py` is out of
  scope for this feature.
- **Architecture:** a new `web/src/lib/parsers/` pipeline that emits rich normalized rows,
  **bridged down** to the existing app `Transaction`/`ParseResult` so selectors/dashboard/UI
  stay compatible (Approach B).
- **Anti-double-counting:** **purchase-first** — repayments to credit/BNPL issuers become
  TRANSFER + `is_duplicate` only when a matching purchase is in the corpus; orphan repayments
  stay EXPENSE and are tagged `needs_review`. Never silently suppress an uncertain pair.
- **Currency:** store **native** amount + currency per transaction; FX rates fetched from a
  public API **client-side**, cached; conversion applied **at render time** against a
  user-selected **display currency** (default **SGD**, rate 1).
- **First-slice sources:** OCBC CSV, WeChat Pay (`.xlsx`/`.csv`), Alipay (`.csv`, GB18030),
  Meituan (`.csv`, UTF-8 with BOM). **Douyin deferred** (current export is a PDF with no
  extractable merchant text; revisit when a CSV/xlsx export exists). **OCBC PDF deferred**.
- **Category model:** `pillar` (Fixed Needs / Variable Wants) + `sub-category` remain the
  source of truth (budgets / savings-rate / 50-30-20 key off them). `normalized_category`
  is a **derived display label** mapping 1:1 from `sub` — never a second category system.

## Section 1 — Architecture & data flow

New module `web/src/lib/parsers/`. Its one job: **file bytes in → app `Transaction[]` /
`ParseResult` out.**

```
files[] (name + bytes)
   │
   ├─ StatementClassifier        classifier.ts     bytes/headers/extension → source + encoding
   ├─ decode + sniff             encoding.ts       TextDecoder(utf-8 | gb18030 | utf-16)
   ├─ per-source parser          ocbc.ts / wechat.ts / alipay.ts / meituan.ts
   │                             → NormalizedRow[]  (source, currency, direction,
   │                                                 counterparty, paymentMethod, tags, nativeAmount)
   └─ assemble                   index.ts
        ├─ categorize (reuse lib/categorize.ts, extended with Chinese keywords)
        ├─ transfer / income detection
        ├─ currency resolve      currency.ts       (native stored; view-currency applied later)
        ├─ purchase-first dedup  dedup.ts           → is_duplicate + transfer flags
        └─ bridge → Transaction[] + ParseResult     (store-compatible)
```

Classifier runs **per file** (a mixed drag-drop of OCBC + Alipay + WeChat is handled
correctly). Each file's result is merged by the **existing** `merge.ts` multi-import flow
("merge by default" / "Replace all"), not a replacement.

**Reused / extended:**

- `lib/categorize.ts` — extended with Chinese merchant keywords (美团, 饿了么, 滴滴, 花呗,
  月付, 支付宝/微信, etc.) → existing canonical sub-categories.
- `lib/taxonomy.ts` — unchanged, plus a small `normalizedCategoryFor(sub)` derived-label helper.
- `lib/store.ts` / `lib/selectors.ts` — mostly unchanged; `selectors.ts` gains a view-currency
  conversion step.
- `lib/banks/` — migrated into `parsers/` so there is a **single parse path** (OCBC CSV logic
  moves in; `banks/` retired after migration).

**Failure & fallback:** unknown/undetected source → the existing column-mapping wizard
(`/import/map`). Unparseable file → per-file error card with "skip"; one bad file never blocks
the batch.

## Section 2 — Unified schema & per-source mapping

The parser layer emits a rich, currency-aware normalized row:

```ts
type Direction = 'EXPENSE' | 'INCOME' | 'TRANSFER';
type Source = 'OCBC' | 'WECHAT' | 'ALIPAY' | 'MEITUAN';

interface NormalizedRow {
  source: Source;
  currency: 'SGD' | 'CNY';        // native
  timestamp: string;              // ISO; OCBC has date-only
  rawCategory: string;            // raw product/description text
  counterparty: string;           // payee / merchant name
  amount: number;                 // positive, native currency
  direction: Direction;           // EXPENSE | INCOME | TRANSFER
  paymentMethod: string;          // 'OCBC Debit' | '零钱' | '零钱通' | '余额宝' | '美团月付' …
  tags: string[];                 // e.g. ['bnpl','repayment','foreign_card']
  sourceId?: string;              // order/merchant id — used for cross-source dedup pairing
}
```

| Source | amount | direction | desc | counterparty | payment method | notes |
|---|---|---|---|---|---|---|
| OCBC | `Withdrawals(SGD)` | income via `Deposits`; transfers via rules | description (whitespace-normalized) | merchantKey from desc | "OCBC Debit" | SGD; keep existing transfer detection |
| WeChat | `金额(元)` | `收/支` (`支出`→EXPENSE, `收入`→INCOME; 充值/提现/理财通/零钱通存取→TRANSFER) | `商品` | `交易对方` | `支付方式` | `.xlsx` row 17 header (row 16 is the `--------微信支付` delimiter) |
| Alipay | `金额` | `收/支` (`不计收支`→TRANSFER) | `商品说明` | `交易对方` | `收/付款方式` | **GB18030**; 余额宝→savings-transfer; 花呗→`bnpl` |
| Meituan | **`实付金额`** (NOT `订单金额`) | `收/支` | `订单标题` (merchant = the segment before the first `-` when present; else the full title) | derived from 订单标题 | `支付方式` (美团月付→`bnpl`) | `.csv` UTF-8-BOM; header row 19 (row 18 `【美团交易账单明细列表】`); amounts prefixed `¥` |

Each parser produces `NormalizedRow[]`; a single `categorize` pass (extended with Chinese
keywords) assigns `pillar`+`sub`, then `normalizedCategory` is a derived display label from `sub`.

### Encodings / formats (verified against `sample data/`)

- **Alipay** `.csv` — **GB18030**, preamble of account metadata + `共：N笔记录` summaries, a
  `----------------支付宝...----------------` delimiter, then header
  `交易时间,交易对方,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注`.
- **WeChat** `.xlsx` — preamble rows 0–16, header row 17
  `交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注`.
  `.csv` variant uses `微信支付账单明细` + `交易时间,交易类型,交易对方...`.
- **Meituan** `.csv` — **UTF-8 with BOM**, preamble + `共：N笔记录` summaries, row 18 marker
  `【美团交易账单明细列表】`, header row 19
  `交易创建时间,交易成功时间,交易类型,订单标题,收/支,支付方式,订单金额,实付金额,交易单号,商家单号,备注`.
- **OCBC** `.csv` — kept as-is from the existing adapter (preamble rows, `Withdrawals/Deposits`
  split, multi-line quoted description, DD/MM/YYYY).

## Section 3 — Currency & view-currency

- Transactions stored in **native currency** (`SGD`/`CNY`) with `amount` native.
- `parsers/currency.ts` — fetches CNY→SGD (and inverse) from a public free API, **cached**
  (IndexedDB/localStorage) with fetch time; a `rates` store holds rate + timestamp + stale flag.
- Conversion at **aggregation/render** (not bake-in), so a "view in CNY" toggle recomputes all
  sums without re-importing.
- **Display-currency** setting (Settings), **default = SGD** (rate 1); toggling recomputes
  dashboard cards, savings-rate, 50-30-20, budgets, and charts.
- Offline health check: use last cached rate; if none, **flag** CNY rows and either use a
  user-entered rate or hold them pending — never show silently-wrong sums.
- `amount` (native) + `currency` are stored on both `NormalizedRow` and the bridged
  `Transaction`, so selectors can re-base.

## Section 4 — Purchase-first anti-double-counting

The pair: a **purchase** on a BNPL/credit line (Meituan/Alipay/WeChat EXPENSE with a `bnpl`
payment method + order-id) and the later **repayment** (OCBC money leaving to that issuer).

**Rule:**

1. Collect **repayment rows** — `direction=TRANSFER` + counterparty matching a credit/BNPL
   issuer (美团/月付, 支付宝/花呗, 微信还款, a card name). Tag `repayment`.
2. For each repayment, find a **matching purchase**: same issuer, `sourceId` (order-id) where
   available — else amount + issuer + date range with repayment trailing purchase; handle
   installments by aggregating.
3. **Match found** → `is_duplicate=true`, keep `TRANSFER` (excluded). Purchase stays the real
   EXPENSE — no double count.
4. **No match** → the repayment is our only evidence: keep as **EXPENSE**, tag `needs_review`.

**Edge cases:**

- **Installments** — 美团月付 splits one purchase over N monthly repayments → aggregate to the purchase.
- **Lumped repayment** — one bank payment covers several 花呗 purchases → match at issuer+time level, not per-order.
- **Refunds** — a refund (`退款`) nets against the purchase before matching.
- **Ambiguity** — do not suppress on amount+issuer alone; require order-id certainty or a strong
  amount+time-window+issuer match, else leave as spend + `needs_review`. No silent suppression.

**Corpus awareness:** dedup runs (a) within a batch and (b) **against existing
`store.transactions`** at merge time (purchases and repayments may be imported in different
sessions), keyed off issuer + sourceId/amount. `merge.ts` gains this step on top of the
existing fingerprint merge.

## Section 5 — Classifier, import UI, testing

**Classifier (per file):**

- `.xlsx` → WeChat (`微信支付账单明细` / `交易时间,交易类型…` header).
- `.csv` → sniff encoding (UTF-8 BOM → validate as UTF-8; else decode GB18030), then match
  signature: OCBC (`Transaction date,Value date`), Alipay (`支付宝交易记录明细` + `------` +
  `交易时间,交易对方…`), Meituan (`美团交易账单明细` list header).
- No match → column-mapping wizard. Each file shows a detection card (source + encoding + row count).

**Import UI:** keep the existing multi-file drag-drop + "merge by default"/"Replace all"
toggle; extend the summary to **per-file** rows (file → source → encoding → income/expense/transfer
counts) with a **per-file error card ("skip")**.

**Testing:**

- **Per-parser** unit tests against the sample files (rows, currency, direction, Meituan
  `实付金额`, counterparty). `sample data/` is gitignored → commit **sanitized mini-fixtures**
  (merchant names + order-ids redacted) so CI runs; keep optional local full-file tests.
- **Dedup**: purchase+repayment, installments, lumped repayment, refund, orphan repayment.
- **Classifier**: each source + encoding → correct detection.
- **Currency**: rate fetch/cache, conversion math, offline fallback.
- **E2E**: extend `scripts/e2e*.ts` to import a mixed batch and assert **no doubled spending**.

## File plan

**New (`web/src/lib/parsers/`):** `index.ts` (pipeline + bridge), `classifier.ts`,
`encoding.ts`, `types.ts` (NormalizedRow + Direction + Source), `ocbc.ts`, `wechat.ts`,
`alipay.ts`, `meituan.ts`, `currency.ts`, `dedup.ts`, `labels.ts` (or reuse taxonomy).
**Modified:** `web/src/lib/categorize.ts` (Chinese keywords), `web/src/lib/merge.ts`
(corpus-wide purchase-first dedup step), `web/src/lib/store.ts` (native amount+currency,
rates store), `web/src/lib/selectors.ts` (view-currency conversion),
`web/src/app/import/**` (per-file detection + error cards), `.gitignore` (add `sample data/`).

## Out of scope (follow-ups)

- Douyin (needs CSV/xlsx export; PDF has no merchant text).
- OCBC PDF parsing (in-browser PDF layout is complex; CSV preferred).
- Replacing the bridged `Transaction` with the rich schema everywhere (Approach C) — the
  eventual destination, not part of this slice.

## Privacy / git

All parsing, storage, and charts stay client-side; nothing is uploaded. Bank CSVs, generated
workbooks, and the `sample data/` folder are gitignored and must never be committed. Sanitized
fixtures (no real merchant names / order-ids) are the only new committed data.

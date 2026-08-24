# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A **personal-finance** project: turn a raw OCBC bank-statement CSV into a clear picture of where
your money goes. There are **two implementations of the same idea** that must stay conceptually in
sync:

| | What | Where |
|---|---|---|
| 🌐 **Web app** (active successor) | Interactive, fully client-side expense tracker (import → categorize → dashboard). Branded **"Where's My Money?"** / **"花哪了"**. | [`web/`](web/) |
| 🐍 **Python generator** (original) | Reads the newest OCBC CSV and writes a static Excel workbook. | [`build_tracker.py`](build_tracker.py) |

**Privacy is a hard constraint.** The web app is 100% client-side (no backend, no API routes) — parsing,
categorization, storage, and charts all run in the browser. Bank CSVs and generated workbooks are
**gitignored** and must never be committed or uploaded.

## Commands

### Web app (`web/`)

```bash
cd web
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (static, deploys to Vercel)
npm run lint
```

**Tests — there is no `test` script in `package.json`; run them by hand with `tsx`:**

- **Logic/unit tests** (no browser): `npx tsx scripts/test-merge.ts`, and the same for
  `test-budgets.ts`, `test-filters.ts`, `test-insights.ts`, `test-recurring.ts`.
- **Parser parity test**: `npx tsx scripts/smoke-parse.ts`. This needs a real `TransactionHistory_*.csv`
  at the **repo root** (gitignored, so it is present only in your local checkout, not in the repo).
- **E2E smoke tests** (`scripts/e2e*.ts`, e.g. `e2e.ts`, `e2e-merge.ts`): these are standalone Playwright
  scripts (not `npx playwright test`). **Start `npm run dev` first**, then `npx tsx scripts/e2e.ts`.

### Python generator

```bash
pip install pandas openpyxl
python build_tracker.py   # reads newest TransactionHistory_*.csv, writes MonthlyExpenseTracker.xlsx
```

No linter/tests exist for the Python side. Output is gitignored — regenerate, don't hand-edit then commit.

## Architecture (the big picture)

### Web app — `web/src/`

Next.js 16 (App Router) + TypeScript + Tailwind v4. **No backend/API routes.** State is held in a
Zustand store (`lib/store.ts`) persisted to **IndexedDB via `idb-keyval`**; a `_hydrated` flag gates
the UI (`components/HydrationGate.tsx`) so it can wait for data to load. Recharts for charts, PapaParse
for CSV, SheetJS for xlsx, `html-to-image` for share cards.

**Routes** — `/` (import), `/import/map` (column-mapping wizard), `/review` (redirects to
`/transactions` with the "Needs review" preset), `/transactions` (filterable list; filters live in the
URL via `lib/filters.ts`), `/dashboard` (URL-driven `?month=` / `?range=`), `/recurring`, `/export`,
`/settings`.

**Key `lib/` modules:**

| File | Responsibility |
|---|---|
| `taxonomy.ts` | **Canonical** pillars/sub-categories/budget targets (mirrors the Python side). |
| `categorize.ts` | Categorization rules + precedence + merchant-key extraction. |
| `banks/` | CSV adapter layer: `ocbc.ts` preset, `generic.ts` mapping, `index.ts` auto-detect + `parseDetected`. |
| `merge.ts` | Multi-statement merge: union by transaction fingerprint `id`, income deduped by deposit `id`. |
| `store.ts` | Zustand + IndexedDB persistence; `importData` vs `mergeData`. |
| `selectors.ts` | Dashboard aggregations + month/range filtering. |
| `recurring.ts` | Subscriptions/bills + frequent merchants (group by merchant, ≥3 months). |
| `insights.ts` | "What changed" month-over-month delta for the Dashboard Insights card. |
| `budgets.ts` | Optional per-category monthly budgets (`budgets: Record<sub, cap>`) → "Budget watch" card. |
| `i18n.tsx` | Lightweight `en`/`zh` store (no provider) — display strings only; category **values** stay English. |
| `exporters/` | `csv.ts` + `xlsx.ts` (xlsx mirrors the Python workbook). |

**Spending model (shared, the most important concept).** Money is split by **transaction type**, not
one category axis:

- `spending` → categorized into **Fixed Needs / Variable Wants** (the only pillars counted as "spent").
- `transfer` → savings/investment moves + P2P; **excluded from spending** so internal moves don't inflate it.
- `income` → handled separately; salary deposits keyed by month.

**Savings is an outcome** (`Savings = Income − Spending`), shown as a Savings Rate. The **50/30/20 rule
is evaluated as a share of income**, not a spend bucket.

**Categorization precedence:** manual override → learned merchant rule → keyword rule → transfer
detection → default (**Variable Wants → Shopping**).

**Theme:** "Editorial Luxe" — Sora display + Plus Jakarta Sans (see `globals.css` tokens). Do not split
the theme across components.

### Python generator — `build_tracker.py`

`pandas` + `openpyxl`, rule-based categorization via a `RULES` list (first keyword match wins,
case-insensitive against whitespace-normalized description text; unmatched → `DEFAULT_CATEGORY`).
Emits `MonthlyExpenseTracker.xlsx` with Dashboard / Transactions / Setup tabs and dependent dropdowns
driven by named ranges.

### Keep-in-sync rule

`web/src/lib/taxonomy.ts` and `build_tracker.py` **share the same category/target names**. If you change
the taxonomy or spending/transfer rules in one, update the **other** too, then regenerate the workbook
and re-run the parity test (`smoke-parse.ts`).

## OCBC CSV gotchas (matters for the parser)

OCBC exports are not a clean CSV — a parser must handle:

- **Preamble rows**: account metadata (`Account details for:`, `Available Balance`, `Ledger Balance`, a
  blank line), then a `Transaction History` line, then the real header:
  `Transaction date,Value date,Description,Withdrawals(SGD),Deposits(SGD)`. Strip preamble before parsing.
- **Withdrawals and Deposits are separate columns**, not one signed amount. Spend lives in
  `Withdrawals(SGD)`, income/refunds in `Deposits(SGD)`; exactly one is populated per row.
- **`Description` is multi-line and quoted** with heavy trailing whitespace/padding (e.g. `FAST PAYMENT`,
  `DEBIT PURCHASE ...`, `PAYNOW transfer ...`). Use a real CSV reader (PapaParse / pandas) — never line-splitting
  — and normalize whitespace when matching merchant text.
- **Dates are `DD/MM/YYYY`**; amounts are quoted with thousands separators (e.g. `"6,037.08"`).

## Constraints & conventions

- **Currency SGD; dates DD/MM/YYYY.**
- **Never upload or commit financial data** (`.gitignore` protects `TransactionHistory_*.csv` /
  `MonthlyExpenseTracker.xlsx`). Keep generated outputs local.
- **Next.js 16 has breaking changes** — APIs, conventions, and file structure can differ from training
  data. Read the relevant guide in `web/node_modules/next/dist/docs/` before writing web code
  (also stated in `web/AGENTS.md`, loaded via `web/CLAUDE.md`).
- Keep category/pillar names **exact** — dropdowns, `SUMIFS`, and exports depend on string matches.

## Reference docs

- `web/README.md` — web app features, architecture, deploy-to-Vercel.
- `ROADMAP.md` — all items completed; documents the savings-as-outcome / transfer-model decisions.
- `instructions.md` — the **original spec** (an older 3-bucket "Future Savings" model). Historical only;
  the savings-as-outcome model above supersedes it.
- `.github/copilot-instructions.md` — detailed implementation notes (kept roughly in sync with this file).

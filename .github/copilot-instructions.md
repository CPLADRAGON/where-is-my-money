# Copilot Instructions

## What this repository is

This is a **personal-finance project**. The goal is to turn raw OCBC bank statement exports into
a **Monthly Expense Tracker**. There are now **two implementations** of the same idea:

1. A **Python generator** (`build_tracker.py`) that emits a static Excel workbook.
2. A **client-side web app** (`web/`) — an interactive Next.js successor (branded **"Where's My
   Money?"** / 中文 **"花哪了"**) that imports one or more bank CSVs, lets you categorize
   uncategorized rows, and shows a live dashboard. See `web/README.md`.

Key files:

- `build_tracker.py` — the **generator**. Reads the OCBC CSV, auto-categorizes spend rows via
  merchant-text rules, and writes `MonthlyExpenseTracker.xlsx` (Dashboard / Transactions / Setup).
- `web/` — the **web app**. Next.js 16 + TypeScript + Tailwind v4, fully client-side (data never
  leaves the browser), deployable to Vercel. **"Editorial Luxe"** visual theme (Sora display +
  Plus Jakarta Sans body, warm-paper light / near-black dark, lavender-indigo accent; tokens
  live in `web/src/app/globals.css`). Transaction browsing
  lives on `/transactions` (filterable; URL-encoded filters via `lib/filters.ts`); `/review`
  redirects there with the "Needs review" preset, and the Dashboard charts/rows deep-link into it.
  The Dashboard's month/range selector is **URL-driven** (`/dashboard?month=YYYY-MM` or
  `?range=custom&from=&to=`) so it survives drill-in + Back/Forward and is shareable.
  `/recurring` detects subscriptions/bills + frequent merchants from `lib/recurring.ts` (group by
  merchant, ≥3 months); items deep-link to `/transactions?q=<merchant>`. The Dashboard also shows a
  **Spending Insights** "What changed" card (`lib/insights.ts` + `components/InsightsCard.tsx`)
  comparing the two latest months (spend delta, top movers colored by pillar, biggest category);
  movers deep-link to `/transactions?month=<m>&sub=<sub>`. Optional **per-category monthly budgets**
  (set in Settings, stored as `budgets: Record<sub, cap>`) drive a Dashboard **"Budget watch"** card
  (`lib/budgets.ts` + `components/BudgetWatchCard.tsx`): spend-vs-cap progress bars normalized per
  month over the selected range, with over-budget alerts. Navigation uses the top header on desktop
  and a **fixed bottom tab bar on mobile** (`AppShell.tsx`; top nav is `hidden sm:flex`). Imports
  **merge by default** (multiple files at once or incrementally): transactions union by their
  deterministic fingerprint `id` and income is deduped by fingerprinted salary deposit
  (`lib/merge.ts`, store `mergeData` + `incomeDeposits`); a "Replace all" toggle resets instead.
- **Both implementations now share the same model** (kept in sync): spending is **Fixed Needs /
  Variable Wants** only; **savings is an outcome** (Income − Spending); **transfers**
  (savings/investment + person-to-person) are auto-detected and **excluded from spending**; and
  50/30/20 is evaluated as a **share of income**. If you change the taxonomy/rules in one, update
  the other (`build_tracker.py` ↔ `web/src/lib/`).
- `instructions.md` — the **original spec/prompt** (describes the earlier 3-bucket system with a
  "Future Savings" pillar). Historical context; the savings-as-outcome model above supersedes it.
- `TransactionHistory_*.csv` — a real **OCBC FRANK account** export; the raw input data.
- `MonthlyExpenseTracker.xlsx` — the generated output (regenerate; don't hand-edit then commit).

## Build / run

```powershell
python build_tracker.py   # reads the newest TransactionHistory_*.csv, writes the .xlsx

cd web; npm install; npm run dev   # the web app at http://localhost:3000
```

The Python script requires `pandas` + `openpyxl` and picks the latest `TransactionHistory_*.csv`
in the cwd automatically. The web app has its own toolchain (npm) and a parser parity test
(`web/scripts/smoke-parse.ts`). There is no linter for the Python side.

## The CSV input format (important quirks)

OCBC exports are not a clean CSV — a parser must account for these:

- The first rows are **account metadata**, not data: `Account details for:`, `Available Balance`,
  `Ledger Balance`, a blank line, then a `Transaction History` line, then the real header row:
  `Transaction date,Value date,Description,Withdrawals(SGD),Deposits(SGD)`. Skip/strip these
  preamble rows before parsing.
- **Withdrawals and Deposits are separate columns**, not one signed amount. Spend lives in
  `Withdrawals(SGD)`; income/refunds live in `Deposits(SGD)`. Exactly one is populated per row.
- The `Description` field is **multi-line and quoted** — it contains embedded newlines and lots of
  trailing whitespace/padding (e.g. `FAST PAYMENT`, `DEBIT PURCHASE  xx-1767 BUS/MRT ...`,
  `PAYNOW transfer ... via PayNow-UEN`). Use a real CSV reader (e.g. pandas), not line splitting,
  and normalize whitespace when matching merchant text.
- Dates are **DD/MM/YYYY**. Amounts use thousands separators in quotes (e.g. `"6,037.08"`).

## Target spreadsheet architecture (from `instructions.md`)

Three tabs:

- **Transactions** — raw rows. Columns: `A Date`, `B Description`, `C Amount`, `D Main Pillar`,
  `E Sub-Category`, `F Notes`. `D` is a dropdown; `E` is a **dependent dropdown** driven by `D`.
- **Setup** — the budget targets and the **3-bucket category system** definitions (drives the dropdowns).
- **Dashboard** — month selector (`B3`, dropdown of each month + "All") drives `StartDate`/`EndDate`
  helper cells on the Setup tab that feed every `SUMIFS`. Shows three summary cards (income, spent,
  remaining), a pillar table (actual vs target % with conditional formatting), a sub-category table,
  and three charts: a Spend-by-Pillar doughnut, an Actual%-vs-Target% column chart, and a
  Spend-by-Sub-Category horizontal bar. Uses the Flat-UI data-viz palette
  (`#264653`/`#2A9D8F`/`#E9C46A`/`#E76F51`); gridlines are hidden for a dashboard look.

### The 3-bucket category system (canonical taxonomy)

- **Fixed Needs:** Accommodation/Rent, Transport, Insurance, Basic Groceries, Utilities
- **Variable Wants:** Dining Out/Cafes, Entertainment/Hobbies, Subscriptions, Shopping, Travel
- **Future Savings:** Emergency Fund, Investments, General Savings

Baseline targets for the Dashboard comparison: **50% Needs / 30% Wants / 20% Savings**.

## Conventions

- Keep the pillar/sub-category names **exactly** as listed above — the dependent dropdowns and the
  Dashboard `SUMIFS` depend on string matches.
- Currency is **SGD**; dates stay **DD/MM/YYYY**.
- When generating a spreadsheet programmatically, the spec calls for **Python with `pandas` +
  `openpyxl`** to emit an `.xlsx`. Prefer that path over VBA unless asked otherwise.
- Categorization is rule-based: extend the `RULES` list in `build_tracker.py` (first keyword match
  wins; matched case-insensitively against whitespace-normalized description text). Rows that match
  no rule **default to Variable Wants → Shopping** and are flagged in Notes (`auto-default`) so they
  can be retagged. Adjust `DEFAULT_CATEGORY` to change that fallback.
- Dependent dropdowns rely on named ranges with **underscores** (`Fixed_Needs`, `Variable_Wants`,
  `Future_Savings`) via `INDIRECT(SUBSTITUTE($D2," ","_"))` — keep pillar names and these range
  names in sync.
- Deposits are excluded from spend rows; **salary deposits are summed per month** to populate the
  Dashboard income (matched by `INCOME_KEYWORDS` — note OCBC labels salary inconsistently, e.g.
  `GIRO - SALARY` one month and `IBG GIRO ... INFINEON ... SALA` the next, so matching keys on the
  employer name is more reliable than the word "SALARY").
- This data is personal financial history. **Do not commit secrets/derived account data to any
  external service**, and keep generated outputs local.

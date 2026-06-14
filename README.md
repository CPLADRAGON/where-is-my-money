# Money Tracker

Turn a raw bank-statement CSV into a clear picture of where your money goes.

This repo has **two implementations** of the same idea:

| | What it is | Where |
|---|---|---|
| 🌐 **Web app** | Interactive, client-side expense tracker (import → categorize → dashboard). **Your data never leaves your browser.** | [`web/`](web/) |
| 🐍 **Python generator** | A script that reads an OCBC CSV and writes a static Excel workbook. | [`build_tracker.py`](build_tracker.py) |

The web app is the actively-developed successor; the Python generator is the
original spreadsheet tool.

---

## Privacy first

The web app is **100% client-side**: CSV parsing, categorization, storage, and
charts all run in your browser. Nothing is uploaded to any server, and your bank
files are **gitignored** so they're never committed.

---

## Web app

A Next.js app that imports a bank CSV and helps you understand your spending.

**Features**
- **Import** — drag-drop a CSV. OCBC statements are auto-detected; any other bank
  works via a **column-mapping wizard** (saveable as a reusable preset). Includes
  per-bank "how to download your CSV" guides and a one-click **demo dataset**.
- **Review & categorize** — uncategorized-first table with dependent
  Pillar → Sub-Category dropdowns, provenance badges, bulk apply, and **learned
  merchant memory** (recurring payees auto-categorize on future imports).
- **Dashboard** — Income / Spent / Saved + **Savings-Rate** cards, a **"Where your
  income went"** flow, a **50/30/20 (share-of-income)** table, and charts
  (Needs-vs-Wants, actual-vs-target, sub-categories, monthly trend).
- **Settings** — edit budget targets, monthly income, remembered merchants, and
  saved bank presets; one-click clear-all (privacy reset).
- **Export** — optional CSV and `.xlsx`, plus a **share-card builder**
  (selectable range + metrics + theme → PNG).

**How money is modeled.** Spending is split into **Fixed Needs** and **Variable
Wants**. **Savings is an outcome** (`Income − Spending`), shown as a Savings Rate
rather than a spending category — so the 50/30/20 rule is evaluated as a **share
of income**. **Transfers** (moves to savings/investment accounts and person-to-
person payments) are auto-detected and **excluded from spending** so they don't
distort the picture.

**Run it**
```bash
cd web
npm install
npm run dev      # http://localhost:3000
```
More detail (architecture, deploy) in [`web/README.md`](web/README.md).

---

## Python generator

Reads the newest `TransactionHistory_*.csv` in the folder and writes
`MonthlyExpenseTracker.xlsx` (Dashboard / Transactions / Setup tabs).

```bash
pip install pandas openpyxl
python build_tracker.py
```

> Note: the Python generator still uses the original 3-bucket model (incl. a
> "Future Savings" spend pillar). The web app has since moved to the
> savings-as-outcome + transfers model described above. See
> [`ROADMAP.md`](ROADMAP.md) for the planned reconciliation.

---

## Deploy

The web app deploys to Vercel with zero config — set the project **Root
Directory** to `web/`. Step-by-step instructions are in
[`web/README.md`](web/README.md#deploy-to-vercel).

---

## Roadmap

Planned work (visual redesign, dark mode, Chinese language, mobile/PWA, logo,
and more) is tracked in [`ROADMAP.md`](ROADMAP.md).

---

## Repository layout

```
build_tracker.py     # Python → Excel generator
instructions.md      # original spec for the tracker
ROADMAP.md           # planned enhancements
web/                 # the Next.js web app (see web/README.md)
.github/             # Copilot instructions
```

_Screenshots will be added after the planned visual redesign (ROADMAP #6)._

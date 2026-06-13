# Money Tracker — Web App

A fully client-side personal expense tracker. Import a bank CSV, categorize
spending into a 3-bucket system (Fixed Needs / Variable Wants / Future Savings),
and explore a clean dashboard. **Your data never leaves your browser** — parsing,
storage, and charts all run locally; nothing is uploaded.

This is the interactive successor to the Python `build_tracker.py` + Excel
workflow in the repository root.

## Stack

- **Next.js 16** (App Router) + **TypeScript**, **Tailwind CSS v4**
- **PapaParse** (CSV), **Recharts** (charts), **SheetJS** (xlsx export),
  **html-to-image** (share cards)
- **Zustand** + **IndexedDB** (`idb-keyval`) for private, persistent local storage
- **Wise-inspired** visual theme (lime-green accent, rounded white cards)

## Develop

```bash
cd web
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (static)
npm run lint
npx tsx scripts/smoke-parse.ts   # parser parity test vs the sample OCBC CSV
```

## Features

- **Import** — drag-drop a CSV. OCBC statements are auto-detected; any other bank
  works via the **column-mapping wizard**, which can save reusable presets.
  Includes per-bank "how to download your CSV" guidance and a **demo dataset**.
- **Review & categorize** — uncategorized-first table with dependent
  Pillar -> Sub-Category dropdowns, provenance badges (rule / learned / manual /
  default), bulk apply, and **learned merchant memory** (recurring payees
  auto-categorize on future imports).
- **Dashboard** — month / all / custom range selector; income, spent and
  remaining cards; pillar-vs-target table with status; and four charts
  (spend-by-pillar pie, actual-vs-target bars, sub-category bars, monthly trend).
- **Settings** — edit budget targets, monthly income, remembered merchants and
  saved bank presets; one-click clear-all (privacy reset).
- **Export** — optional CSV and `.xlsx` (mirrors the original workbook), plus a
  **share-card builder** (selectable range + metrics + theme -> PNG).

## Architecture

```
src/
  app/                 # routes: / (import), /import/map, /review, /dashboard, /export, /settings
  components/          # UI kit (Button, Card, Badge, Select, charts, shell)
  lib/
    taxonomy.ts        # canonical pillars/sub-categories/targets (mirrors Python)
    categorize.ts      # rules + precedence + merchant-key extraction
    banks/             # adapter layer: ocbc preset, generic mapping, auto-detect, pipeline
    store.ts           # Zustand + IndexedDB persistence
    selectors.ts       # dashboard aggregations + range filtering
    exporters/         # csv + xlsx (share card lives in the export page)
```

Categorization precedence: **manual override -> learned merchant rule -> keyword
rule -> default (Variable Wants -> Shopping)**.

## Deploy to Vercel

This is a standard Next.js app and deploys with zero config:

1. Push the repo to GitHub.
2. In Vercel, **Import Project** and set the **Root Directory** to `web/`.
3. Deploy. (Framework preset: Next.js — detected automatically.)

Or from the CLI:

```bash
cd web
npx vercel        # preview
npx vercel --prod # production
```

No environment variables or backend are required.

# Multi-Statement Merge + Rebrand — Design

**Date:** 2026-06-17
**Status:** Approved (design)

## Goal

Two deliverables in one plan:

1. **Rebrand** the app to **"Where's My Money?"** (EN) / **"花哪了"** (ZH) — a playful,
   memorable name matching the project's core intention (the honest answer to a
   universal question) and the existing repo name `where-is-my-money`.
2. **Multi-statement merge** — let the user import **multiple bank statements**
   (several files at once *and* incrementally), **de-duplicated**, so the
   dashboard, trend, recurring detector, insights, and budgets span the user's
   full imported history instead of a single statement. Imports **merge by
   default**, with a clear **"Replace all"** escape hatch.

## Baseline (current behaviour)

- `app/page.tsx` → `parseDetected(text)` → `store.importData(result)` which
  **replaces** `transactions`, `months`, `detectedIncome`.
- `Dropzone` reads only `files[0]`.
- Unknown bank → `/import/map` wizard → `parseMapped` → `importData` (replace).
- Transaction `id` = djb2 `hash(date|spend.toFixed(2)|description)` with a
  per-file `#n` disambiguator for exact duplicates (see `banks/index.ts`). The id
  is **deterministic across files** — the same statement row always hashes the
  same id.
- Income: salary deposits matched by `incomeKeywords`, summed into
  `incomeByMonth` per file, stored as `detectedIncome` (replaced each import).
- `overrides` keyed by transaction `id`; `learned` keyed by `merchantKey`; both
  persisted; `recategorize` re-applies them.

## Design

### 1. Rebrand

- **i18n** `brand`: EN `"Where's My Money?"`, ZH `"花哪了"`.
- **layout.tsx**: `metadata.title` → `"Where's My Money? — Personal Expense Dashboard"`;
  `appleWebApp.title` → `"Where's My Money?"`.
- **manifest.ts**: `name` → `"Where's My Money?"`, `short_name` → `"WMM"`;
  update stale `background_color`/`theme_color` to the current theme `#f4f2ee`.
- **export share-card** wordmark: `"Money Tracker"` → `"Where's My Money?"`.
- **Docs**: README title/intro, `.github/copilot-instructions.md`, ROADMAP.
- Repo name and code token names are unchanged.

### 2. Income deposits (enables income dedup)

Add a fingerprinted income-deposit list so overlapping months don't double-count
salary on merge.

- **types.ts**: new `IncomeDeposit = { id: string; month: string; amount: number }`;
  `ParseResult.incomeDeposits: IncomeDeposit[]`.
- **banks/index.ts** (`buildParseResult`): when a row is income
  (`row.income > 0 && row.spend === 0 && incomeRe.test(description)`), compute a
  fingerprint id the same way as transactions — `hash(date|income.toFixed(2)|description)`
  with a separate `seenIncome` `#n` disambiguator — and push
  `{ id, month, amount: row.income }` to `incomeDeposits`. Keep `incomeByMonth`
  too (still used by the summary `stats.income`).

### 3. Store changes (`lib/store.ts`)

- **New persisted state**: `incomeDeposits: Record<string, { month: string; amount: number }>`
  — the union of all imported deposits, keyed by deposit id.
- **Keep** `detectedIncome: IncomeByMonth` as the read API for selectors, but
  **derive** it from `incomeDeposits` via a helper:
  ```ts
  function recomputeIncome(deposits: Record<string, { month: string; amount: number }>): IncomeByMonth {
    const out: IncomeByMonth = {};
    for (const { month, amount } of Object.values(deposits)) {
      out[month] = (out[month] ?? 0) + amount;
    }
    return out;
  }
  ```
- **`importData(result)` (REPLACE)** — rework to:
  - `transactions` = `result.transactions.map(t => recategorize(t, s))`
  - `months` = `result.months`
  - `bankLabel` = `result.bankLabel`
  - `incomeDeposits` = `Object.fromEntries(result.incomeDeposits.map(d => [d.id, { month: d.month, amount: d.amount }]))`
  - `detectedIncome` = `recomputeIncome(incomeDeposits)`
- **`mergeData(result)` (NEW, MERGE)**:
  - Build a `byId` map from existing `transactions`; add each `result.transactions`
    item whose id is **not** already present (existing rows win — they already
    carry applied edits).
  - `merged` = `Array.from(byId.values())`, then recategorize all with current
    `overrides`/`learned`.
  - `incomeDeposits` = `{ ...existing, ...resultDepositsById }` (union by id).
  - `detectedIncome` = `recomputeIncome(merged incomeDeposits)`.
  - `months` = sorted unique union of existing + result months.
  - `bankLabel` = existing || result; if both present and differ → `"Multiple sources"`.
- **`clearAll`** also resets `incomeDeposits: {}`.

### 4. Import flow (`Dropzone` + `app/page.tsx`)

- **Dropzone**: add `multiple` to the file input; read **all** dropped/selected
  files; new prop `onFiles(files: { text: string; name: string }[])` replacing
  `onFile`. Update copy to "Drop one or more bank CSVs".
- **`app/page.tsx` `handleFiles(files)`**:
  1. Parse each file with `parseDetected`; collect `parsed: ParseResult[]` and
     `unknown: { text, name }[]` (caught `UNKNOWN_BANK` / empty-result files).
  2. Decide mode: `replace = replaceChecked || store.transactions.length === 0`.
  3. Snapshot `beforeCount = store.getState().transactions.length` (0 if replacing).
     Apply: if `replace` → `importData(parsed[0])` then `mergeData(parsed[1..])`;
     else `mergeData(parsed[i])` for all.
  4. `afterCount = useStore.getState().transactions.length`;
     `totalParsed = sum(parsed[i].transactions.length)`;
     `added = afterCount - beforeCount`; `skipped = totalParsed - added`.
  5. Set the summary (added / skipped / afterCount / months.length).
  6. If `unknown.length > 0`: `setPending(unknown[0])` and route to `/import/map`
     (the wizard result then `mergeData`s). Show a note that N files need manual
     mapping (only the first is handled now — documented v1 limitation).
- **Replace control**: a checkbox **"Replace existing data"** shown only when the
  store already has transactions; default unchecked (merge).
- **"Try demo data"**: always replaces (`importData`).

### 5. Mapping wizard (`app/import/map/page.tsx`)

- On successful mapping import: if `store.transactions.length > 0` →
  `mergeData(res)` else `importData(res)`. (Today it always `importData`s.)

### 6. i18n keys (EN + ZH)

- `brand` (updated, see Rebrand).
- `import.dropTitle` → "Drop one or more bank CSVs" / "拖入一个或多个银行 CSV".
- `import.replaceExisting` → "Replace existing data" / "替换现有数据".
- `import.mergedSummary` → "Added {added} · skipped {skipped} duplicates · {total} transactions across {months} months" / "新增 {added} · 跳过 {skipped} 条重复 · 共 {total} 笔，{months} 个月".
- `import.filesNeedMapping` → "{n} file(s) need manual column mapping." / "{n} 个文件需要手动映射列。".

### 7. Edge cases

- **Same-day identical purchases**: preserved via deterministic `#n` ids.
- **Overlapping months**: transactions deduped by id; income deduped by deposit id.
- **Mixed banks** across files: each detected independently; `bankLabel` becomes
  "Multiple sources".
- **Garbage / zero-spend file**: skipped (counts as 0 parsed); other files still
  merge. If **every** file is unknown → route the first to `/import/map`.
- **Replace + multiple files**: first replaces, the rest merge → net = union of
  all dropped files.

## Testing

- **Unit** (`scripts/test-merge.ts`, tsx + `eq` helper, `if/else` not ternary):
  - `mergeData` dedups transactions across two overlapping `ParseResult`s (unique
    ids); a same-day duplicate (`#1`) is preserved.
  - Income dedup: two results sharing one month's salary deposit (same deposit id)
    → that month's `detectedIncome` is **not** doubled; distinct deposits sum.
  - `buildParseResult` emits `incomeDeposits` with **stable** ids across two
    parses of the same text.
- **e2e** (`scripts/e2e-merge.ts`, Playwright, 0 console errors):
  - Import demo (replace) → record counts/months.
  - Import a second small OCBC-format fixture (a new month) with **merge** →
    assert transactions increased and months are the union.
  - Re-import the **same** second file → assert no change (deduped).
  - Toggle **Replace existing data** + re-import demo → assert dataset reset.
- Re-run existing suites (drilldown / recurring / insights / budgets), `tsc`,
  `lint`, `build`.

## Files

- **Modify**: `lib/types.ts`, `lib/banks/index.ts`, `lib/store.ts`,
  `components/Dropzone.tsx`, `app/page.tsx`, `app/import/map/page.tsx`,
  `lib/i18n.tsx`, `app/layout.tsx`, `app/manifest.ts`, `app/export/page.tsx`.
- **Create**: `scripts/test-merge.ts`, `scripts/e2e-merge.ts`.
- **Docs**: `web/README.md`, `.github/copilot-instructions.md`, `ROADMAP.md`.

## Out of scope (YAGNI)

- Routing **all** unknown-bank files through the wizard in one pass (only the first
  is handled per multi-select; the rest can be re-dropped).
- A "manage imported statements" UI (list/remove individual statements). Possible
  follow-up.

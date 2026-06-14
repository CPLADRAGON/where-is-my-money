# Design: Unified filterable Transactions page (category drill-down)

Date: 2026-06-14
Status: Approved (design) — pending spec review before implementation planning.

## Problem

Today you cannot drill into a category to see its entries:

- The **Dashboard** charts and breakdown tables are static (not clickable).
- The **Review** page (`/review`) lists *all* transactions flat with inline
  category dropdowns, but has no way to filter to a single category, month, or type.

We want to "tap into a category and see the entries," from the Dashboard, with a
proper filterable transaction view, and be able to recategorize entries inline.

## Goal

A single **filterable Transactions page** that:

1. Lists transactions with filters: pillar, sub-category, month/range, type
   (spending vs transfer), a "Needs review" preset, and text search; plus sort.
2. Lets you **view + edit (recategorize/retag) inline** — reusing the existing
   Review table behavior.
3. Is the **deep-link target** from the Dashboard: tapping a pie slice, a
   Needs/Wants breakdown row, or a sub-category bar navigates here pre-filtered,
   carrying the current month. The Back button and shareable URLs "just work."
4. **Absorbs the Review page** — Review becomes the "Needs review" preset on this
   page (no duplicate table/edit logic).

## Non-goals (YAGNI)

- Saved/named filter sets.
- Amount-range filter; provenance-source filter (beyond the "Needs review" preset).
- Exporting the *filtered* view (global CSV/xlsx export already exists on /export).
- A service worker / offline changes.

## Architecture

### Route & navigation
- New canonical page: **`/transactions`** (client component).
- `/review` **redirects** to `/transactions?review=1` so existing flows/links
  (e.g. the import success CTA, the nav badge) keep working.
- Nav: the existing "Review" item points to `/transactions` and keeps its
  uncategorized-count badge. (Label may stay "Review" or become "Transactions";
  default to **"Transactions"** with the badge retained.)
- Import success CTA (`page.tsx`) updates its push target to
  `/transactions?review=1`.

### Filter state in the URL
All filter state is encoded as query params so navigation is shareable and the
Back button restores state. Supported params:

| Param   | Values                                                        |
|---------|---------------------------------------------------------------|
| `pillar`| `Fixed Needs` \| `Variable Wants` \| `Transfer`               |
| `sub`   | a sub-category name (validated against the pillar)            |
| `month` | `YYYY-MM` (omitted/`all` = all months)                        |
| `from`  | `YYYY-MM-DD` (custom range start; used when `month` absent)   |
| `to`    | `YYYY-MM-DD` (custom range end)                               |
| `type`  | `spending` \| `transfer` (omitted = all)                     |
| `review`| `1` (needs-review preset → provenance = `default`)           |
| `q`     | free-text search over description + merchant key             |
| `sort`  | `date_desc` (default) \| `date_asc` \| `amount_desc` \| `amount_asc` |

Invalid/unknown values are ignored (graceful fallback to "all").

### New / changed modules
- `web/src/lib/filters.ts` (new)
  - `TxFilter` type (the params above as a typed object).
  - `parseFilter(searchParams): TxFilter` and `serializeFilter(filter): string`.
  - `applyFilter(transactions, filter): Transaction[]` — pure; filters then sorts.
  - Reuses `inRange` from `selectors.ts` for month/custom-range logic.
- `web/src/components/TransactionTable.tsx` (new — extracted from `app/review/page.tsx`)
  - Renders the rows + inline `CategoryPicker` + "not spending" tag + the
    select/bulk-apply bar + "remember merchant" toggle. Props: `rows`,
    handlers from the store. No filtering logic inside (stays presentational).
- `web/src/components/TransactionFilters.tsx` (new)
  - Pillar select; **dependent** sub-category select; month/range control; type
    toggle; "Needs review" toggle; search input (debounced); sort select; Clear.
  - On change, writes the new query string via `router.replace(...)` (no scroll).
- `web/src/app/transactions/page.tsx` (new)
  - `useSearchParams()` → `parseFilter` → `applyFilter(transactions, filter)` →
    `<TransactionFilters/>` + `<TransactionTable/>`. Handles empty/no-data states.
- `web/src/app/review/page.tsx` → becomes a small redirect to
  `/transactions?review=1` (or is removed and a `redirects()` entry added in
  `next.config.ts`). Default: a client redirect component for simplicity.

### Dashboard entry points (`app/dashboard/page.tsx`, `components/DashboardCharts.tsx`)
- `PillarPie` slices: `onClick` → navigate `/transactions?pillar=<Fixed Needs|
  Variable Wants>&<current month params>`.
- Budget breakdown table: **Needs** and **Wants** rows become clickable (link to
  the matching pillar + month). The **Savings** row is **not** clickable — savings
  is `Income − Spending`, so it has no transactions; show a small muted hint
  (tooltip/`title`) instead.
- `SubBars` rows: `onClick` → `/transactions?sub=<name>&<month>`.
- The "transfers excluded" flow note links to `/transactions?type=transfer&<month>`.
- Add affordances: pointer cursor + subtle hover; a short "tap to view entries"
  caption near the charts.
- Charts pass a click handler down; navigation uses `next/navigation` `useRouter`.

## Data flow

```
URL query params
  → parseFilter()            (lib/filters.ts)
  → applyFilter(transactions, filter)   (pure: filter + sort)
  → TransactionTable rows
Inline edit → store.setCategory / bulkSetCategory  (existing)
  → transactions update → re-filter live (a row may drop out of the
    current filter, which is expected, clear feedback)
Dashboard click → router.push("/transactions?...") → page re-parses params
```

## States & behavior

- **Live re-filter on edit:** when a row's category changes so it no longer
  matches the active filter, it leaves the list. This is intended feedback; a
  result count ("N transactions · S$X total") sits above the table.
- **Empty results:** "No transactions match these filters." + a Clear button.
- **No data imported:** existing empty state (import prompt).
- **Savings drill:** non-clickable with an explanatory hint.
- **Mobile:** filter controls wrap; table keeps its horizontal scroll.
- **i18n:** new keys for filter labels, type/sort options, result count, and the
  empty state, in `lib/i18n.tsx` (en + zh). Category/sub values stay canonical
  English (consistent with the existing approach).

## Edge cases

- `sub` provided without a matching `pillar` → infer pillar from the sub; if the
  sub is invalid, ignore it.
- `month` + `from`/`to` both present → `month` wins.
- Unknown enum values → dropped.
- A `Transfer` row shown under a sub filter: transfers have their own subs
  (Savings/Investment, Personal Transfer, …) so they're reachable via `type` or
  `sub`, not via the Needs/Wants pie.
- Search matches the normalized description and the derived merchant key,
  case-insensitive.

## Testing

- Unit: `applyFilter` — pillar filter, sub filter, month, type, review preset,
  search, and each sort order, against the sample dataset.
- e2e (Playwright): import demo → Dashboard pie slice click deep-links to a
  pre-filtered Transactions page; "Needs review" preset shows only `default`
  rows; sub-category bar click filters; search narrows; inline recategorize works
  and updates the list. Assert 0 console errors.
- Re-run the existing build/lint/typecheck gates.

## Affected files (summary)

- New: `lib/filters.ts`, `components/TransactionTable.tsx`,
  `components/TransactionFilters.tsx`, `app/transactions/page.tsx`.
- Changed: `app/review/page.tsx` (→ redirect), `app/page.tsx` (CTA target),
  `app/dashboard/page.tsx` + `components/DashboardCharts.tsx` (clickable),
  `components/AppShell.tsx` (nav target/label), `lib/i18n.tsx` (new keys).
- Keep `lib/selectors.ts` as the source of range/aggregation helpers (reused).

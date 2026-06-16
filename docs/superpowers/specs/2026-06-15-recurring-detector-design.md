# Design: Recurring & subscriptions detector

Date: 2026-06-15
Status: Approved (design) — pending spec review before implementation planning.

## Problem

The app has no way to surface **recurring charges** — subscriptions (Netflix,
Spotify), bills (telco, insurance, utilities), and frequently-visited merchants.
This is a headline feature in comparable products (Copilot/Monarch recurring &
subscriptions; Actual "schedules"; YNAB "true expenses"). The data clearly
contains them: in the real OCBC export, e.g. `SINGTEL PREPAID` ($15 × 6 months),
`AIA` insurance ($181 × 6 months), `STARHUB` ($29.55 × 5 months).

## Goal

A read-only **Recurring** view that detects and groups repeating spending:

1. **Subscriptions & bills** — stable amount, ~monthly cadence.
2. **Frequent merchants** — recurs across months but the amount varies.

For each item show: name, category, average amount, cadence, charge count,
months active, last charge, **next expected date**, and total spent. Tapping an
item drills into its transactions. A Dashboard card summarizes the estimated
monthly commitment and links to the page.

## Non-goals (YAGNI)

- Recurring **transfers / savings / income** (v1 is spending only).
- Editable schedules, reminders/notifications, or "mark as cancelled".
- A persisted "ignore this item" list (we chose drill-in + next-date instead).
- Predicting price changes.

## Architecture

### New / changed modules
- `web/src/lib/recurring.ts` (new) — pure detection logic.
  - `RecurringItem` type and `RecurringGroups` (subscriptions[], frequent[]).
  - `detectRecurring(transactions): RecurringGroups`.
  - `monthlyCommitment(groups): number` — sum of subscription average amounts.
  - No persisted state; computed from the store on demand.
- `web/src/app/recurring/page.tsx` (new) — renders the two sections + header.
- `web/src/components/RecurringCard.tsx` (new) — one recurring item row/card with
  a drill-in link to `/transactions?q=<merchantKey>`.
- `web/src/components/RecurringSummaryCard.tsx` (new) — small Dashboard card.
- `web/src/app/dashboard/page.tsx` (modify) — render the summary card.
- `web/src/components/AppShell.tsx` (modify) — add a "Recurring" nav item.
- `web/src/lib/i18n.tsx` (modify) — new keys (en + zh).
- `web/src/lib/demo.ts` (modify) — extend the demo dataset (see "Demo data").

### Detection algorithm (`detectRecurring`)

Input: the store's `transactions`. Steps:

1. **Filter to spending** (`isSpending(pillar)` — exclude `Transfer`).
2. **Group by `merchantKey`** (fallback: first 24 chars of normalized
   description when `merchantKey` is empty).
3. **Qualify**: keep groups present in **≥ `MIN_MONTHS` (= 3)** distinct months.
4. For each qualifying group compute:
   - `count` (# charges), `monthsActive` (# distinct YYYY-MM), `total`, `avg`.
   - **amount stability**: `spread = (max - min)`; treat as **stable** when
     `spread <= max(1.0, avg * 0.10)` (within $1 or 10% of the average).
   - **cadence**: sort charge dates; take the **median gap** in days between
     consecutive charges → `"Monthly"` (gap 24–38), `"Weekly"` (5–10),
     `"Fortnightly"` (11–18), else `"Irregular"`.
   - **lastCharge** = max date; **nextExpected** = lastCharge + medianGap days
     (rounded), formatted `YYYY-MM-DD`; omit when cadence is `"Irregular"`.
   - `pillar`, `sub` from the most recent charge (categories may have been edited).
   - `name` = prettified merchant key (title-cased words, collapse runs).
5. **Classify**: a group is a **subscription/bill** when `stable === true` AND
   cadence is `Monthly`/`Fortnightly`/`Weekly` AND `count / monthsActive <= 1.5`
   (about one charge per active month). Otherwise it is a **frequent merchant**.
6. **Sort** each list by `total` desc. Return `{ subscriptions, frequent }`.

`monthlyCommitment(groups)` = sum of `avg` over `subscriptions` (the recurring
monthly outflow estimate). Used by the page header and the Dashboard card.

Tunable constants live at the top of the file: `MIN_MONTHS = 3`,
`STABILITY_RATIO = 0.10`, `STABILITY_FLOOR = 1.0`.

### Drill-in
Reuses the existing transactions filter: a recurring item links to
`/transactions?q=<merchantKey>` (the `q` search already matches description +
merchant key — see `lib/filters.ts`). No new filter param needed.

## Screens

### `/recurring` page
- Title + subtitle; a header stat: **"~S$X / month"** (monthly commitment) and a
  count of detected subscriptions.
- **Section 1 — Subscriptions & bills**: list of `RecurringCard`s. Each shows
  name, category badge, **avg amount** (prominent), cadence, "next ~ <date>",
  `count` charges over `monthsActive` months, and total. Whole card links to
  `/transactions?q=<merchantKey>`.
- **Section 2 — Frequent merchants**: same card, amount shown as a range
  (`min–max`) with the average; no "next" when irregular.
- **Empty state**: when both lists are empty → a friendly message + a link to
  import or to `/transactions`. Shown when no data, or data spans < 3 months.

### Dashboard `RecurringSummaryCard`
- Compact card: "Recurring" · `N` subscriptions · **~S$X/mo**, links to
  `/recurring`. Hidden when there are no subscriptions detected. Placed in the
  summary area of the dashboard (after the existing cards / flow).

## Demo data

The current demo (`demo.ts`) spans only **two months** with **no repeating
merchants**, so the detector would find nothing on "Try demo data." Extend the
demo to **three months** (add an earlier month) and make a few merchants repeat
across all three so they cross `MIN_MONTHS`:
- A stable subscription (e.g. `SPOTIFY` ~10.98) in each month → subscription.
- A stable bill (e.g. `SINGTEL` ~15.00) in each month → subscription.
- A variable but frequent merchant (e.g. a grocery/transport payee) across the
  three months → frequent merchant.
Keep the existing single-month rows so the rest of the app still demos well.
Salary/income rows for each month so the dashboard stays meaningful.

## i18n keys (en + zh)

Add: `nav.recurring`, `recurring.title`, `recurring.subtitle`,
`recurring.monthlyCommitment` ("~{amount} / month"), `recurring.subsCount`
("{n} subscriptions"), `recurring.sectionSubs` ("Subscriptions & bills"),
`recurring.sectionFrequent` ("Frequent merchants"), `recurring.cadence.Monthly`
/ `.Weekly` / `.Fortnightly` / `.Irregular`, `recurring.nextExpected`
("Next ~ {date}"), `recurring.chargesOverMonths` ("{count} charges · {months}
months"), `recurring.total` ("Total {amount}"), `recurring.empty` (needs ≥ 3
months of data), `dash.recurringCard` ("Recurring"). Category/sub values stay
canonical English (existing convention).

## States & edge cases

- **< 3 months of data** → both lists empty → page shows the empty state; the
  Dashboard card is hidden.
- **merchantKey collisions** (different payees mapped to the same cleaned key):
  acceptable; they aggregate together, consistent with how learning already works.
- **Category edited after import**: the item's `pillar`/`sub` reflect the most
  recent charge, so edits show through.
- **Single charge in a month vs multiple**: `count/monthsActive` guards against a
  high-frequency merchant (e.g. daily coffee) being mislabeled a subscription.
- **Irregular cadence**: no "next expected" shown.
- **Live updates**: page derives from the store via `useMemo`; recategorizing a
  row elsewhere updates the lists on next visit/render.

## Testing

- **Unit** (`web/scripts/test-recurring.ts`, tsx asserts):
  - stable monthly group (3+ months) → classified subscription; cadence Monthly;
    nextExpected = last + ~30d.
  - variable group (3+ months) → frequent merchant.
  - group in only 2 months → excluded.
  - high-frequency stable (e.g. 8 charges over 3 months) → frequent (not sub).
  - `monthlyCommitment` sums subscription averages.
- **e2e** (`web/scripts/e2e-recurring.ts`, Playwright): import demo → open
  `/recurring` → assert ≥ 1 subscription card and the monthly-commitment header;
  click a card → URL becomes `/transactions?q=<key>` with rows; assert 0 console
  errors.
- Re-run `tsc --noEmit`, `npm run lint`, `npm run build`.

## Affected files (summary)

- New: `lib/recurring.ts`, `app/recurring/page.tsx`,
  `components/RecurringCard.tsx`, `components/RecurringSummaryCard.tsx`,
  `scripts/test-recurring.ts`, `scripts/e2e-recurring.ts`.
- Modified: `app/dashboard/page.tsx`, `components/AppShell.tsx`, `lib/i18n.tsx`,
  `lib/demo.ts`.
- Reused as-is: `lib/filters.ts` (search drill-in), `lib/selectors.ts`,
  `lib/store.ts`, `lib/taxonomy.ts`, `lib/utils.ts`.

## Notes to preserve

- Web app stays **100% client-side**; no new persisted state, no network.
- Keep EN/中文 parity (ZH object is typed `Record<keyof typeof EN, string>`).
- This is web-app only; the Python generator is unaffected.

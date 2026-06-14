# Roadmap — Money Tracker

Planned enhancements for the `web/` app (and repo). Each item notes **what**,
**why**, an **approach**, rough **effort**, and **dependencies**.

> **Status: all 8 roadmap items are now ✅ DONE.** (#8 data-model rethink, #6
> visual redesign → Apple, #7 upload feedback, #2 dark mode, #1 Chinese i18n, #4
> logo/icons, #3 mobile/PWA, #5 repo README.) The Python generator was also synced
> to the new savings/transfer model. Remaining optional polish is noted inline
> (e.g. a service worker for full offline caching, and README screenshots).

---

## P0 — Data model & presentation rethink (pairs with the redesign)

### 8. Reconsider "Future Savings" and how spending is presented

**Problem.** "Future Savings" always shows ~0% because it is **not a spending
category**. A bank statement lists money *leaving* as withdrawals; savings is
either (a) the money you simply *didn't* spend, or (b) money **transferred** to a
savings/investment account — which is an internal transfer, not an expense.
Presenting savings next to Needs/Wants mixes two different concepts (a *spending*
breakdown vs a *budget allocation*), which is confusing and makes the chart look
broken.

**Research / best practice.**
- The **50/30/20 rule** treats savings as a **20% allocation of net income**, set
  aside — *not* a spend bucket. Savings is an **outcome**, not a category.
- "**Pay yourself first**" / cash-flow budgeting frames money as a **flow**:
  `Income → Spending (by category) → what's left = Savings`.
- The popular Reddit **cash-flow (Sankey) diagrams** visualize exactly this:
  income on the left flows into taxes, savings/investments, and spending
  categories — far clearer for "where did my money go" than a pie of withdrawals.
- Good trackers also separate **transaction types**: Income, Spending, and
  **Transfers** (to own accounts / to people), so internal moves don't inflate
  "spending."

**Recommended approach (default if no other direction given).**
1. **Drop "Future Savings" as a spending pillar.** Spending = **Needs vs Wants**
   only. Keep the 3-bucket *names* out of the spend breakdown.
2. **Introduce transaction types** at parse time:
   - `income` (salary, refunds) — already detected.
   - `spending` (Needs / Wants) — the real expense rows.
   - `transfer` / `savings-investment` — money to your own savings/investment
     accounts or P2P transfers; **excluded from spending totals**, shown
     separately so they don't distort the picture.
   - `uncategorized` — review queue (today's "auto-default").
3. **Show a headline `Savings Rate`** = `(Income − Spending) / Income`, plus
   Income / Spent / Saved cards. This makes savings a first-class outcome without
   a fake pillar.
4. **Add a cash-flow / Sankey "Where your money went" view** (income → big
   buckets → categories). Recharts lacks a Sankey out of the box; options:
   `recharts` Sankey (experimental), `@nivo/sankey`, or `d3-sankey`.
5. **Re-architect categories for clarity** (see below).

**Category architecture options (pick one during design):**
- **A. Two-tier essentials model (recommended):** top level = **Essential vs
  Discretionary** (clearer than "Needs/Wants" for some users), each with rich
  sub-categories (Housing, Transport, Food, Subscriptions, Shopping, Health,
  etc.). Drill-down from group → sub.
- **B. Flat rich categories** (~12–15) with smart grouping in the UI, plus tags
  (recurring vs one-off, essential vs nice-to-have).
- **C. Keep Needs/Wants** but add a **Transfers/Savings** *type* outside spending.

**Better "where did it go" presentations to add:**
- **Sankey / flow** (headline view).
- **Treemap** for proportional spend (area = amount) — great at a glance.
- **Top merchants** and **recurring vs one-off** split (surfaces subscriptions).
- **Month-over-month deltas** ("Dining up $80 vs last month").
- **Per-category trend** sparklines.

**Migration / compatibility notes.**
- Keep the taxonomy as a single source of truth shared with `build_tracker.py`;
  if categories change, update **both** and regenerate the workbook + re-run the
  parity test.
- Savings-rate and transaction-type logic should live in `lib/selectors.ts` /
  `lib/categorize.ts` so the Excel export can mirror it.
- Make transaction **type** user-editable in Review (so a P2P transfer can be
  marked "transfer" and excluded, or "spending" if it really was a shared bill).

**Effort:** M–L (data model + new charts + review UI for types).
**Dependencies:** Product decision on the category model (A/B/C). Pairs with #6.
**Status:** ✅ **DONE in the web app** (`web/`). Implemented the recommended default:
dropped "Future Savings" as a spend pillar; added a **Transfer** type (savings/
investment + P2P, auto-detected, excluded from spending and editable in Review);
**50/30/20 now computed as a share of income** with **Savings = Income − Spending**;
added Savings-Rate card + a **"Where your income went"** flow bar. Result on the
sample data: 77 rows reclassified as transfers and "need review" dropped 135 → 58.
The **Python generator (`build_tracker.py`) still uses the legacy 3-bucket model** —
a follow-up if you want the Excel output to match.

---

## P0 — Visual redesign (do early; most things inherit from it)

### 6. New visual design — ✅ DONE (Apple-inspired)
Re-skinned to an **Apple-inspired** theme (iOS grouped-card look): parchment page,
white rounded cards, single Action-Blue accent, SF Pro system font, iOS system
semantic + chart colors, pill buttons, lighter (semibold) headings. Implemented by
remapping the centralized theme tokens in `web/src/app/globals.css` plus the chart
palette; the Excel generator was given a matching palette too.

### 6. New visual design
_(Historical detail — implemented as the Apple-inspired theme above.)_

---

## P1 — Quick UX wins

### 7. Upload feedback / "what's next" affordance — ✅ DONE
Added a parsing spinner, a success banner ("Imported N transactions"), a
next-steps **stepper** (Imported ✓ → Review → Dashboard), a **pulsing primary
CTA**, and auto-scroll to the summary.

### 2. Dark mode toggle — ✅ DONE
Dark token set (iOS dark surfaces) overriding the theme variables, a header
toggle that persists to localStorage, a pre-paint script to avoid a flash, and
chart axis/gridline colors that read in both themes.

---

## P2 — Internationalization

### 1. Chinese language support (中文) — ✅ DONE
Added a lightweight i18n (`src/lib/i18n.tsx`) using an external store
(`useSyncExternalStore`, hydration-safe, no provider) with `en`/`zh`
dictionaries, a header EN/中 toggle (persisted; defaults from the browser), and
localized strings across the shell, import, dashboard, review, settings, and
export. Category/sub-category **values** stay canonical English internally
(budget bucket labels Needs/Wants/Savings are translated for display) so
categorization logic and exports remain intact.

---

## P3 — Mobile & installable app

### 3. Mobile optimization + iOS Safari "Add to Home Screen" — ✅ DONE (core)
Added a web manifest (`app/manifest.ts`, standalone display, icons), Apple web-app
meta + theme-color + `viewport-fit: cover`, and a full icon set (favicon,
apple-touch, PWA 192/512 + maskable) generated by `scripts/gen_icons.py`.
Responsive layout verified at phone width (nav collapses to icons, content
stacks). _Optional later:_ a service worker for full offline app-shell caching.

### 4. Project logo / app icons — ✅ DONE
A simple Apple-style mark (Action-Blue rounded tile with three ascending white
bars) generated at all required sizes (favicon, 180 apple-touch, 192/512 PWA, and
a maskable 512) via `scripts/gen_icons.py`, wired through the Next icon
conventions and the manifest.

---

## P4 — Documentation

### 5. Proper repo README
- **What:** A top-level `README.md` for the whole project (currently only
  `web/README.md` and `.github/copilot-instructions.md` exist).
- **Why:** Front door for the repo: what it is, the two implementations
  (Python generator + web app), privacy stance, screenshots, and deploy.
- **Approach:**
  - Root `README.md`: overview, features, screenshots/GIF, the Python vs web
    paths, "your data stays local" note, links to `web/README.md` and deploy steps.
  - Add screenshots once #6 lands so they reflect the final look.
- **Effort:** S.
- **Dependencies:** #6 (for accurate screenshots).
- **Status:** ✅ Root `README.md` written (overview, both implementations, privacy
  stance, features, run/deploy, layout). **Screenshots deferred** until after the
  visual redesign (#6).

---

## Status

All items above are implemented. Post-roadmap features:
- Category drill-down: unified filterable `/transactions` page with clickable
  Dashboard entry points (spec: `docs/superpowers/specs/2026-06-14-transactions-drilldown-design.md`,
  plan: `docs/superpowers/plans/2026-06-14-transactions-drilldown.md`).

Optional follow-ups if desired later:
- Service worker for full offline app-shell caching (PWA already installable).
- README screenshots (light/dark) now that the design is settled.
- Deeper i18n: translate category/sub-category display labels (values stay English).

## Notes / constraints to preserve
- Keep the app **100% client-side** (no backend); financial data must never be
  uploaded or committed (`.gitignore` already protects the CSV/xlsx).
- Keep `web/src/lib/taxonomy.ts` aligned with the Python `build_tracker.py`
  categories/targets; exports should stay in canonical English regardless of UI
  language.
- Re-run the parity test (`web/scripts/smoke-parse.ts`) and Playwright e2e after
  structural changes.

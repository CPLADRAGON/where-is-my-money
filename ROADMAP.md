# Roadmap — Money Tracker

Planned enhancements for the `web/` app (and repo). Ordered by recommended
sequence. Each item notes **what**, **why**, an **approach**, rough **effort**,
and **dependencies**.

> Suggested order rationale: do the **visual redesign (#6) first** because the
> logo (#4), dark mode (#2), and upload feedback (#7) all inherit from the chosen
> look. Then ship the quick UX wins, then i18n, PWA, and docs.
>
> **Note:** Item **#8 (data-model / presentation rethink)** is arguably the most
> important and pairs naturally with the redesign (#6), since it changes what the
> dashboard shows. It needs a product decision — see its section for options.

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

### 7. Upload feedback / "what's next" affordance
- **What:** Clear visual feedback after a CSV is parsed so the next steps are obvious.
- **Why:** Right now the summary card appears but the path forward can be missed.
- **Approach:**
  - Add a parsing state (spinner/skeleton) while the file is read.
  - Success toast + a prominent "stepper" (Import → Review → Dashboard) showing
    progress, with a pulsing primary CTA to the next step.
  - If rows need review, surface the count as a badge on the Review nav item
    (already partly done) and auto-scroll to the summary card.
  - Consider a confetti/checkmark micro-animation on first successful import.
- **Effort:** S.
- **Dependencies:** Visual language from #6 (can be done independently if needed).

### 2. Dark mode toggle
- **What:** Light/dark switch, persisted, respecting `prefers-color-scheme`.
- **Why:** Comfort + expected modern UX.
- **Approach:**
  - Add a `data-theme` (or `.dark`) attribute on `<html>`; define a dark token set
    in `globals.css` mirroring the light `@theme` variables (surfaces, ink,
    hairlines, semantic colors, chart palette).
  - Toggle component in `AppShell` header; persist choice (localStorage or the
    existing Zustand/IndexedDB store) and apply before paint to avoid a flash
    (inline script in `layout.tsx`).
  - Verify Recharts colors and the share-card themes work in both modes.
- **Effort:** S–M.
- **Dependencies:** #6 (final palette).

---

## P2 — Internationalization

### 1. Chinese language support (中文)
- **What:** English/Chinese toggle in the header, persisted.
- **Why:** Bilingual usability.
- **Approach:**
  - Introduce lightweight i18n. Options: `next-intl` (App-Router native) or a tiny
    in-house dictionary + React context (sufficient for a small UI). Recommend a
    simple `messages/en.json` + `messages/zh.json` + a `useT()` hook to avoid heavy
    deps for a client-only app.
  - Extract all UI strings (currently inline) into the dictionaries. Keep the
    **taxonomy/category names** as stable keys internally; show localized **labels**
    in the UI while storing canonical English in data/exports (so categorization
    logic and `.xlsx` parity stay intact).
  - Localize dates/numbers via `Intl` (already used in `utils.ts`); add a locale
    param.
  - Persist language choice; default from the browser.
- **Effort:** M (mostly string extraction).
- **Dependencies:** None hard; easier after #6 so new UI is translated once.

---

## P3 — Mobile & installable app

### 3. Mobile optimization + iOS Safari "Add to Home Screen"
- **What:** First-class mobile layout and an installable PWA (esp. iPhone Safari).
- **Why:** Most people check finances on their phone; home-screen launch feels native.
- **Approach:**
  - Audit responsive breakpoints (tables → stacked cards on small screens; the
    Review table and Dashboard charts need mobile variants; bottom-nav on mobile).
  - Add a **web app manifest** (`app/manifest.ts` in Next 16) with name,
    theme/background color, display `standalone`, and icons.
  - Add iOS-specific bits: `apple-touch-icon`, `apple-mobile-web-app-capable`,
    status-bar style, and a splash/title via metadata.
  - Optional offline: a service worker (or `@ducanh2912/next-pwa`) so the app shell
    loads offline — fits the "100% client-side" model well. Validate Safari quirks
    (IndexedDB persistence, safe-area insets, momentum scroll).
- **Effort:** M.
- **Dependencies:** #4 (icons), #6 (theme colors for manifest/status bar).

### 4. Project logo / app icons
- **What:** A distinctive logo + full icon set (favicon, PWA icons, Apple touch icon).
- **Why:** Needed for the home-screen install (#3) and overall identity.
- **Approach:**
  - Design a simple, scalable mark (wallet/coin/“M” motif) as SVG; generate PNGs
    at required sizes (180 apple-touch, 192/512 maskable PWA, favicon).
  - Keep it legible at 16px and on a colored tile; provide light/dark variants.
  - Drop into `web/public/` and wire via `app/icon`/`apple-icon` conventions and
    the manifest.
- **Effort:** S–M.
- **Dependencies:** #6 (visual direction). Feeds #3.

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

## Suggested sequencing

1. **#8 Data-model / presentation rethink** + **#6 Visual redesign** (do together —
   they reshape the dashboard and unblock the rest)
2. **#7 Upload feedback** + **#2 Dark mode** (quick wins in the new style)
3. **#4 Logo/icons** → **#3 Mobile/PWA + Add to Home Screen**
4. **#1 Chinese i18n**
5. **#5 Root README** (with final screenshots)

## Notes / constraints to preserve
- Keep the app **100% client-side** (no backend); financial data must never be
  uploaded or committed (`.gitignore` already protects the CSV/xlsx).
- Keep `web/src/lib/taxonomy.ts` aligned with the Python `build_tracker.py`
  categories/targets; exports should stay in canonical English regardless of UI
  language.
- Re-run the parity test (`web/scripts/smoke-parse.ts`) and Playwright e2e after
  structural changes.

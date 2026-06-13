# Roadmap — Money Tracker

Planned enhancements for the `web/` app (and repo). Ordered by recommended
sequence. Each item notes **what**, **why**, an **approach**, rough **effort**,
and **dependencies**.

> Suggested order rationale: do the **visual redesign (#6) first** because the
> logo (#4), dark mode (#2), and upload feedback (#7) all inherit from the chosen
> look. Then ship the quick UX wins, then i18n, PWA, and docs.

---

## P0 — Visual redesign (do first; everything else inherits from it)

### 6. New visual design
- **What:** Replace the current Wise-inspired theme with a look you actually like.
- **Why:** Current design is not to taste; the logo, dark palette, and component
  styling all depend on this decision, so settling it first avoids rework.
- **Approach:**
  - Pick a direction first (mood: minimal / playful / premium-fintech / editorial;
    light or dark default; accent color). Browse `VoltAgent/awesome-design-md`
    again or share references/screenshots.
  - Theme is centralized in `web/src/app/globals.css` (`@theme` tokens: colors,
    radius, shadows, fonts) and a tiny UI kit (`Button`, `Card`, `Badge`,
    `Select`). Re-skinning means editing tokens + those components — pages mostly
    use semantic classes, so the blast radius is small.
  - Update chart colors in `web/src/lib/taxonomy.ts` (`PILLAR_COLORS`) and
    `DashboardCharts.tsx` to match.
- **Effort:** M (1 token/design pass + component polish).
- **Dependencies:** Needs a design decision from you. Blocks #2, #4, and ideally #7.

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

---

## Suggested sequencing

1. **#6 Visual redesign** (unblocks the rest)
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

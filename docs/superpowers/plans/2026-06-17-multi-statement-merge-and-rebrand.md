# Multi-Statement Merge + Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the app to "Where's My Money?" / "花哪了" and let users import multiple bank statements that merge (de-duplicated) into one dataset.

**Architecture:** Income deposits get fingerprinted in the parser so they can be de-duplicated like transactions. The store gains a `mergeData` action that unions transactions and income deposits by their deterministic ids. The import page parses N files, then replaces-or-merges and reports added/skipped counts.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind v4, Zustand + idb-keyval, Recharts. Tests are `tsx` scripts run via `npx tsx` (unit) and Playwright (e2e). Working dir for all commands: `web/`.

---

## Task 1: Fingerprint income deposits in the parser

**Files:**
- Modify: `web/src/lib/types.ts`
- Modify: `web/src/lib/banks/index.ts:36-123`
- Test: `web/scripts/test-merge.ts` (created here, expanded later)

- [ ] **Step 1: Add the `IncomeDeposit` type and extend `ParseResult`**

In `web/src/lib/types.ts`, add after `IncomeByMonth`:

```ts
/** A fingerprinted income (salary) deposit, used to de-duplicate on merge. */
export interface IncomeDeposit {
  id: string;
  month: string;
  amount: number;
}
```

And add to the `ParseResult` interface (after `months: string[];`):

```ts
  /** Fingerprinted salary deposits (for income de-dup on merge). */
  incomeDeposits: IncomeDeposit[];
```

- [ ] **Step 2: Emit `incomeDeposits` from `buildParseResult`**

In `web/src/lib/banks/index.ts`, add `IncomeDeposit` to the type import:

```ts
import type { IncomeDeposit, ParseResult, Transaction } from "../types";
```

Inside `buildParseResult`, declare the deposit collector + a separate seen-map near the other locals:

```ts
  const incomeDeposits: IncomeDeposit[] = [];
  const seenIncome = new Map<string, number>();
```

Replace the income branch:

```ts
    if (row.income > 0 && row.spend === 0) {
      if (incomeRe.test(row.description)) {
        incomeByMonth[month] = (incomeByMonth[month] ?? 0) + row.income;
      }
      continue;
    }
```

with:

```ts
    if (row.income > 0 && row.spend === 0) {
      if (incomeRe.test(row.description)) {
        incomeByMonth[month] = (incomeByMonth[month] ?? 0) + row.income;
        const baseKey = `${row.date}|${row.income.toFixed(2)}|${row.description}`;
        const k = seenIncome.get(baseKey) ?? 0;
        seenIncome.set(baseKey, k + 1);
        const depId = hash(k === 0 ? baseKey : `${baseKey}#${k}`);
        incomeDeposits.push({ id: depId, month, amount: row.income });
      }
      continue;
    }
```

Add `incomeDeposits` to the returned object (next to `incomeByMonth`):

```ts
  return {
    transactions,
    incomeByMonth,
    incomeDeposits,
    months,
    bankId,
    bankLabel,
    stats: { /* unchanged */ },
  };
```

- [ ] **Step 3: Write the parser test**

Create `web/scripts/test-merge.ts`:

```ts
import { parseDetected } from "../src/lib/banks";
import { DEMO_CSV } from "../src/lib/demo";

let pass = 0, fail = 0;
function eq(actual: unknown, expected: unknown, msg: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? "PASS" : "FAIL", "-", msg);
  if (ok) pass++;
  else fail++;
}

// Parsing the same text twice yields identical, stable income-deposit ids.
const a = parseDetected(DEMO_CSV);
const b = parseDetected(DEMO_CSV);
eq(
  a.incomeDeposits.map((d) => d.id),
  b.incomeDeposits.map((d) => d.id),
  "income deposit ids are stable across parses"
);
eq(a.incomeDeposits.length > 0, true, "demo CSV produces at least one income deposit");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 4: Run the test**

Run: `cd web; npx tsx scripts/test-merge.ts`
Expected: PASS on both assertions, exit 0.

- [ ] **Step 5: Typecheck**

Run: `cd web; npx tsc --noEmit`
Expected: no errors (every `ParseResult` literal now needs `incomeDeposits` — only `buildParseResult` builds one, so this should pass; if another literal exists, add `incomeDeposits: []`).

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/types.ts web/src/lib/banks/index.ts web/scripts/test-merge.ts
git commit -m "feat(import): fingerprint income deposits for merge de-dup"
```

---

## Task 2: Store — `incomeDeposits` state, `mergeData`, income recompute

**Files:**
- Modify: `web/src/lib/store.ts`
- Test: `web/scripts/test-merge.ts`

- [ ] **Step 1: Add the failing test for merge de-dup**

Append to `web/scripts/test-merge.ts` (before the final summary block). This drives the
store helpers directly by importing them; to keep the store out of React, test the
pure merge helpers, which Task 2 Step 3 will export from a new `lib/merge.ts`.

```ts
import { mergeTransactions, recomputeIncome } from "../src/lib/merge";
import type { Transaction } from "../src/lib/types";

function tx(id: string, month: string, sub = "Shopping"): Transaction {
  return {
    id, date: `${month}-05`, month, description: id, merchantKey: id,
    amount: 10, pillar: "Variable Wants", sub, provenance: "rule",
  };
}

// Union by id: overlap deduped, distinct kept.
const existing = [tx("a", "2026-05"), tx("b", "2026-05")];
const incoming = [tx("b", "2026-05"), tx("c", "2026-06")];
const merged = mergeTransactions(existing, incoming);
eq(merged.map((t) => t.id).sort(), ["a", "b", "c"], "transactions union by id");

// Income recompute groups by month and de-dups by deposit id.
const deposits = { d1: { month: "2026-05", amount: 3000 }, d2: { month: "2026-06", amount: 3200 } };
eq(recomputeIncome(deposits), { "2026-05": 3000, "2026-06": 3200 }, "income recompute by month");
const withDup = { ...deposits, d1b: { month: "2026-05", amount: 3000 } };
eq(recomputeIncome({ d1: deposits.d1, d1b: withDup.d1b })["2026-05"], 6000, "distinct deposit ids sum");
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd web; npx tsx scripts/test-merge.ts`
Expected: FAIL — `Cannot find module '../src/lib/merge'`.

- [ ] **Step 3: Create the pure merge helpers**

Create `web/src/lib/merge.ts`:

```ts
import type { IncomeByMonth, Transaction } from "./types";

/** Union two transaction lists by stable id; existing rows win on collision. */
export function mergeTransactions(
  existing: Transaction[],
  incoming: Transaction[]
): Transaction[] {
  const byId = new Map<string, Transaction>();
  for (const t of existing) byId.set(t.id, t);
  for (const t of incoming) if (!byId.has(t.id)) byId.set(t.id, t);
  return Array.from(byId.values());
}

/** Sum unique income deposits per month. */
export function recomputeIncome(
  deposits: Record<string, { month: string; amount: number }>
): IncomeByMonth {
  const out: IncomeByMonth = {};
  for (const { month, amount } of Object.values(deposits)) {
    out[month] = (out[month] ?? 0) + amount;
  }
  return out;
}

/** Sorted unique union of month strings. */
export function mergeMonths(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b])).sort();
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd web; npx tsx scripts/test-merge.ts`
Expected: PASS on all assertions.

- [ ] **Step 5: Wire the helpers + new state into the store**

In `web/src/lib/store.ts`:

Add imports:

```ts
import { mergeTransactions, recomputeIncome, mergeMonths } from "./merge";
import type { IncomeByMonth, IncomeDeposit, ParseResult, Transaction } from "./types";
```

Add to `AppState` (after `targets`):

```ts
  /** Union of imported salary deposits, keyed by deposit id. */
  incomeDeposits: Record<string, { month: string; amount: number }>;
```

Add to the action signatures (after `importData`):

```ts
  mergeData: (result: ParseResult) => void;
```

Add to the initial state (after `targets: { ...TARGETS },`):

```ts
      incomeDeposits: {},
```

Add a module-level helper (near `recategorize`):

```ts
function depositsToMap(deposits: IncomeDeposit[]): Record<string, { month: string; amount: number }> {
  return Object.fromEntries(deposits.map((d) => [d.id, { month: d.month, amount: d.amount }]));
}
```

Replace `importData` with the deposit-aware version:

```ts
      importData: (result) =>
        set((s) => {
          const transactions = result.transactions.map((t) => recategorize(t, s));
          const incomeDeposits = depositsToMap(result.incomeDeposits);
          return {
            transactions,
            months: result.months,
            bankLabel: result.bankLabel,
            incomeDeposits,
            detectedIncome: recomputeIncome(incomeDeposits),
          };
        }),
```

Add `mergeData` right after `importData`:

```ts
      mergeData: (result) =>
        set((s) => {
          const next = { ...s };
          const unioned = mergeTransactions(s.transactions, result.transactions);
          const transactions = unioned.map((t) => recategorize(t, next));
          const incomeDeposits = { ...s.incomeDeposits, ...depositsToMap(result.incomeDeposits) };
          const bankLabel =
            !s.bankLabel
              ? result.bankLabel
              : s.bankLabel === result.bankLabel
              ? s.bankLabel
              : "Multiple sources";
          return {
            transactions,
            months: mergeMonths(s.months, result.months),
            bankLabel,
            incomeDeposits,
            detectedIncome: recomputeIncome(incomeDeposits),
          };
        }),
```

In `clearAll`, add `incomeDeposits: {},` to the reset object.

- [ ] **Step 6: Typecheck + commit**

Run: `cd web; npx tsx scripts/test-merge.ts` (PASS), then `npx tsc --noEmit` (clean).

```bash
git add web/src/lib/merge.ts web/src/lib/store.ts web/scripts/test-merge.ts
git commit -m "feat(store): mergeData + income de-dup via incomeDeposits"
```

---

## Task 3: Dropzone accepts multiple files

**Files:**
- Modify: `web/src/components/Dropzone.tsx`

- [ ] **Step 1: Switch to a multi-file `onFiles` API**

Replace the `Dropzone` props and `handleFiles` in `web/src/components/Dropzone.tsx`:

```tsx
export function Dropzone({
  onFiles,
}: {
  onFiles: (files: { text: string; name: string }[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      const files = Array.from(fileList ?? []);
      if (files.length === 0) return;
      const read = await Promise.all(
        files.map(async (f) => ({ text: await f.text(), name: f.name }))
      );
      onFiles(read);
    },
    [onFiles]
  );
```

Add `multiple` to the input:

```tsx
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
```

Update the copy line to use i18n later; for now change the static text to
"Drop one or more bank CSVs here".

- [ ] **Step 2: Typecheck (will fail at the call site)**

Run: `cd web; npx tsc --noEmit`
Expected: FAIL in `app/page.tsx` (`onFile` no longer exists) — fixed in Task 4.

- [ ] **Step 3: Commit (deferred)** — commit together with Task 4 since the call site must change.

---

## Task 4: Import page — multi-file parse, merge/replace, summary

**Files:**
- Modify: `web/src/app/page.tsx`

- [ ] **Step 1: Replace `handleCsv` with multi-file `handleFiles`**

In `web/src/app/page.tsx`, add state for the replace toggle and a merged summary, and
import the store getter + `mergeData`:

```tsx
  const importData = useStore((s) => s.importData);
  const mergeData = useStore((s) => s.mergeData);
  const hasData = useStore((s) => s.transactions.length > 0);
  const [replaceExisting, setReplaceExisting] = useState(false);
```

Change the summary state shape to include merge counts:

```tsx
  const [summary, setSummary] = useState<
    | { added: number; skipped: number; total: number; months: number }
    | null
  >(null);
```

Replace `handleCsv` with:

```tsx
  function handleFiles(files: { text: string; name: string }[]) {
    setError(null);
    setSummary(null);
    setParsing(true);
    setTimeout(() => {
      try {
        const parsed: ParseResult[] = [];
        const unknown: { text: string; name: string }[] = [];
        for (const f of files) {
          try {
            const res = parseDetected(f.text);
            if (res.transactions.length === 0) unknown.push(f);
            else parsed.push(res);
          } catch (e) {
            if (e instanceof Error && e.message === "UNKNOWN_BANK") unknown.push(f);
            else throw e;
          }
        }

        const replace = replaceExisting || !hasData;
        const before = replace ? 0 : useStore.getState().transactions.length;
        const totalParsed = parsed.reduce((n, r) => n + r.transactions.length, 0);

        if (parsed.length > 0) {
          let rest = parsed;
          if (replace) {
            importData(parsed[0]);
            rest = parsed.slice(1);
          }
          for (const r of rest) mergeData(r);

          const state = useStore.getState();
          const after = state.transactions.length;
          const added = after - before;
          setSummary({
            added,
            skipped: Math.max(0, totalParsed - added),
            total: after,
            months: state.months.length,
          });
        }

        if (unknown.length > 0) {
          setPending(unknown[0].text, unknown[0].name);
          router.push("/import/map");
          return;
        }
        if (parsed.length === 0) {
          setError(t("error.read"));
        }
      } catch {
        setError(t("error.read"));
      } finally {
        setParsing(false);
      }
    }, 50);
  }
```

Add the `ParseResult` import:

```tsx
import type { ParseResult } from "@/lib/types";
```

- [ ] **Step 2: Update the JSX — Dropzone prop, replace toggle, demo, summary**

Change `<Dropzone onFile={handleCsv} />` to `<Dropzone onFiles={handleFiles} />`.

Add a replace checkbox just under the Dropzone, shown only when data exists:

```tsx
      {hasData && (
        <label className="flex items-center gap-2 text-sm text-body">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => setReplaceExisting(e.target.checked)}
            className="size-4 accent-[var(--color-primary)]"
          />
          {t("import.replaceExisting")}
        </label>
      )}
```

Change the demo button to wrap its CSV in the multi-file shape and force replace:

```tsx
        <Button variant="secondary" onClick={() => { setReplaceExisting(true); handleFiles([{ text: DEMO_CSV, name: "demo.csv" }]); }}>
```

Replace the existing imported-summary block that reads `summary.stats` with the merged
summary text:

```tsx
      {summary && (
        <Card ref={summaryRef}>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">
              {t("import.mergedSummary", {
                added: summary.added,
                skipped: summary.skipped,
                total: summary.total,
                months: summary.months,
              })}
            </p>
            <Link href="/dashboard">
              <Button>{t("nav.dashboard")} <ArrowRight className="size-4" /></Button>
            </Link>
          </CardBody>
        </Card>
      )}
```

(Keep the existing "needs review" deep-link if present; adapt the surrounding JSX to the new `summary` shape. Remove any references to `summary.stats` / `summary.bank`.)

- [ ] **Step 3: Typecheck + lint**

Run: `cd web; npx tsc --noEmit` then `npm run lint`
Expected: clean. Fix any leftover `summary.stats`/`onFile` references.

- [ ] **Step 4: Commit (Dropzone + page together)**

```bash
git add web/src/components/Dropzone.tsx web/src/app/page.tsx
git commit -m "feat(import): multi-file drop, merge-by-default with replace toggle + merged summary"
```

---

## Task 5: Mapping wizard merges instead of replacing

**Files:**
- Modify: `web/src/app/import/map/page.tsx:36-161`

- [ ] **Step 1: Use `mergeData` when data already exists**

Add the merge action + a data flag near the other store selectors in `MapView`:

```tsx
  const importData = useStore((s) => s.importData);
  const mergeData = useStore((s) => s.mergeData);
  const hasData = useStore((s) => s.transactions.length > 0);
```

In `doImport`, replace `importData(res);` with:

```ts
      if (hasData) mergeData(res);
      else importData(res);
```

- [ ] **Step 2: Typecheck + commit**

Run: `cd web; npx tsc --noEmit` (clean).

```bash
git add web/src/app/import/map/page.tsx
git commit -m "feat(import): mapping wizard merges into existing data"
```

---

## Task 6: Rebrand strings + i18n keys

**Files:**
- Modify: `web/src/lib/i18n.tsx`, `web/src/app/layout.tsx`, `web/src/app/manifest.ts`, `web/src/app/export/page.tsx`

- [ ] **Step 1: Update the brand + add import keys (EN)**

In `web/src/lib/i18n.tsx`, set EN `"brand": "Where's My Money?"`, and add these EN keys
(before the EN object's closing `};`):

```ts
  "import.replaceExisting": "Replace existing data",
  "import.mergedSummary": "Added {added} · skipped {skipped} duplicates · {total} transactions across {months} months",
  "import.filesNeedMapping": "{n} file(s) need manual column mapping.",
```

- [ ] **Step 2: Mirror in ZH**

Set ZH `"brand": "花哪了"`, and add (before the ZH object's closing `};`):

```ts
  "import.replaceExisting": "替换现有数据",
  "import.mergedSummary": "新增 {added} · 跳过 {skipped} 条重复 · 共 {total} 笔，{months} 个月",
  "import.filesNeedMapping": "{n} 个文件需要手动映射列。",
```

- [ ] **Step 3: Title, manifest, share-card wordmark**

`web/src/app/layout.tsx`:
```ts
  title: "Where's My Money? — Personal Expense Dashboard",
```
and `appleWebApp.title: "Where's My Money?"`.

`web/src/app/manifest.ts`:
```ts
    name: "Where's My Money?",
    short_name: "WMM",
    background_color: "#f4f2ee",
    theme_color: "#f4f2ee",
```

`web/src/app/export/page.tsx` share-card wordmark text: `Money Tracker` → `Where's My Money?`.

- [ ] **Step 4: Typecheck + lint + build**

Run: `cd web; npx tsc --noEmit; npm run lint; npm run build`
Expected: all clean (build prerenders all routes).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/i18n.tsx web/src/app/layout.tsx web/src/app/manifest.ts web/src/app/export/page.tsx
git commit -m "feat(brand): rename to Where's My Money? / 花哪了"
```

---

## Task 7: e2e — merge, de-dup, replace

**Files:**
- Create: `web/scripts/e2e-merge.ts`

- [ ] **Step 1: Write the e2e**

Create `web/scripts/e2e-merge.ts`. It imports the demo (replace), then merges a second
OCBC-format fixture with one new month, asserts growth + month union, re-imports the same
file to assert de-dup, then toggles replace and re-imports demo to assert reset.

```ts
import { chromium } from "playwright";

// Minimal OCBC-format statement for a brand-new month (2026-09).
const SECOND = `Account details for:,OCBC FRANK Account 525-000000-001
Available Balance,1000.00
Ledger Balance,1000.00

Transaction History
Transaction date,Value date,Description,Withdrawals(SGD),Deposits(SGD)
05/09/2026,05/09/2026,"DEBIT PURCHASE  NTUC FAIRPRICE",42.50,
12/09/2026,12/09/2026,"DEBIT PURCHASE  KOPITIAM",6.80,
`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Try demo data/i }).click();
  await page.getByText(/Added \d+/i).waitFor({ timeout: 10000 });

  // counts after demo
  const demoTotal = await page.evaluate(() =>
    (window as unknown as { __c?: number }).__c ?? document.body.innerText.match(/(\d+) transactions/)?.[1]
  );

  // Merge the second fixture via the hidden file input.
  await page.setInputFiles('input[type=file]', {
    name: "sep.csv", mimeType: "text/csv", buffer: Buffer.from(SECOND),
  });
  await page.getByText(/Added 2 /i).waitFor({ timeout: 10000 });
  const afterMerge = (await page.getByText(/transactions across/i).innerText());

  // Re-import the SAME file → 0 added (deduped).
  await page.setInputFiles('input[type=file]', {
    name: "sep.csv", mimeType: "text/csv", buffer: Buffer.from(SECOND),
  });
  await page.getByText(/Added 0 /i).waitFor({ timeout: 10000 });

  console.log("after demo total text:", demoTotal);
  console.log("after merge summary:", afterMerge);
  console.log("console errors:", errors.length);
  errors.slice(0, 8).forEach((e) => console.log(" -", e));
  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();
```

- [ ] **Step 2: Run it against a dev server**

Run (one shell): `cd web; npm run dev` (background), then in another: `cd web; npx tsx scripts/e2e-merge.ts`
Expected: "Added 2" after merge, "Added 0" on re-import, `console errors: 0`, exit 0.
If the demo button auto-checks replace and hides the checkbox, the second `setInputFiles`
merges because `replaceExisting` is false by default after demo (note: the demo handler sets
`replaceExisting=true`; reset it to false in the handler after a demo import, or uncheck before
the merge step — see Step 3).

- [ ] **Step 3: Fix demo replace-flag leak if needed**

If the demo import leaves `replaceExisting` checked (causing the second file to replace),
update the demo `onClick` in `app/page.tsx` to reset the flag after dispatch:

```tsx
        <Button variant="secondary" onClick={() => { handleFiles([{ text: DEMO_CSV, name: "demo.csv" }]); }}>
```

and inside `handleFiles`, compute `const replace = replaceExisting || !hasData || isDemo;`
by passing an explicit `replace` argument from the demo button instead of toggling state.
Simplest: give `handleFiles(files, forceReplace = false)` and call the demo button with
`handleFiles([...], true)`. Re-run the e2e until green.

- [ ] **Step 4: Commit**

```bash
git add web/scripts/e2e-merge.ts web/src/app/page.tsx
git commit -m "test(import): e2e for multi-statement merge + de-dup"
```

---

## Task 8: Full verification + docs

**Files:**
- Modify: `web/README.md`, `.github/copilot-instructions.md`, `ROADMAP.md`

- [ ] **Step 1: Run the whole gate**

Run (with dev server up for e2e):
```
cd web
npx tsx scripts/test-merge.ts
npx tsx scripts/test-budgets.ts
npx tsx scripts/test-insights.ts
npx tsx scripts/test-filters.ts
npx tsx scripts/test-recurring.ts
npx tsx scripts/e2e-merge.ts
npx tsx scripts/e2e-drilldown.ts
npx tsx scripts/e2e-recurring.ts
npx tsx scripts/e2e-insights.ts
npx tsx scripts/e2e-budgets.ts
npx tsc --noEmit
npm run lint
npm run build
```
Expected: every unit suite passes, every e2e reports 0 console errors, tsc/lint clean,
build prerenders all routes.

- [ ] **Step 2: Update docs**

- `web/README.md`: rename title/intro to "Where's My Money?"; add a **Multi-statement
  import** feature bullet (merge by default, de-duped, replace option).
- `.github/copilot-instructions.md`: note the new name and that imports merge by default
  (union by transaction id; income deduped by deposit id via `lib/merge.ts`).
- `ROADMAP.md`: add multi-statement merge + the rename under the post-roadmap Status list.

- [ ] **Step 3: Regenerate README screenshots (optional)**

If the brand wordmark is visible in the committed dashboard screenshots, regenerate
`web/docs/images/dashboard-{light,dark}.png` so they show the new name.

- [ ] **Step 4: Commit**

```bash
git add web/README.md .github/copilot-instructions.md ROADMAP.md web/docs/images
git commit -m "docs: multi-statement merge + Where's My Money? rebrand"
```

---

## Self-review notes

- **Spec coverage:** Tasks 1–2 (income fingerprint + merge logic), Task 3–4 (multi-file
  UX + merge/replace + summary), Task 5 (wizard merge), Task 6 (rebrand), Task 7 (e2e),
  Task 8 (verify + docs) — all spec sections covered.
- **Type consistency:** `mergeData`, `incomeDeposits`, `IncomeDeposit`, `recomputeIncome`,
  `mergeTransactions`, `mergeMonths`, `onFiles` are named identically across tasks.
- **Known risk:** the demo button's replace flag (Task 7 Step 3 handles the leak by passing
  an explicit `forceReplace` instead of toggling state — prefer that form from the start in
  Task 4 to avoid rework).

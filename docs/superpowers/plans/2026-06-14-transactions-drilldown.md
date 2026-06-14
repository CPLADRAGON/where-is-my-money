# Transactions Drill-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unified, filterable `/transactions` page (absorbing the Review page) that lets you tap a category on the Dashboard and drill into its entries, view + edit inline, with filter state encoded in the URL.

**Architecture:** A pure `applyFilter` over the existing Zustand transaction store drives a presentational `TransactionTable` (extracted from today's Review page) plus a `TransactionFilters` bar. Filter state lives in URL query params (`useSearchParams`). The Dashboard charts/rows become links that `router.push` into `/transactions` with the right params; `/review` redirects to `/transactions?review=1`.

**Tech Stack:** Next.js 16 (App Router, client components), TypeScript, Tailwind v4, Zustand, Recharts, `tsx` test scripts + Playwright (existing patterns — no new test framework).

---

## File Structure

- **Create** `web/src/lib/filters.ts` — `TxFilter` type, `parseFilter`, `serializeFilter`, `applyFilter` (pure filter + sort). Reuses `inRange` from `selectors.ts`.
- **Create** `web/src/components/TransactionTable.tsx` — presentational table (rows + inline `CategoryPicker` + bulk-apply bar + remember toggle + provenance badge + "not spending" tag). Pulls `setCategory`/`bulkSetCategory` from the store; owns its own selection/remember state. Renders rows in the order given.
- **Create** `web/src/components/TransactionFilters.tsx` — filter bar (pillar, dependent sub, month, type, needs-review, search, sort, clear). Writes changes to the URL via `router.replace`.
- **Create** `web/src/app/transactions/page.tsx` — parses URL → `applyFilter` → renders filters + table + result count + empty states.
- **Create** `web/scripts/test-filters.ts` — unit test for `applyFilter`/`parseFilter`/`serializeFilter` (tsx asserts).
- **Create** `web/scripts/e2e-drilldown.ts` — Playwright e2e.
- **Modify** `web/src/app/review/page.tsx` — replace with a client redirect to `/transactions?review=1`.
- **Modify** `web/src/app/page.tsx` — import CTA targets `/transactions?review=1`.
- **Modify** `web/src/components/AppShell.tsx` — nav item points to `/transactions`, label key `nav.transactions`.
- **Modify** `web/src/components/DashboardCharts.tsx` — `PillarPie`/`SubBars` accept optional click handlers.
- **Modify** `web/src/app/dashboard/page.tsx` — wire chart/row clicks to navigate; Needs/Wants rows clickable, Savings not; transfers note links.
- **Modify** `web/src/lib/i18n.tsx` — add filter/sort/empty/nav keys (en + zh).

---

## Task 1: `applyFilter` core (lib/filters.ts)

**Files:**
- Create: `web/src/lib/filters.ts`
- Test: `web/scripts/test-filters.ts`

- [ ] **Step 1: Write the failing test**

Create `web/scripts/test-filters.ts`:

```ts
import { parseFilter, serializeFilter, applyFilter, type TxFilter } from "../src/lib/filters";
import type { Transaction } from "../src/lib/types";

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    date: p.date ?? "2026-03-10",
    month: (p.date ?? "2026-03-10").slice(0, 7),
    description: p.description ?? "TEST",
    merchantKey: p.merchantKey ?? "TEST",
    amount: p.amount ?? 10,
    pillar: p.pillar ?? "Variable Wants",
    sub: p.sub ?? "Shopping",
    provenance: p.provenance ?? "rule",
  };
}

const data: Transaction[] = [
  tx({ id: "a", pillar: "Fixed Needs", sub: "Transport", amount: 2, date: "2026-03-01" }),
  tx({ id: "b", pillar: "Variable Wants", sub: "Shopping", amount: 50, date: "2026-03-15", provenance: "default" }),
  tx({ id: "c", pillar: "Transfer", sub: "Personal Transfer", amount: 100, date: "2026-04-02", description: "TO JOHN" }),
  tx({ id: "d", pillar: "Variable Wants", sub: "Dining Out/Cafes", amount: 20, date: "2026-04-20" }),
];

let pass = 0, fail = 0;
function eq(actual: unknown, expected: unknown, msg: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? "PASS" : "FAIL", "-", msg);
  ok ? pass++ : fail++;
}
const ids = (rows: Transaction[]) => rows.map((r) => r.id);

eq(ids(applyFilter(data, { sort: "date_desc" })), ["d", "c", "b", "a"], "default sort date_desc");
eq(ids(applyFilter(data, { sort: "amount_desc" })), ["c", "b", "d", "a"], "sort amount_desc");
eq(ids(applyFilter(data, { pillar: "Variable Wants", sort: "date_desc" })), ["d", "b"], "filter pillar");
eq(ids(applyFilter(data, { sub: "Transport", sort: "date_desc" })), ["a"], "filter sub");
eq(ids(applyFilter(data, { month: "2026-04", sort: "date_desc" })), ["d", "c"], "filter month");
eq(ids(applyFilter(data, { type: "transfer", sort: "date_desc" })), ["c"], "filter type transfer");
eq(ids(applyFilter(data, { type: "spending", sort: "date_desc" })), ["d", "b", "a"], "filter type spending");
eq(ids(applyFilter(data, { review: true, sort: "date_desc" })), ["b"], "filter review preset");
eq(ids(applyFilter(data, { q: "john", sort: "date_desc" })), ["c"], "search by description");

eq(
  serializeFilter({ pillar: "Variable Wants", month: "2026-03", sort: "date_desc" }),
  "pillar=Variable+Wants&month=2026-03",
  "serialize omits default sort"
);
const parsed = parseFilter(new URLSearchParams("pillar=Transfer&type=transfer&review=1&sort=amount_asc"));
eq(parsed, { sort: "amount_asc", pillar: "Transfer", type: "transfer", review: true } as TxFilter, "parse params");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web; npx tsx scripts/test-filters.ts`
Expected: FAIL — `Cannot find module '../src/lib/filters'`.

- [ ] **Step 3: Write minimal implementation**

Create `web/src/lib/filters.ts`:

```ts
import { CATEGORIES, PILLARS, isSpending, type Pillar } from "./taxonomy";
import { inRange, type DateRange } from "./selectors";
import type { Transaction } from "./types";

export type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

export interface TxFilter {
  pillar?: Pillar;
  sub?: string;
  month?: string; // YYYY-MM
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  type?: "spending" | "transfer";
  review?: boolean;
  q?: string;
  sort: SortKey;
}

const SORTS: SortKey[] = ["date_desc", "date_asc", "amount_desc", "amount_asc"];

function toRange(f: TxFilter): DateRange {
  if (f.month) return { mode: "month", month: f.month };
  if (f.from || f.to) return { mode: "custom", start: f.from, end: f.to };
  return { mode: "all" };
}

export function applyFilter(tx: Transaction[], f: TxFilter): Transaction[] {
  const range = toRange(f);
  const q = f.q?.trim().toLowerCase();
  const rows = tx.filter((t) => {
    if (f.pillar && t.pillar !== f.pillar) return false;
    if (f.sub && t.sub !== f.sub) return false;
    if (f.type === "spending" && !isSpending(t.pillar)) return false;
    if (f.type === "transfer" && isSpending(t.pillar)) return false;
    if (f.review && t.provenance !== "default") return false;
    if (!inRange(t, range)) return false;
    if (q && !(t.description.toLowerCase().includes(q) || t.merchantKey.toLowerCase().includes(q)))
      return false;
    return true;
  });
  const sorted = [...rows].sort((a, b) => {
    switch (f.sort) {
      case "date_asc":
        return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      case "amount_desc":
        return b.amount - a.amount;
      case "amount_asc":
        return a.amount - b.amount;
      case "date_desc":
      default:
        return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    }
  });
  return sorted;
}

function validPillar(v: string | null): Pillar | undefined {
  return v && (PILLARS as readonly string[]).includes(v) ? (v as Pillar) : undefined;
}

export function parseFilter(sp: URLSearchParams): TxFilter {
  const pillar = validPillar(sp.get("pillar"));
  let sub = sp.get("sub") ?? undefined;
  if (sub) {
    const owner = (PILLARS as readonly Pillar[]).find((p) => CATEGORIES[p].includes(sub as string));
    if (!owner) sub = undefined;
  }
  const type = sp.get("type");
  const sortParam = sp.get("sort");
  const f: TxFilter = {
    sort: SORTS.includes(sortParam as SortKey) ? (sortParam as SortKey) : "date_desc",
  };
  if (pillar) f.pillar = pillar;
  if (sub) f.sub = sub;
  const month = sp.get("month");
  if (month && /^\d{4}-\d{2}$/.test(month)) f.month = month;
  else {
    const from = sp.get("from");
    const to = sp.get("to");
    if (from) f.from = from;
    if (to) f.to = to;
  }
  if (type === "spending" || type === "transfer") f.type = type;
  if (sp.get("review") === "1") f.review = true;
  const q = sp.get("q");
  if (q) f.q = q;
  return f;
}

export function serializeFilter(f: TxFilter): string {
  const p = new URLSearchParams();
  if (f.pillar) p.set("pillar", f.pillar);
  if (f.sub) p.set("sub", f.sub);
  if (f.month) p.set("month", f.month);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.type) p.set("type", f.type);
  if (f.review) p.set("review", "1");
  if (f.q) p.set("q", f.q);
  if (f.sort && f.sort !== "date_desc") p.set("sort", f.sort);
  return p.toString();
}

export const EMPTY_FILTER: TxFilter = { sort: "date_desc" };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web; npx tsx scripts/test-filters.ts`
Expected: `11 passed, 0 failed`.

- [ ] **Step 5: Typecheck + commit**

```bash
cd web && npx tsc --noEmit
git add web/src/lib/filters.ts web/scripts/test-filters.ts
git commit -m "feat(transactions): add applyFilter/parseFilter/serializeFilter"
```

---

## Task 2: Extract `TransactionTable` from Review

**Files:**
- Create: `web/src/components/TransactionTable.tsx`
- Reference (current table): `web/src/app/review/page.tsx` (the `<Card>`/table block and bulk bar)

- [ ] **Step 1: Create the presentational table component**

Create `web/src/components/TransactionTable.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Card, CardBody } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { CategoryPicker } from "@/components/CategoryPicker";
import { useStore } from "@/lib/store";
import { CATEGORIES, PILLARS, isSpending, type Pillar } from "@/lib/taxonomy";
import { formatSGD, formatMonthLabel } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Provenance, Transaction } from "@/lib/types";

const PROV_TONE: Record<Provenance, "rule" | "learned" | "manual" | "default"> = {
  rule: "rule",
  learned: "learned",
  manual: "manual",
  default: "default",
};

export function TransactionTable({ rows }: { rows: Transaction[] }) {
  const tr = useT();
  const setCategory = useStore((s) => s.setCategory);
  const bulkSetCategory = useStore((s) => s.bulkSetCategory);

  const [remember, setRemember] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPillar, setBulkPillar] = useState<Pillar>("Variable Wants");
  const [bulkSub, setBulkSub] = useState<string>("Shopping");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function applyBulk() {
    if (selected.size === 0) return;
    bulkSetCategory(Array.from(selected), bulkPillar, bulkSub, remember);
    setSelected(new Set());
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label className="flex items-center gap-2 rounded-full bg-canvas-soft px-3 py-1.5 text-sm font-medium">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          {tr("review.rememberMerchant")}
        </label>
      </div>

      {selected.size > 0 && (
        <Card>
          <CardBody className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold">{tr("review.selectedN", { n: selected.size })}</span>
            <select
              className="h-9 rounded-[var(--radius-md)] border border-hairline bg-canvas px-2 text-sm"
              value={bulkPillar}
              onChange={(e) => {
                const p = e.target.value as Pillar;
                setBulkPillar(p);
                setBulkSub(CATEGORIES[p][0]);
              }}
            >
              {PILLARS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select
              className="h-9 rounded-[var(--radius-md)] border border-hairline bg-canvas px-2 text-sm"
              value={bulkSub}
              onChange={(e) => setBulkSub(e.target.value)}
            >
              {CATEGORIES[bulkPillar].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <Button size="sm" onClick={applyBulk}>
              {tr("review.applyTo", { n: selected.size })}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              {tr("review.clear")}
            </Button>
          </CardBody>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline bg-canvas-soft text-left text-xs uppercase tracking-wide text-mute">
                <th className="w-10 px-3 py-2"></th>
                <th className="px-3 py-2">{tr("th.date")}</th>
                <th className="px-3 py-2">{tr("th.description")}</th>
                <th className="px-3 py-2 text-right">{tr("th.amount")}</th>
                <th className="px-3 py-2">{tr("th.source")}</th>
                <th className="px-3 py-2">{tr("th.category")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-hairline/60 align-middle hover:bg-primary-pale/30">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular text-mute">
                    {formatMonthLabel(t.month).split(" ")[0]} {t.date.slice(8, 10)}
                  </td>
                  <td className="max-w-xs px-3 py-2">
                    <span className="line-clamp-2 text-body">{t.description}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular font-semibold">
                    {formatSGD(t.amount)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={PROV_TONE[t.provenance]}>{t.provenance}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <CategoryPicker
                        compact
                        pillar={t.pillar}
                        sub={t.sub}
                        onChange={(p, s) => setCategory(t.id, p, s, remember)}
                      />
                      {!isSpending(t.pillar) && (
                        <span className="whitespace-nowrap rounded-full bg-canvas-soft px-2 py-0.5 text-[10px] font-semibold text-mute">
                          {tr("review.notSpending")}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web; npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/TransactionTable.tsx
git commit -m "feat(transactions): extract reusable TransactionTable"
```

---

## Task 3: `TransactionFilters` bar

**Files:**
- Create: `web/src/components/TransactionFilters.tsx`

- [ ] **Step 1: Create the filter bar**

Create `web/src/components/TransactionFilters.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/Button";
import { Select } from "@/components/Select";
import { CATEGORIES, PILLARS, type Pillar } from "@/lib/taxonomy";
import { serializeFilter, type SortKey, type TxFilter } from "@/lib/filters";
import { formatMonthLabel } from "@/lib/utils";
import { useT } from "@/lib/i18n";

const SORTS: SortKey[] = ["date_desc", "date_asc", "amount_desc", "amount_asc"];

export function TransactionFilters({
  filter,
  months,
}: {
  filter: TxFilter;
  months: string[];
}) {
  const router = useRouter();
  const t = useT();

  function update(patch: Partial<TxFilter>) {
    const next: TxFilter = { ...filter, ...patch };
    if (patch.pillar !== undefined && next.sub && !CATEGORIES[next.pillar as Pillar]?.includes(next.sub)) {
      delete next.sub;
    }
    const qs = serializeFilter(next);
    router.replace(qs ? `/transactions?${qs}` : "/transactions", { scroll: false });
  }

  const subs = filter.pillar ? CATEGORIES[filter.pillar] : [];
  const hasFilters =
    filter.pillar || filter.sub || filter.month || filter.from || filter.to || filter.type || filter.review || filter.q;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label={t("filter.pillar")}
        value={filter.pillar ?? ""}
        onChange={(e) => update({ pillar: (e.target.value || undefined) as Pillar | undefined, sub: undefined })}
      >
        <option value="">{t("filter.allPillars")}</option>
        {PILLARS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Select>

      <Select
        aria-label={t("filter.sub")}
        value={filter.sub ?? ""}
        disabled={!filter.pillar}
        onChange={(e) => update({ sub: e.target.value || undefined })}
      >
        <option value="">{t("filter.allSubs")}</option>
        {subs.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>

      <Select
        aria-label={t("filter.month")}
        value={filter.month ?? "all"}
        onChange={(e) => update({ month: e.target.value === "all" ? undefined : e.target.value, from: undefined, to: undefined })}
      >
        <option value="all">{t("range.all")}</option>
        {months.map((m) => (
          <option key={m} value={m}>
            {formatMonthLabel(m)}
          </option>
        ))}
      </Select>

      <Select
        aria-label={t("filter.type")}
        value={filter.type ?? ""}
        onChange={(e) => update({ type: (e.target.value || undefined) as TxFilter["type"] })}
      >
        <option value="">{t("filter.allTypes")}</option>
        <option value="spending">{t("filter.spending")}</option>
        <option value="transfer">{t("filter.transfer")}</option>
      </Select>

      <Button
        size="sm"
        variant={filter.review ? "primary" : "secondary"}
        onClick={() => update({ review: filter.review ? undefined : true })}
      >
        {t("filter.needsReview")}
      </Button>

      <label className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-hairline bg-canvas px-2">
        <Search className="size-4 text-mute" />
        <input
          aria-label={t("filter.search")}
          value={filter.q ?? ""}
          onChange={(e) => update({ q: e.target.value || undefined })}
          placeholder={t("filter.search")}
          className="h-9 bg-transparent text-sm outline-none"
        />
      </label>

      <Select
        aria-label={t("filter.sort")}
        value={filter.sort}
        onChange={(e) => update({ sort: e.target.value as SortKey })}
      >
        {SORTS.map((s) => (
          <option key={s} value={s}>
            {t(`sort.${s}`)}
          </option>
        ))}
      </Select>

      {hasFilters && (
        <Button size="sm" variant="ghost" onClick={() => router.replace("/transactions", { scroll: false })}>
          <X className="size-4" /> {t("filter.clear")}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web; npx tsc --noEmit`
Expected: no errors (the i18n `t()` accepts any string key; missing keys fall back to the key string until Task 6).

- [ ] **Step 3: Commit**

```bash
git add web/src/components/TransactionFilters.tsx
git commit -m "feat(transactions): add TransactionFilters bar"
```

---

## Task 4: `/transactions` page

**Files:**
- Create: `web/src/app/transactions/page.tsx`

- [ ] **Step 1: Create the page**

Create `web/src/app/transactions/page.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { HydrationGate } from "@/components/HydrationGate";
import { Card, CardBody } from "@/components/Card";
import { Button } from "@/components/Button";
import { TransactionFilters } from "@/components/TransactionFilters";
import { TransactionTable } from "@/components/TransactionTable";
import { useStore } from "@/lib/store";
import { applyFilter, parseFilter } from "@/lib/filters";
import { formatSGD } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export default function Page() {
  return (
    <AppShell>
      <HydrationGate>
        <TransactionsView />
      </HydrationGate>
    </AppShell>
  );
}

function TransactionsView() {
  const t = useT();
  const sp = useSearchParams();
  const transactions = useStore((s) => s.transactions);
  const months = useStore((s) => s.months);

  const filter = useMemo(() => parseFilter(new URLSearchParams(sp.toString())), [sp]);
  const rows = useMemo(() => applyFilter(transactions, filter), [transactions, filter]);
  const total = rows.reduce((a, r) => a + r.amount, 0);

  if (transactions.length === 0) {
    return (
      <Card>
        <CardBody className="grid place-items-center gap-3 py-16 text-center">
          <p className="text-lg font-bold">{t("review.emptyTitle")}</p>
          <p className="text-sm text-body">{t("review.emptyBody")}</p>
          <Link href="/">
            <Button>{t("btn.importFile")}</Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.transactions")}</h1>
        <p className="mt-1 text-sm text-body">
          {t("tx.resultCount", { n: rows.length })} · {formatSGD(total)}
        </p>
      </div>

      <TransactionFilters filter={filter} months={months} />

      {rows.length === 0 ? (
        <Card>
          <CardBody className="grid place-items-center gap-3 py-12 text-center">
            <p className="text-sm font-medium text-body">{t("tx.noMatch")}</p>
            <Link href="/transactions">
              <Button variant="secondary">{t("filter.clear")}</Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <TransactionTable rows={rows} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web; npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/transactions/page.tsx
git commit -m "feat(transactions): add filterable /transactions page"
```

---

## Task 5: Redirect `/review`, update CTA + nav

**Files:**
- Modify: `web/src/app/review/page.tsx` (replace entire contents)
- Modify: `web/src/app/page.tsx` (CTA target, 1 occurrence)
- Modify: `web/src/components/AppShell.tsx` (NAV entry + badge condition)

- [ ] **Step 1: Replace `/review` with a redirect**

Replace the entire contents of `web/src/app/review/page.tsx` with:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ReviewRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/transactions?review=1");
  }, [router]);
  return null;
}
```

- [ ] **Step 2: Update the import success CTA**

In `web/src/app/page.tsx`, the review CTA currently reads `onClick={() => router.push("/review")}`. Change that one line to:

```tsx
              <Button className="cta-pulse" onClick={() => router.push("/transactions?review=1")}>
```

- [ ] **Step 3: Point the nav at `/transactions`**

In `web/src/components/AppShell.tsx`, change the Review nav entry in the `NAV` array from `{ href: "/review", key: "nav.review", icon: ListChecks }` to:

```tsx
  { href: "/transactions", key: "nav.transactions", icon: ListChecks },
```

Then change the badge condition from `href === "/review"` to:

```tsx
                const badge = href === "/transactions" && needsReview > 0 ? needsReview : null;
```

(The existing `pathname.startsWith(href)` active check already handles `/transactions`.)

- [ ] **Step 4: Typecheck**

Run: `cd web; npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/review/page.tsx web/src/app/page.tsx web/src/components/AppShell.tsx
git commit -m "feat(transactions): redirect /review and point nav/CTA to /transactions"
```

---

## Task 6: i18n keys (en + zh)

**Files:**
- Modify: `web/src/lib/i18n.tsx` (add to both the `EN` and `ZH` objects)

- [ ] **Step 1: Add keys to the `EN` object**

In `web/src/lib/i18n.tsx`, add these entries inside the `EN = { ... }` object (before its closing brace):

```ts
  "nav.transactions": "Transactions",
  "tx.resultCount": "{n} transactions",
  "tx.noMatch": "No transactions match these filters.",
  "filter.pillar": "Pillar",
  "filter.allPillars": "All pillars",
  "filter.sub": "Sub-category",
  "filter.allSubs": "All sub-categories",
  "filter.month": "Month",
  "filter.type": "Type",
  "filter.allTypes": "All types",
  "filter.spending": "Spending",
  "filter.transfer": "Transfers",
  "filter.needsReview": "Needs review",
  "filter.search": "Search",
  "filter.sort": "Sort",
  "filter.clear": "Clear",
  "sort.date_desc": "Newest first",
  "sort.date_asc": "Oldest first",
  "sort.amount_desc": "Largest first",
  "sort.amount_asc": "Smallest first",
  "dash.tapHint": "Tap a slice, bar, or row to view its transactions",
```

- [ ] **Step 2: Add the same keys to the `ZH` object**

Add these inside the `ZH` object (its type is `Record<keyof typeof EN, string>`, so it must contain every EN key):

```ts
  "nav.transactions": "交易",
  "tx.resultCount": "{n} 笔交易",
  "tx.noMatch": "没有符合筛选条件的交易。",
  "filter.pillar": "类别",
  "filter.allPillars": "全部类别",
  "filter.sub": "子类别",
  "filter.allSubs": "全部子类别",
  "filter.month": "月份",
  "filter.type": "类型",
  "filter.allTypes": "全部类型",
  "filter.spending": "消费",
  "filter.transfer": "转账",
  "filter.needsReview": "待核对",
  "filter.search": "搜索",
  "filter.sort": "排序",
  "filter.clear": "清除",
  "sort.date_desc": "最新优先",
  "sort.date_asc": "最早优先",
  "sort.amount_desc": "金额从高到低",
  "sort.amount_asc": "金额从低到高",
  "dash.tapHint": "点击扇区、柱条或行即可查看对应交易",
```

- [ ] **Step 3: Typecheck**

Run: `cd web; npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/i18n.tsx
git commit -m "feat(transactions): add i18n keys for filters and drill-down"
```

---

## Task 7: Make the Dashboard clickable

**Files:**
- Modify: `web/src/components/DashboardCharts.tsx` (`PillarPie`, `SubBars`)
- Modify: `web/src/app/dashboard/page.tsx` (wire navigation)

- [ ] **Step 1: Add optional click handlers to the charts**

In `web/src/components/DashboardCharts.tsx`, replace the `PillarPie` function with:

```tsx
export function PillarPie({
  data,
  onSliceClick,
}: {
  data: { pillar: SpendingPillar; amount: number }[];
  onSliceClick?: (pillar: SpendingPillar) => void;
}) {
  const slices = data.filter((d) => d.amount > 0);
  if (slices.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="amount"
          nameKey="pillar"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          label={(p: { percent?: number }) => formatPct(p.percent ?? 0, 0)}
          labelLine={false}
          onClick={(_, index) => onSliceClick?.(slices[index].pillar)}
          cursor={onSliceClick ? "pointer" : undefined}
        >
          {slices.map((d) => (
            <Cell key={d.pillar} fill={PILLAR_COLORS[d.pillar]} />
          ))}
        </Pie>
        <Tooltip formatter={money} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

And replace the `SubBars` function with:

```tsx
export function SubBars({
  data,
  onBarClick,
}: {
  data: SubRow[];
  onBarClick?: (sub: string) => void;
}) {
  if (data.length === 0) return <Empty />;
  const height = Math.max(220, data.length * 30);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="sub" width={130} tick={{ fontSize: 11, fill: "#86868b" }} />
        <Tooltip formatter={money} />
        <Bar
          dataKey="amount"
          fill={SUB_COLOR}
          radius={[0, 6, 6, 0]}
          onClick={(d: { payload?: SubRow }) => d.payload && onBarClick?.(d.payload.sub)}
          cursor={onBarClick ? "pointer" : undefined}
        >
          <LabelList dataKey="amount" position="right" formatter={moneyShort} style={{ fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Wire navigation in the dashboard**

In `web/src/app/dashboard/page.tsx`:

(a) Add the router import at the top:

```tsx
import { useRouter } from "next/navigation";
```

(b) Just after `const t = useT();` inside `DashboardView`, add:

```tsx
  const router = useRouter();
  function drill(extra: Record<string, string>) {
    const p = new URLSearchParams(extra);
    if (rangeMode !== "all" && rangeMode !== "custom") p.set("month", rangeMode);
    else if (rangeMode === "custom") {
      if (start) p.set("from", start);
      if (end) p.set("to", end);
    }
    router.push(`/transactions?${p.toString()}`);
  }
  const pillarForBucket = (b: string) =>
    b === "Needs" ? "Fixed Needs" : b === "Wants" ? "Variable Wants" : null;
```

(c) Add the tap hint immediately after the header flex `</div>` (the row containing the `<h1>` and range selector). Insert:

```tsx
      <p className="-mt-3 text-xs text-mute">{t("dash.tapHint")}</p>
```

(d) Pass the click handler to the pie — change `<PillarPie data={pieData} />` to:

```tsx
              <PillarPie data={pieData} onSliceClick={(p) => drill({ pillar: p })} />
```

(e) Pass the click handler to the sub bars — change `<SubBars data={subRows} />` to:

```tsx
              <SubBars data={subRows} onBarClick={(s) => drill({ sub: s })} />
```

(f) Make the budget-table bucket cell clickable for Needs/Wants. Replace the cell
`<td className="py-2 font-medium">{t(\`bucket.${r.bucket}\`)}</td>` with:

```tsx
                    <td className="py-2 font-medium">
                      {pillarForBucket(r.bucket) ? (
                        <button
                          className="text-primary underline-offset-2 hover:underline"
                          onClick={() => drill({ pillar: pillarForBucket(r.bucket)! })}
                        >
                          {t(`bucket.${r.bucket}`)}
                        </button>
                      ) : (
                        <span title={t("dash.savingsTargetNote")}>{t(`bucket.${r.bucket}`)}</span>
                      )}
                    </td>
```

(g) Make the transfers note clickable. Replace the existing transfers `<p>…</p>`
block inside the flow card with:

```tsx
          {transfers > 0 && (
            <button
              className="mt-1 block text-left text-xs text-mute hover:text-primary"
              onClick={() => drill({ type: "transfer" })}
            >
              {invested > 0
                ? t("dash.flowExcludes", { t: formatSGD(transfers), i: formatSGD(invested) })
                : t("dash.flowExcludesShort", { t: formatSGD(transfers) })}
            </button>
          )}
```

- [ ] **Step 3: Typecheck + lint**

Run: `cd web; npx tsc --noEmit; npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/DashboardCharts.tsx web/src/app/dashboard/page.tsx
git commit -m "feat(dashboard): drill into transactions from charts and breakdown rows"
```

---

## Task 8: e2e + final verification

**Files:**
- Create: `web/scripts/e2e-drilldown.ts`

- [ ] **Step 1: Write the e2e script**

Create `web/scripts/e2e-drilldown.ts`:

```ts
import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Try demo data/i }).click();
  await page.getByText(/Imported \d+ transactions/i).waitFor({ timeout: 10000 });

  // /review redirects to /transactions?review=1
  await page.goto("http://localhost:3000/review", { waitUntil: "networkidle" });
  await page.waitForURL("**/transactions?review=1", { timeout: 5000 });
  const reviewRows = await page.locator("table tbody tr").count();

  // Dashboard sub-category bar deep-links with a sub filter
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.locator("svg .recharts-bar-rectangle").first().click();
  await page.waitForURL("**/transactions?sub=*", { timeout: 5000 });
  const filteredUrl = page.url();
  const filteredRows = await page.locator("table tbody tr").count();

  // Search narrows results
  await page.goto("http://localhost:3000/transactions", { waitUntil: "networkidle" });
  await page.getByLabel("Search").fill("netflix");
  await page.waitForTimeout(400);
  const searchRows = await page.locator("table tbody tr").count();

  console.log("review preset rows:", reviewRows);
  console.log("deep-linked url:", filteredUrl);
  console.log("filtered rows:", filteredRows);
  console.log("search rows:", searchRows);
  console.log("console errors:", errors.length);
  errors.slice(0, 8).forEach((e) => console.log(" -", e));
  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();
```

- [ ] **Step 2: Build, start dev server, run e2e**

```bash
cd web
npm run build
# start the dev server in the background and wait until it prints "Ready", then:
npx tsx scripts/e2e-drilldown.ts
```

Expected: `console errors: 0`; `deep-linked url` contains `/transactions?sub=`; `filtered rows` > 0; `search rows` ≥ 1 (the demo data has a Netflix subscription row).

- [ ] **Step 3: Run unit test + typecheck + lint**

```bash
cd web
npx tsx scripts/test-filters.ts   # 11 passed, 0 failed
npx tsc --noEmit
npm run lint
```

Expected: all green.

- [ ] **Step 4: Stop the dev server, commit**

```bash
git add web/scripts/e2e-drilldown.ts
git commit -m "test(transactions): e2e for drill-down + filters"
```

---

## Task 9: Docs

**Files:**
- Modify: `web/README.md`
- Modify: `.github/copilot-instructions.md`
- Modify: `ROADMAP.md`

- [ ] **Step 1: Update the web README feature list**

In `web/README.md`, replace the "Review & categorize" feature bullet with:

```md
- **Transactions** — one filterable list (pillar, sub-category, month, type,
  "Needs review", search, sort; filters live in the URL). View and recategorize
  inline. Tapping a category on the Dashboard deep-links here pre-filtered.
```

- [ ] **Step 2: Note the route change in copilot-instructions**

In `.github/copilot-instructions.md`, add this line in the web-app section:

```md
- Transaction browsing lives on `/transactions` (filterable; URL-encoded filters); `/review`
  redirects there with the "Needs review" preset, and the Dashboard charts/rows deep-link into it.
```

- [ ] **Step 3: Mark the feature in ROADMAP**

In `ROADMAP.md`, under the "Status" section, add:

```md
- Category drill-down: unified filterable `/transactions` page with clickable
  Dashboard entry points (spec: `docs/superpowers/specs/2026-06-14-transactions-drilldown-design.md`).
```

- [ ] **Step 4: Commit**

```bash
git add web/README.md .github/copilot-instructions.md ROADMAP.md
git commit -m "docs: document the Transactions drill-down feature"
```

---

## Notes for the implementer

- **No new test framework:** tests are `tsx` scripts run via `npx tsx scripts/<name>.ts` (existing repo pattern), plus Playwright (already a dev dependency).
- **Privacy:** never commit `TransactionHistory_*.csv` or `MonthlyExpenseTracker.xlsx` — they are gitignored.
- **The `t` shadowing trap:** in `TransactionTable` the row variable is `t` (transaction); the translator is named `tr`. In the dashboard/page and `/transactions` page the translator is `t` (no row-variable clash there).
- **Recharts onClick payloads:** the `Pie` onClick gives `(data, index)`; `Bar` onClick gives an object with `.payload`. The snippets above use both correctly.
- **Live re-filter:** editing a row's category re-runs `applyFilter`; a row may drop out of the current view — this is intended feedback.
- **Verification gates each task:** every code task ends with `npx tsc --noEmit`; the final task also runs lint, the unit test, and the e2e.

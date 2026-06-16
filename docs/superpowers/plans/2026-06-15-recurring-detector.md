# Recurring & Subscriptions Detector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect recurring spending (subscriptions/bills + frequent merchants) and surface it on a new `/recurring` page plus a Dashboard summary card, with drill-in to the filtered transactions.

**Architecture:** A pure `detectRecurring(transactions)` selector groups spending rows by `merchantKey`, qualifies groups present in ≥ 3 distinct months, classifies them (stable+monthly → subscription, else → frequent), and computes cadence + next-expected date. The `/recurring` page and a Dashboard card render it; each item links to `/transactions?q=<merchantKey>` (reusing the existing search filter). No new persisted state.

**Tech Stack:** Next.js 16 (App Router, client components), TypeScript, Tailwind v4, Zustand, `tsx` test scripts + Playwright (existing patterns — no new test framework).

---

## File Structure

- **Create** `web/src/lib/recurring.ts` — `RecurringItem`/`RecurringGroups`/`Cadence` types, `detectRecurring`, `monthlyCommitment`. Pure; reuses `isSpending` from `taxonomy.ts`.
- **Create** `web/src/components/RecurringCard.tsx` — one recurring item, links to `/transactions?q=<key>`.
- **Create** `web/src/components/RecurringSummaryCard.tsx` — Dashboard card (self-contained; reads store, hides when no subscriptions).
- **Create** `web/src/app/recurring/page.tsx` — the page (two sections + header + empty state).
- **Create** `web/scripts/test-recurring.ts` — unit test for the detector.
- **Create** `web/scripts/e2e-recurring.ts` — Playwright e2e.
- **Modify** `web/src/lib/demo.ts` — extend the demo to 3 months with repeating merchants.
- **Modify** `web/src/lib/i18n.tsx` — new keys (en + zh).
- **Modify** `web/src/components/AppShell.tsx` — add "Recurring" nav item.
- **Modify** `web/src/app/dashboard/page.tsx` — render `<RecurringSummaryCard/>`.

---

## Task 1: `detectRecurring` core (lib/recurring.ts)

**Files:**
- Create: `web/src/lib/recurring.ts`
- Test: `web/scripts/test-recurring.ts`

- [ ] **Step 1: Write the failing test**

Create `web/scripts/test-recurring.ts`:

```ts
import { detectRecurring, monthlyCommitment } from "../src/lib/recurring";
import type { Transaction } from "../src/lib/types";

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    date: p.date ?? "2026-04-01",
    month: (p.date ?? "2026-04-01").slice(0, 7),
    description: p.description ?? p.merchantKey ?? "TEST",
    merchantKey: p.merchantKey ?? "TEST",
    amount: p.amount ?? 10,
    pillar: p.pillar ?? "Variable Wants",
    sub: p.sub ?? "Shopping",
    provenance: p.provenance ?? "rule",
  };
}

const data: Transaction[] = [
  // Spotify: stable, monthly, 3 months -> subscription
  tx({ merchantKey: "SPOTIFY AB", sub: "Subscriptions", amount: 10.98, date: "2026-04-05" }),
  tx({ merchantKey: "SPOTIFY AB", sub: "Subscriptions", amount: 10.98, date: "2026-05-05" }),
  tx({ merchantKey: "SPOTIFY AB", sub: "Subscriptions", amount: 10.98, date: "2026-06-05" }),
  // Foodpanda: varies, monthly, 3 months -> frequent
  tx({ merchantKey: "FOODPANDA SG", sub: "Dining Out/Cafes", amount: 22.4, date: "2026-04-10" }),
  tx({ merchantKey: "FOODPANDA SG", sub: "Dining Out/Cafes", amount: 18.9, date: "2026-05-10" }),
  tx({ merchantKey: "FOODPANDA SG", sub: "Dining Out/Cafes", amount: 25.3, date: "2026-06-10" }),
  // Uniqlo: only 2 months -> excluded
  tx({ merchantKey: "UNIQLO", sub: "Shopping", amount: 59.9, date: "2026-05-08" }),
  tx({ merchantKey: "UNIQLO", sub: "Shopping", amount: 39.9, date: "2026-06-08" }),
  // Kopi: stable amount but high frequency (~fortnightly, 2/month) -> frequent
  tx({ merchantKey: "KOPI", sub: "Dining Out/Cafes", amount: 5, date: "2026-04-03" }),
  tx({ merchantKey: "KOPI", sub: "Dining Out/Cafes", amount: 5, date: "2026-04-17" }),
  tx({ merchantKey: "KOPI", sub: "Dining Out/Cafes", amount: 5, date: "2026-05-01" }),
  tx({ merchantKey: "KOPI", sub: "Dining Out/Cafes", amount: 5, date: "2026-05-15" }),
  tx({ merchantKey: "KOPI", sub: "Dining Out/Cafes", amount: 5, date: "2026-06-01" }),
  tx({ merchantKey: "KOPI", sub: "Dining Out/Cafes", amount: 5, date: "2026-06-15" }),
  // Transfers excluded from recurring entirely
  tx({ merchantKey: "JOHN TAN", pillar: "Transfer", sub: "Personal Transfer", amount: 25, date: "2026-04-20" }),
  tx({ merchantKey: "JOHN TAN", pillar: "Transfer", sub: "Personal Transfer", amount: 25, date: "2026-05-20" }),
  tx({ merchantKey: "JOHN TAN", pillar: "Transfer", sub: "Personal Transfer", amount: 25, date: "2026-06-20" }),
];

let pass = 0, fail = 0;
function eq(actual: unknown, expected: unknown, msg: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? "PASS" : "FAIL", "-", msg);
  if (ok) pass++;
  else fail++;
}

const g = detectRecurring(data);
const subKeys = g.subscriptions.map((s) => s.key);
const freqKeys = g.frequent.map((s) => s.key);

eq(subKeys, ["SPOTIFY AB"], "spotify is the only subscription");
eq(freqKeys.includes("FOODPANDA SG"), true, "foodpanda (varies) is frequent");
eq(freqKeys.includes("KOPI"), true, "high-frequency kopi is frequent not subscription");
eq(subKeys.includes("UNIQLO") || freqKeys.includes("UNIQLO"), false, "2-month merchant excluded");
eq(subKeys.includes("JOHN TAN") || freqKeys.includes("JOHN TAN"), false, "transfers excluded");
eq(g.subscriptions[0].cadence, "Monthly", "spotify cadence is Monthly");
eq(g.subscriptions[0].name, "Spotify Ab", "name is prettified");
eq(g.subscriptions[0].nextExpected, "2026-07-06", "spotify next expected = last + median gap");
eq(Math.round(monthlyCommitment(g) * 100) / 100, 10.98, "monthly commitment = sum of subscription avgs");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web; npx tsx scripts/test-recurring.ts`
Expected: FAIL — `Cannot find module '../src/lib/recurring'`.

- [ ] **Step 3: Write minimal implementation**

Create `web/src/lib/recurring.ts`:

```ts
import { isSpending, type Pillar } from "./taxonomy";
import type { Transaction } from "./types";

export type Cadence = "Monthly" | "Fortnightly" | "Weekly" | "Irregular";

export interface RecurringItem {
  key: string;
  name: string;
  pillar: Pillar;
  sub: string;
  count: number;
  monthsActive: number;
  total: number;
  avg: number;
  min: number;
  max: number;
  stable: boolean;
  cadence: Cadence;
  lastCharge: string; // YYYY-MM-DD
  nextExpected: string | null; // YYYY-MM-DD or null when Irregular
}

export interface RecurringGroups {
  subscriptions: RecurringItem[];
  frequent: RecurringItem[];
}

export const MIN_MONTHS = 3;
const STABILITY_RATIO = 0.1;
const STABILITY_FLOOR = 1.0;

function toDays(iso: string): number {
  return Math.floor(Date.parse(iso + "T00:00:00Z") / 86400000);
}
function fromDays(days: number): string {
  return new Date(days * 86400000).toISOString().slice(0, 10);
}
function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function prettify(key: string): string {
  return key
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
function cadenceFromGap(gap: number): Cadence {
  if (gap >= 24 && gap <= 38) return "Monthly";
  if (gap >= 11 && gap <= 18) return "Fortnightly";
  if (gap >= 5 && gap <= 10) return "Weekly";
  return "Irregular";
}

export function detectRecurring(tx: Transaction[]): RecurringGroups {
  const groups = new Map<string, Transaction[]>();
  for (const t of tx) {
    if (!isSpending(t.pillar)) continue;
    const key = t.merchantKey || t.description.slice(0, 24).toUpperCase();
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  const subscriptions: RecurringItem[] = [];
  const frequent: RecurringItem[] = [];

  for (const [key, rows] of groups) {
    const months = new Set(rows.map((r) => r.month));
    if (months.size < MIN_MONTHS) continue;

    const amounts = rows.map((r) => r.amount);
    const count = rows.length;
    const total = amounts.reduce((a, b) => a + b, 0);
    const avg = total / count;
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const stable = max - min <= Math.max(STABILITY_FLOOR, avg * STABILITY_RATIO);

    const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const dayVals = sorted.map((r) => toDays(r.date));
    const gaps: number[] = [];
    for (let i = 1; i < dayVals.length; i++) gaps.push(dayVals[i] - dayVals[i - 1]);
    const medGap = median(gaps);
    const cadence = cadenceFromGap(medGap);
    const last = sorted[sorted.length - 1];
    const nextExpected =
      cadence === "Irregular" ? null : fromDays(toDays(last.date) + Math.round(medGap));

    const item: RecurringItem = {
      key,
      name: prettify(key),
      pillar: last.pillar,
      sub: last.sub,
      count,
      monthsActive: months.size,
      total: Math.round(total * 100) / 100,
      avg: Math.round(avg * 100) / 100,
      min,
      max,
      stable,
      cadence,
      lastCharge: last.date,
      nextExpected,
    };

    const isSubscription = stable && cadence !== "Irregular" && count / months.size <= 1.5;
    if (isSubscription) subscriptions.push(item);
    else frequent.push(item);
  }

  subscriptions.sort((a, b) => b.total - a.total);
  frequent.sort((a, b) => b.total - a.total);
  return { subscriptions, frequent };
}

export function monthlyCommitment(g: RecurringGroups): number {
  return g.subscriptions.reduce((a, s) => a + s.avg, 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web; npx tsx scripts/test-recurring.ts`
Expected: `9 passed, 0 failed`.

- [ ] **Step 5: Typecheck + commit**

```bash
cd web && npx tsc --noEmit
git add web/src/lib/recurring.ts web/scripts/test-recurring.ts
git commit -m "feat(recurring): add detectRecurring + monthlyCommitment"
```

---

## Task 2: Extend the demo data to 3 months

**Files:**
- Modify: `web/src/lib/demo.ts` (replace the `DEMO_CSV` export only)

**Why:** the current demo spans 2 months with no repeating merchants, so the detector would find nothing on "Try demo data." This version repeats `SPOTIFY AB` (stable, → subscription), `SINGTEL TELECOM` (stable, → subscription), and `FOODPANDA SG` (varies, → frequent) across April/May/June 2026, with salary each month.

- [ ] **Step 1: Replace the `DEMO_CSV` string**

In `web/src/lib/demo.ts`, replace the entire `export const DEMO_CSV = \`...\`;` block (keep everything below it — `BankGuide`, `BANK_GUIDES` — unchanged) with:

```ts
/** A small embedded OCBC-format CSV so users can try the app without a file. */
export const DEMO_CSV = `Account details for:,OCBC FRANK Account 525-000000-001
Available Balance,"4,210.55"
Ledger Balance,"4,210.55"

Transaction History
Transaction date,Value date,Description,Withdrawals(SGD),Deposits(SGD)
02/04/2026,02/04/2026,"IBG GIRO
30224037426 ACME TECHNOLOG SALA",,3000.00
05/04/2026,05/04/2026,"FAST PAYMENT
OTHR via PayNow-UEN to SPOTIFY AB",10.98,
07/04/2026,07/04/2026,"FAST PAYMENT
OTHR via PayNow-UEN to SINGTEL TELECOM",15.00,
10/04/2026,10/04/2026,"FAST PAYMENT
OTHR via PayNow-UEN to FOODPANDA SG",22.40,
12/04/2026,12/04/2026,"DEBIT PURCHASE
xx-1767 BUS/MRT 861001234        S                   11/04/26",2.10,
15/04/2026,15/04/2026,"DEBIT PURCHASE
xx-1767 SHENG SIONG SUPERMARKET   S                   14/04/26",33.20,
20/04/2026,20/04/2026,"FAST PAYMENT
OTHR via PayNow-Mobile to JOHN TAN",25.00,
02/05/2026,02/05/2026,"IBG GIRO
30224037526 ACME TECHNOLOG SALA",,3000.00
05/05/2026,05/05/2026,"FAST PAYMENT
OTHR via PayNow-UEN to SPOTIFY AB",10.98,
07/05/2026,07/05/2026,"FAST PAYMENT
OTHR via PayNow-UEN to SINGTEL TELECOM",15.00,
09/05/2026,09/05/2026,"FAST PAYMENT
OTHR via PayNow-UEN to FOODPANDA SG",18.90,
11/05/2026,11/05/2026,"DEBIT PURCHASE
xx-1767 UNIQLO -ION ORCHARD      S                   10/05/26",59.90,
14/05/2026,14/05/2026,"DEBIT PURCHASE
xx-1767 GOLDEN VILLAGE -VIVOCITY S                   13/05/26",13.50,
18/05/2026,18/05/2026,"FAST PAYMENT
OTHR via PayNow-UEN to STARBUCKS COFFEE",7.40,
02/06/2026,02/06/2026,"IBG GIRO
30224037626 ACME TECHNOLOG SALA",,3000.00
05/06/2026,05/06/2026,"FAST PAYMENT
OTHR via PayNow-UEN to SPOTIFY AB",10.98,
07/06/2026,07/06/2026,"FAST PAYMENT
OTHR via PayNow-UEN to SINGTEL TELECOM",15.00,
09/06/2026,09/06/2026,"FAST PAYMENT
OTHR via PayNow-UEN to FOODPANDA SG",25.30,
11/06/2026,11/06/2026,"DEBIT PURCHASE
xx-1767 SHOPEE SINGAPORE         S                   10/06/26",45.00,
13/06/2026,13/06/2026,"FAST PAYMENT
OTHR via PayNow-Mobile to MARY LIM",60.00,
15/06/2026,15/06/2026,"DEBIT PURCHASE
xx-1767 NTUC FP-CLEMENTI         S                   14/06/26",41.10,
`;
```

- [ ] **Step 2: Verify the demo yields the expected recurring groups**

Create a temporary probe `web/scripts/_demo-check.ts`:

```ts
import { parseDetected } from "../src/lib/banks/index";
import { detectRecurring, monthlyCommitment } from "../src/lib/recurring";
import { DEMO_CSV } from "../src/lib/demo";

const r = parseDetected(DEMO_CSV);
const g = detectRecurring(r.transactions);
console.log("subscriptions:", g.subscriptions.map((s) => `${s.name} ${s.avg}`));
console.log("frequent:", g.frequent.map((s) => `${s.name} ${s.min}-${s.max}`));
console.log("monthly commitment:", monthlyCommitment(g).toFixed(2));
```

Run: `cd web; npx tsx scripts/_demo-check.ts`
Expected output (order may vary):
```
subscriptions: [ 'Singtel Telecom 15', 'Spotify Ab 10.98' ]
frequent: [ 'Foodpanda Sg 18.9-25.3' ]
monthly commitment: 25.98
```

- [ ] **Step 3: Delete the probe + commit**

```bash
cd web && rm scripts/_demo-check.ts
git add web/src/lib/demo.ts
git commit -m "feat(recurring): extend demo data to 3 months with recurring merchants"
```

---

## Task 3: i18n keys (en + zh)

**Files:**
- Modify: `web/src/lib/i18n.tsx` (add to both `EN` and `ZH` objects)

- [ ] **Step 1: Add keys to the `EN` object**

In `web/src/lib/i18n.tsx`, add these inside the `EN = { ... }` object (before its closing brace):

```ts
  "nav.recurring": "Recurring",
  "recurring.title": "Recurring",
  "recurring.monthlyCommitment": "~{amount} / month",
  "recurring.subsCount": "{n} subscriptions",
  "recurring.sectionSubs": "Subscriptions & bills",
  "recurring.sectionFrequent": "Frequent merchants",
  "recurring.cadence.Monthly": "Monthly",
  "recurring.cadence.Fortnightly": "Fortnightly",
  "recurring.cadence.Weekly": "Weekly",
  "recurring.cadence.Irregular": "Irregular",
  "recurring.nextExpected": "Next ~ {date}",
  "recurring.chargesOverMonths": "{count} charges · {months} months",
  "recurring.total": "Total {amount}",
  "recurring.empty": "Import at least 3 months of statements to see recurring charges.",
  "dash.recurringCard": "Recurring",
```

- [ ] **Step 2: Add the same keys to the `ZH` object**

Add inside the `ZH` object (it is typed `Record<keyof typeof EN, string>`, so it must contain every EN key):

```ts
  "nav.recurring": "定期",
  "recurring.title": "定期支出",
  "recurring.monthlyCommitment": "约 {amount} / 月",
  "recurring.subsCount": "{n} 项订阅",
  "recurring.sectionSubs": "订阅与账单",
  "recurring.sectionFrequent": "常用商家",
  "recurring.cadence.Monthly": "每月",
  "recurring.cadence.Fortnightly": "每两周",
  "recurring.cadence.Weekly": "每周",
  "recurring.cadence.Irregular": "不定期",
  "recurring.nextExpected": "下次约 {date}",
  "recurring.chargesOverMonths": "{count} 笔 · {months} 个月",
  "recurring.total": "合计 {amount}",
  "recurring.empty": "导入至少 3 个月的对账单即可查看定期支出。",
  "dash.recurringCard": "定期",
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd web && npx tsc --noEmit
git add web/src/lib/i18n.tsx
git commit -m "feat(recurring): add i18n keys (en + zh)"
```

---

## Task 4: `RecurringCard` component

**Files:**
- Create: `web/src/components/RecurringCard.tsx`

- [ ] **Step 1: Create the component**

Create `web/src/components/RecurringCard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Card, CardBody } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { formatSGD } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { RecurringItem } from "@/lib/recurring";

export function RecurringCard({ item }: { item: RecurringItem }) {
  const t = useT();
  const amount = item.stable
    ? formatSGD(item.avg)
    : `${formatSGD(item.min, { decimals: false })}–${formatSGD(item.max, { decimals: false })}`;

  return (
    <Link href={`/transactions?q=${encodeURIComponent(item.key)}`} className="block">
      <Card className="transition-colors hover:border-primary">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{item.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mute">
              <Badge tone="neutral">{item.sub}</Badge>
              <span>{t(`recurring.cadence.${item.cadence}`)}</span>
              <span>· {t("recurring.chargesOverMonths", { count: item.count, months: item.monthsActive })}</span>
              {item.nextExpected && <span>· {t("recurring.nextExpected", { date: item.nextExpected })}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="tabular text-lg font-semibold">{amount}</p>
            <p className="text-xs text-mute">{t("recurring.total", { amount: formatSGD(item.total) })}</p>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd web && npx tsc --noEmit
git add web/src/components/RecurringCard.tsx
git commit -m "feat(recurring): add RecurringCard"
```

---

## Task 5: `/recurring` page

**Files:**
- Create: `web/src/app/recurring/page.tsx`

- [ ] **Step 1: Create the route directory and page**

Create `web/src/app/recurring/page.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { HydrationGate } from "@/components/HydrationGate";
import { Card, CardBody } from "@/components/Card";
import { Button } from "@/components/Button";
import { RecurringCard } from "@/components/RecurringCard";
import { useStore } from "@/lib/store";
import { detectRecurring, monthlyCommitment } from "@/lib/recurring";
import { formatSGD } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export default function Page() {
  return (
    <AppShell>
      <HydrationGate>
        <RecurringView />
      </HydrationGate>
    </AppShell>
  );
}

function RecurringView() {
  const t = useT();
  const transactions = useStore((s) => s.transactions);
  const groups = useMemo(() => detectRecurring(transactions), [transactions]);
  const monthly = monthlyCommitment(groups);
  const isEmpty = groups.subscriptions.length === 0 && groups.frequent.length === 0;

  if (isEmpty) {
    return (
      <Card>
        <CardBody className="grid place-items-center gap-3 py-16 text-center">
          <p className="text-lg font-bold">{t("recurring.title")}</p>
          <p className="text-sm text-body">{t("recurring.empty")}</p>
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
        <h1 className="text-2xl font-semibold tracking-tight">{t("recurring.title")}</h1>
        <p className="mt-1 text-sm text-body">
          {t("recurring.monthlyCommitment", { amount: formatSGD(monthly) })} ·{" "}
          {t("recurring.subsCount", { n: groups.subscriptions.length })}
        </p>
      </div>

      {groups.subscriptions.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-mute">
            {t("recurring.sectionSubs")}
          </h2>
          {groups.subscriptions.map((it) => (
            <RecurringCard key={it.key} item={it} />
          ))}
        </section>
      )}

      {groups.frequent.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-mute">
            {t("recurring.sectionFrequent")}
          </h2>
          {groups.frequent.map((it) => (
            <RecurringCard key={it.key} item={it} />
          ))}
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd web && npx tsc --noEmit
git add web/src/app/recurring/page.tsx
git commit -m "feat(recurring): add /recurring page"
```

---

## Task 6: Dashboard summary card + nav item

**Files:**
- Create: `web/src/components/RecurringSummaryCard.tsx`
- Modify: `web/src/components/AppShell.tsx` (NAV array + import)
- Modify: `web/src/app/dashboard/page.tsx` (render the card)

- [ ] **Step 1: Create the summary card**

Create `web/src/components/RecurringSummaryCard.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Repeat } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/Card";
import { useStore } from "@/lib/store";
import { detectRecurring, monthlyCommitment } from "@/lib/recurring";
import { formatSGD } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export function RecurringSummaryCard() {
  const t = useT();
  const transactions = useStore((s) => s.transactions);
  const groups = useMemo(() => detectRecurring(transactions), [transactions]);
  if (groups.subscriptions.length === 0) return null;
  const monthly = monthlyCommitment(groups);

  return (
    <Link href="/recurring" className="block">
      <Card className="transition-colors hover:border-primary">
        <CardBody className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-primary-pale text-ink-deep">
              <Repeat className="size-5" />
            </span>
            <div>
              <CardTitle>{t("dash.recurringCard")}</CardTitle>
              <p className="text-sm text-body">
                {t("recurring.subsCount", { n: groups.subscriptions.length })}
              </p>
            </div>
          </div>
          <p className="tabular text-xl font-semibold">
            {t("recurring.monthlyCommitment", { amount: formatSGD(monthly) })}
          </p>
        </CardBody>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Add the nav item**

In `web/src/components/AppShell.tsx`, add `Repeat` to the existing lucide-react import, e.g.:

```tsx
import { Wallet, LayoutDashboard, ListChecks, Settings, Download, Upload, Repeat } from "lucide-react";
```

Then add an entry to the `NAV` array, after the Dashboard entry:

```tsx
  { href: "/recurring", key: "nav.recurring", icon: Repeat },
```

- [ ] **Step 3: Render the card on the Dashboard**

In `web/src/app/dashboard/page.tsx`, add the import near the other component imports:

```tsx
import { RecurringSummaryCard } from "@/components/RecurringSummaryCard";
```

Then render it immediately after the summary-cards grid closes — find the `</div>`
that closes the `grid gap-4 sm:grid-cols-4` block (right before the
`{/* Where your income went (flow) */}` comment) and insert on the next line:

```tsx
      <RecurringSummaryCard />

      {/* Where your income went (flow) */}
```

- [ ] **Step 4: Typecheck + lint + commit**

```bash
cd web && npx tsc --noEmit && npm run lint
git add web/src/components/RecurringSummaryCard.tsx web/src/components/AppShell.tsx web/src/app/dashboard/page.tsx
git commit -m "feat(recurring): dashboard summary card + nav item"
```

---

## Task 7: e2e + final verification

**Files:**
- Create: `web/scripts/e2e-recurring.ts`

- [ ] **Step 1: Write the e2e script**

Create `web/scripts/e2e-recurring.ts`:

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

  // Recurring page shows the subscriptions section + a known item
  await page.goto("http://localhost:3000/recurring", { waitUntil: "networkidle" });
  await page.getByText(/Subscriptions & bills/i).waitFor({ timeout: 5000 });
  const spotifyVisible = await page.getByText(/Spotify Ab/i).first().isVisible();
  const headerVisible = await page.getByText(/\/ month/i).first().isVisible();

  // Drill-in: clicking the Spotify card lands on a filtered transactions page
  await page.getByText(/Spotify Ab/i).first().click();
  await page.waitForURL("**/transactions?q=*", { timeout: 5000 });
  const drillUrl = page.url();
  const drillRows = await page.locator("table tbody tr").count();

  console.log("spotify card visible:", spotifyVisible);
  console.log("monthly header visible:", headerVisible);
  console.log("drill url:", drillUrl);
  console.log("drill rows:", drillRows);
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
npx tsx scripts/e2e-recurring.ts
```

Expected: `spotify card visible: true`; `monthly header visible: true`; `drill url`
contains `/transactions?q=`; `drill rows: 3`; `console errors: 0`.

- [ ] **Step 3: Run unit tests + typecheck + lint**

```bash
cd web
npx tsx scripts/test-recurring.ts   # 9 passed, 0 failed
npx tsx scripts/test-filters.ts     # 11 passed, 0 failed (regression guard)
npx tsc --noEmit
npm run lint
```

Expected: all green.

- [ ] **Step 4: Stop the dev server, commit**

```bash
git add web/scripts/e2e-recurring.ts
git commit -m "test(recurring): e2e for recurring page + drill-in"
```

---

## Task 8: Docs

**Files:**
- Modify: `web/README.md`
- Modify: `.github/copilot-instructions.md`
- Modify: `ROADMAP.md`

- [ ] **Step 1: Add a feature bullet to the web README**

In `web/README.md`, add a bullet to the features list (after the **Dashboard** bullet):

```md
- **Recurring** — auto-detected subscriptions & bills (stable, ~monthly) and
  frequent merchants, with average amount, cadence, and next-expected date. A
  Dashboard card summarizes your monthly commitment; each item drills into its
  transactions.
```

- [ ] **Step 2: Note the page in copilot-instructions**

In `.github/copilot-instructions.md`, add this line in the web-app section:

```md
- `/recurring` detects subscriptions/bills + frequent merchants from `lib/recurring.ts`
  (group by merchant, ≥3 months); items deep-link to `/transactions?q=<merchant>`.
```

- [ ] **Step 3: Record it in ROADMAP**

In `ROADMAP.md`, under the "Status" section, add:

```md
- Recurring & subscriptions detector: `/recurring` page + Dashboard card
  (spec: `docs/superpowers/specs/2026-06-15-recurring-detector-design.md`,
  plan: `docs/superpowers/plans/2026-06-15-recurring-detector.md`).
```

- [ ] **Step 4: Commit**

```bash
git add web/README.md .github/copilot-instructions.md ROADMAP.md
git commit -m "docs: document the recurring detector"
```

---

## Notes for the implementer

- **No new test framework:** tests are `tsx` scripts run via `npx tsx scripts/<name>.ts` (existing repo pattern), plus Playwright (already a dev dependency).
- **Privacy:** never commit `TransactionHistory_*.csv` or `MonthlyExpenseTracker.xlsx` — they are gitignored. The demo CSV is synthetic and safe to commit.
- **Drill-in reuses search:** `/transactions?q=<merchantKey>` works because `applyFilter` matches `q` against both description and `merchantKey` (`lib/filters.ts`). No new filter param.
- **Dashboard insertion point:** the summary-cards grid is the `<div className="grid gap-4 sm:grid-cols-4">…</div>` block; insert `<RecurringSummaryCard />` right after its closing `</div>`, before the flow card.
- **Why Spotify's next-expected is 2026-07-06 in the test:** gaps are 30 and 31 days → median 30.5 → `Math.round` = 31 → 2026-06-05 + 31 days = 2026-07-06.
- **Verification gates each task:** every code task ends with `npx tsc --noEmit`; Task 6 adds lint; Task 7 runs the unit tests, e2e, lint, and build.

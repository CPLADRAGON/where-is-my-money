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

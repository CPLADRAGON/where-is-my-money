import { CATEGORIES, SPENDING_PILLARS, isSpending, type SpendingPillar } from "./taxonomy";
import type { Transaction } from "./types";

export interface MoverRow {
  sub: string;
  pillar: SpendingPillar;
  current: number;
  previous: number;
  delta: number; // current - previous
}

export interface Insights {
  currentMonth: string;
  previousMonth: string;
  currentSpent: number;
  previousSpent: number;
  spentDelta: number; // current - previous (positive = spent more)
  spentDeltaPct: number | null; // null when previous is 0
  topMovers: MoverRow[]; // largest |delta|, current month vs previous
  biggestCategory: { sub: string; amount: number } | null; // in current month
}

const MAX_MOVERS = 4;

function spendingInMonth(tx: Transaction[], month: string): Transaction[] {
  return tx.filter((t) => isSpending(t.pillar) && t.month === month);
}

/**
 * Compare the latest month against the previous one. Returns null when there
 * aren't at least two months of data to compare.
 */
export function computeInsights(tx: Transaction[], months: string[]): Insights | null {
  if (months.length < 2) return null;
  const sorted = [...months].sort();
  const currentMonth = sorted[sorted.length - 1];
  const previousMonth = sorted[sorted.length - 2];

  const cur = spendingInMonth(tx, currentMonth);
  const prev = spendingInMonth(tx, previousMonth);
  if (cur.length === 0 && prev.length === 0) return null;

  const sum = (rows: Transaction[]) => rows.reduce((a, t) => a + t.amount, 0);
  const currentSpent = sum(cur);
  const previousSpent = sum(prev);
  const spentDelta = currentSpent - previousSpent;
  const spentDeltaPct = previousSpent > 0 ? spentDelta / previousSpent : null;

  // Per-sub totals for both months, keeping the pillar for coloring.
  const curBySub = new Map<string, { amount: number; pillar: SpendingPillar }>();
  const prevBySub = new Map<string, number>();
  for (const t of cur) {
    const e = curBySub.get(t.sub) ?? { amount: 0, pillar: t.pillar as SpendingPillar };
    e.amount += t.amount;
    curBySub.set(t.sub, e);
  }
  for (const t of prev) prevBySub.set(t.sub, (prevBySub.get(t.sub) ?? 0) + t.amount);

  const subs = new Set<string>([...curBySub.keys(), ...prevBySub.keys()]);
  const ownerPillar = (sub: string): SpendingPillar =>
    SPENDING_PILLARS.find((p) => CATEGORIES[p].includes(sub)) ?? "Variable Wants";
  const movers: MoverRow[] = [];
  for (const sub of subs) {
    const curEntry = curBySub.get(sub);
    const current = curEntry?.amount ?? 0;
    const previous = prevBySub.get(sub) ?? 0;
    const delta = current - previous;
    if (Math.abs(delta) < 0.005) continue;
    const pillar = curEntry?.pillar ?? ownerPillar(sub);
    movers.push({ sub, pillar, current, previous, delta });
  }
  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const topMovers = movers.slice(0, MAX_MOVERS);

  let biggestCategory: { sub: string; amount: number } | null = null;
  for (const [sub, e] of curBySub) {
    if (!biggestCategory || e.amount > biggestCategory.amount) {
      biggestCategory = { sub, amount: e.amount };
    }
  }

  return {
    currentMonth,
    previousMonth,
    currentSpent: Math.round(currentSpent * 100) / 100,
    previousSpent: Math.round(previousSpent * 100) / 100,
    spentDelta: Math.round(spentDelta * 100) / 100,
    spentDeltaPct,
    topMovers,
    biggestCategory,
  };
}

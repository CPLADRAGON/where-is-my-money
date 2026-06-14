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

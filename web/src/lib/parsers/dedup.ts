import type { NormalizedRow } from "./types";

/**
 * Purchase-first anti-double-counting across sources.
 *
 * A consumption event can appear in two ledgers: a purchase on credit/BNPL
 * (WeChat/Alipay/Meituan, tagged `bnpl`) and a later repayment that shows up in
 * the bank (OCBC) as money leaving to that issuer. If both are imported, the
 * purchase appears TIMES TWO (once as the purchase, once as the repayment).
 *
 * Rule: a repayment row becomes a TRANSFER (excluded from spending) only when a
 * matching purchase exists in the corpus. If no purchase is present, the
 * repayment is our only evidence -> keep it as EXPENSE and tag `needs_review`
 * (never silently drop it).
 */
export function applyPurchaseFirst(rows: NormalizedRow[], existing: NormalizedRow[]): NormalizedRow[] {
  const purchases = [...rows, ...existing].filter(isPurchase);
  return rows.map((r) => {
    if (!isRepayment(r)) return r;
    return hasMatchingPurchase(r, purchases)
      ? { ...r, direction: "TRANSFER" as const, tags: dedup([...r.tags, "repayment"]) }
      : { ...r, tags: dedup([...r.tags, "needs_review"]) };
  });
}

/** A credit/BNPL purchase — the "real" expense we never downgrade. */
function isPurchase(r: NormalizedRow): boolean {
  return r.direction === "EXPENSE" && r.tags.includes("bnpl");
}

/** A bank-side outflow that funds a purchase, not a purchase itself. */
function isRepayment(r: NormalizedRow): boolean {
  if (r.tags.includes("bnpl")) return false; // credit purchase = the real expense
  if (r.tags.includes("repayment")) return true;
  if (r.direction === "TRANSFER") return true;
  return issuerKey(r.counterparty) !== null;
}

/** Does a matching purchase exist (same issuer, order-id or amount + date order)? */
function hasMatchingPurchase(repayment: NormalizedRow, purchases: NormalizedRow[]): boolean {
  const key = issuerKey(repayment.counterparty);
  if (!key) return false;
  return purchases.some((p) => {
    if (issuerKey(p.counterparty) !== key) return false;
    const idMatch = repayment.sourceId && p.sourceId ? repayment.sourceId === p.sourceId : undefined;
    const amtOk = idMatch === undefined ? Math.abs(p.amount - repayment.amount) < 0.5 : true;
    return (idMatch ?? amtOk) && p.date <= repayment.date; // purchase precedes repayment
  });
}

/** Normalize a counterparty to a stable credit/BNPL issuer key, or null. */
function issuerKey(counterparty: string): string | null {
  const s = (counterparty || "").toLowerCase();
  if (/meituan|美团|月付/.test(s)) return "meituan";
  if (/alipay|支付宝|花呗|huabei|hxb|蚂蚁/.test(s)) return "alipay";
  if (/wechat|微信|腾讯/.test(s)) return "wechat";
  if (/credit|信用卡|还款/.test(s)) return "credit";
  return null;
}

function dedup(tags: string[]): string[] {
  return Array.from(new Set(tags));
}

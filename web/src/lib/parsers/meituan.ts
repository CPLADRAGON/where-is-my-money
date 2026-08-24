import Papa from "papaparse";
import type { Direction, NormalizedRow } from "./types";
import { parseAmount, splitLines } from "./helpers";

/**
 * Meituan bill (美团账单) — UTF-8 with BOM. Header row (a line starting with
 * 交易创建时间, after the `【美团交易账单明细列表】` marker):
 *   交易创建时间,交易成功时间,交易类型,订单标题,收/支,支付方式,订单金额,实付金额,交易单号,商家单号,备注
 * amount = 实付金额 (the real amount paid, after discounts — NOT 订单金额).
 * 支付方式 美团月付/花呗 -> bnpl tag.
 */
export function parseMeituan(text: string): NormalizedRow[] {
  const lines = splitLines(text);
  const headerIdx = lines.findIndex((l) => /^\s*交易创建时间/.test(l));
  if (headerIdx === -1) return [];

  const sliced = lines.slice(headerIdx).join("\n");
  const parsed = Papa.parse<Record<string, string>>(sliced, {
    header: true,
    skipEmptyLines: true,
  });

  const rows: NormalizedRow[] = [];
  for (const r of parsed.data) {
    const ts = (r["交易成功时间"] || r["交易创建时间"] || "").trim();
    if (!ts || !r["收/支"]) continue;
    const amount = Math.abs(parseAmount(r["实付金额"]));
    if (amount === 0) continue;
    const title = (r["订单标题"] ?? "").trim();
    const pm = (r["支付方式"] ?? "").trim();
    const tags: string[] = [];
    if (/月付|花呗/.test(pm)) tags.push("bnpl");
    rows.push({
      source: "MEITUAN",
      currency: "CNY",
      date: ts.slice(0, 10),
      timestamp: ts,
      rawCategory: title,
      counterparty: merchantFromTitle(title),
      amount,
      direction: mapDirection(r["收/支"]),
      paymentMethod: pm,
      tags,
      sourceId: (r["交易单号"] ?? "").trim() || undefined,
    });
  }
  return rows;
}

/** Merchant = the segment before the first `-` in 订单标题, else the full title. */
function merchantFromTitle(title: string): string {
  const dash = title.indexOf("-");
  return (dash === -1 ? title : title.slice(0, dash)).trim();
}

function mapDirection(raw: string | undefined): Direction {
  const s = (raw ?? "").trim();
  if (s === "收入") return "INCOME";
  if (s === "不计收支" || s === "中性") return "TRANSFER";
  return "EXPENSE"; // 支出 (default)
}

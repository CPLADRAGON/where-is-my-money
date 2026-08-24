import Papa from "papaparse";
import type { Direction, NormalizedRow } from "./types";
import { parseAmount, splitLines } from "../banks/helpers";

/**
 * Alipay transaction detail export (支付宝交易记录明细). Decoded from GB18030
 * upstream by the caller. Header (a line starting with 交易时间 after a
 * `------` delimiter):
 *   交易时间,交易对方,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注
 * 收/支: 支出 → EXPENSE, 收入 → INCOME, 不计收支 → TRANSFER.
 */
export function parseAlipay(text: string): NormalizedRow[] {
  const lines = splitLines(text);
  const headerIdx = lines.findIndex((l) => /^\s*交易时间/.test(l));
  if (headerIdx === -1) return [];

  const sliced = lines.slice(headerIdx).join("\n");
  const parsed = Papa.parse<Record<string, string>>(sliced, {
    header: true,
    skipEmptyLines: true,
  });

  const rows: NormalizedRow[] = [];
  for (const r of parsed.data) {
    const ts = (r["交易时间"] ?? "").trim();
    if (!ts || !r["收/支"]) continue;
    const amount = Math.abs(parseAmount(r["金额"]));
    if (amount === 0) continue;
    const pm = (r["收/付款方式"] ?? "").trim();
    rows.push({
      source: "ALIPAY",
      currency: "CNY",
      date: ts.slice(0, 10),
      timestamp: ts,
      rawCategory: (r["商品说明"] ?? "").trim(),
      counterparty: (r["交易对方"] ?? "").trim(),
      amount,
      direction: mapDirection(r["收/支"]),
      paymentMethod: pm,
      tags: /花呗/.test(pm) ? ["bnpl"] : [],
      sourceId: (r["交易订单号"] ?? "").trim() || undefined,
    });
  }
  return rows;
}

function mapDirection(raw: string | undefined): Direction {
  const s = (raw ?? "").trim();
  if (s === "支出") return "EXPENSE";
  if (s === "收入") return "INCOME";
  return "TRANSFER"; // 不计收支
}

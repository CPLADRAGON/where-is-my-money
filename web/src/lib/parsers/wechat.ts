import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Direction, NormalizedRow } from "./types";
import { parseAmount, splitLines } from "./helpers";

/**
 * WeChat Pay (微信支付账单) — `.xlsx` and `.csv`.
 * Header row: 交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注
 * `.csv` has a preamble then a header row starting with 交易时间.
 * `.xlsx` has a preamble then a `----------------------微信支付` row, and the header on the NEXT row.
 * 存取/理财通/零钱通 transfers are treated as TRANSFER (money moved, not spent).
 */
export function parseWechatText(text: string): NormalizedRow[] {
  const lines = splitLines(text);
  const headerIdx = lines.findIndex((l) => /^\s*交易时间,交易类型/.test(l));
  if (headerIdx === -1) return [];
  const sliced = lines.slice(headerIdx).join("\n");
  const parsed = Papa.parse<Record<string, string>>(sliced, {
    header: true,
    skipEmptyLines: true,
  });
  const rows: NormalizedRow[] = [];
  for (const r of parsed.data) {
    if (!r["交易时间"]) continue;
    const row = buildRow(
      r["交易时间"] ?? "",
      r["交易类型"] ?? "",
      r["交易对方"] ?? "",
      r["商品"] ?? "",
      r["收/支"] ?? "",
      r["金额(元)"] ?? "",
      r["支付方式"] ?? "",
      r["交易单号"] ?? ""
    );
    if (row) rows.push(row);
  }
  return rows;
}

export function parseWechatXlsx(bytes: ArrayBuffer): NormalizedRow[] {
  const wb = XLSX.read(bytes, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]] ?? {};
  const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  const headerIdx = aoa.findIndex((row) => String(row?.[0]) === "交易时间");
  if (headerIdx === -1) return [];
  const rows: NormalizedRow[] = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const c = aoa[i];
    if (!Array.isArray(c) || !c[0]) continue;
    const row = buildRow(
      String(c[0] ?? ""), String(c[1] ?? ""), String(c[2] ?? ""), String(c[3] ?? ""),
      String(c[4] ?? ""), c[5] ?? "", String(c[6] ?? ""), String(c[8] ?? "")
    );
    if (row) rows.push(row);
  }
  return rows;
}

function buildRow(
  ts: string, txType: string, counterparty: string, rawCategory: string,
  dirRaw: string, amountRaw: string | number, pm: string, sourceId: string
): NormalizedRow | null {
  const t = ts.trim();
  const dir = dirRaw.trim();
  if (!t || !dir) return null;
  const amount = Math.abs(parseAmount(amountRaw == null ? "" : String(amountRaw)));
  if (amount === 0) return null;
  const paymentMethod = pm.trim();
  const tags: string[] = [];
  if (/花呗|信用/.test(paymentMethod)) tags.push("bnpl");
  return {
    source: "WECHAT",
    currency: "CNY",
    date: t.slice(0, 10),
    timestamp: t,
    rawCategory,
    counterparty,
    amount,
    direction: mapDirection(dir, txType),
    paymentMethod,
    tags,
    sourceId: sourceId.trim() || undefined,
  };
}

function mapDirection(dirRaw: string, txType: string): Direction {
  if (dirRaw === "支出") {
    // 充值/提现/零钱通存取/理财通 -> internal move, not spending
    if (/充值|提现|零钱通|理财通|转入|转出/.test(txType)) return "TRANSFER";
    return "EXPENSE";
  }
  if (dirRaw === "收入") return "INCOME";
  return "TRANSFER"; // 中性 / 不计收支
}

import * as XLSX from "xlsx";
import type { Source } from "./types";
import { decodeBytes } from "./encoding";

export type ClassifyResult =
  | { kind: "classified"; source: Source; bankId: string; bankLabel: string; encoding: string }
  | { kind: "unknown" };

const SOURCE_META: Record<Source, { bankId: string; bankLabel: string }> = {
  OCBC: { bankId: "ocbc", bankLabel: "OCBC" },
  WECHAT: { bankId: "wechat", bankLabel: "WeChat Pay" },
  ALIPAY: { bankId: "alipay", bankLabel: "Alipay" },
  MEITUAN: { bankId: "meituan", bankLabel: "Meituan" },
};

/** Detect source from file name + content. Unknown -> { kind: "unknown" }. */
export function classifyFile(bytes: ArrayBuffer, name: string): ClassifyResult {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "xlsx" || ext === "xls") {
    const source = detectFromXlsx(bytes);
    return source ? classified(source, "xlsx") : { kind: "unknown" };
  }
  const { text, encoding } = decodeBytes(bytes);
  const lines = text.split(/\r\n|\r|\n/);
  const source = detectFromLines(lines);
  return source ? classified(source, encoding) : { kind: "unknown" };
}

function classified(source: Source, encoding: string): ClassifyResult {
  return { kind: "classified", source, ...SOURCE_META[source], encoding };
}

function detectFromLines(lines: string[]): Source | null {
  const head = lines.join("\n");
  // Data-header signatures — scan EVERY line, since the header can sit well past a
  // long preamble (Alipay's is at line ~23 after 8 tip lines). 交易分类 = Alipay,
  // 交易类型 = WeChat (the discriminator).
  for (const l of lines) {
    if (/^\s*交易时间,交易分类,交易对方/.test(l)) return "ALIPAY";
    if (/^\s*交易时间,交易类型,交易对方/.test(l)) return "WECHAT";
    if (/^\s*交易创建时间,交易成功时间/.test(l)) return "MEITUAN";
  }
  // Preamble/title signatures (fallback when the data header isn't the first to match).
  if (/支付宝交易记录明细/.test(head)) return "ALIPAY";
  if (/美团交易账单明细/.test(head)) return "MEITUAN";
  if (/微信支付账单明细/.test(head)) return "WECHAT";
  if (
    /transaction date/i.test(head) &&
    /withdrawals?\s*\(sgd\)/i.test(head) &&
    /deposits?\s*\(sgd\)/i.test(head)
  ) return "OCBC";
  return null;
}

function detectFromXlsx(bytes: ArrayBuffer): Source | null {
  try {
    const wb = XLSX.read(bytes, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]] ?? {};
    const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    const head = JSON.stringify(aoa.slice(0, 20));
    if (/微信支付账单明细|交易时间,交易类型/.test(head)) return "WECHAT";
    return null; // WeChat is the only .xlsx source in the first slice
  } catch {
    return null;
  }
}

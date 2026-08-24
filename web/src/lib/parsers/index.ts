import type {
  IncomeByMonth,
  IncomeDeposit,
  ParseResult,
  Transaction,
} from "../types";
import { categorize, detectTransfer, merchantKeyFrom } from "../categorize";
import { isSpending } from "../taxonomy";
import { classifyFile } from "./classifier";
import { decodeBytes } from "./encoding";
import { parseAlipay } from "./alipay";
import { parseMeituan } from "./meituan";
import { parseOcbc } from "./ocbc";
import { parseWechatText, parseWechatXlsx } from "./wechat";
import type { NormalizedRow, SourceFileResult } from "./types";

export interface IngestFile {
  bytes: ArrayBuffer;
  name: string;
}

export interface BatchResult {
  files: SourceFileResult[];
  unknown: IngestFile[];
  errorFiles: { name: string; error: string }[];
}

/** Classify + parse each file. Unknown files are queued for the mapping wizard. */
export function parseBatch(files: IngestFile[]): BatchResult {
  const out: BatchResult = { files: [], unknown: [], errorFiles: [] };
  for (const f of files) {
    try {
      const cls = classifyFile(f.bytes, f.name);
      if (cls.kind === "unknown") {
        out.unknown.push(f);
        continue;
      }
      const ext = f.name.split(".").pop()?.toLowerCase();
      let rows: NormalizedRow[] = [];
      if (cls.source === "WECHAT" && (ext === "xlsx" || ext === "xls")) {
        rows = parseWechatXlsx(f.bytes);
      } else {
        const { text } = decodeBytes(f.bytes);
        rows =
          cls.source === "OCBC"
            ? parseOcbc(text)
            : cls.source === "ALIPAY"
            ? parseAlipay(text)
            : cls.source === "MEITUAN"
            ? parseMeituan(text)
            : parseWechatText(text);
      }
      out.files.push({
        source: cls.source,
        bankId: cls.bankId,
        bankLabel: cls.bankLabel,
        encoding: cls.encoding,
        name: f.name,
        rows,
      });
    } catch (e) {
      out.errorFiles.push({
        name: f.name,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return out;
}

/** djb2 string hash → short stable hex id. */
function hash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

/** Bridge parsed/source files down to the app's `ParseResult`. */
export function bridgeToApp(files: SourceFileResult[]): ParseResult {
  const transactions: Transaction[] = [];
  const incomeByMonth: IncomeByMonth = {};
  const incomeDeposits: IncomeDeposit[] = [];
  const seenSpend = new Map<string, number>();
  const seenIncome = new Map<string, number>();
  const months = new Set<string>();
  let defaulted = 0;
  let transfers = 0;

  for (const file of files) {
    for (const row of file.rows) {
      const month = row.date.slice(0, 7);
      months.add(month);

      // Income is handled separately (not a transaction row).
      if (row.direction === "INCOME") {
        incomeByMonth[month] = (incomeByMonth[month] ?? 0) + row.amount;
        const key = `${file.source}|${row.date}|${row.amount.toFixed(2)}|${row.rawCategory}`;
        const k = seenIncome.get(key) ?? 0;
        seenIncome.set(key, k + 1);
        incomeDeposits.push({
          id: hash(k === 0 ? key : `${key}#${k}`),
          month,
          amount: row.amount,
        });
        continue;
      }
      if (row.direction !== "EXPENSE" && row.direction !== "TRANSFER") continue;

      const merchantKey = row.counterparty.trim() || merchantKeyFrom(row.rawCategory);
      const cat = categorize(row.rawCategory, merchantKey, {});
      let pillar = cat.pillar;
      let sub = cat.sub;
      let provenance = cat.provenance;

      if (row.direction === "TRANSFER") {
        pillar = "Transfer";
        sub = detectTransfer(row.rawCategory)?.sub ?? "Personal Transfer";
        provenance = "rule";
      }

      if (provenance === "default") defaulted++;
      if (!isSpending(pillar)) transfers++;

      const baseKey = `${file.source}|${row.date}|${row.amount.toFixed(2)}|${row.rawCategory}${row.sourceId ?? ""}`;
      const n = seenSpend.get(baseKey) ?? 0;
      seenSpend.set(baseKey, n + 1);
      const id = hash(n === 0 ? baseKey : `${baseKey}#${n}`);

      transactions.push({
        id,
        date: row.date,
        month,
        description: row.rawCategory,
        merchantKey,
        amount: row.amount,
        pillar,
        sub,
        provenance,
        source: file.source,
        currency: row.currency,
        nativeAmount: row.amount,
        counterparty: row.counterparty,
        paymentMethod: row.paymentMethod,
        tags: row.tags,
      });
    }
  }

  const income = Object.values(incomeByMonth).reduce((a, b) => a + b, 0);
  return {
    transactions,
    incomeByMonth,
    months: Array.from(months).sort(),
    incomeDeposits,
    bankId: files.map((f) => f.bankId).join("+"),
    bankLabel: label(files),
    stats: {
      total: transactions.length,
      autoCategorized: transactions.length - defaulted,
      defaulted,
      transfers,
      income,
    },
  };
}

function label(files: SourceFileResult[]): string {
  const unique = Array.from(new Set(files.map((f) => f.source)));
  if (unique.length <= 1) return files[0]?.bankLabel ?? "";
  return "Multiple sources";
}

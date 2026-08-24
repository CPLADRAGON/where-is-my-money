import type {
  IncomeByMonth,
  IncomeDeposit,
  ParseResult,
  Transaction,
} from "../types";
import { categorize, detectTransfer, merchantKeyFrom } from "../categorize";
import { isValidPair, isSpending, type Pillar } from "../taxonomy";
import { classifyFile } from "./classifier";
import { decodeBytes } from "./encoding";
import { parseAlipay } from "./alipay";
import { parseMeituan } from "./meituan";
import { parseOcbc } from "./ocbc";
import { parseWechatText, parseWechatXlsx } from "./wechat";
import { parseWithMapping, previewCsv, type ColumnMapping, type DateFormat, type RawRow } from "./mapping";
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

const DEFAULT_INCOME_KEYWORDS =
  /SALARY|PAYROLL|WAGES|\bSALA\b|MONTHLY PAY/i;

interface BuildOpts {
  overrides?: Record<string, { pillar: Pillar; sub: string }>;
  learned?: Record<string, { pillar: Pillar; sub: string }>;
  incomeKeywords?: RegExp;
}

/** Turn normalized rows into categorized transactions + income + stats (custom-mapping path). */
export function buildParseResult(
  rawRows: RawRow[],
  bankId: string,
  bankLabel: string,
  opts: BuildOpts = {}
): ParseResult {
  const incomeRe = opts.incomeKeywords ?? DEFAULT_INCOME_KEYWORDS;
  const transactions: Transaction[] = [];
  const incomeByMonth: IncomeByMonth = {};
  const incomeDeposits: IncomeDeposit[] = [];
  const seen = new Map<string, number>();
  const seenIncome = new Map<string, number>();

  let defaulted = 0;
  let transfers = 0;

  for (const row of rawRows) {
    const month = row.date.slice(0, 7);

    if (row.income > 0 && row.spend === 0) {
      if (incomeRe.test(row.description)) {
        incomeByMonth[month] = (incomeByMonth[month] ?? 0) + row.income;
        const baseKey = `${row.date}|${row.income.toFixed(2)}|${row.description}`;
        const k = seenIncome.get(baseKey) ?? 0;
        seenIncome.set(baseKey, k + 1);
        const depId = hash(k === 0 ? baseKey : `${baseKey}#${k}`);
        incomeDeposits.push({ id: depId, month, amount: row.income });
      }
      continue;
    }
    if (row.spend === 0) continue;

    const baseKey = `${row.date}|${row.spend.toFixed(2)}|${row.description}`;
    const n = seen.get(baseKey) ?? 0;
    seen.set(baseKey, n + 1);
    const id = hash(n === 0 ? baseKey : `${baseKey}#${n}`);

    const merchantKey = merchantKeyFrom(row.description);

    let result = categorize(row.description, merchantKey, {
      overrides: opts.overrides,
      learned: opts.learned,
      fingerprint: id,
    });
    if (
      result.provenance === "default" &&
      row.existingCategory &&
      isValidPair(splitPillar(row.existingCategory), splitSub(row.existingCategory))
    ) {
      result = {
        pillar: splitPillar(row.existingCategory) as Pillar,
        sub: splitSub(row.existingCategory),
        provenance: "rule",
      };
    }

    if (result.provenance === "default") defaulted++;
    if (!isSpending(result.pillar)) transfers++;

    transactions.push({
      id,
      date: row.date,
      month,
      description: row.description,
      merchantKey,
      amount: row.spend,
      pillar: result.pillar,
      sub: result.sub,
      provenance: result.provenance,
    });
  }

  const months = Array.from(
    new Set(transactions.map((t) => t.month))
  ).sort();
  const income = Object.values(incomeByMonth).reduce((a, b) => a + b, 0);

  return {
    transactions,
    incomeByMonth,
    incomeDeposits,
    months,
    bankId,
    bankLabel,
    stats: {
      total: transactions.length,
      autoCategorized: transactions.length - defaulted,
      defaulted,
      transfers,
      income,
    },
  };
}

/** Parse via a user-defined column mapping (custom/unknown bank). */
export function parseMapped(
  csvText: string,
  mapping: ColumnMapping,
  label = "Custom mapping"
): ParseResult {
  const rows = parseWithMapping(csvText, mapping);
  return buildParseResult(rows, "custom", label);
}

/** Parse a single CSV string through the auto-detected pipeline (convenience). */
export function parseDetected(csvText: string): ParseResult {
  const bytes = new TextEncoder().encode(csvText).buffer;
  const batch = parseBatch([{ bytes, name: "statement.csv" }]);
  if (batch.files.length === 0) throw new Error("UNKNOWN_BANK");
  return bridgeToApp(batch.files);
}

// "Pillar — Sub" / "Pillar: Sub" / "Pillar > Sub" existing-category parsing.
function splitPillar(cat: string): string {
  const parts = cat.split(/\s*[—:>|]\s*|\s-\s/);
  return parts[0]?.trim() ?? cat.trim();
}
function splitSub(cat: string): string {
  const parts = cat.split(/\s*[—:>|]\s*|\s-\s/);
  return parts[1]?.trim() ?? "";
}

export { parseWithMapping, previewCsv };
export type { ColumnMapping, DateFormat, RawRow };

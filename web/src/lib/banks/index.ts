import { categorize, merchantKeyFrom } from "../categorize";
import type { Pillar } from "../taxonomy";
import { isValidPair } from "../taxonomy";
import type { ParseResult, Transaction } from "../types";
import { ocbcAdapter } from "./ocbc";
import { parseWithMapping } from "./generic";
import type { BankAdapter, ColumnMapping, RawRow } from "./types";
import { splitLines } from "./helpers";

export const ADAPTERS: BankAdapter[] = [ocbcAdapter];

const DEFAULT_INCOME_KEYWORDS =
  /SALARY|PAYROLL|WAGES|\bSALA\b|MONTHLY PAY/i;

/** Auto-detect a bank adapter from the CSV text. */
export function detectBank(csvText: string): BankAdapter | null {
  const lines = splitLines(csvText);
  return ADAPTERS.find((a) => a.detect(lines)) ?? null;
}

/** djb2 string hash → short stable hex id. */
function hash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

interface BuildOpts {
  overrides?: Record<string, { pillar: Pillar; sub: string }>;
  learned?: Record<string, { pillar: Pillar; sub: string }>;
  incomeKeywords?: RegExp;
}

/** Turn normalized rows into categorized transactions + income + stats. */
export function buildParseResult(
  rawRows: RawRow[],
  bankId: string,
  bankLabel: string,
  opts: BuildOpts = {}
): ParseResult {
  const incomeRe = opts.incomeKeywords ?? DEFAULT_INCOME_KEYWORDS;
  const transactions: Transaction[] = [];
  const incomeByMonth: Record<string, number> = {};
  const seen = new Map<string, number>();

  let defaulted = 0;

  for (const row of rawRows) {
    const month = row.date.slice(0, 7);

    if (row.income > 0 && row.spend === 0) {
      if (incomeRe.test(row.description)) {
        incomeByMonth[month] = (incomeByMonth[month] ?? 0) + row.income;
      }
      continue;
    }
    if (row.spend === 0) continue;

    // Stable fingerprint; disambiguate exact duplicates within a file.
    const baseKey = `${row.date}|${row.spend.toFixed(2)}|${row.description}`;
    const n = seen.get(baseKey) ?? 0;
    seen.set(baseKey, n + 1);
    const id = hash(n === 0 ? baseKey : `${baseKey}#${n}`);

    const merchantKey = merchantKeyFrom(row.description);

    // Honor a valid pre-existing category from the source file as a rule hit.
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
    months,
    bankId,
    bankLabel,
    stats: {
      total: transactions.length,
      autoCategorized: transactions.length - defaulted,
      defaulted,
      income,
    },
  };
}

/** Parse via an auto-detected adapter. Throws if none match. */
export function parseDetected(csvText: string): ParseResult {
  const adapter = detectBank(csvText);
  if (!adapter) {
    throw new Error("UNKNOWN_BANK");
  }
  const rows = adapter.parse(csvText);
  return buildParseResult(rows, adapter.id, adapter.label, {
    incomeKeywords: adapter.incomeKeywords,
  });
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

// "Pillar — Sub" / "Pillar: Sub" / "Pillar > Sub" existing-category parsing.
// Note: sub-categories themselves contain "/" (e.g. Accommodation/Rent), so "/"
// is intentionally NOT a separator here.
function splitPillar(cat: string): string {
  const parts = cat.split(/\s*[—:>|]\s*|\s-\s/);
  return parts[0]?.trim() ?? cat.trim();
}
function splitSub(cat: string): string {
  const parts = cat.split(/\s*[—:>|]\s*|\s-\s/);
  return parts[1]?.trim() ?? "";
}

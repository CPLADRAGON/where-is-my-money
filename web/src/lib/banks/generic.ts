import Papa from "papaparse";
import type { ColumnMapping, RawRow } from "./types";
import { normalizeText, parseAmount, parseDate, splitLines } from "./helpers";

/**
 * Build normalized rows from an arbitrary CSV using a user-defined column
 * mapping (produced by the column-mapping wizard). Handles a single signed
 * amount column or separate debit/credit columns.
 */
export function parseWithMapping(
  csvText: string,
  mapping: ColumnMapping
): RawRow[] {
  const lines = splitLines(csvText);
  const sliced = lines.slice(mapping.headerRowIndex).join("\n");
  const parsed = Papa.parse<Record<string, string>>(sliced, {
    header: true,
    skipEmptyLines: true,
  });

  const rows: RawRow[] = [];
  for (const r of parsed.data) {
    const date = parseDate(r[mapping.dateField], mapping.dateFormat);
    if (!date) continue;

    const description = normalizeText(
      mapping.descriptionFields.map((f) => r[f] ?? "").join(" ")
    );

    let spend = 0;
    let income = 0;
    if (mapping.amountMode === "split") {
      spend = mapping.debitField ? Math.abs(parseAmount(r[mapping.debitField])) : 0;
      income = mapping.creditField ? Math.abs(parseAmount(r[mapping.creditField])) : 0;
    } else {
      const amt = mapping.amountField ? parseAmount(r[mapping.amountField]) : 0;
      const negIsSpend = mapping.signConvention !== "positive-is-spend";
      if (negIsSpend) {
        if (amt < 0) spend = Math.abs(amt);
        else income = amt;
      } else {
        if (amt > 0) spend = amt;
        else income = Math.abs(amt);
      }
    }
    if (spend === 0 && income === 0) continue;

    const existingCategory = mapping.categoryField
      ? normalizeText(r[mapping.categoryField]) || undefined
      : undefined;

    rows.push({ date, description, spend, income, existingCategory });
  }
  return rows;
}

/** Preview helper: header fields + a few sample rows for the wizard UI. */
export function previewCsv(
  csvText: string,
  headerRowIndex: number,
  sampleSize = 5
): { fields: string[]; rows: Record<string, string>[] } {
  const lines = splitLines(csvText);
  const sliced = lines.slice(headerRowIndex).join("\n");
  const parsed = Papa.parse<Record<string, string>>(sliced, {
    header: true,
    skipEmptyLines: true,
    preview: sampleSize + 1,
  });
  return {
    fields: parsed.meta.fields ?? [],
    rows: parsed.data.slice(0, sampleSize),
  };
}

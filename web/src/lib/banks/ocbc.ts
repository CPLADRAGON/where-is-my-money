import Papa from "papaparse";
import type { BankAdapter, RawRow } from "./types";
import { normalizeText, parseAmount, parseDate, splitLines } from "./helpers";

/**
 * OCBC FRANK account export.
 * Preamble: "Account details for:", balances, blank line, "Transaction History",
 * then the header: Transaction date,Value date,Description,Withdrawals(SGD),Deposits(SGD).
 * Withdrawals = spend; Deposits = income/refund (exactly one populated per row).
 * Dates are DD/MM/YYYY.
 */
export const ocbcAdapter: BankAdapter = {
  id: "ocbc",
  label: "OCBC (FRANK / 360 / statement CSV)",
  incomeKeywords: /GIRO - SALARY|\bSALARY\b|INFI\s*NEON|TECHNOLOG\s*SALA/i,

  detect(lines) {
    return lines.some(
      (l) =>
        /transaction date/i.test(l) &&
        /withdrawals?\s*\(sgd\)/i.test(l) &&
        /deposits?\s*\(sgd\)/i.test(l)
    );
  },

  parse(csvText) {
    const lines = splitLines(csvText);
    const headerIdx = lines.findIndex((l) =>
      /^\s*transaction date/i.test(l)
    );
    if (headerIdx === -1) return [];

    const sliced = lines.slice(headerIdx).join("\n");
    const parsed = Papa.parse<Record<string, string>>(sliced, {
      header: true,
      skipEmptyLines: true,
    });

    const rows: RawRow[] = [];
    for (const r of parsed.data) {
      const keys = Object.keys(r);
      const dateKey = keys.find((k) => /transaction date/i.test(k));
      const descKey = keys.find((k) => /description/i.test(k));
      const wKey = keys.find((k) => /withdrawal/i.test(k));
      const dKey = keys.find((k) => /deposit/i.test(k));
      if (!dateKey || !descKey) continue;

      const date = parseDate(r[dateKey], "DD/MM/YYYY");
      if (!date) continue;
      const description = normalizeText(r[descKey]);
      const spend = wKey ? Math.abs(parseAmount(r[wKey])) : 0;
      const income = dKey ? Math.abs(parseAmount(r[dKey])) : 0;
      if (spend === 0 && income === 0) continue;
      rows.push({ date, description, spend, income });
    }
    return rows;
  },
};

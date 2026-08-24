import Papa from "papaparse";
import type { Direction, NormalizedRow } from "./types";
import { normalizeText, parseAmount, parseDate, splitLines } from "../banks/helpers";
import { detectTransfer, merchantKeyFrom } from "../categorize";

const INCOME_RE = /GIRO - SALARY|\bSALARY\b|INFI\s*NEON|TECHNOLOG\s*SALA/i;

/**
 * OCBC FRANK / statement CSV. Preamble rows, then header:
 *   Transaction date,Value date,Description,Withdrawals(SGD),Deposits(SGD)
 * Withdrawals = spend; Deposits = income/refund. Dates DD/MM/YYYY.
 * Money to a person / savings platform is TRANSFER (reuses categorize.detectTransfer).
 */
export function parseOcbc(text: string): NormalizedRow[] {
  const lines = splitLines(text);
  const headerIdx = lines.findIndex((l) => /^\s*transaction date/i.test(l));
  if (headerIdx === -1) return [];

  const sliced = lines.slice(headerIdx).join("\n");
  const parsed = Papa.parse<Record<string, string>>(sliced, {
    header: true,
    skipEmptyLines: true,
  });

  const rows: NormalizedRow[] = [];
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

    let direction: Direction;
    let amount: number;
    if (income > 0 && INCOME_RE.test(description)) {
      direction = "INCOME";
      amount = income;
    } else if (spend > 0 && detectTransfer(description)) {
      direction = "TRANSFER";
      amount = spend;
    } else if (spend > 0) {
      direction = "EXPENSE";
      amount = spend;
    } else {
      continue;
    }

    rows.push({
      source: "OCBC",
      currency: "SGD",
      date,
      timestamp: date,
      rawCategory: description,
      counterparty: merchantKeyFrom(description),
      amount,
      direction,
      paymentMethod: "OCBC Debit",
      tags: [],
    });
  }
  return rows;
}

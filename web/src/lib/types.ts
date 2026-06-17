import type { Pillar } from "./taxonomy";

/** How a transaction got its category — drives the provenance badge. */
export type Provenance = "manual" | "learned" | "rule" | "default";

/** A normalized transaction after parsing + categorization. */
export interface Transaction {
  /** Stable fingerprint: hash of date+amount+normalized description. */
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** YYYY-MM bucket for month filtering. */
  month: string;
  /** Whitespace-normalized description text. */
  description: string;
  /** Derived clean payee key used for merchant learning. */
  merchantKey: string;
  /** Positive amount that left the account (SGD). */
  amount: number;
  pillar: Pillar;
  sub: string;
  provenance: Provenance;
}

/** Per-month detected/overridden income. */
export type IncomeByMonth = Record<string, number>;

/** A fingerprinted income (salary) deposit, used to de-duplicate on merge. */
export interface IncomeDeposit {
  id: string;
  month: string;
  amount: number;
}

/** Result of parsing a CSV through a bank adapter. */
export interface ParseResult {
  transactions: Transaction[];
  incomeByMonth: IncomeByMonth;
  months: string[];
  /** Fingerprinted salary deposits (for income de-dup on merge). */
  incomeDeposits: IncomeDeposit[];
  /** Which bank adapter produced this (or "custom"/"generic"). */
  bankId: string;
  bankLabel: string;
  /** Counts for the import summary. */
  stats: {
    total: number;
    autoCategorized: number;
    defaulted: number;
    transfers: number;
    income: number;
  };
}

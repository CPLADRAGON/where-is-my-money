/** A row after a bank adapter has normalized the CSV shape. */
export interface RawRow {
  /** ISO date YYYY-MM-DD. */
  date: string;
  description: string;
  /** Positive spend amount (0 if this row is income/other). */
  spend: number;
  /** Positive income/deposit amount (0 if this row is spend). */
  income: number;
  /** Optional pre-existing category from the source file. */
  existingCategory?: string;
}

export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD-MM-YYYY";

/** User-defined mapping for an unknown CSV (column-mapping wizard output). */
export interface ColumnMapping {
  /** 0-based index of the header row within the file. */
  headerRowIndex: number;
  dateField: string;
  dateFormat: DateFormat;
  descriptionFields: string[];
  amountMode: "single" | "split";
  /** single mode */
  amountField?: string;
  signConvention?: "negative-is-spend" | "positive-is-spend";
  /** split mode */
  debitField?: string;
  creditField?: string;
  /** optional */
  categoryField?: string;
}

export interface BankAdapter {
  id: string;
  label: string;
  /** Heuristic: does this adapter recognize the file? */
  detect(lines: string[]): boolean;
  /** Parse the raw CSV text into normalized rows. */
  parse(csvText: string): RawRow[];
  /** Optional salary-income keyword override. */
  incomeKeywords?: RegExp;
}

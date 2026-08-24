export type Source = "OCBC" | "WECHAT" | "ALIPAY" | "MEITUAN";
export type Direction = "EXPENSE" | "INCOME" | "TRANSFER";

export interface NormalizedRow {
  source: Source;
  currency: "SGD" | "CNY";
  date: string;          // ISO YYYY-MM-DD (drives the app's month bucket)
  timestamp: string;     // full ISO; === date for OCBC
  rawCategory: string;   // raw product/description text
  counterparty: string;  // payee / merchant name
  amount: number;        // positive, native currency
  direction: Direction;
  paymentMethod: string;
  tags: string[];        // e.g. ['bnpl','repayment']
  sourceId?: string;     // order/merchant id, for cross-source dedup
}

export interface SourceFileResult {
  source: Source;
  bankId: string;    // 'ocbc' | 'wechat' | 'alipay' | 'meituan'
  bankLabel: string; // human name
  encoding: string;  // 'utf-8' | 'gb18030' | 'xlsx' | 'utf-16'
  rows: NormalizedRow[];
}

export interface DecodedFile {
  text: string;
  encoding: string;
}

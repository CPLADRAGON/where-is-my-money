import {
  DEFAULT_CATEGORY,
  SAVINGS_DEFAULT,
  TRANSFER_DEFAULT,
  type Pillar,
} from "./taxonomy";
import type { Provenance } from "./types";

/**
 * Merchant-text rules ported from build_tracker.py. First match wins; matched
 * case-insensitively against the whitespace-normalized description.
 */
const RULES: { re: RegExp; pillar: Pillar; sub: string }[] = [
  { re: /BUS\/MRT|CAUSEWAYLINK|GOPAY|GOJEK|GRAB|COMFORTDELGRO|SMRT|TRANSITLINK/i, pillar: "Fixed Needs", sub: "Transport" },
  { re: /SHENG SIONG|NTUC|FAIRPRICE|NTUC FP|GIANT|COLD STORAGE|GOURMET PARADISE|7-ELEVEN|7 ELEVEN|KK MART|KK SUPER|99 SPEEDMART|CHEERS|PRIME SUPER/i, pillar: "Fixed Needs", sub: "Basic Groceries" },
  { re: /SP SERVICES|SP SVCS|SINGTEL|STARHUB|M1 |MYREPUBLIC|CIRCLES\.LIFE|SINGTEL PREPAID|PUB /i, pillar: "Fixed Needs", sub: "Utilities" },
  { re: /INSURANCE|AIA|PRUDENTIAL|GREAT EASTERN|NTUC INCOME|MANULIFE/i, pillar: "Fixed Needs", sub: "Insurance" },
  { re: /RENT|RENTAL|ACCOMMODATION|HOSTEL|LANDLORD/i, pillar: "Fixed Needs", sub: "Accommodation/Rent" },
  { re: /STRIPE|NETFLIX|SPOTIFY|YOUTUBE|ICLOUD|APPLE\.COM|GOOGLE \*|OPENAI|CHATGPT|ADOBE|MICROSOFT|AMAZON PRIME|DISNEY/i, pillar: "Variable Wants", sub: "Subscriptions" },
  { re: /BURGER KING|MCDONALD|KFC|STARBUCKS|COFFEE|CAFE|KOPITIAM|FOODPANDA|DELIVEROO|ASIAN ROTISSERIE|IRON CHEF|A KITCHEN|CHOCOLICIOUS|RESTAURANT|EATERY|F&B|BAKERY|TOAST|BUBBLE|DESSERT|HAWKER|FOOD|DELIGHT|TECHNO EDGE|KITCHEN|HWANG/i, pillar: "Variable Wants", sub: "Dining Out/Cafes" },
  { re: /SHOPEE|LAZADA|UNIQLO|H&M|MALL|WATSON|GUARDIAN|DAISO|MUJI|DECATHLON|POPULAR|CHALLENGER|COURTS/i, pillar: "Variable Wants", sub: "Shopping" },
  { re: /CATHAY|GOLDEN VILLAGE|GV |SHAW|CINEMA|KARAOKE|KTV|ARCADE|STEAM /i, pillar: "Variable Wants", sub: "Entertainment/Hobbies" },
  { re: /AIRLINE|AIRASIA|SCOOT|SINGAPORE AIRLINES|HOTEL|AGODA|BOOKING\.COM|EXPEDIA|KLOOK|AIRBNB/i, pillar: "Variable Wants", sub: "Travel" },
];

/** Investment / savings platforms — money here is a transfer, not spending. */
const INVESTMENT_RE =
  /SYFE|ENDOWUS|STASHAWAY|FSMONE|FUNDSUPERMART|MOOMOO|FUTU|TIGER BROKERS|INTERACTIVE BROKERS|\bIBKR\b|WEBULL|SAXO|POEMS|DBS INVEST|REGULAR SAVINGS|FIXED DEPOSIT|\bSSB\b|SINGAPORE SAVINGS BOND|CPF|SRS|GIGANTIQ|SINGLIFE/i;

/**
 * Detect a transfer (money moved, not spent). Returns a category or null.
 * - Investment/savings platforms -> Savings / Investment.
 * - Person-to-person PayNow/FAST transfers (to a person, via Mobile) -> Personal Transfer.
 */
function detectTransfer(description: string): { pillar: Pillar; sub: string } | null {
  if (INVESTMENT_RE.test(description)) return SAVINGS_DEFAULT;

  const d = description.toUpperCase();
  // Person-to-person heuristics: mobile PayNow / "Transfer - Mobile" / fund transfer
  // to a named individual. UEN payments are businesses → treated as spending.
  const looksP2P =
    /PAYNOW-MOBILE/.test(d) ||
    /TRANSFER\s*-\s*MOBILE/.test(d) ||
    (/(FAST PAYMENT|FUND TRANSFER|PAYMENT\/TRANSFER)/.test(d) &&
      /\bTO\s+[A-Z]/.test(d) &&
      !/PAYNOW-UEN/.test(d));
  if (looksP2P) return TRANSFER_DEFAULT;
  return null;
}

export interface CategoryResult {
  pillar: Pillar;
  sub: string;
  provenance: Provenance;
}

/**
 * Categorize a transaction using precedence:
 * manual override -> learned merchant rule -> spending RULES -> transfer
 * detection -> default (Variable Wants / Shopping).
 */
export function categorize(
  description: string,
  merchantKey: string,
  opts: {
    overrides?: Record<string, { pillar: Pillar; sub: string }>;
    learned?: Record<string, { pillar: Pillar; sub: string }>;
    fingerprint?: string;
  } = {}
): CategoryResult {
  const { overrides, learned, fingerprint } = opts;

  if (fingerprint && overrides?.[fingerprint]) {
    const o = overrides[fingerprint];
    return { pillar: o.pillar, sub: o.sub, provenance: "manual" };
  }
  if (merchantKey && learned?.[merchantKey]) {
    const l = learned[merchantKey];
    return { pillar: l.pillar, sub: l.sub, provenance: "learned" };
  }
  for (const rule of RULES) {
    if (rule.re.test(description)) {
      return { pillar: rule.pillar, sub: rule.sub, provenance: "rule" };
    }
  }
  const transfer = detectTransfer(description);
  if (transfer) {
    return { pillar: transfer.pillar, sub: transfer.sub, provenance: "rule" };
  }
  return {
    pillar: DEFAULT_CATEGORY.pillar,
    sub: DEFAULT_CATEGORY.sub,
    provenance: "default",
  };
}

/**
 * Derive a clean payee key from noisy bank text so recurring merchants/people
 * collapse to the same key. Strips transfer noise, card masks, ref numbers.
 */
export function merchantKeyFrom(description: string): string {
  let s = description.toUpperCase();

  // Pull out the human/merchant name in "to NAME" / "from NAME" transfers.
  const toFrom = s.match(/\b(?:TO|FROM)\s+([A-Z][A-Z .'&-]{2,40})/);
  if (toFrom) {
    s = toFrom[1];
  }

  s = s
    .replace(/VIA PAYNOW[-\w]*/g, " ")
    .replace(/PAYNOW[-\w]*/g, " ")
    .replace(/\bOTHR\b[-\w]*/g, " ")
    .replace(/\bBEXP\b|\bCHAR\b/g, " ")
    .replace(/\bXX-\d+\b/g, " ") // card masks like xx-1767
    .replace(/\b\d{4,}\b/g, " ") // long ref numbers
    .replace(/\bSGD?\b|\bMYR\b/g, " ")
    .replace(/\bDEBIT PURCHASE\b|\bFAST PAYMENT\b|\bFUND TRANSFER\b|\bPAYMENT\/TRANSFER\b|\bNETS QR\b|\bBILL PAYMENT\b|\bINB\b/g, " ")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Keep it to the first few significant words.
  return s.split(" ").slice(0, 4).join(" ");
}

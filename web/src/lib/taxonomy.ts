/**
 * The canonical 3-bucket taxonomy and budget targets.
 * Mirrors the Python generator (build_tracker.py) — keep names in sync.
 */

export const PILLARS = [
  "Fixed Needs",
  "Variable Wants",
  "Future Savings",
] as const;

export type Pillar = (typeof PILLARS)[number];

export const CATEGORIES: Record<Pillar, string[]> = {
  "Fixed Needs": [
    "Accommodation/Rent",
    "Transport",
    "Insurance",
    "Basic Groceries",
    "Utilities",
  ],
  "Variable Wants": [
    "Dining Out/Cafes",
    "Entertainment/Hobbies",
    "Subscriptions",
    "Shopping",
    "Travel",
  ],
  "Future Savings": ["Emergency Fund", "Investments", "General Savings"],
};

export const TARGETS: Record<Pillar, number> = {
  "Fixed Needs": 0.5,
  "Variable Wants": 0.3,
  "Future Savings": 0.2,
};

/** Fallback for transactions no rule matches. */
export const DEFAULT_CATEGORY: { pillar: Pillar; sub: string } = {
  pillar: "Variable Wants",
  sub: "Shopping",
};

/** Brand colors per pillar (kept aligned with globals.css theme tokens). */
export const PILLAR_COLORS: Record<Pillar, string> = {
  "Fixed Needs": "#163300",
  "Variable Wants": "#ffd11a",
  "Future Savings": "#2ead4b",
};

export function subCategoriesFor(pillar: Pillar): string[] {
  return CATEGORIES[pillar];
}

export function isValidPair(pillar: string, sub: string): boolean {
  return (
    (PILLARS as readonly string[]).includes(pillar) &&
    CATEGORIES[pillar as Pillar].includes(sub)
  );
}

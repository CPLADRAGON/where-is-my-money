/**
 * Spending taxonomy + budget model.
 *
 * Money is split by TRANSACTION TYPE, not by a single "category" axis:
 *   - spending  -> categorized into Fixed Needs / Variable Wants
 *   - transfer  -> money moved to savings/investments or to people; NOT spending
 *   - income    -> handled separately (incomeByMonth)
 *
 * Savings is an OUTCOME (Income - Spending), shown as a Savings Rate — it is not
 * a spending pillar. The 50/30/20 rule is evaluated as a share of INCOME.
 *
 * Keep names in sync with the Python generator where they overlap.
 */

// Spending pillars (the only ones that count toward "spent").
export const SPENDING_PILLARS = ["Fixed Needs", "Variable Wants"] as const;
export type SpendingPillar = (typeof SPENDING_PILLARS)[number];

// The transfer "pillar" replaces the old "Future Savings" spend bucket.
export const TRANSFER_PILLAR = "Transfer" as const;

// All pillars selectable in the category dropdown.
export const PILLARS = [...SPENDING_PILLARS, TRANSFER_PILLAR] as const;
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
  Transfer: [
    "Savings / Investment",
    "Personal Transfer",
    "Reimbursement",
    "Other Transfer",
  ],
};

export function isSpending(pillar: Pillar): boolean {
  return pillar !== TRANSFER_PILLAR;
}

/** Budget buckets for the 50/30/20 view (share of income). */
export const BUDGET_BUCKETS = ["Needs", "Wants", "Savings"] as const;
export type BudgetBucket = (typeof BUDGET_BUCKETS)[number];

export const TARGETS: Record<BudgetBucket, number> = {
  Needs: 0.5,
  Wants: 0.3,
  Savings: 0.2,
};

/** Map a spending pillar to its budget bucket (transfers have none). */
export function pillarToBucket(pillar: Pillar): BudgetBucket | null {
  if (pillar === "Fixed Needs") return "Needs";
  if (pillar === "Variable Wants") return "Wants";
  return null;
}

/** Fallback for unmatched purchases (kept as spending so it's reviewed). */
export const DEFAULT_CATEGORY: { pillar: Pillar; sub: string } = {
  pillar: "Variable Wants",
  sub: "Shopping",
};

/** Default category for detected personal/P2P transfers. */
export const TRANSFER_DEFAULT: { pillar: Pillar; sub: string } = {
  pillar: "Transfer",
  sub: "Personal Transfer",
};

/** Default category for detected savings/investment moves. */
export const SAVINGS_DEFAULT: { pillar: Pillar; sub: string } = {
  pillar: "Transfer",
  sub: "Savings / Investment",
};

/** Colors for budget buckets + the transfer pillar (iOS system palette). */
export const BUCKET_COLORS: Record<BudgetBucket, string> = {
  Needs: "#0066cc",
  Wants: "#ff9500",
  Savings: "#34c759",
};
export const TRANSFER_COLOR = "#8e8e93";

/** Colors per spending pillar (for pie/sub-category charts). */
export const PILLAR_COLORS: Record<Pillar, string> = {
  "Fixed Needs": "#0066cc",
  "Variable Wants": "#ff9500",
  Transfer: TRANSFER_COLOR,
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

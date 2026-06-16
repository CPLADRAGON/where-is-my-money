"use client";

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { categorize } from "./categorize";
import { TARGETS, type BudgetBucket, type Pillar } from "./taxonomy";
import type { ColumnMapping } from "./banks/types";
import type { IncomeByMonth, ParseResult, Transaction } from "./types";

type Cat = { pillar: Pillar; sub: string };

export interface SavedPreset extends ColumnMapping {
  name: string;
}

interface AppState {
  /** Imported, categorized transactions. */
  transactions: Transaction[];
  months: string[];
  bankLabel: string;
  /** Salary income auto-detected at import time. */
  detectedIncome: IncomeByMonth;
  /** User edits to income, keyed by YYYY-MM. */
  incomeOverrides: IncomeByMonth;

  /** Manual category overrides keyed by transaction fingerprint. */
  overrides: Record<string, Cat>;
  /** Learned merchant -> category, keyed by merchantKey. */
  learned: Record<string, Cat>;

  /** Saved custom column mappings for unknown banks. */
  presets: SavedPreset[];
  /** Budget targets per bucket (share of income). */
  targets: Record<BudgetBucket, number>;
  /** Optional monthly spending cap per sub-category (SGD). 0/absent = no cap. */
  budgets: Record<string, number>;

  /** Hydration flag so the UI can wait for IndexedDB. */
  _hydrated: boolean;

  importData: (result: ParseResult) => void;
  setCategory: (
    id: string,
    pillar: Pillar,
    sub: string,
    remember: boolean
  ) => void;
  bulkSetCategory: (
    ids: string[],
    pillar: Pillar,
    sub: string,
    remember: boolean
  ) => void;
  setIncome: (month: string, amount: number) => void;
  forgetMerchant: (merchantKey: string) => void;
  removeOverride: (fingerprint: string) => void;
  setTarget: (bucket: BudgetBucket, value: number) => void;
  setBudget: (sub: string, amount: number) => void;
  addPreset: (preset: SavedPreset) => void;
  removePreset: (name: string) => void;
  clearAll: () => void;
}

/** idb-keyval as a zustand StateStorage backend. */
const idbStorage: StateStorage = {
  getItem: async (name) => (await idbGet(name)) ?? null,
  setItem: async (name, value) => {
    await idbSet(name, value);
  },
  removeItem: async (name) => {
    await idbDel(name);
  },
};

function income(month: string, s: AppState): number {
  return s.incomeOverrides[month] ?? s.detectedIncome[month] ?? 0;
}

function recategorize(t: Transaction, s: Pick<AppState, "overrides" | "learned">): Transaction {
  const r = categorize(t.description, t.merchantKey, {
    overrides: s.overrides,
    learned: s.learned,
    fingerprint: t.id,
  });
  return { ...t, pillar: r.pillar, sub: r.sub, provenance: r.provenance };
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      transactions: [],
      months: [],
      bankLabel: "",
      detectedIncome: {},
      incomeOverrides: {},
      overrides: {},
      learned: {},
      presets: [],
      targets: { ...TARGETS },
      budgets: {},
      _hydrated: false,

      importData: (result) =>
        set((s) => {
          // Re-apply existing overrides/learned to freshly parsed rows.
          const transactions = result.transactions.map((t) =>
            recategorize(t, s)
          );
          return {
            transactions,
            months: result.months,
            bankLabel: result.bankLabel,
            detectedIncome: result.incomeByMonth,
          };
        }),

      setCategory: (id, pillar, sub, remember) =>
        set((s) => {
          const overrides = { ...s.overrides, [id]: { pillar, sub } };
          const learned = { ...s.learned };
          const tx = s.transactions.find((t) => t.id === id);
          if (remember && tx?.merchantKey) {
            learned[tx.merchantKey] = { pillar, sub };
          }
          const next = { ...s, overrides, learned };
          return {
            overrides,
            learned,
            transactions: s.transactions.map((t) => recategorize(t, next)),
          };
        }),

      bulkSetCategory: (ids, pillar, sub, remember) =>
        set((s) => {
          const idSet = new Set(ids);
          const overrides = { ...s.overrides };
          const learned = { ...s.learned };
          for (const t of s.transactions) {
            if (!idSet.has(t.id)) continue;
            overrides[t.id] = { pillar, sub };
            if (remember && t.merchantKey) {
              learned[t.merchantKey] = { pillar, sub };
            }
          }
          const next = { ...s, overrides, learned };
          return {
            overrides,
            learned,
            transactions: s.transactions.map((t) => recategorize(t, next)),
          };
        }),

      setIncome: (month, amount) =>
        set((s) => ({
          incomeOverrides: { ...s.incomeOverrides, [month]: amount },
        })),

      forgetMerchant: (merchantKey) =>
        set((s) => {
          const learned = { ...s.learned };
          delete learned[merchantKey];
          const next = { ...s, learned };
          return {
            learned,
            transactions: s.transactions.map((t) => recategorize(t, next)),
          };
        }),

      removeOverride: (fingerprint) =>
        set((s) => {
          const overrides = { ...s.overrides };
          delete overrides[fingerprint];
          const next = { ...s, overrides };
          return {
            overrides,
            transactions: s.transactions.map((t) => recategorize(t, next)),
          };
        }),

      setTarget: (bucket, value) =>
        set((s) => ({ targets: { ...s.targets, [bucket]: value } })),

      setBudget: (sub, amount) =>
        set((s) => {
          const budgets = { ...s.budgets };
          if (amount > 0) budgets[sub] = amount;
          else delete budgets[sub];
          return { budgets };
        }),

      addPreset: (preset) =>
        set((s) => ({
          presets: [...s.presets.filter((p) => p.name !== preset.name), preset],
        })),

      removePreset: (name) =>
        set((s) => ({ presets: s.presets.filter((p) => p.name !== name) })),

      clearAll: () =>
        set({
          transactions: [],
          months: [],
          bankLabel: "",
          detectedIncome: {},
          incomeOverrides: {},
          overrides: {},
          learned: {},
        }),
    }),
    {
      name: "money-tracker-v2",
      storage: createJSONStorage(() => idbStorage),
      onRehydrateStorage: () => (state) => {
        if (state) state._hydrated = true;
      },
    }
  )
);

/** Resolve the effective income for a month (override or detected). */
export function incomeForMonth(s: AppState, month: string): number {
  return income(month, s);
}

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";

/** Currency → SGD per 1 unit (e.g. CNY: 0.186 = 1 CNY is 0.186 SGD). */
export type Rates = Record<string, number>;

const idbStorage: StateStorage = {
  getItem: async (name) => (await idbGet(name)) ?? null,
  setItem: async (name, value) => {
    await idbSet(name, value);
  },
  removeItem: async (name) => {
    await idbDel(name);
  },
};

interface CurrencyState {
  /** The currency the dashboard/budgets are displayed in. */
  displayCurrency: string;
  rates: Rates;
  ratesUpdatedAt: string | null;
  setDisplayCurrency: (c: string) => void;
  setRates: (r: Rates) => void;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      displayCurrency: "SGD",
      rates: { SGD: 1 },
      ratesUpdatedAt: null,
      setDisplayCurrency: (c) => set({ displayCurrency: c }),
      setRates: (r) => set({ rates: r, ratesUpdatedAt: new Date().toISOString() }),
    }),
    { name: "money-tracker-currency", storage: createJSONStorage(() => idbStorage) }
  )
);

/** Convert a value between currencies. `to === from` is a passthrough. */
export function convert(value: number, from: string, to: string, rates: Rates): number {
  if (from === to) return value;
  const rate = rates[from] ?? 1;
  if (to === "SGD") return value * rate;
  return value / (rates[to] ?? 1);
}

/** Display a transaction's amount in the view currency (defaults to SGD when no currency). */
export function toDisplay(
  t: { amount: number; currency?: string },
  rates: Rates,
  display: string
): number {
  return convert(t.amount, t.currency ?? "SGD", display, rates);
}

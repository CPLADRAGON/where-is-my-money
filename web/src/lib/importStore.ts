"use client";

import { create } from "zustand";
import type { ParseResult } from "./types";

/** Transient (non-persisted) state for the import flow. */
interface ImportState {
  /** CSV text awaiting column mapping (unknown bank). */
  pendingCsv: string | null;
  pendingFileName: string | null;
  /** Summary of the most recent successful import. */
  lastSummary: ParseResult["stats"] | null;
  lastBankLabel: string | null;
  setPending: (csv: string, fileName: string) => void;
  clearPending: () => void;
  setSummary: (stats: ParseResult["stats"], bankLabel: string) => void;
}

export const useImportStore = create<ImportState>((set) => ({
  pendingCsv: null,
  pendingFileName: null,
  lastSummary: null,
  lastBankLabel: null,
  setPending: (csv, fileName) =>
    set({ pendingCsv: csv, pendingFileName: fileName }),
  clearPending: () => set({ pendingCsv: null, pendingFileName: null }),
  setSummary: (stats, bankLabel) =>
    set({ lastSummary: stats, lastBankLabel: bankLabel }),
}));

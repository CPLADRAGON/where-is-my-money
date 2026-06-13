import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as SGD currency. */
export function formatSGD(value: number, opts?: { decimals?: boolean }): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: opts?.decimals === false ? 0 : 2,
    maximumFractionDigits: opts?.decimals === false ? 0 : 2,
  }).format(value);
}

/** Format a fraction (0..1) as a percentage string. */
export function formatPct(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Format a YYYY-MM key as e.g. "Jan 2026". */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString("en-SG", {
    month: "short",
    year: "numeric",
  });
}

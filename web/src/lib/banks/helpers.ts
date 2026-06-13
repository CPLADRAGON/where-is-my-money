import type { DateFormat } from "./types";

/** Parse a money string like "6,037.08" or "(12.50)" to a number. */
export function parseAmount(raw: string | undefined | null): number {
  if (raw == null) return 0;
  let s = String(raw).trim();
  if (s === "") return 0;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.includes("-")) negative = true;
  s = s.replace(/[^0-9.]/g, "");
  if (s === "") return 0;
  const n = Number(s);
  if (Number.isNaN(n)) return 0;
  return negative ? -n : n;
}

/** Parse a date in a known format to ISO YYYY-MM-DD, or "" if invalid. */
export function parseDate(raw: string | undefined, fmt: DateFormat): string {
  if (!raw) return "";
  const s = raw.trim();
  const parts = s.split(/[/\-.]/).map((p) => p.trim());
  if (parts.length < 3) return "";
  let y: number, m: number, d: number;
  switch (fmt) {
    case "DD/MM/YYYY":
    case "DD-MM-YYYY":
      [d, m, y] = [Number(parts[0]), Number(parts[1]), Number(parts[2])];
      break;
    case "MM/DD/YYYY":
      [m, d, y] = [Number(parts[0]), Number(parts[1]), Number(parts[2])];
      break;
    case "YYYY-MM-DD":
      [y, m, d] = [Number(parts[0]), Number(parts[1]), Number(parts[2])];
      break;
  }
  if (!y || !m || !d || m > 12 || d > 31) return "";
  if (y < 100) y += 2000;
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/** Collapse all whitespace (incl. embedded newlines) to single spaces. */
export function normalizeText(text: string): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

/** Split CSV text into lines, tolerating CRLF. */
export function splitLines(csvText: string): string[] {
  return csvText.replace(/\r\n/g, "\n").split("\n");
}

import type { Transaction } from "../types";

/** Trigger a browser download for a Blob. */
export function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function transactionsToCsv(tx: Transaction[]): string {
  const header = ["Date", "Description", "Amount", "Main Pillar", "Sub-Category", "Source"];
  const lines = [header.join(",")];
  for (const t of tx) {
    lines.push(
      [t.date, t.description, t.amount.toFixed(2), t.pillar, t.sub, t.provenance]
        .map(csvCell)
        .join(",")
    );
  }
  return lines.join("\n");
}

export function exportCsv(tx: Transaction[]) {
  const csv = transactionsToCsv(tx);
  download("transactions.csv", new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

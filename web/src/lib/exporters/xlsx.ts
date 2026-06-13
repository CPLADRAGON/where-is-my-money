import * as XLSX from "xlsx";
import { CATEGORIES, PILLARS, TARGETS, type Pillar } from "../taxonomy";
import type { IncomeByMonth, Transaction } from "../types";
import { download } from "./csv";

/**
 * Build a multi-sheet workbook (Transactions / Dashboard / Setup) mirroring the
 * Python generator, then trigger a download.
 */
export function exportXlsx(
  tx: Transaction[],
  income: IncomeByMonth,
  months: string[],
  targets: Record<Pillar, number> = TARGETS
) {
  const wb = XLSX.utils.book_new();

  // Transactions sheet
  const txRows = tx.map((t) => ({
    Date: t.date,
    Description: t.description,
    Amount: Number(t.amount.toFixed(2)),
    "Main Pillar": t.pillar,
    "Sub-Category": t.sub,
    Source: t.provenance,
  }));
  const wsTx = XLSX.utils.json_to_sheet(txRows);
  wsTx["!cols"] = [
    { wch: 12 },
    { wch: 52 },
    { wch: 12 },
    { wch: 16 },
    { wch: 22 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsTx, "Transactions");

  // Dashboard sheet (computed values)
  const totalSpent = tx.reduce((a, t) => a + t.amount, 0);
  const totalIncome = months.reduce((a, m) => a + (income[m] ?? 0), 0);
  const byPillar: Record<string, number> = {};
  for (const t of tx) byPillar[t.pillar] = (byPillar[t.pillar] ?? 0) + t.amount;

  const dash: (string | number)[][] = [
    ["Monthly Expense Tracker"],
    [],
    ["Total Income", Number(totalIncome.toFixed(2))],
    ["Total Spent", Number(totalSpent.toFixed(2))],
    ["Remaining", Number((totalIncome - totalSpent).toFixed(2))],
    [],
    ["Pillar", "Spent", "Actual %", "Target %", "Status"],
  ];
  for (const p of PILLARS) {
    const spent = byPillar[p] ?? 0;
    const actual = totalSpent > 0 ? spent / totalSpent : 0;
    const target = targets[p];
    const ok = p === "Future Savings" ? actual >= target : actual <= target;
    dash.push([
      p,
      Number(spent.toFixed(2)),
      Number((actual * 100).toFixed(1)) / 100,
      target,
      ok ? "On track" : p === "Future Savings" ? "Below target" : "Over budget",
    ]);
  }
  dash.push([]);
  dash.push(["Sub-Category", "Pillar", "Spent"]);
  const bySub: Record<string, number> = {};
  for (const t of tx) bySub[t.sub] = (bySub[t.sub] ?? 0) + t.amount;
  for (const p of PILLARS) {
    for (const s of CATEGORIES[p]) {
      if ((bySub[s] ?? 0) > 0)
        dash.push([s, p, Number((bySub[s] ?? 0).toFixed(2))]);
    }
  }
  const wsDash = XLSX.utils.aoa_to_sheet(dash);
  wsDash["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsDash, "Dashboard");

  // Setup sheet (income by month + targets)
  const setup: (string | number)[][] = [["Month", "Income"]];
  for (const m of months) setup.push([m, Number((income[m] ?? 0).toFixed(2))]);
  setup.push([]);
  setup.push(["Pillar", "Target %"]);
  for (const p of PILLARS) setup.push([p, targets[p]]);
  const wsSetup = XLSX.utils.aoa_to_sheet(setup);
  wsSetup["!cols"] = [{ wch: 18 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsSetup, "Setup");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  download(
    "MonthlyExpenseTracker.xlsx",
    new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  );
}

import * as XLSX from "xlsx";
import {
  CATEGORIES,
  SPENDING_PILLARS,
  TARGETS,
  isSpending,
  type BudgetBucket,
} from "../taxonomy";
import type { IncomeByMonth, Transaction } from "../types";
import { download } from "./csv";

/**
 * Build a multi-sheet workbook (Transactions / Dashboard / Setup) reflecting the
 * income-based 50/30/20 model, then trigger a download.
 */
export function exportXlsx(
  tx: Transaction[],
  income: IncomeByMonth,
  months: string[],
  targets: Record<BudgetBucket, number> = TARGETS
) {
  const wb = XLSX.utils.book_new();

  // Transactions sheet
  const txRows = tx.map((t) => ({
    Date: t.date,
    Description: t.description,
    Amount: Number(t.amount.toFixed(2)),
    Type: isSpending(t.pillar) ? "Spending" : "Transfer",
    Pillar: t.pillar,
    "Sub-Category": t.sub,
    Source: t.provenance,
  }));
  const wsTx = XLSX.utils.json_to_sheet(txRows);
  wsTx["!cols"] = [
    { wch: 12 },
    { wch: 52 },
    { wch: 12 },
    { wch: 10 },
    { wch: 16 },
    { wch: 22 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsTx, "Transactions");

  // Totals (spending excludes transfers)
  const spendingTx = tx.filter((t) => isSpending(t.pillar));
  const totalSpent = spendingTx.reduce((a, t) => a + t.amount, 0);
  const totalIncome = months.reduce((a, m) => a + (income[m] ?? 0), 0);
  const needs = spendingTx
    .filter((t) => t.pillar === "Fixed Needs")
    .reduce((a, t) => a + t.amount, 0);
  const wants = spendingTx
    .filter((t) => t.pillar === "Variable Wants")
    .reduce((a, t) => a + t.amount, 0);
  const savings = totalIncome - totalSpent;
  const denom = totalIncome > 0 ? totalIncome : 1;

  const dash: (string | number)[][] = [
    ["Monthly Expense Tracker"],
    [],
    ["Total Income", Number(totalIncome.toFixed(2))],
    ["Total Spent", Number(totalSpent.toFixed(2))],
    ["Saved (Income - Spent)", Number(savings.toFixed(2))],
    ["Savings Rate", totalIncome > 0 ? Number((savings / denom).toFixed(3)) : 0],
    [],
    ["Bucket", "Amount", "Actual % of income", "Target %", "Status"],
    [
      "Needs",
      Number(needs.toFixed(2)),
      Number((needs / denom).toFixed(3)),
      targets.Needs,
      needs / denom <= targets.Needs ? "On track" : "Over budget",
    ],
    [
      "Wants",
      Number(wants.toFixed(2)),
      Number((wants / denom).toFixed(3)),
      targets.Wants,
      wants / denom <= targets.Wants ? "On track" : "Over budget",
    ],
    [
      "Savings",
      Number(savings.toFixed(2)),
      Number((savings / denom).toFixed(3)),
      targets.Savings,
      savings / denom >= targets.Savings ? "On track" : "Below target",
    ],
    [],
    ["Sub-Category", "Pillar", "Spent"],
  ];
  const bySub: Record<string, number> = {};
  for (const t of spendingTx) bySub[t.sub] = (bySub[t.sub] ?? 0) + t.amount;
  for (const p of SPENDING_PILLARS) {
    for (const s of CATEGORIES[p]) {
      if ((bySub[s] ?? 0) > 0)
        dash.push([s, p, Number((bySub[s] ?? 0).toFixed(2))]);
    }
  }
  const wsDash = XLSX.utils.aoa_to_sheet(dash);
  wsDash["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsDash, "Dashboard");

  // Setup sheet (income by month + targets)
  const setup: (string | number)[][] = [["Month", "Income"]];
  for (const m of months) setup.push([m, Number((income[m] ?? 0).toFixed(2))]);
  setup.push([]);
  setup.push(["Bucket", "Target %"]);
  (["Needs", "Wants", "Savings"] as BudgetBucket[]).forEach((b) =>
    setup.push([b, targets[b]])
  );
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

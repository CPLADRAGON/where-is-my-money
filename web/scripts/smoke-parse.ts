import { parseDetected } from "../src/lib/banks/index";
import { readFileSync } from "fs";
import { join } from "path";

const csv = readFileSync(
  join(__dirname, "..", "..", "TransactionHistory_20260613223841.csv"),
  "utf-8"
);

const result = parseDetected(csv);
console.log("bank:", result.bankLabel);
console.log("total rows (spend+transfer):", result.stats.total);
console.log("autoCategorized:", result.stats.autoCategorized);
console.log("defaulted:", result.stats.defaulted);
console.log("transfers:", result.stats.transfers);
console.log("months:", result.months.join(", "));
console.log("incomeByMonth:", JSON.stringify(result.incomeByMonth));
console.log("total income:", result.stats.income);

const spending = result.transactions.filter(
  (t) => t.pillar !== "Transfer"
);
const totalSpent = spending.reduce((a, t) => a + t.amount, 0);
const totalTransfers = result.transactions
  .filter((t) => t.pillar === "Transfer")
  .reduce((a, t) => a + t.amount, 0);
console.log("spending rows:", spending.length);
console.log("total spent (excl transfers):", totalSpent.toFixed(2));
console.log("total transfers:", totalTransfers.toFixed(2));

const expect = (cond: boolean, msg: string) => {
  console.log(cond ? "PASS" : "FAIL", "-", msg);
};
// 385 outflow rows total; some are now transfers (excluded from spend).
expect(result.stats.total === 385, "385 outflow rows parsed");
expect(result.stats.transfers > 0, "some rows detected as transfers");
expect(totalSpent < 17062.13, "spending is less than raw outflow (transfers removed)");
expect(
  Object.keys(result.incomeByMonth).length === 5,
  "salary detected in 5 months"
);

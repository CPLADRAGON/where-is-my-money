import { parseDetected } from "../src/lib/banks/index";
import { readFileSync } from "fs";
import { join } from "path";

const csv = readFileSync(
  join(__dirname, "..", "..", "TransactionHistory_20260613223841.csv"),
  "utf-8"
);

const result = parseDetected(csv);
console.log("bank:", result.bankLabel);
console.log("total spend rows:", result.stats.total);
console.log("autoCategorized:", result.stats.autoCategorized);
console.log("defaulted:", result.stats.defaulted);
console.log("months:", result.months.join(", "));
console.log("incomeByMonth:", JSON.stringify(result.incomeByMonth));
console.log("total income:", result.stats.income);

const sumByPillar: Record<string, number> = {};
for (const t of result.transactions) {
  sumByPillar[t.pillar] = (sumByPillar[t.pillar] ?? 0) + t.amount;
}
console.log("sumByPillar:", JSON.stringify(sumByPillar, null, 1));
const totalSpent = result.transactions.reduce((a, t) => a + t.amount, 0);
console.log("total spent:", totalSpent.toFixed(2));

const expect = (cond: boolean, msg: string) => {
  console.log(cond ? "PASS" : "FAIL", "-", msg);
};
// Correct totals: the Python generator drops the first data row (a pandas
// blank-line/header off-by-one), so its 384/17,046.13 are one row short.
expect(result.stats.total === 385, "385 spend rows");
expect(Math.abs(totalSpent - 17062.13) < 0.01, "total spent ~ 17,062.13");
expect(
  Object.keys(result.incomeByMonth).length === 5,
  "salary detected in 5 months"
);

import { chromium } from "playwright";

// Minimal OCBC-format statement for a brand-new month (2026-09).
const SECOND = `Account details for:,OCBC FRANK Account 525-000000-001
Available Balance,1000.00
Ledger Balance,1000.00

Transaction History
Transaction date,Value date,Description,Withdrawals(SGD),Deposits(SGD)
05/09/2026,05/09/2026,"DEBIT PURCHASE  NTUC FAIRPRICE",42.50,
12/09/2026,12/09/2026,"DEBIT PURCHASE  KOPITIAM",6.80,
`;

const file = (buf: string) => ({
  name: "sep.csv",
  mimeType: "text/csv",
  buffer: Buffer.from(buf),
});

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });

  // 1) Demo import (forces replace).
  await page.getByRole("button", { name: /Try demo data/i }).click();
  const summary = page.getByText(/across \d+ months/i).first();
  await summary.waitFor({ timeout: 10000 });
  const afterDemo = await summary.innerText();
  const demoTotal = Number(afterDemo.match(/·\s*(\d+) transactions/)?.[1] ?? "0");
  const demoMonths = Number(afterDemo.match(/across (\d+) months/)?.[1] ?? "0");

  // 2) Merge the second fixture (a new month) — checkbox left unchecked → merge.
  await page.setInputFiles("input[type=file]", file(SECOND));
  await page.getByText(/Added 2 /i).waitFor({ timeout: 10000 });
  const afterMerge = await page.getByText(/across \d+ months/i).first().innerText();
  const mergeTotal = Number(afterMerge.match(/·\s*(\d+) transactions/)?.[1] ?? "0");
  const mergeMonths = Number(afterMerge.match(/across (\d+) months/)?.[1] ?? "0");

  // 3) Re-import the SAME file → 0 added (deduped).
  await page.setInputFiles("input[type=file]", file(SECOND));
  await page.getByText(/Added 0 /i).waitFor({ timeout: 10000 });
  const afterDup = await page.getByText(/across \d+ months/i).first().innerText();
  const dupTotal = Number(afterDup.match(/·\s*(\d+) transactions/)?.[1] ?? "0");

  const grew = mergeTotal === demoTotal + 2;
  const monthsUnioned = mergeMonths === demoMonths + 1;
  const deduped = dupTotal === mergeTotal;

  console.log("demo total/months:", demoTotal, demoMonths);
  console.log("after merge total/months:", mergeTotal, mergeMonths, "grew:", grew, "monthsUnioned:", monthsUnioned);
  console.log("after re-import total:", dupTotal, "deduped:", deduped);
  console.log("console errors:", errors.length);
  errors.slice(0, 8).forEach((e) => console.log(" -", e));

  await browser.close();
  process.exit(errors.length > 0 || !grew || !monthsUnioned || !deduped ? 1 : 0);
})();

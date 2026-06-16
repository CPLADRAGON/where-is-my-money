import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Try demo data/i }).click();
  await page.getByText(/Imported \d+ transactions/i).waitFor({ timeout: 15000 });

  // Set a tiny cap on Dining so it's guaranteed over budget.
  await page.goto("http://localhost:3000/settings", { waitUntil: "networkidle" });
  const diningRow = page
    .locator("div")
    .filter({ has: page.getByText("Dining Out/Cafes", { exact: true }) })
    .last();
  await diningRow.getByRole("spinbutton").fill("1");
  await page.waitForTimeout(200);

  // Dashboard now shows the Budget watch card with an over-budget Dining row.
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
  await page.getByText(/Budget watch/i).waitFor({ timeout: 5000 });
  const cardVisible = await page.getByText(/Budget watch/i).first().isVisible();
  const overBadge = await page.getByText(/over budget/i).first().isVisible();
  const diningVisible = await page.getByText("Dining Out/Cafes", { exact: true }).first().isVisible();

  // Drill-in: clicking the row filters /transactions by that sub.
  await page.getByTestId("budget-row").first().click();
  await page.waitForURL("**/transactions?*sub=*", { timeout: 5000 });
  const drillUrl = page.url();

  console.log("budget card visible:", cardVisible);
  console.log("over badge visible:", overBadge);
  console.log("dining row visible:", diningVisible);
  console.log("drill url:", drillUrl);
  console.log("console errors:", errors.length);
  errors.slice(0, 8).forEach((e) => console.log(" -", e));
  await browser.close();
  process.exit(errors.length > 0 || !cardVisible || !overBadge ? 1 : 0);
})();

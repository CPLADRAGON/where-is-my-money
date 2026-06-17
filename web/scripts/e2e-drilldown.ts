import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Try demo data/i }).click();
  await page.getByText(/across \d+ months/i).waitFor({ timeout: 10000 });

  // /review redirects to /transactions?review=1
  await page.goto("http://localhost:3000/review", { waitUntil: "networkidle" });
  await page.waitForURL("**/transactions?review=1", { timeout: 5000 });
  const reviewRows = await page.locator("table tbody tr").count();

  // Dashboard budget-table "Wants" button deep-links with a pillar filter
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Wants", exact: true }).click();
  await page.waitForURL("**/transactions?pillar=*", { timeout: 5000 });
  const filteredUrl = page.url();
  const filteredRows = await page.locator("table tbody tr").count();

  // Search narrows results
  await page.goto("http://localhost:3000/transactions", { waitUntil: "networkidle" });
  await page.getByLabel("Search").fill("netflix");
  await page.waitForTimeout(400);
  const searchRows = await page.locator("table tbody tr").count();

  console.log("review preset rows:", reviewRows);
  console.log("deep-linked url:", filteredUrl);
  console.log("filtered rows:", filteredRows);
  console.log("search rows:", searchRows);
  console.log("console errors:", errors.length);
  errors.slice(0, 8).forEach((e) => console.log(" -", e));
  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();

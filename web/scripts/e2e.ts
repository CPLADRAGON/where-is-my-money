import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Try demo data/i }).click();
  await page.getByText(/Imported from/i).waitFor({ timeout: 10000 });
  const summary = await page.getByText(/Imported from/i).textContent();
  console.log("summary:", summary?.trim());

  // Go to review and verify rows render.
  await page.getByRole("link", { name: /Review/i }).first().click();
  await page.waitForURL("**/review");
  const rowCount = await page.locator("table tbody tr").count();
  console.log("review rows:", rowCount);

  // Go to dashboard, wait for charts (svg) to render.
  await page.getByRole("link", { name: /Dashboard/i }).first().click();
  await page.waitForURL("**/dashboard");
  await page.waitForTimeout(1500);
  const svgCount = await page.locator("svg.recharts-surface").count();
  console.log("dashboard charts (svg):", svgCount);
  const spentText = await page.getByText(/Spent/).first().isVisible();
  console.log("spent card visible:", spentText);
  await page.screenshot({ path: "scripts/_dash.png", fullPage: true });

  // Export page renders share card.
  await page.getByRole("link", { name: /Export/i }).first().click();
  await page.waitForURL("**/export");
  await page.waitForTimeout(800);
  const cardVisible = await page.getByText(/WHERE YOUR INCOME WENT/i).isVisible();
  console.log("share card visible:", cardVisible);
  await page.screenshot({ path: "scripts/_export.png", fullPage: true });

  console.log("console errors:", errors.length);
  errors.slice(0, 10).forEach((e) => console.log("  -", e));

  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();

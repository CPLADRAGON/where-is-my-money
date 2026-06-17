import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Try demo data/i }).click();
  await page.getByText(/across \d+ months/i).waitFor({ timeout: 15000 });

  await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
  const select = page.locator("select").first();

  // Pick the first real month (second option; first is "All").
  const monthValue = await select.locator("option").nth(1).getAttribute("value");
  if (!monthValue) throw new Error("no month option found");
  await select.selectOption(monthValue);
  await page.waitForURL(`**/dashboard?month=${monthValue}`, { timeout: 5000 });
  const urlAfterSelect = page.url();

  // Drill into a category via the 50/30/20 table pillar link.
  await page.getByRole("button", { name: /^Needs$/ }).first().click();
  await page.waitForURL("**/transactions?*month=*", { timeout: 5000 });
  const drillUrl = page.url();

  // Go back — the dashboard should restore the selected month.
  await page.goBack({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const backUrl = page.url();
  const restored = await page.locator("select").first().inputValue();

  const drillHadMonth = drillUrl.includes(`month=${monthValue}`);
  const backHasMonth = backUrl.includes(`month=${monthValue}`);
  const selectRestored = restored === monthValue;

  console.log("url after select:", urlAfterSelect);
  console.log("drill url:", drillUrl, "hasMonth:", drillHadMonth);
  console.log("back url:", backUrl, "hasMonth:", backHasMonth);
  console.log("restored select value:", restored, "ok:", selectRestored);
  console.log("console errors:", errors.length);
  errors.slice(0, 8).forEach((e) => console.log(" -", e));

  await browser.close();
  process.exit(errors.length > 0 || !drillHadMonth || !backHasMonth || !selectRestored ? 1 : 0);
})();

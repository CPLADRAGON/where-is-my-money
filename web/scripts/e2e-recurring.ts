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

  // Recurring page shows the subscriptions section + a known item
  await page.goto("http://localhost:3000/recurring", { waitUntil: "networkidle" });
  await page.getByText(/Subscriptions & bills/i).waitFor({ timeout: 5000 });
  const spotifyVisible = await page.getByText(/Spotify Ab/i).first().isVisible();
  const headerVisible = await page.getByText(/\/ month/i).first().isVisible();

  // Drill-in: clicking the Spotify card lands on a filtered transactions page
  await page.getByText(/Spotify Ab/i).first().click();
  await page.waitForURL("**/transactions?q=*", { timeout: 5000 });
  const drillUrl = page.url();
  const drillRows = await page.locator("table tbody tr").count();

  console.log("spotify card visible:", spotifyVisible);
  console.log("monthly header visible:", headerVisible);
  console.log("drill url:", drillUrl);
  console.log("drill rows:", drillRows);
  console.log("console errors:", errors.length);
  errors.slice(0, 8).forEach((e) => console.log(" -", e));
  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();

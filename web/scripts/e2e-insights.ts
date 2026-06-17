import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Try demo data/i }).click();
  await page.getByText(/across \d+ months/i).waitFor({ timeout: 10000 });

  await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
  await page.getByText(/What changed/i).waitFor({ timeout: 5000 });
  const headlineVisible = await page
    .getByText(/You spent .* (more|less) than|held steady/i)
    .first()
    .isVisible();
  const moversVisible = await page.getByText(/Biggest changes/i).first().isVisible();

  // Drill-in: click the first mover row -> filtered transactions for that sub + month
  await page.getByText(/Biggest changes/i).first().scrollIntoViewIfNeeded();
  const firstMover = page.getByTestId("insights-mover").first();
  await firstMover.click();
  await page.waitForURL("**/transactions?month=*sub=*", { timeout: 5000 });
  const drillUrl = page.url();

  console.log("insights headline visible:", headlineVisible);
  console.log("movers visible:", moversVisible);
  console.log("drill url:", drillUrl);
  console.log("console errors:", errors.length);
  errors.slice(0, 8).forEach((e) => console.log(" -", e));
  await browser.close();
  process.exit(errors.length > 0 || !headlineVisible ? 1 : 0);
})();

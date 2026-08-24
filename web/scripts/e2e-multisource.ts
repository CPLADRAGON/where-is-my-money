import { chromium } from "playwright";
import { ALIPAY_FIXTURE, MEITUAN_FIXTURE, OCBC_REPAY_FIXTURE } from "./fixtures";

// Requires: `npm run dev` running on :3000 and `npx playwright install` done.
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.locator('input[type="file"]').setInputFiles([
    { name: "alipay.csv", mimeType: "text/csv", buffer: Buffer.from(ALIPAY_FIXTURE, "utf8") },
    { name: "meituan.csv", mimeType: "text/csv", buffer: Buffer.from(MEITUAN_FIXTURE, "utf8") },
    { name: "ocbc.csv", mimeType: "text/csv", buffer: Buffer.from(OCBC_REPAY_FIXTURE, "utf8") },
  ]);
  await page.waitForTimeout(1500);
  await page.getByText(/Detected files|已识别文件/).first().waitFor({ timeout: 10000 });

  // Dashboard: spent should be a single purchase, never doubled by the repayment.
  await page.getByRole("link", { name: /Dashboard/i }).first().click();
  await page.waitForURL("**/dashboard");
  await page.waitForTimeout(1500);
  const spentText = await page.getByText(/Spent|支出/).first().textContent();
  console.log("spent:", spentText?.trim());

  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();

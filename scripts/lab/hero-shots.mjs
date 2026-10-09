// The hero composition, desktop and phone, for each wordmark placement. node scripts/lab/hero-shots.mjs [ms=4500]
import { chromium, devices } from "playwright";
import fs from "node:fs";
const wait = Number(process.argv[2] ?? 4500);
fs.mkdirSync("test-results/hero", { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
for (const [variant, q] of [["A", ""], ["B", "&wm=bottom"]]) {
  for (const [dev, opts] of [["desktop", { viewport: { width: 1440, height: 900 } }], ["phone", { ...devices["iPhone 13"] }]]) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && console.error(variant, dev, m.text().slice(0, 200)));
    await page.goto(`http://localhost:3100/lab/sand?hero&tier=${dev === "phone" ? "mid" : "high"}${q}`);
    await page.waitForFunction(() => window.__sand?.state, null, { timeout: 120000 });
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    if (dev === "desktop") await page.mouse.move(1430, 890);
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `test-results/hero/${variant}-${dev}.png` });
    await ctx.close();
  }
}
await browser.close();
console.log("ok");

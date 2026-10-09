// The live page held at given scroll positions (still mode), cropped to the ball. node scripts/lab/at-shots.mjs 0.84,0.97
import { chromium } from "playwright";
const stops = process.argv[2].split(",").map(Number);
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 400)));
await page.goto("http://localhost:3100/lab/sand?hero&still&tier=high");
await page.waitForFunction(() => window.__sand?.state, null, { timeout: 120000 });
await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
await page.mouse.move(1430, 890);
for (const [i, p] of stops.entries()) {
  await page.evaluate((p) => window.scrollTo(0, p * (document.documentElement.scrollHeight - innerHeight)), p);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `test-results/hero/at-${i}.png` });
}
await browser.close();
console.log("ok");

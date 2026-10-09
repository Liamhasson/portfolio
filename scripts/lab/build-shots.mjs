// 2.3 build at held moments (the ball hovering at the arrival view): node scripts/lab/build-shots.mjs [0.1,0.3,...]
import { chromium } from "playwright";
const steps = (process.argv[2] ?? "0,0.2,0.4,0.55,0.7,0.85,1").split(",");
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 400)));
for (const b of steps) {
  await page.goto(`http://localhost:3100/lab/sand?hero&still&wordmark=0&tier=mid&dsframe=66&reveal=5&build=${b}`);
  await page.waitForFunction(() => window.__sand?.state && window.__desk3d, null, { timeout: 120000 });
  await page.addStyleTag({ content: "nextjs-portal,nav,[data-testid=hero-overlay]{display:none!important}" });
  await page.mouse.move(1599, 999);
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `test-results/sand/build-${b}.png`, clip: { x: 480, y: 60, width: 520, height: 440 } });
}
await browser.close();
console.log("ok");

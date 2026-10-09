// The lid at held angles, at one descend frame: node scripts/lab/lid-shots.mjs [frame=40] [angles=0,40,108]
import { chromium } from "playwright";
const frame = process.argv[2] ?? "40";
const angles = (process.argv[3] ?? "0,40,108").split(",");
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
for (const a of angles) {
  await page.goto(`http://localhost:3100/lab/sand?hero&still&wordmark=0&tier=low&dsframe=${frame}&lid=${a}`);
  await page.waitForFunction(() => window.__sand?.state, null, { timeout: 120000 });
  await page.addStyleTag({ content: "nextjs-portal,nav,[data-testid=hero-overlay]{display:none!important}" });
  await page.mouse.move(1599, 999);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `test-results/sand/lid-${frame}-${a}.png`, clip: { x: 500, y: 150, width: 800, height: 450 } });
}
await browser.close();
console.log("ok");

// The wordmark: a frame at rest, frames through an ambient wave, and a cursor sweep across the letters.
//   node scripts/lab/wordmark-test.mjs [weight=black] [out=test-results/sand/wm]
import { chromium } from "playwright";
const weight = process.argv[2] ?? "black";
const out = process.argv[3] ?? "test-results/sand/wm";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text().slice(0, 400)));
await page.goto(`http://localhost:3100/lab/sand?tier=high&weight=${weight}`);
await page.waitForFunction(() => window.__sand?.state, null, { timeout: 120000 });
await page.addStyleTag({ content: "nextjs-portal,nav,header,.font-mono{display:none!important}" });
await page.mouse.move(1590, 990);
await page.waitForTimeout(800);
// the first wave starts ~4.5s after load (phase 2.0 in a 6.5s cycle); sample across it
const shots = [];
for (let i = 0; i < 12; i++) { await page.screenshot({ path: `${out}-wave-${i}.png` }); shots.push(i); await page.waitForTimeout(400); }
await page.waitForTimeout(1500);
for (let i = 0; i <= 40; i++) { await page.mouse.move(250 + i * 28, 300 + Math.sin(i / 4) * 70); await page.waitForTimeout(16); }
await page.screenshot({ path: `${out}-cursor.png` });
await browser.close();
console.log("ok");

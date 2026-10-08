// What the cursor does: a frame without the pointer, then a sweep, then frames during and after. Optional look JSON.
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3100";
const look = JSON.parse(process.argv[3] ?? "{}");
const out = process.argv[4] ?? "test-results/sand/cursor";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text().slice(0, 400)));
await page.goto(`${base}/lab/sand?tier=high&still`);
await page.waitForFunction(() => window.__sand?.state, null, { timeout: 120000 });
await page.addStyleTag({ content: "nextjs-portal,nav,header,.font-mono{display:none!important}" });
await page.evaluate((l) => window.__sand.field.setLook(l), look);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}-0.png` });
for (let i = 0; i <= 40; i++) { await page.mouse.move(200 + i * 12, 430 + Math.sin(i / 4) * 60); await page.waitForTimeout(16); }
await page.screenshot({ path: `${out}-1.png` });
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}-2.png` });
await browser.close();
console.log("ok");

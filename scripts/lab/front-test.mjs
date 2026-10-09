// What the cursor's drift moves: still mode, frame before and right after a sweep; the diff shows moved grains.
//   node scripts/lab/front-test.mjs <chaos|ball> '<look json>' <out>
import { chromium } from "playwright";
const [state, lookJson, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text().slice(0, 300)));
await page.goto("http://localhost:3100/lab/sand?tier=high&still&wordmark=0");
await page.waitForFunction(() => window.__sand?.state, null, { timeout: 120000 });
await page.addStyleTag({ content: "nextjs-portal,nav,header,.font-mono{display:none!important}" });
await page.evaluate((l) => window.__sand.field.setLook(JSON.parse(l)), lookJson);
await page.mouse.move(1270, 790);
if (state === "ball") { await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); }
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}-0.png` });
const [cx, cy] = state === "ball" ? [640, 400] : [460, 470];
for (let i = 0; i <= 30; i++) { await page.mouse.move(cx - 220 + i * 15, cy + Math.sin(i / 3) * 40); await page.waitForTimeout(16); }
await page.screenshot({ path: `${out}-1.png` });
await browser.close();

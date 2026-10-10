// 2.3's through move at held frames (live): node scripts/lab/through-shots.mjs [1,40,...] [w=1440] [h=900]
import { chromium } from "playwright";
const frames = (process.argv[2] ?? "1,40,90,104,110,116,140,165,176,188,200,210").split(",");
const W = Number(process.argv[3] ?? 1440), H = Number(process.argv[4] ?? 900);
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 500)));
for (const f of frames) {
  await page.goto(`http://localhost:3100/lab/sand?hero&still&wordmark=0&tier=mid&thframe=${f}&reveal=5`);
  await page.waitForFunction(() => window.__sand?.state && window.__desk3d, null, { timeout: 120000 });
  await page.addStyleTag({ content: "nextjs-portal,nav,[data-testid=hero-overlay]{display:none!important}" });
  await page.mouse.move(W / 2, H / 2);
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `test-results/sand/th-${f}.png` });
}
await browser.close();
console.log("ok");

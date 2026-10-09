// The push into the screen at held frames; with indexmix the live index sits over the 3D screen at that opacity (a
// misregistration shows as doubled text). node scripts/lab/push-shots.mjs [1,36,60,72] [indexmix]
import { chromium } from "playwright";
const frames = (process.argv[2] ?? "1,36,60,72").split(",");
const mix = process.argv[3] ?? "";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 400)));
for (const f of frames) {
  await page.goto(`http://localhost:3100/lab/sand?hero&still&wordmark=0&tier=mid&pushframe=${f}&reveal=5${mix ? `&indexmix=${mix}` : ""}`);
  await page.waitForFunction(() => window.__sand?.state && window.__desk3d, null, { timeout: 120000 });
  await page.addStyleTag({ content: "nextjs-portal,nav,[data-testid=hero-overlay]{display:none!important}" });
  await page.mouse.move(1439, 899);
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `test-results/sand/push-${f}${mix ? `-mix${mix}` : ""}.png` });
}
await browser.close();
console.log("ok");

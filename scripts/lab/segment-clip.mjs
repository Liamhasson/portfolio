// Records one stretch of the hero page as a visitor scrolls it: starts at timeline progress `from`, scrolls evenly to `to`
// over `seconds`, then holds (the screen's reveal plays in time). Progress is in the lab's timeline units (sand-lab.tsx TL).
//   node scripts/lab/segment-clip.mjs [desktop|phone] [from=0.95] [to=1.1875] [seconds=9] [hold=4] [out]
import { chromium, devices } from "playwright";
import fs from "node:fs";
const [dev = "desktop", from = "0.95", to = "1.1875", seconds = "9", hold = "4"] = process.argv.slice(2);
const out = process.argv[7] ?? `test-results/hero/segment-${dev}.webm`;
const PROGRESS_SCALE = (2000 - 100) / 1600;   // sand-lab.tsx PAGE_VH
const dir = `test-results/hero/video-seg-${dev}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const size = dev === "phone" ? { width: 390, height: 844 } : { width: 1280, height: 800 };
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ ...(dev === "phone" ? devices["iPhone 13"] : { viewport: size }), recordVideo: { dir, size } });
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 200)));
await page.goto(`http://localhost:3100/lab/sand?hero&tier=mid`);
await page.waitForFunction(() => window.__sand?.state && window.__desk3d, null, { timeout: 120000 });
await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
const y = (p) => Math.min((p / PROGRESS_SCALE) * max, max);
await page.evaluate((v) => window.scrollTo(0, v), y(Number(from)));
await page.waitForTimeout(3500);   // the damped progress settles at the start
const steps = Math.round(Number(seconds) * 30);
for (let i = 1; i <= steps; i++) {
  await page.evaluate((v) => window.scrollTo(0, v), y(Number(from) + ((Number(to) - Number(from)) * i) / steps));
  await page.waitForTimeout(33);
}
await page.waitForTimeout(Number(hold) * 1000);
await ctx.close(); await browser.close();
fs.renameSync(`${dir}/${fs.readdirSync(dir).find((n) => n.endsWith(".webm"))}`, out);
console.log("ok", out);

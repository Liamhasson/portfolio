// Records the hero page as a visitor: a few seconds on the hero, a slow scroll through the pull-back to the 2.1 line.
//   node scripts/lab/run-clip.mjs [desktop|phone] [out]
import { chromium, devices } from "playwright";
import fs from "node:fs";
const dev = process.argv[2] ?? "desktop", out = process.argv[3] ?? `test-results/hero/run-${dev}.webm`;
const dir = `test-results/hero/video-${dev}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const size = dev === "phone" ? { width: 390, height: 844 } : { width: 1280, height: 800 };
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ ...(dev === "phone" ? devices["iPhone 13"] : { viewport: size }), recordVideo: { dir, size } });
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 200)));
await page.goto(`http://localhost:3100/lab/sand?hero&tier=mid`);
await page.waitForFunction(() => window.__sand?.state, null, { timeout: 120000 });
await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
await page.waitForTimeout(4000);
// a slow, even scroll over ~10s to the end
const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
const steps = 640;
for (let i = 1; i <= steps; i++) {
  await page.evaluate((y) => window.scrollTo(0, y), (i / steps) * max);
  await page.waitForTimeout(33);
}
await page.waitForTimeout(3500);
await ctx.close(); await browser.close();
fs.renameSync(`${dir}/${fs.readdirSync(dir).find((n) => n.endsWith(".webm"))}`, out);
console.log("ok");

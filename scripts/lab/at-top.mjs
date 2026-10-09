// 2.2 calibration: the live page at the approved clip's frames (top view, 960x600 like the clip), still mode, no copy.
//   node scripts/lab/at-top.mjs 24,74,144 ['<frost json>;...']
import { chromium } from "playwright";
import fs from "node:fs";
const frames = process.argv[2].split(",").map(Number);
const looks = (process.argv[3] === "@" ? fs.readFileSync(process.argv[4], "utf8").trim().split("\n") : (process.argv[3] ?? "{}").split(";")).map((s) => JSON.parse(s));
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 400)));
await page.goto("http://localhost:3100/lab/sand?hero&still&wordmark=0&tier=high");
await page.waitForFunction(() => window.__sand?.state && window.__frost, null, { timeout: 120000 });
await page.addStyleTag({ content: "nextjs-portal,nav,[data-testid=hero-overlay]{display:none!important}" });
await page.mouse.move(959, 599);
for (const f of frames) {
  const p = 0.71 + ((f - 1) / 143) * 0.26;
  await page.evaluate((p) => window.scrollTo(0, p * (document.documentElement.scrollHeight - innerHeight)), p);
  await page.waitForTimeout(3500);
  for (const [i, l] of looks.entries()) {
    await page.evaluate((l) => window.__frost(l), l);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `test-results/sand/at-${f}-${i}.png` });
  }
}
await browser.close();
console.log("ok");

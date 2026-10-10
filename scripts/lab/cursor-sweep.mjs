// The hero with the cursor sweeping left, right, up and down: the scene's lean and the floating grains, recorded.
//   node scripts/lab/cursor-sweep.mjs [progress=0] [out]
import { chromium } from "playwright";
import fs from "node:fs";
const p = Number(process.argv[2] ?? 0), out = process.argv[3] ?? "test-results/hero/cursor-sweep.webm";
const dir = "test-results/hero/video-sweep"; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const size = { width: 1280, height: 800 };
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: size, recordVideo: { dir, size } });
const page = await ctx.newPage();
await page.goto("http://localhost:3100/lab/sand?hero&tier=mid");
await page.waitForFunction(() => window.__sand?.state, null, { timeout: 120000 });
await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
await page.evaluate((p) => { const max = document.documentElement.scrollHeight - innerHeight; const sc = ((document.documentElement.scrollHeight / innerHeight) * 100 - 100) / 1600; window.scrollTo(0, (p / sc) * max); }, p);
await page.mouse.move(640, 400);
await page.waitForTimeout(3500);
const path = [[1260, 400], [20, 400], [640, 400], [640, 20], [640, 780], [640, 400]];
for (const [x, y] of path) { await page.mouse.move(x, y, { steps: 60 }); await page.waitForTimeout(1200); }
await ctx.close(); await browser.close();
fs.renameSync(`${dir}/${fs.readdirSync(dir).find((n) => n.endsWith(".webm"))}`, out);
console.log("ok", out);

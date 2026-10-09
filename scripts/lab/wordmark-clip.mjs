// Records the wordmark untouched for N seconds (the ambient light), optionally followed by two cursor sweeps.
//   node scripts/lab/wordmark-clip.mjs [seconds=19] [sweep=0]
import { chromium } from "playwright";
import fs from "node:fs";
const dir = "test-results/sand/wmvideo";
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const secs = Number(process.argv[2] ?? 19), sweep = process.argv[3] === "1";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, recordVideo: { dir, size: { width: 1280, height: 800 } } });
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text().slice(0, 300)));
await page.goto("http://localhost:3100/lab/sand?tier=mid");
await page.waitForFunction(() => window.__sand?.state, null, { timeout: 120000 });
await page.addStyleTag({ content: "nextjs-portal,nav,header,.font-mono{display:none!important}" });
await page.mouse.move(1270, 790);
await page.waitForTimeout(secs * 1000);
if (sweep) for (let k = 0; k < 2; k++) for (let i = 0; i <= 60; i++) { await page.mouse.move(150 + i * 15, 230 + Math.sin(i / 5) * 50); await page.waitForTimeout(16); }
if (sweep) await page.waitForTimeout(3000);
await ctx.close(); await browser.close();
const f = fs.readdirSync(dir).find((n) => n.endsWith(".webm"));
fs.renameSync(`${dir}/${f}`, "test-results/sand/wordmark.webm");
console.log("ok");

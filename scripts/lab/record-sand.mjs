// Records a scripted visit to the sand lab (real browser, GPU): idle chaos, a cursor sweep, scroll into the ball, a flare,
// a stir on the ball. Writes test-results/sand/visit.webm and logs console errors and frame timing.
//   node scripts/lab/record-sand.mjs [base=http://localhost:3100] [tier=high]
import { chromium } from "playwright";
import { mkdirSync, renameSync, readdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3100";
const tier = process.argv[3] ?? "high";
const out = "test-results/sand/video";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, recordVideo: { dir: out, size: { width: 1280, height: 800 } } });
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text().slice(0, 400)));
await page.goto(`${base}/lab/sand?tier=${tier}`);
await page.waitForFunction(() => window.__sand?.state, null, { timeout: 120000 });
await page.addStyleTag({ content: "nextjs-portal,nav,header{display:none!important}" });
const t0 = Date.now();
const sweep = async (cx, cy, r, ms) => {
  const steps = Math.round(ms / 16);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a * 2) * r * 0.5);
    await page.waitForTimeout(16);
  }
};
await page.waitForTimeout(2000);                       // the chaos, alive
await sweep(420, 420, 220, 3000);                      // the cursor through the chaos
await page.mouse.move(1270, 790); await page.waitForTimeout(800);
for (let i = 0; i <= 120; i++) {                       // scroll down: the sand compacts into the ball
  await page.mouse.wheel(0, 40); await page.waitForTimeout(33);
}
await page.waitForTimeout(9000);                       // the ball alive: spin, a flare
await sweep(640, 400, 160, 3000);                      // stir the ball
await page.waitForTimeout(1500);
const timing = await page.evaluate(() => new Promise((r) => { let n = 0, t = performance.now(), worst = 0, last = t;
  const f = (now) => { worst = Math.max(worst, now - last); last = now; n++; if (now - t < 2000) requestAnimationFrame(f); else r({ fps: n / ((now - t) / 1000), worst }); };
  requestAnimationFrame(f); }));
console.log("visit", ((Date.now() - t0) / 1000).toFixed(1), "s; fps", timing.fps.toFixed(1), "worst frame", timing.worst.toFixed(1), "ms; state", JSON.stringify(await page.evaluate(() => ({ compact: window.__sand.state.compact.toFixed(3), time: window.__sand.state.time.toFixed(1) }))));
await ctx.close();
await browser.close();
const f = readdirSync(out).filter((n) => n.endsWith(".webm")).sort().pop();
renameSync(`${out}/${f}`, "test-results/sand/visit.webm");
console.log("wrote test-results/sand/visit.webm");

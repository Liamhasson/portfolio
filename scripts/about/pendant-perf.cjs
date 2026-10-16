/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS script */
// The pendant's frame cost on the GPU (plan Task 10): Playwright with the GPU flags at 1440 x 900, the mount's GPU timer on
// (`window.__pendantPerf`: an EXT_disjoint_timer_query_webgl2 query round each frame's draws, read back into
// `window.__pendant.gpuMs`), the whole track scrolled end to end, then a dwell at the expensive shots (the whirl, the glass).
// Prints the median and p95 GPU ms, overall and per shot. Budget: median under 6 ms.
//   node scripts/about/pendant-perf.cjs
// It builds and starts its own server (port PORT, 3105 by default) and stops it, by its own PID, when done. BASE: measure a
// server already running instead (nothing is started or stopped). SKIP_BUILD=1: start on the existing .next build.
// DPR: the pixel ratio (2 by default: a retina laptop); W, H: the viewport; SCROLL_S: the scroll's length (s); DWELL_S: each
// dwell (s); OUT: write the samples as JSON there. The governor (governor.ts) is held (?governor=0), so the numbers are the
// cost at DPR itself; GOVERNOR=1 leaves it on (it then reports the ratios it chose).
// Measure with nothing else on the GPU: a Blender render makes the numbers meaningless (perf-lessons). This script checks
// `pgrep -fl Blender` and labels the run CONTAMINATED if one is running (it never stops it).
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn, execSync } = require("node:child_process");
const { chromium } = require("playwright"); // (resolved up from here: a worktree finds the main checkout's node_modules)

const ROOT = path.resolve(__dirname, "../..");
const PORT = Number(process.env.PORT) || 3105;
const BASE = process.env.BASE || `http://localhost:${PORT}`;
const OWN_SERVER = !process.env.BASE;
const DPR = Number(process.env.DPR) || 2;
const W = Number(process.env.W) || 1440;
const H = Number(process.env.H) || 900;
const SCROLL_S = Number(process.env.SCROLL_S) || 30;
const DWELL_S = Number(process.env.DWELL_S) || 5;
const DWELL = ["opening", "whirl", "glass", "tumble", "hero"];
const GOVERNOR = process.env.GOVERNOR === "1";
/** Frames dropped at the start (the first frames compile and upload). */
const WARMUP = 60;

const pct = (xs, p) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
};
const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : "  -  ");

function blender() {
  try {
    return execSync("pgrep -fl Blender", { encoding: "utf8" }).trim();
  } catch {
    return ""; // (pgrep exits 1 when nothing matches)
  }
}

function portFree(port) {
  return new Promise((done) => {
    const srv = http.createServer().once("error", () => done(false)).once("listening", () => srv.close(() => done(true)));
    srv.listen(port, "127.0.0.1");
  });
}

async function waitFor(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const ok = await new Promise((done) => {
      const req = http.get(url, (res) => { res.resume(); done(res.statusCode !== undefined && res.statusCode < 500); });
      req.on("error", () => done(false));
      req.setTimeout(5000, () => { req.destroy(); done(false); });
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${url} did not come up in ${ms / 1000} s`);
}

/** Our own server: its own process group, so stopping it by its PID takes `next start`'s children with it. */
let server = null;
function stopServer() {
  if (!server || server.exitCode !== null) return;
  try {
    process.kill(-server.pid, "SIGTERM"); // (the group led by our PID only)
  } catch {
    /* already gone */
  }
}
process.on("exit", stopServer);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { stopServer(); process.exit(130); });

(async () => {
  const b = blender();
  const contaminated = b.length > 0;
  if (contaminated) console.warn(`WARNING: Blender is running (left alone); these numbers are CONTAMINATED:\n${b}\n`);

  if (OWN_SERVER) {
    if (!(await portFree(PORT))) throw new Error(`port ${PORT} is taken: set PORT, or BASE to measure a running server`);
    if (!process.env.SKIP_BUILD) {
      console.log("building (next build --webpack)...");
      execSync("npx next build --webpack", { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
    }
    server = spawn("npx", ["next", "start", "-p", String(PORT)], { cwd: ROOT, detached: true, stdio: "ignore" });
    console.log(`server pid ${server.pid} on ${BASE}`);
    await waitFor(`${BASE}/about`, 120_000);
  }

  const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
  let result;
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
    await page.addInitScript(() => { window.__pendantPerf = true; });
    page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 400)));
    await page.goto(`${BASE}/about${GOVERNOR ? "" : "?governor=0"}`);
    await page.waitForFunction(() => window.__pendant?.ready, null, { timeout: 120_000 });
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.mouse.move(W - 10, H - 10);
    const timed = await page.evaluate(() => window.__pendant.gpuMs !== null);
    if (!timed) throw new Error("no GPU timer here (EXT_disjoint_timer_query_webgl2 missing): nothing to measure");
    const gpu = await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl2");
      const d = gl?.getExtension("WEBGL_debug_renderer_info");
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : "unknown";
    });
    const keys = await page.evaluate(() => window.__pendant.keys);
    const y0 = keys[0].y, y1 = keys[keys.length - 1].y;

    // the whole track, end to end at an even speed (scrolled in the page, one step a frame), and back to the start
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);
    const rafMs = await page.evaluate(({ y0, y1, ms }) => new Promise((done) => {
      const t0 = performance.now();
      const gaps = [];
      window.__perfPr = [];
      let last = t0;
      const tick = (now) => {
        gaps.push(now - last);
        window.__perfPr.push(window.__pendant.pixelRatio);
        last = now;
        const k = Math.min(1, (now - t0) / ms);
        window.scrollTo(0, y0 + (y1 - y0) * k);
        if (k < 1) requestAnimationFrame(tick);
        else done(gaps);
      };
      requestAnimationFrame(tick);
    }), { y0, y1, ms: SCROLL_S * 1000 });
    await page.waitForTimeout(2000);
    const scrolled = await page.evaluate(() => window.__pendant.gpuMs.splice(0));
    const ratios = await page.evaluate(() => {
      const n = {};
      for (const r of window.__perfPr) n[r] = (n[r] ?? 0) + 1;
      return n;
    });

    // a dwell at each expensive shot (the motion keeps running: the whirl spins, the glass draws its lens view)
    const dwell = {};
    for (const id of DWELL) {
      const k = keys.find((x) => x.id === id);
      if (!k) continue;
      await page.evaluate((y) => window.scrollTo(0, y), k.y);
      await page.waitForTimeout(2500); // (the follow settles)
      await page.evaluate(() => window.__pendant.gpuMs.splice(0));
      const blurOn = [];
      const end = Date.now() + DWELL_S * 1000;
      while (Date.now() < end) {
        blurOn.push(await page.evaluate(() => window.__pendant.blur.on));
        await page.waitForTimeout(250);
      }
      dwell[id] = { ms: (await page.evaluate(() => window.__pendant.gpuMs.splice(0))).map((x) => x.ms), blurShare: blurOn.filter(Boolean).length / blurOn.length };
    }
    result = { gpu, scrolled: scrolled.slice(WARMUP), rafMs: rafMs.slice(5), dwell, ratios };
  } finally {
    await browser.close();
    stopServer();
  }

  const all = result.scrolled.map((x) => x.ms);
  const label = contaminated ? " [CONTAMINATED: Blender running]" : "";
  console.log(`\npendant GPU ms per frame, ${W}x${H} at DPR ${DPR} (${result.gpu})${label}`);
  console.log(`full track scroll (${SCROLL_S} s, ${all.length} frames): median ${fmt(pct(all, 50))}  p95 ${fmt(pct(all, 95))}  max ${fmt(Math.max(...all))}`);
  console.log(`  frame interval during the scroll: median ${fmt(pct(result.rafMs, 50))} ms  p95 ${fmt(pct(result.rafMs, 95))} ms`);
  const total = Object.values(result.ratios).reduce((a, b) => a + b, 0) || 1;
  console.log(`  pixel ratio drawn (frames): ${Object.entries(result.ratios).map(([r, n]) => `${r}x ${Math.round((100 * n) / total)}%`).join(", ")}${GOVERNOR ? " (governor on)" : " (governor held)"}`);
  console.log("\n  per shot (nearest key, during the scroll)       median     p95   frames");
  const byShot = {};
  for (const x of result.scrolled) (byShot[x.shot] ??= []).push(x.ms);
  for (const [id, xs] of Object.entries(byShot)) console.log(`    ${id.padEnd(44)} ${fmt(pct(xs, 50)).padStart(6)}  ${fmt(pct(xs, 95)).padStart(6)}  ${String(xs.length).padStart(6)}`);
  console.log(`\n  dwell at the key (${DWELL_S} s each)                 median     p95   frames  blur on`);
  for (const [id, d] of Object.entries(result.dwell)) {
    console.log(`    ${id.padEnd(44)} ${fmt(pct(d.ms, 50)).padStart(6)}  ${fmt(pct(d.ms, 95)).padStart(6)}  ${String(d.ms.length).padStart(6)}  ${Math.round(d.blurShare * 100)}%`);
  }
  const med = pct(all, 50);
  console.log(`\nbudget: median < 6 ms: ${med < 6 ? "PASS" : "OVER"} (${fmt(med)} ms)${label}`);
  if (process.env.OUT) {
    fs.mkdirSync(path.dirname(process.env.OUT), { recursive: true });
    fs.writeFileSync(process.env.OUT, JSON.stringify({ W, H, DPR, contaminated, ...result }, null, 1));
  }
})().catch((e) => {
  console.error(e);
  stopServer();
  process.exit(1);
});

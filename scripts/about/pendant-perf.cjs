/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS script */
// The pendant's frame cost on the GPU (plan Task 10): Playwright with the GPU flags at 1440 x 900, the mount's GPU timer on
// (`window.__pendantPerf`, with ?pendant-debug: an EXT_disjoint_timer_query_webgl2 query round each frame's draws, read back into
// `window.__pendant.gpuMs`), the whole track scrolled end to end, then a dwell at the expensive shots (the whirl, the glass).
// Prints the median and p95 GPU ms, overall and per shot. Budget: median under 6 ms.
//   node scripts/about/pendant-perf.cjs
// It builds and starts its own server (port PORT, 3105 by default) and stops it, by its own PID, when done. BASE: measure a
// server already running instead (nothing is started or stopped). SKIP_BUILD=1: start on the existing .next build.
// The build writes this worktree's shared .next: it refuses to build while any Next server (dev or start) is listening from
// this worktree (a listening-port check: lsof, then each listener's working directory), since rebuilding under a running
// server breaks it. Stop that server, or measure it with BASE, or pass SKIP_BUILD=1. If that check can't be made (lsof
// missing or failing for any reason other than "nothing is listening"), it refuses to build too.
// DPR: the pixel ratio (2 by default: a retina laptop); W, H: the viewport; SCROLL_S: the scroll's length (s); DWELL_S: each
// dwell (s); OUT: write the samples as JSON there. The governor (governor.ts) is held (?governor=0), so the numbers are the
// cost at DPR itself; GOVERNOR=1 leaves it on (it then reports the levels it chose). QUERY: more of the page's query, e.g.
// QUERY=bokehHalf=1 (the governor's last step held on, to measure it).
// Measure with nothing else on the GPU: a Blender render makes the numbers meaningless (perf-lessons). This script checks
// `pgrep -fl Blender` and labels the run CONTAMINATED if one is running (it never stops it).
//
// MODE=both: the testimonials (plan 2026-10-17-about-testimonials-light, Task 6) instead of the whole track. Their window is
// the scroll from Yoav's quote at 105% of the screen to Andrada's at -5% (q > 0; the glass slot is near only inside it). With
// the pendant on, it reports per round: the pendant's GPU ms, the light's GPU ms (its own context, its own timer query:
// `window.__testimonials.gpuMs`, also only with ?pendant-debug and __pendantPerf) and the rAF interval (median, p95, and
// the share of frames over 8.4 ms and 16.7 ms: a 120 Hz screen's frame and a 60 Hz one's), once scrolling through the
// window and once dwelling at the slot (q 1, the ball centred, the lens at full strength). Rounds alternate the glass edges
// on and off (off: `.ab-lens` hidden, so its backdrop filters don't run). MODE=light: the same with the pendant's model
// blocked, so the light draws its own ball (its costliest frame). The scroll rows leave out the frames while the work
// section's clips still play at the window's start (they hold this Chromium's rAF at 30 Hz with or without the testimonials)
// and report those apart. Budgets: the light's median GPU time <= 2 ms; the rAF
// interval's median <= 17.5 ms with the lens on. Both modes run headed by default (HEADED=0 for headless): a headless
// Chromium paces rAF at 60 Hz whatever the screen, so it can't show a 120 Hz screen's dropped frames. ROUNDS: lens on/off
// pairs (2); SCROLL_S (12) and DWELL_S (5) per round; SETTLE_MS (3000) held at the window's start before each pass; CSS:
// a style added to the page, for experiments.
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
const MODE = process.env.MODE || "pendant";
if (!["pendant", "both", "light"].includes(MODE)) throw new Error(`MODE must be pendant, both or light (got ${MODE})`);
const TESTIMONIALS = MODE !== "pendant";
const SCROLL_S = Number(process.env.SCROLL_S) || (TESTIMONIALS ? 12 : 30);
const DWELL_S = Number(process.env.DWELL_S) || 5;
const ROUNDS = Number(process.env.ROUNDS) || 2;
/** ms held at the window's start before each pass (SETTLE_MS): the pendant's follow settles after the jump back. */
const SETTLE_MS = Number(process.env.SETTLE_MS) || 3000;
const HEADED = process.env.HEADED ? process.env.HEADED === "1" : TESTIMONIALS;
const DWELL = ["opening", "whirl", "glass", "tumble", "hero"];
const GOVERNOR = process.env.GOVERNOR === "1";

/** Next servers listening from this worktree: [{ pid, cmd }] (lsof's listening TCP sockets, then each one's cwd). Throws if
 *  that can't be told for sure (lsof missing or failing, a listener whose directory can't be read): the build then refuses. */
function serversHere() {
  let out = "";
  try {
    out = execSync("lsof -nP -iTCP -sTCP:LISTEN -Fpc", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    // lsof exits 1 with no output when nothing listens; anything else (not installed, an error, a signal) is not knowing
    const quiet = !String(e.stdout ?? "").trim() && !String(e.stderr ?? "").trim();
    if (e.status === 1 && quiet) return [];
    throw new Error(`can't check for servers running from this worktree (lsof: ${String(e.stderr || e.message).trim().split("\n")[0]})`);
  }
  const pids = new Set();
  let pid = null;
  for (const line of out.split("\n")) {
    if (line[0] === "p") pid = line.slice(1);
    else if (line[0] === "c" && /node|next/i.test(line) && pid) pids.add(pid);
  }
  const here = [];
  for (const p of pids) {
    let cwd;
    try {
      cwd = execSync(`lsof -a -p ${p} -d cwd -Fn`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).split("\n").find((l) => l[0] === "n")?.slice(1);
    } catch {
      let alive = true;
      try { process.kill(Number(p), 0); } catch (err) { alive = err.code === "EPERM"; }
      if (!alive) continue; // (gone meanwhile)
      throw new Error(`can't read the working directory of listening process ${p}, so can't tell whether it serves this worktree`);
    }
    if (cwd && (cwd === ROOT || cwd.startsWith(ROOT + path.sep))) {
      here.push({ pid: p, cmd: execSync(`ps -o command= -p ${p}`, { encoding: "utf8" }).trim() });
    }
  }
  return here;
}
/** Frames dropped at the start (the first frames compile and upload). */
const WARMUP = 60;

const pct = (xs, p) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
};
const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : "  -  ");

function blender() {
  let out = "";
  try {
    out = execSync("pgrep -fl Blender", { encoding: "utf8" });
  } catch {
    return ""; // (pgrep exits 1 when nothing matches)
  }
  // (-f matches whole command lines, so a shell whose command merely mentions Blender, this check's own included, would
  // count: keep only processes that are Blender itself)
  return out.split("\n").filter((l) => {
    const cmd = l.replace(/^\s*\d+\s+/, "");
    return /Blender\.app\//.test(cmd) || /(^|\/)[Bb]lender(\s|$)/.test(cmd.split(/\s+/)[0] ?? "");
  }).join("\n").trim();
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

/** MODE=pendant: the whole track end to end, then a dwell at each expensive shot. */
async function pendant(page, gpu, contaminated) {
  await page.waitForFunction(() => window.__pendant?.ready, null, { timeout: 120_000 });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.mouse.move(W - 10, H - 10);
  const timed = await page.evaluate(() => window.__pendant.gpuMs !== null);
  if (!timed) throw new Error("no GPU timer here (EXT_disjoint_timer_query_webgl2 missing): nothing to measure");
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
      window.__perfPr.push(`${window.__pendant.pixelRatio}x${window.__pendant.bokehHalf ? "+half" : ""}`);
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
    const levels = {};
    const end = Date.now() + DWELL_S * 1000;
    while (Date.now() < end) {
      const [on, level] = await page.evaluate(() => [window.__pendant.blur.on, `${window.__pendant.pixelRatio}x${window.__pendant.bokehHalf ? "+half" : ""}`]);
      blurOn.push(on);
      levels[level] = (levels[level] ?? 0) + 1;
      await page.waitForTimeout(250);
    }
    dwell[id] = {
      ms: (await page.evaluate(() => window.__pendant.gpuMs.splice(0))).map((x) => x.ms),
      blurShare: blurOn.filter(Boolean).length / blurOn.length,
      levels: Object.keys(levels).join("/"),
    };
  }
  const baseMs = await page.evaluate(() => window.__pendant.baseMs);
  const result = { gpu, scrolled: scrolled.slice(WARMUP), rafMs: rafMs.slice(5), dwell, ratios, baseMs };
  const all = result.scrolled.map((x) => x.ms);
  const label = contaminated ? " [CONTAMINATED: Blender running]" : "";
  console.log(`\npendant GPU ms per frame, ${W}x${H} at DPR ${DPR} (${result.gpu})${label}`);
  console.log(`full track scroll (${SCROLL_S} s, ${all.length} frames): median ${fmt(pct(all, 50))}  p95 ${fmt(pct(all, 95))}  max ${fmt(Math.max(...all))}`);
  console.log(`  frame interval during the scroll: median ${fmt(pct(result.rafMs, 50))} ms  p95 ${fmt(pct(result.rafMs, 95))} ms`);
  const total = Object.values(result.ratios).reduce((a, b) => a + b, 0) || 1;
  console.log(`  level drawn (frames): ${Object.entries(result.ratios).map(([r, n]) => `${r} ${Math.round((100 * n) / total)}%`).join(", ")}${GOVERNOR ? ` (governor on; the screen's pace it reads load against: ${fmt(result.baseMs)} ms)` : " (governor held)"}`);
  console.log("\n  per shot (nearest key, during the scroll)       median     p95   frames");
  const byShot = {};
  for (const x of result.scrolled) (byShot[x.shot] ??= []).push(x.ms);
  for (const [id, xs] of Object.entries(byShot)) console.log(`    ${id.padEnd(44)} ${fmt(pct(xs, 50)).padStart(6)}  ${fmt(pct(xs, 95)).padStart(6)}  ${String(xs.length).padStart(6)}`);
  console.log(`\n  dwell at the key (${DWELL_S} s each)                 median     p95   frames  blur on  level`);
  for (const [id, d] of Object.entries(result.dwell)) {
    console.log(`    ${id.padEnd(44)} ${fmt(pct(d.ms, 50)).padStart(6)}  ${fmt(pct(d.ms, 95)).padStart(6)}  ${String(d.ms.length).padStart(6)}  ${`${Math.round(d.blurShare * 100)}%`.padStart(7)}  ${d.levels}`);
  }
  const med = pct(all, 50);
  console.log(`\nbudget: median < 6 ms: ${med < 6 ? "PASS" : "OVER"} (${fmt(med)} ms)${label}`);
  if (process.env.OUT) {
    fs.mkdirSync(path.dirname(process.env.OUT), { recursive: true });
    fs.writeFileSync(process.env.OUT, JSON.stringify({ MODE, W, H, DPR, contaminated, ...result }, null, 1));
  }
}

/** rAF intervals (ms): median, p95, and the shares over a 120 Hz screen's frame (8.4 ms) and a 60 Hz one's (16.7 ms).
 *  (rAF's clock moves in 0.1 ms steps and the intervals jitter round the screen's period, so a share over exactly one
 *  period counts on-time frames too: the shares over 12.5 ms (a 120 Hz frame missed) and 25 ms (a 60 Hz one missed) are
 *  the dropped frames.) */
function rafStats(gaps) {
  const n = gaps.length || 1;
  const over = (ms) => gaps.filter((g) => g > ms).length / n;
  return { n: gaps.length, median: pct(gaps, 50), p95: pct(gaps, 95), over8: over(8.4), over12: over(12.5), over16: over(16.7), over25: over(25) };
}
const share = (x) => `${(100 * x).toFixed(1)}%`;

/** MODE=both / light: the testimonials' window, scrolled through and dwelt at, rounds alternating the lens on and off. */
async function testimonials(page, gpu, contaminated) {
  await page.waitForFunction(() => window.__testimonials !== undefined, null, { timeout: 120_000 });
  if (MODE === "both") await page.waitForFunction(() => window.__pendant?.ready, null, { timeout: 120_000 });
  else await page.waitForFunction(() => !document.querySelector("canvas.ab-pendant"), null, { timeout: 60_000 });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  if (process.env.CSS) await page.addStyleTag({ content: process.env.CSS }); // (experiments: e.g. CSS='.ab-mood{display:none}')
  await page.mouse.move(W - 10, H - 10);
  const timers = await page.evaluate(() => ({ light: Array.isArray(window.__testimonials?.gpuMs), pendant: Array.isArray(window.__pendant?.gpuMs) }));
  if (!timers.light) throw new Error("no GPU timer on the light here (EXT_disjoint_timer_query missing): nothing to measure");
  if (MODE === "both" && !timers.pendant) throw new Error("no GPU timer on the pendant here (EXT_disjoint_timer_query_webgl2 missing)");
  // the window: the scroll where Yoav's centre is at 105% of the screen's width (q starts) to where Andrada's is at -5% (q is
  // 0 again); the glass slot lies between them, so it is near only inside this. And the slot centred (q 1).
  const win = await page.evaluate(() => {
    const sec = document.querySelector("section.ab"), tr = sec?.querySelector(".ab-track"), clip = tr?.parentElement;
    if (!sec || !tr || !clip || sec.dataset.mode !== "track") return null;
    const trR = tr.getBoundingClientRect(), clipL = clip.getBoundingClientRect().left, vw = clip.clientWidth;
    const top = sec.getBoundingClientRect().top + window.scrollY;
    const at = (sel, x) => { const r = document.querySelector(sel).getBoundingClientRect(); return top + clipL + (r.left - trR.left + r.width / 2) - x; };
    return { y0: at("[data-pendant='quote1']", 1.05 * vw), y1: at("[data-pendant='quote2']", -0.05 * vw), slot: at("[data-pendant='glass']", vw / 2) };
  });
  if (!win) throw new Error("About isn't on its sideways track at this size: no testimonials window to measure");
  const setLens = (on) => page.evaluate((on) => {
    const st = document.getElementById("perf-lens-off");
    if (!on && !st) {
      const el = document.createElement("style");
      el.id = "perf-lens-off";
      el.textContent = ".ab-lens{display:none!important}";
      document.head.appendChild(el);
    } else if (on && st) st.remove();
  }, on);
  const lensShown = () => page.evaluate(() => {
    const el = document.querySelector(".ab-lens-strip[data-edge='top']");
    return !!el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0;
  });
  const takeGpu = () => page.evaluate(() => ({
    pendant: window.__pendant?.gpuMs?.splice(0) ?? [],
    light: window.__testimonials?.gpuMs?.splice(0) ?? [],
  }));
  const sweep = () => page.evaluate(({ y0, y1, ms }) => new Promise((done) => {
    const gaps = [], drawing = [], at = [], video = [];
    const vids = [...document.querySelectorAll("video")];
    let t0 = null, last = 0, k = 0;
    const tick = (now) => {
      if (t0 === null) { t0 = last = now; window.scrollTo(0, y0); requestAnimationFrame(tick); return; }
      gaps.push(now - last);
      drawing.push(!!window.__testimonials?.drawing);
      at.push(k); // (where in the window the frame that just ended was drawn: 0 its start, 1 its end)
      video.push(vids.some((v) => !v.paused)); // (the work section's clips, playing at the window's start: see below)
      last = now;
      k = Math.min(1, (now - t0) / ms);
      window.scrollTo(0, y0 + (y1 - y0) * k);
      if (k < 1) requestAnimationFrame(tick);
      else done({ gaps, drawing, at, video });
    };
    requestAnimationFrame(tick);
  }), { y0: win.y0, y1: win.y1, ms: SCROLL_S * 1000 });
  const still = () => page.evaluate((ms) => new Promise((done) => {
    const gaps = [];
    let t0 = null, last = 0;
    const tick = (now) => {
      if (t0 === null) t0 = last = now;
      else { gaps.push(now - last); last = now; }
      if (now - t0 < ms) requestAnimationFrame(tick);
      else done(gaps);
    };
    requestAnimationFrame(tick);
  }), DWELL_S * 1000);

  // a warm-up pass (the first frames compile and upload), not counted
  await page.evaluate((y) => window.scrollTo(0, y), win.y0);
  await page.waitForTimeout(1000);
  await sweep();
  await page.waitForTimeout(1000);
  await takeGpu();

  const rounds = [];
  for (let i = 0; i < 2 * ROUNDS; i++) {
    const lens = i % 2 === 0;
    await setLens(lens);
    await page.evaluate((y) => window.scrollTo(0, y), win.y0);
    await page.waitForTimeout(SETTLE_MS);
    await takeGpu();
    const sw = await sweep();
    await page.waitForTimeout(300); // (the last frames' queries read back)
    const swGpu = await takeGpu();
    await page.evaluate((y) => window.scrollTo(0, y), win.slot);
    await page.waitForTimeout(1500); // (the pendant's follow settles)
    const hook = await page.evaluate(() => ({ q: window.__testimonials.q, drawing: window.__testimonials.drawing, ownBall: window.__testimonials.ownBall }));
    const shown = await lensShown();
    await takeGpu();
    const gaps = await still();
    await page.waitForTimeout(300);
    const dwGpu = await takeGpu();
    rounds.push({
      lens, lensShownAtSlot: shown, hookAtSlot: hook,
      sweepShots: Object.fromEntries(Object.entries(swGpu.pendant.reduce((m, x) => ((m[x.shot] ??= []).push(x.ms), m), {})).map(([k, v]) => [k, { median: +pct(v, 50).toFixed(2), p95: +pct(v, 95).toFixed(2), n: v.length }])),
      sweep: { raf: sw.gaps.filter((_, k) => sw.drawing[k] && !sw.video[k]), withVideo: sw.gaps.filter((_, k) => sw.drawing[k] && sw.video[k]), long: sw.gaps.map((g, k) => [g, sw.at[k]]).filter(([g], k) => sw.drawing[k] && g > 25).map(([g, a]) => [+g.toFixed(1), +a.toFixed(3)]), pendant: swGpu.pendant.map((x) => x.ms), light: swGpu.light.map((x) => x.ms), ownBall: swGpu.light.filter((x) => x.ownBall).length },
      dwell: { raf: gaps, pendant: dwGpu.pendant.map((x) => x.ms), light: dwGpu.light.map((x) => x.ms), ownBall: dwGpu.light.filter((x) => x.ownBall).length },
    });
  }
  await setLens(true);
  const sizes = await page.evaluate(() => {
    const c = document.querySelector("canvas.ab-light");
    const imgs = [...document.querySelectorAll(".ab-lens-defs feImage")].map((i) => `${i.getAttribute("width")}x${i.getAttribute("height")}`);
    return { light: c ? `${c.width}x${c.height}` : "none", lensSlices: imgs.join(" "), dpr: window.devicePixelRatio };
  });

  const label = contaminated ? " [CONTAMINATED: Blender running]" : "";
  const who = MODE === "both" ? "the pendant on" : "the pendant blocked: the light's own ball";
  console.log(`\ntestimonials (MODE=${MODE}, ${who}), ${W}x${H} at DPR ${DPR}, ${HEADED ? "headed" : "headless"}, governor ${GOVERNOR ? "on" : "held"} (${gpu})${label}`);
  console.log(`  light canvas ${sizes.light} (DPR cap 1.5); lens slices (map px x2) ${sizes.lensSlices || "none"}`);
  console.log(`  window: scroll ${Math.round(win.y0)} -> ${Math.round(win.y1)} over ${SCROLL_S} s; slot centred at ${Math.round(win.slot)}; dwell ${DWELL_S} s; ${ROUNDS} round(s) each way`);
  for (const r of rounds) {
    if (r.lens && !r.lensShownAtSlot) console.warn("  WARNING: a lens-on round without the lens showing at the slot (not Chromium, or the map not built)");
    if (!r.lens && r.lensShownAtSlot) console.warn("  WARNING: a lens-off round with the lens showing");
  }
  const head = "                       frames  rAF med     p95   >8.4ms  >12.5ms  >16.7ms    >25ms   pendant GPU med    p95   light GPU med    p95  (frames, own ball)";
  console.log(`\n${head}`);
  const rows = {};
  for (const where of ["sweep", "dwell"]) {
    for (const lens of [true, false]) {
      const rs = rounds.filter((r) => r.lens === lens).map((r) => r[where]);
      const raf = rs.flatMap((x) => x.raf), pg = rs.flatMap((x) => x.pendant), lg = rs.flatMap((x) => x.light);
      const own = rs.reduce((a, x) => a + x.ownBall, 0);
      const st = rafStats(raf);
      rows[`${where}-${lens ? "on" : "off"}`] = { raf: st, pendant: { n: pg.length, median: pct(pg, 50), p95: pct(pg, 95) }, light: { n: lg.length, median: pct(lg, 50), p95: pct(lg, 95), ownBall: own } };
      const name = `${where === "sweep" ? "scroll through" : "dwell at slot"}, lens ${lens ? "on " : "off"}`;
      console.log(`  ${name.padEnd(22)} ${String(st.n).padStart(5)}  ${fmt(st.median).padStart(6)}  ${fmt(st.p95).padStart(6)}  ${share(st.over8).padStart(7)}  ${share(st.over12).padStart(7)}  ${share(st.over16).padStart(7)}  ${share(st.over25).padStart(7)}   ${fmt(pct(pg, 50)).padStart(15)}  ${fmt(pct(pg, 95)).padStart(5)}  ${fmt(pct(lg, 50)).padStart(14)}  ${fmt(pct(lg, 95)).padStart(5)}  (${lg.length}, ${own})`);
    }
  }
  console.log("\n  per round                     rAF med     p95  >12.5ms  >16.7ms  pendant GPU med  light GPU med");
  rounds.forEach((r, i) => {
    for (const where of ["sweep", "dwell"]) {
      const x = r[where], st = rafStats(x.raf);
      console.log(`    ${`${i + 1} ${where === "sweep" ? "scroll" : "slot"}, lens ${r.lens ? "on" : "off"}`.padEnd(26)} ${fmt(st.median).padStart(7)}  ${fmt(st.p95).padStart(6)}  ${share(st.over12).padStart(7)}  ${share(st.over16).padStart(7)}  ${fmt(pct(x.pendant, 50)).padStart(15)}  ${fmt(pct(x.light, 50)).padStart(13)}`);
    }
  });
  // The window's start still has the work section's three clips (cyvore, eventread, nordic-logic-live: 1280 x 800 videos
  // shown as thumbnails) playing on screen, and while any plays this Chromium paces rAF at 30 Hz, testimonials or not (the
  // same 33 ms at q 0, before the window). Those frames are left out of the rows above and shown here on their own.
  for (const lens of [true, false]) {
    const v = rounds.filter((r) => r.lens === lens).flatMap((r) => r.sweep.withVideo), st = rafStats(v);
    console.log(`  scroll, lens ${lens ? "on " : "off"}, frames with the work clips playing: ${st.n}, rAF median ${fmt(st.median)} p95 ${fmt(st.p95)}, >16.7 ms ${share(st.over16)}`);
  }
  // where the dropped 60 Hz frames fall in the window (tenths, start to end)
  for (const lens of [true, false]) {
    const bins = Array(10).fill(0);
    for (const r of rounds.filter((x) => x.lens === lens)) for (const [, a] of r.sweep.long) bins[Math.min(9, Math.floor(a * 10))]++;
    console.log(`  frames over 25 ms while scrolling, lens ${lens ? "on " : "off"}, by tenth of the window: ${bins.join(" ")}`);
  }
  if (MODE === "both") console.log(`  the pendant's GPU ms while scrolling, by its nearest shot (round 1): ${Object.entries(rounds[0].sweepShots).map(([k, v]) => `${k} ${v.median}/${v.p95} (${v.n})`).join(", ")}`);
  const allLight = rounds.flatMap((r) => [...r.sweep.light, ...r.dwell.light]);
  const lightMed = pct(allLight, 50);
  const onMed = Math.max(rows["sweep-on"].raf.median, rows["dwell-on"].raf.median);
  console.log(`\nbudget: the light's median GPU <= 2 ms: ${lightMed <= 2 ? "PASS" : "OVER"} (${fmt(lightMed)} ms)${label}`);
  console.log(`budget: the rAF interval's median <= 17.5 ms with the lens on: ${onMed <= 17.5 ? "PASS" : "OVER"} (scroll ${fmt(rows["sweep-on"].raf.median)}, slot ${fmt(rows["dwell-on"].raf.median)} ms)${label}`);
  if (process.env.OUT) {
    fs.mkdirSync(path.dirname(process.env.OUT), { recursive: true });
    fs.writeFileSync(process.env.OUT, JSON.stringify({ MODE, W, H, DPR, HEADED, contaminated, gpu, sizes, win, rows, rounds }, null, 1));
  }
}
(async () => {
  const b = blender();
  const contaminated = b.length > 0;
  if (contaminated) console.warn(`WARNING: Blender is running (left alone); these numbers are CONTAMINATED:\n${b}\n`);

  if (OWN_SERVER) {
    if (!(await portFree(PORT))) throw new Error(`port ${PORT} is taken: set PORT, or BASE to measure a running server`);
    if (!process.env.SKIP_BUILD) {
      const busy = serversHere();
      if (busy.length) {
        throw new Error(
          `a Next server is running from this worktree, and the build would rewrite the .next it serves:\n${busy.map((b) => `  pid ${b.pid}: ${b.cmd}`).join("\n")}\n` +
          "stop it, measure it with BASE=http://localhost:<port>, or pass SKIP_BUILD=1",
        );
      }
      console.log("building (next build --webpack)...");
      execSync("npx next build --webpack", { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
    }
    server = spawn("npx", ["next", "start", "-p", String(PORT)], { cwd: ROOT, detached: true, stdio: "ignore" });
    console.log(`server pid ${server.pid} on ${BASE}`);
    await waitFor(`${BASE}/about`, 120_000);
  }

  const browser = await chromium.launch({ headless: !HEADED, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
    await page.addInitScript(() => { window.__pendantPerf = true; });
    page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 400)));
    // (the light's own ball: the pendant's model blocked; its URL carries a ?v= token)
    if (MODE === "light") await page.route(/\/pendant\.glb(\?|$)/, (r) => r.abort());
    // (pendant-debug: the mounts read window.__pendantPerf only with it)
    const query = ["pendant-debug", GOVERNOR ? "" : "governor=0", process.env.QUERY ?? ""].filter(Boolean).join("&");
    await page.goto(`${BASE}/about${query ? `?${query}` : ""}`);
    const gpu = await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl2");
      const d = gl?.getExtension("WEBGL_debug_renderer_info");
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : "unknown";
    });
    if (TESTIMONIALS) await testimonials(page, gpu, contaminated);
    else await pendant(page, gpu, contaminated);
  } finally {
    await browser.close();
    stopServer();
  }
})().catch((e) => {
  console.error(e);
  stopServer();
  process.exit(1);
});

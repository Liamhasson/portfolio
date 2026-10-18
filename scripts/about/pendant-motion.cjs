/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS script */
// The pendant's motion between shots (plan 2026-10-17-about-pendant-motion-pass, Task 2): how hard it moves on screen as the
// track scrolls at a steady speed. Playwright, headless, at 1440 x 900: the whole track scrolled end to end at SPEED page px a
// second (1500 by default), one even step a frame, with the mount's fixed frame step (`window.__pendantStep`, 1/60 s, read
// with ?pendant-debug), so every frame is 1/60 s of scroll whatever the machine does. Each frame it reads the mount's
// diagnostics (`window.__pendant.pose`, only with ?pendant-debug): the pendant's middle on screen, its height and its roll.
// Per transition (shot i to shot i + 1) it reports the peak screen speed of the middle (vw per 1/60 s frame), its peak
// acceleration (the change of that velocity from one frame to the next, vw per frame per frame: the kick leaving and reaching
// a shot), the peak height change per frame (%) and the peak roll change per frame (degrees), and flags any transition whose
// peak speed is more than 2x the median transition's. Bounds (the brief's): peak speed <= 1.2 vw a frame, height change <= 4% a frame.
//   node scripts/about/pendant-motion.cjs
//   OUT=test-results/pendant-motion.json node scripts/about/pendant-motion.cjs
// It builds and starts its own server (port PORT, 3320 by default) and stops it, by its own process group, when done. BASE:
// measure a server already running instead (nothing is started or stopped). SKIP_BUILD=1: start on the existing .next build.
// The build writes this worktree's shared .next: it refuses to build while any Next server (dev or start) is listening from
// this worktree (lsof, then each listener's working directory), as pendant-perf.cjs does; if that can't be told, it refuses.
// Never a visible window (Liam, 2026-10-17: "stop it for good"): always headless, there is no HEADED switch here.
// W, H: the viewport; DPR: the pixel ratio (1 by default: the motion is geometry, the pixels don't change it); SPEED: page px a
// second; SETTLE_MS: held at the start before the run; TAIL: frames held at the end (the follow catching up); OUT: the JSON.
// FROM=<a JSON this wrote>: report that run again (no server, no browser), e.g. to compare an old run with today's columns.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn, execSync } = require("node:child_process");
const { chromium } = require("playwright"); // (resolved up from here: a worktree finds the main checkout's node_modules)

const ROOT = path.resolve(__dirname, "../..");
const PORT = Number(process.env.PORT) || 3320;
const BASE = process.env.BASE || `http://localhost:${PORT}`;
const OWN_SERVER = !process.env.BASE;
const W = Number(process.env.W) || 1440;
const H = Number(process.env.H) || 900;
const DPR = Number(process.env.DPR) || 1;
const SPEED = Number(process.env.SPEED) || 1500;
const SETTLE_MS = Number(process.env.SETTLE_MS) || 3000;
const TAIL = Number(process.env.TAIL) || 90;
const FRAME_MS = 1000 / 60;
/** The brief's bounds, per 1/60 s frame. */
const MAX_VW = 1.2;
const MAX_H_PCT = 4;

/** Next servers listening from this worktree: [{ pid, cmd }] (pendant-perf.cjs's check). Throws if that can't be told. */
function serversHere() {
  let out = "";
  try {
    out = execSync("lsof -nP -iTCP -sTCP:LISTEN -Fpc", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
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
      if (!alive) continue;
      throw new Error(`can't read the working directory of listening process ${p}, so can't tell whether it serves this worktree`);
    }
    if (cwd && (cwd === ROOT || cwd.startsWith(ROOT + path.sep))) {
      here.push({ pid: p, cmd: execSync(`ps -o command= -p ${p}`, { encoding: "utf8" }).trim() });
    }
  }
  return here;
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

/** Our own server: its own process group, so stopping it by its PID takes `next start`'s children with it (and nothing else). */
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

const pct = (xs, p) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
};
const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "-");

/** The per-frame steps between consecutive drawn frames: speed of the middle (vw a frame), height change (% a frame), roll
 *  change (degrees a frame), each attributed to the transition the later frame is in. A pair of samples more than one drawn
 *  frame apart is divided by the frames between (and one with no new frame is skipped). */
function steps(poses, w, h) {
  const out = [];
  let last = null; // (the previous step's velocity, vw a frame, for the acceleration)
  for (let k = 1; k < poses.length; k++) {
    const a = poses[k - 1], b = poses[k];
    const n = b.n - a.n;
    if (n <= 0) continue;
    const vx = ((b.cx - a.cx) * w) / (w / 100) / n, vy = ((b.cy - a.cy) * h) / (w / 100) / n;
    out.push({
      index: b.index, t: b.t, s: b.s,
      v: Math.hypot(vx, vy),
      acc: last ? Math.hypot(vx - last.vx, vy - last.vy) / n : 0,
      dh: (Math.abs(b.h / a.h - 1) * 100) / n,
      droll: Math.abs(b.roll - a.roll) / n,
    });
    last = { vx, vy };
  }
  return out;
}

async function measure(page) {
  await page.waitForFunction(() => window.__pendant?.ready && window.__pendant.pose, null, { timeout: 120_000 });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.mouse.move(W - 10, H - 10); // (the cursor parked in a corner: its lean holds still)
  const keys = await page.evaluate(() => window.__pendant.keys);
  const mode = await page.evaluate(() => window.__pendant.mode);
  if (mode !== "track") throw new Error(`About isn't on its sideways track at ${W}x${H} (mode ${mode})`);
  const y0 = keys[0].y, y1 = keys[keys.length - 1].y;
  await page.evaluate((y) => window.scrollTo(0, y), y0);
  await page.waitForTimeout(SETTLE_MS); // (the arrival, the follow and the fade-in settle)
  const per = (SPEED * FRAME_MS) / 1000;
  const poses = await page.evaluate(({ y0, y1, per, tail }) => new Promise((done) => {
    const out = [];
    let k = 0, held = 0, lastN = -1;
    const tick = () => {
      const p = window.__pendant.pose;
      if (p && p.n !== lastN) { out.push({ ...p, y: window.scrollY }); lastN = p.n; }
      const y = Math.min(y0 + per * ++k, y1);
      window.scrollTo(0, y);
      if (y >= y1 && ++held > tail) done(out);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { y0, y1, per, tail: TAIL });
  return { keys, poses };
}

function report({ keys, poses }, w = W, h = H, dpr = DPR, speed = SPEED) {
  const st = steps(poses, w, h);
  const top = keys[0].y;
  const rows = [];
  for (let i = 0; i < keys.length - 1; i++) {
    const xs = st.filter((x) => x.index === i);
    const peak = (f) => xs.reduce((m, x) => (f(x) > f(m) ? x : m), xs[0]);
    const pv = xs.length ? peak((x) => x.v) : null;
    rows.push({
      from: keys[i].id, to: keys[i + 1].id, travel: Math.round(keys[i + 1].y - keys[i].y), frames: xs.length,
      peakV: pv ? pv.v : NaN, peakVAt: pv ? Math.round(pv.s) : null, peakVT: pv ? pv.t : NaN,
      peakAcc: xs.length ? Math.max(...xs.map((x) => x.acc)) : NaN,
      peakDh: xs.length ? Math.max(...xs.map((x) => x.dh)) : NaN,
      peakRoll: xs.length ? Math.max(...xs.map((x) => x.droll)) : NaN,
      meanV: xs.length ? xs.reduce((a, x) => a + x.v, 0) / xs.length : NaN,
    });
  }
  const med = pct(rows.map((r) => r.peakV).filter(Number.isFinite), 50);
  for (const r of rows) r.busy = r.peakV > 2 * med;
  console.log(`\npendant motion between shots, ${w}x${h} at DPR ${dpr}, headless, ${speed} px/s (${fmt((speed * FRAME_MS) / 1000, 1)} px a 1/60 s frame), ${poses.length} frames`);
  console.log("\n  transition               travel  frames   peak vw/f  (at t)   mean vw/f   peak acc vw/f2   peak dh %/f   peak droll deg/f");
  for (const r of rows) {
    const name = `${r.from} -> ${r.to}`;
    console.log(`  ${name.padEnd(24)} ${String(r.travel).padStart(6)}  ${String(r.frames).padStart(6)}   ${fmt(r.peakV).padStart(9)}  (${fmt(r.peakVT)})   ${fmt(r.meanV).padStart(9)}   ${fmt(r.peakAcc, 3).padStart(14)}   ${fmt(r.peakDh).padStart(11)}   ${fmt(r.peakRoll).padStart(16)}${r.busy ? "   > 2x median" : ""}`);
  }
  const allV = Math.max(...rows.map((r) => r.peakV).filter(Number.isFinite));
  const allH = Math.max(...rows.map((r) => r.peakDh).filter(Number.isFinite));
  console.log(`\n  median transition peak ${fmt(med)} vw/f; busiest ${fmt(allV)} vw/f; height ${fmt(allH)} %/f`);
  console.log(`  bound: peak speed <= ${MAX_VW} vw a frame: ${allV <= MAX_VW ? "PASS" : "OVER"} (${fmt(allV)}); height <= ${MAX_H_PCT}% a frame: ${allH <= MAX_H_PCT ? "PASS" : "OVER"} (${fmt(allH)})`);
  const busy = rows.filter((r) => r.busy).map((r) => `${r.from} -> ${r.to}`);
  console.log(`  more than 2x the median: ${busy.length ? busy.join(", ") : "none"}`);
  if (process.env.OUT) {
    fs.mkdirSync(path.dirname(path.resolve(process.env.OUT)), { recursive: true });
    fs.writeFileSync(process.env.OUT, JSON.stringify({ W: w, H: h, DPR: dpr, SPEED: speed, top, keys, median: med, rows, steps: st, poses }, null, 1));
    console.log(`  wrote ${process.env.OUT}`);
  }
}

(async () => {
  if (process.env.FROM) {
    const run = JSON.parse(fs.readFileSync(process.env.FROM, "utf8"));
    report(run, run.W, run.H, run.DPR, run.SPEED);
    return;
  }
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
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
    await page.addInitScript((ms) => { window.__pendantStep = ms; }, FRAME_MS);
    page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 400)));
    // (pendant-debug: the mount fills `pose` and reads __pendantStep only with it; the governor held, so nothing resizes)
    await page.goto(`${BASE}/about?pendant-debug&governor=0`);
    report(await measure(page));
  } finally {
    await browser.close();
    stopServer();
  }
})().catch((e) => {
  console.error(e);
  stopServer();
  process.exit(1);
});

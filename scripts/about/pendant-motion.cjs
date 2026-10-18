/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS script */
// The pendant's motion between shots (plan 2026-10-17-about-pendant-motion-pass, Task 2): how hard it moves on screen as the
// track scrolls at a steady speed. Playwright, headless, at 1440 x 900: the whole track scrolled end to end at SPEED page px a
// second (1500 by default), one even step a frame, with the mount's fixed frame step (`window.__pendantStep`, 1/60 s, read
// with ?pendant-debug), so every frame is 1/60 s of scroll whatever the machine does. Each frame it reads the mount's
// diagnostics (`window.__pendant.pose`, only with ?pendant-debug): the pendant's middle on screen, its height and its roll.
// Per transition (shot i to shot i + 1) it reports the peak screen speed of the middle (vw per 1/60 s frame), its peak
// acceleration (the change of that velocity from one frame to the next, vw per frame per frame: the kick leaving and reaching
// a shot), the peak height change per frame (%) and the peak roll change per frame (degrees), and flags any transition whose
// peak speed is more than 1.6x the median transition's; and how far a locked face trails its lock (degrees). Bounds (the
// controller's ruling, 2026-10-18): busiest <= 1.6x the median, median <= 1.86 vw a frame, height change <= 6% a frame.
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
// Speeds are per drawn frame (each a fixed 1/60 s step), and every scroll step is checked: a step whose page scroll isn't
// SPEED's 1/60 s share (nor 0, the held tail) is counted and left out of the peaks.
// The brightness: of the frames drawn in front, the share dimmed below 0.9 (the look ahead dimming for a pass behind the
// words, or the brightness coming back after one; frames past the track's end, where the pull to Contact fades it, left
// out), sorted into those within LEAD_F frames before a real pass (a frame the
// solve has behind and over a line), those within BACK_F after the pendant was last behind, and the rest (unexplained); and
// the front frames where the look ahead dims beyond Task 1's own rule (the words where they are at rest, `pose.aheadBase`).
// MODE=pagedown: the same brightness count for a Page Down sequence instead (the key pressed every PAGE_MS from the track's
// start to its end, the frames recorded throughout); no transition table (the scroll isn't steady).
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
const MODE = process.env.MODE || "steady";
if (!["steady", "pagedown"].includes(MODE)) throw new Error(`MODE must be steady or pagedown (got ${MODE})`);
const PAGE_MS = Number(process.env.PAGE_MS) || 1000;
/** The brightness count's windows (frames): before a real pass behind the words (the look ahead's AHEAD_T, 0.9 s, and a
 *  little), and after the pendant was last behind (the brightness easing back from the behind level to 0.9 takes ~0.65 s). */
const LEAD_F = Number(process.env.LEAD_F) || 75;
const BACK_F = Number(process.env.BACK_F) || 60;
const FRAME_MS = 1000 / 60;
/** The bounds, per 1/60 s frame (the controller's ruling of 2026-10-18, in place of the brief's absolute 1.2 vw): an even
 *  pace. No transition's peak speed over EVEN x the median transition's; the median at most MEDIAN_MAX (the pre-motion-pass
 *  median); no transition's height changing more than MAX_H_PCT a frame. */
const EVEN = 1.6;
const MEDIAN_MAX = 1.86;
const MAX_H_PCT = 6;

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
function steps(poses, w, h, per) {
  const out = [];
  const yEnd = Math.max(...poses.map((p) => p.y ?? -Infinity)); // (the last step onto the end may be short: clamped there)
  let last = null; // (the previous step's velocity, vw a frame, for the acceleration)
  for (let k = 1; k < poses.length; k++) {
    const a = poses[k - 1], b = poses[k];
    const n = b.n - a.n;
    if (n <= 0) continue;
    const vx = ((b.cx - a.cx) * w) / (w / 100) / n, vy = ((b.cy - a.cy) * h) / (w / 100) / n;
    // (the scroll that step: SPEED's share a frame while scrolling, 0 once held at the end; anything else is irregular)
    const dy = a.y === undefined || b.y === undefined ? null : b.y - a.y;
    const irregular = per !== undefined && dy !== null && Math.abs(dy - per * n) > 0.5 && Math.abs(dy) > 0.5
      && !(b.y === yEnd && dy > 0 && dy < per * n);
    out.push({
      index: b.index, t: b.t, s: b.s, irregular,
      v: Math.hypot(vx, vy),
      acc: last ? Math.hypot(vx - last.vx, vy - last.vy) / n : 0,
      dh: (Math.abs(b.h / a.h - 1) * 100) / n,
      droll: Math.abs(b.roll - a.roll) / n,
      // (how far the face is from the one its lock asks, degrees: only where a lock holds at least half)
      face: b.lock !== undefined && b.lock !== null && b.lockMix >= 0.5 ? Math.abs(((((b.yaw * 180) / Math.PI - b.lock) % 360) + 540) % 360 - 180) : 0,
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
  return { keys, poses, mode: "steady" };
}

/** MODE=pagedown: Page Down pressed every PAGE_MS from the track's start until the page reaches its end, every frame's pose
 *  recorded meanwhile (and SETTLE_MS more after the last press). */
async function pagedown(page) {
  await page.waitForFunction(() => window.__pendant?.ready && window.__pendant.pose, null, { timeout: 120_000 });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.mouse.move(W - 10, H - 10);
  const keys = await page.evaluate(() => window.__pendant.keys);
  const mode = await page.evaluate(() => window.__pendant.mode);
  if (mode !== "track") throw new Error(`About isn't on its sideways track at ${W}x${H} (mode ${mode})`);
  const y0 = keys[0].y, y1 = keys[keys.length - 1].y;
  await page.evaluate((y) => window.scrollTo(0, y), y0);
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(() => {
    window.__poses = [];
    window.__rec = true;
    let lastN = -1;
    const tick = () => {
      const p = window.__pendant.pose;
      if (p && p.n !== lastN) { window.__poses.push({ ...p, y: window.scrollY }); lastN = p.n; }
      if (window.__rec) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const ys = [];
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("PageDown");
    await page.waitForTimeout(PAGE_MS);
    const y = await page.evaluate(() => window.scrollY);
    ys.push(Math.round(y));
    if (y >= y1) break;
    if (ys.length >= 3 && ys.at(-1) === ys.at(-3)) throw new Error(`Page Down doesn't move the page (scroll ${ys.join(", ")})`);
  }
  await page.waitForTimeout(SETTLE_MS);
  const poses = await page.evaluate(() => { window.__rec = false; return window.__poses; });
  console.log(`  page after each press: ${ys.join(", ")} (track ${Math.round(y0)} to ${Math.round(y1)})`);
  return { keys, poses, mode: "pagedown" };
}

/** The brightness of the frames drawn in front: the share dimmed below 0.9, and why (see the header). */
function dimming(poses, yEnd) {
  if (!poses.length || poses[0].layer === undefined) return { share: NaN }; // (a run from before the pose had the layer)
  // (past the track's end the pull to Contact fades it out: not the look ahead's doing, left out)
  poses = poses.filter((p) => !(p.y > yEnd + 0.5));
  const front = [], why = { before: 0, after: 0, other: 0 }, others = [];
  let lastBack = -Infinity;
  const passAt = poses.map((p) => p.back && p.over);
  for (let k = 0; k < poses.length; k++) {
    const p = poses[k];
    if (p.layer === "back") { lastBack = k; continue; }
    front.push(p);
    if (!(p.bright < 0.9)) continue;
    let before = false;
    for (let j = k + 1; j <= Math.min(k + LEAD_F, poses.length - 1); j++) if (passAt[j]) { before = true; break; }
    if (before) why.before++;
    else if (k - lastBack <= BACK_F) why.after++;
    else { why.other++; if (others.length < 8) others.push(Math.round(p.s)); }
  }
  const dimmed = why.before + why.after + why.other;
  const share = (n) => (front.length ? (100 * n) / front.length : NaN);
  const ahead = front.filter((p) => p.ahead).length;
  // (the look ahead dimming where Task 1's own rule, the words where they are at rest, wouldn't: the lag's doing)
  const extra = front.filter((p) => p.ahead && p.aheadBase === false).length;
  const extraDim = front.filter((p) => p.ahead && p.aheadBase === false && p.bright < 0.9).length;
  const hasBase = front.some((p) => p.aheadBase !== undefined);
  return {
    front: front.length, dimmed, share: share(dimmed), before: share(why.before), after: share(why.after), other: share(why.other),
    aheadShare: share(ahead), extraShare: hasBase ? share(extra) : NaN, extraDimShare: hasBase ? share(extraDim) : NaN, others,
  };
}
function reportDimming(d) {
  if (!Number.isFinite(d.share)) return console.log("\n  brightness: no frames in front (this run has no layer data)");
  console.log(`\n  brightness in front: ${d.dimmed} of ${d.front} frames under 0.9 (${fmt(d.share, 1)}%): ${fmt(d.before, 1)}% within ${LEAD_F} frames before a pass behind and over a line, ${fmt(d.after, 1)}% within ${BACK_F} after it was behind, ${fmt(d.other, 1)}% otherwise${d.others.length ? ` (at s ${d.others.join(", ")}...)` : ""}`);
  console.log(`  frames in front with the look ahead dimming: ${fmt(d.aheadShare, 1)}%; of them beyond Task 1's own rule (the lag's doing): ${fmt(d.extraShare, 1)}% of the front frames (${fmt(d.extraDimShare, 1)}% under 0.9 meanwhile)`);
}

function report({ keys, poses, mode = "steady" }, w = W, h = H, dpr = DPR, speed = SPEED) {
  const per = mode === "steady" ? (speed * FRAME_MS) / 1000 : undefined;
  const all = steps(poses, w, h, per);
  const irregular = all.filter((x) => x.irregular).length;
  const st = all.filter((x) => !x.irregular);
  const dim = dimming(poses, keys[keys.length - 1].y);
  if (mode === "pagedown") {
    console.log(`\npendant on a Page Down sequence, ${w}x${h} at DPR ${dpr}, headless, a press every ${PAGE_MS} ms, ${poses.length} frames`);
    console.log(`  peak speed of its middle ${fmt(Math.max(...st.map((x) => x.v)))} vw/f; peak height change ${fmt(Math.max(...st.map((x) => x.dh)))} %/f`);
    reportDimming(dim);
    if (process.env.OUT) {
      fs.mkdirSync(path.dirname(path.resolve(process.env.OUT)), { recursive: true });
      fs.writeFileSync(process.env.OUT, JSON.stringify({ mode, W: w, H: h, DPR: dpr, PAGE_MS, keys, dimming: dim, poses }, null, 1));
      console.log(`  wrote ${process.env.OUT}`);
    }
    return;
  }
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
      peakFace: xs.length ? Math.max(...xs.map((x) => x.face ?? 0)) : NaN,
      meanV: xs.length ? xs.reduce((a, x) => a + x.v, 0) / xs.length : NaN,
    });
  }
  const med = pct(rows.map((r) => r.peakV).filter(Number.isFinite), 50);
  for (const r of rows) r.busy = r.peakV > EVEN * med;
  console.log(`\npendant motion between shots, ${w}x${h} at DPR ${dpr}, headless, ${speed} px/s (${fmt((speed * FRAME_MS) / 1000, 1)} px a 1/60 s frame), ${poses.length} frames`);
  console.log("\n  transition               travel  frames   peak vw/f  (at t)   mean vw/f   peak acc vw/f2   peak dh %/f   peak droll deg/f   face off lock deg");
  for (const r of rows) {
    const name = `${r.from} -> ${r.to}`;
    console.log(`  ${name.padEnd(24)} ${String(r.travel).padStart(6)}  ${String(r.frames).padStart(6)}   ${fmt(r.peakV).padStart(9)}  (${fmt(r.peakVT)})   ${fmt(r.meanV).padStart(9)}   ${fmt(r.peakAcc, 3).padStart(14)}   ${fmt(r.peakDh).padStart(11)}   ${fmt(r.peakRoll).padStart(16)}   ${fmt(r.peakFace, 1).padStart(17)}${r.busy ? `   > ${EVEN}x median` : ""}`);
  }
  const allV = Math.max(...rows.map((r) => r.peakV).filter(Number.isFinite));
  const allH = Math.max(...rows.map((r) => r.peakDh).filter(Number.isFinite));
  console.log(`\n  median transition peak ${fmt(med)} vw/f; busiest ${fmt(allV)} vw/f; height ${fmt(allH)} %/f`);
  console.log(`  bounds: busiest <= ${EVEN}x the median (${fmt(EVEN * med)}): ${allV <= EVEN * med ? "PASS" : "OVER"} (${fmt(allV / med)}x); median <= ${MEDIAN_MAX}: ${med <= MEDIAN_MAX ? "PASS" : "OVER"}; height <= ${MAX_H_PCT}% a frame: ${allH <= MAX_H_PCT ? "PASS" : "OVER"} (${fmt(allH)})`);
  const busy = rows.filter((r) => r.busy).map((r) => `${r.from} -> ${r.to}`);
  console.log(`  more than ${EVEN}x the median: ${busy.length ? busy.join(", ") : "none"}`);
  console.log(`  track: ${Math.round(keys[keys.length - 1].y - top)} px of travel`);
  console.log(`  scroll steps checked: ${all.length - irregular} of ${all.length} at ${fmt(per, 1)} px a frame (or held)${irregular ? `; ${irregular} irregular, left out` : ""}`);
  reportDimming(dim);
  if (process.env.OUT) {
    fs.mkdirSync(path.dirname(path.resolve(process.env.OUT)), { recursive: true });
    fs.writeFileSync(process.env.OUT, JSON.stringify({ mode, W: w, H: h, DPR: dpr, SPEED: speed, top, keys, median: med, rows, dimming: dim, steps: st, poses }, null, 1));
    console.log(`  wrote ${process.env.OUT}`);
  }
}

(async () => {
  if (process.env.FROM) {
    const run = JSON.parse(fs.readFileSync(process.env.FROM, "utf8"));
    report(run, run.W, run.H, run.DPR, run.SPEED ?? SPEED);
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
    report(MODE === "pagedown" ? await pagedown(page) : await measure(page));
  } finally {
    await browser.close();
    stopServer();
  }
})().catch((e) => {
  console.error(e);
  stopServer();
  process.exit(1);
});

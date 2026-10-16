/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS script */
// The About page's pendant, held at each of its shots: one screenshot per key, to check each against the storyboard
// (framing, angle, layer). Needs the dev server running and the mount's `window.__pendant` hook (Task 7: `ready`, and
// `keys`: [{ id, y }] in scroll px).
//   OUT=test-results/pendant BASE=http://localhost:3000 DPR=1 node scripts/about/pendant-frames.cjs
// W, H: the viewport (1440 x 900 by default); ONLY: a comma list of key ids to grab (all by default), e.g. ONLY=glass.
// QUERY: appended to /about, e.g. QUERY=bokehHalf=1 (the governor's half-resolution bokeh held on); TAG: a file-name suffix.
// STEP: a fixed frame step in ms (the mount's `window.__pendantStep`), e.g. STEP=30 to see the motion blur at 30 ms frames.
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright"); // (resolved up from here: a worktree finds the main checkout's node_modules)

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "test-results/pendant";
const DPR = Number(process.env.DPR) || 1; // (2 for a retina capture: the scene then runs without multisampling)
const W = Number(process.env.W) || 1440;
const H = Number(process.env.H) || 900;
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const STEP = Number(process.env.STEP) || 0;
const QUERY = process.env.QUERY ? `?${process.env.QUERY}` : "";
const TAG = process.env.TAG ? `-${process.env.TAG}` : "";

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  if (STEP > 0) await page.addInitScript((ms) => { window.__pendantStep = ms; }, STEP);
  page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 400)));
  try {
    await page.goto(`${BASE}/about${QUERY}`);
    await page.waitForFunction(() => window.__pendant?.ready, null, { timeout: 120000 });
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.mouse.move(W - 10, H - 10); // (the cursor parked in a corner: its lean stays out of the frame)
    const keys = await page.evaluate(() => window.__pendant.keys);
    for (const { id, y } of keys) {
      if (ONLY && !ONLY.includes(id)) continue;
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(2500); // (the scroll's ease and the pendant's motion settle)
      const file = path.join(OUT, `pendant-${id}${process.env.W || process.env.H ? `-${W}x${H}` : ""}${DPR !== 1 ? `-dpr${DPR}` : ""}${STEP ? `-step${STEP}` : ""}${TAG}.jpg`);
      await page.screenshot({ path: file, type: "jpeg", quality: 90 });
      const blur = await page.evaluate(() => window.__pendant.blur);
      console.log(file, blur ? `blur: ${blur.on ? "on" : "off"}, smear ${blur.smear.toFixed(1)} css px` : "");
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

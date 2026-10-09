// The live 3D desk (no sand) vs the Cycles plate at descend frames: node scripts/lab/descend-plate-compare.mjs [40,55,66]
// The plate is rendered 1.5x wider (overscan): its centre 1/1.5 is the live frame. The screen's reveal is held at the
// plate's time (frame 50 = wake, 24 fps). Writes test-results/sand/dp-<f>-live.png and dp-<f>-plate.png (1600x1000).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
const frames = (process.argv[2] ?? "40,55,66").split(",").map(Number);
const extra = process.argv[3] ?? "";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 300)));
for (const f of frames) {
  const reveal = Math.max((f - 50) / 24, -1);
  await page.goto(`http://localhost:3100/lab/sand?hero&still&wordmark=0&tier=low&dsframe=${f}&reveal=${reveal}${extra}`);
  await page.waitForFunction(() => window.__sand?.state && window.__desk3d, null, { timeout: 120000 });
  await page.addStyleTag({ content: "nextjs-portal,nav,[data-testid=hero-overlay]{display:none!important}" });
  await page.evaluate(() => window.__sand.stage.scene.traverse((o) => { if (o.layers.mask === 2) o.visible = false; }));
  await page.mouse.move(1599, 999);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `test-results/sand/dp-${f}-live.png` });
  const src = `blender/lookdev/renders/descend-plate/f_${String(f).padStart(4, "0")}.png`;
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-vf", "crop=iw/1.5:ih/1.5,scale=1600:1000", `test-results/sand/dp-${f}-plate.png`]);
}
await browser.close();
console.log("ok");

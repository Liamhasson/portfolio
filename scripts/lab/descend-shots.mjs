// The descend (2.2 -> 2.3) at held frames, the live lab next to the approved Blender review clip's frame.
//   node scripts/lab/descend-shots.mjs [frames=1,40,60,66] [extra query]
// Writes test-results/sand/ds-<frame>.png (live; the screen's reveal held finished) and ds-<frame>-ref.png (Blender).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
const frames = (process.argv[2] ?? "1,40,60,66").split(",").map(Number);
const extra = process.argv[3] ?? "";
mkdirSync("test-results/sand", { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 300)));
for (const f of frames) {
  await page.goto(`http://localhost:3100/lab/sand?hero&still&wordmark=0&tier=low&dsframe=${f}&reveal=5${extra}`);
  await page.waitForFunction(() => window.__sand?.state, null, { timeout: 120000 });
  await page.addStyleTag({ content: "nextjs-portal,nav,[data-testid=hero-overlay]{display:none!important}" });
  await page.mouse.move(1599, 999);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `test-results/sand/ds-${f}.png` });
  const ref = `blender/lookdev/renders/deskmove-descend/f_${String(f).padStart(4, "0")}.png`;
  execFileSync("sips", ["-z", "1000", "1600", ref, "--out", `test-results/sand/ds-${f}-ref.png`], { stdio: "ignore" });
}
await browser.close();
console.log("ok");

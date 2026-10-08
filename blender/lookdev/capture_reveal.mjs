// Captures the project index's first reveal (screen wakes from black, rows surface in turn) as a frame sequence,
// used as the laptop screen's texture when the camera arrives at 2.3. Deterministic: every CSS animation is paused
// and stepped to each frame's time, so the frames match the prototype exactly.
//   node blender/lookdev/capture_reveal.mjs [fps=24] [seconds=2.1]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fps = Number(process.argv[2] ?? 24), seconds = Number(process.argv[3] ?? 2.1);
const out = join(here, "textures-local", "reveal");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve(here, "../../docs/prototypes/work-index.html")).href + "#still");
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: ".replay{display:none!important}" });
await page.evaluate(() => {
  const s = document.getElementById("screen");
  s.classList.add("play");
  document.getAnimations().forEach((a) => a.pause());
});
const n = Math.round(fps * seconds);
for (let i = 0; i <= n; i++) {
  const t = (i / fps) * 1000;
  await page.evaluate((t) => document.getAnimations().forEach((a) => (a.currentTime = t)), t);
  await page.screenshot({ path: join(out, `r_${String(i + 1).padStart(4, "0")}.png`), clip: { x: 0, y: 0, width: 1600, height: 1000 } });
}
await browser.close();
console.log("wrote", n + 1, "frames to", out);

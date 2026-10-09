// 2.3: the live glass vs the Cycles references (lookdev.py, renders/run-glass-refs.sh), hovering and landed, at the
// arrival view. node scripts/lab/glass-compare.mjs [extra query] -> test-results/sand/gl-{hover,land}-{live,ref}.png
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
const extra = process.argv[2] ?? "";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 600)));
for (const [tag, ship, z] of [["hover", 0, "0.15"], ["land", 1, "0.0705"]]) {
  await page.goto(`http://localhost:3100/lab/sand?hero&still&wordmark=0&tier=low&dsframe=66&reveal=5&build=1&ship=${ship}${extra}`);
  await page.waitForFunction(() => window.__sand?.state && window.__desk3d, null, { timeout: 120000 });
  await page.addStyleTag({ content: "nextjs-portal,nav,[data-testid=hero-overlay]{display:none!important}" });
  await page.mouse.move(1599, 999);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `test-results/sand/gl-${tag}-live.png` });
  execFileSync("cp", [`blender/lookdev/renders/glass-ref-${z}/f_0100.png`, `test-results/sand/gl-${tag}-ref.png`]);
}
await browser.close();
console.log("ok");

// 2.3: the live frost held at a uniform clearness vs Blender's frost glass at the same clearness (lookdev.py FROST_CLEAR),
// hovering at the arrival view, no sand. node scripts/lab/frost-compare.mjs [0.1,0.5,0.9] ['<look json>']
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
const clears = (process.argv[2] ?? "0.1,0.5,0.9").split(",");
const look = JSON.parse(process.argv[3] ?? "{}");
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 500)));
for (const c of clears) {
  await page.goto(`http://localhost:3100/lab/sand?hero&still&wordmark=0&tier=low&dsframe=66&reveal=5&build=0.01`);
  await page.waitForFunction(() => window.__sand?.state && window.__frost, null, { timeout: 120000 });
  await page.addStyleTag({ content: "nextjs-portal,nav,[data-testid=hero-overlay]{display:none!important}" });
  await page.evaluate(([c, look]) => {
    window.__sand.stage.scene.traverse((o) => { if (o.layers.mask === 2) o.visible = false; });   // the sand layer off
    window.__frost({ ...look, clearHold: Number(c) });
  }, [c, look]);
  await page.mouse.move(1599, 999);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `test-results/sand/fr-${c}-live.png` });
  execFileSync("cp", [`blender/lookdev/renders/frost-ref-${c}/f_0100.png`, `test-results/sand/fr-${c}-ref.png`]);
}
await browser.close();
console.log("ok");

// Captures the live sand at the exact Blender camera (1600x1000, dpr 1) for each compare target, next to the render.
//   node scripts/lab/capture-sand.mjs [base=http://localhost:3100] [targets=ball,chaos,mid] [outDir=test-results/sand]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3100";
const targets = (process.argv[3] ?? "ball,chaos,mid").split(",");
const out = process.argv[4] ?? "test-results/sand";
// optional look overrides, JSON: '{"key":1.4,"exposure":1.2}'; several separated by ';' are captured as variants
const looks = (process.argv[5] ?? "{}").split(";").map((s) => JSON.parse(s));
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text().slice(0, 300)));
for (const t of targets) {
  await page.goto(`${base}/lab/sand?compare=${t}&tier=high`);
  await page.waitForFunction(() => window.__sandReady === true, null, { timeout: 120000 });
  await page.addStyleTag({ content: "[data-testid=sand-target],[data-testid=sand-split],nextjs-portal,nav,header,input,.font-mono{display:none!important}" });
  for (const [i, look] of looks.entries()) {
    await page.evaluate((l) => window.__sandLook(l), look);
    await page.waitForTimeout(200);
    const name = looks.length > 1 ? `live-${t}-${i}.png` : `live-${t}.png`;
    await page.locator("[data-testid=sand-canvas]").screenshot({ path: `${out}/${name}` });
    console.log("captured", name, JSON.stringify(look));
  }
}
await browser.close();

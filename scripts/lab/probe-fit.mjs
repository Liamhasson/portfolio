// Probe orientation and strength for the glossy desk objects, scored against the plate's lid at settle frame 48.
import { chromium } from "playwright";
const sets = JSON.parse(process.argv[2]);   // [[rotY, intensity, flip], ...]
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto("http://localhost:3100/lab/sand?hero&still&wordmark=0&tier=low&stframe=48&desk3d");
await page.waitForFunction(() => window.__sand?.state && window.__desk3d, null, { timeout: 120000 });
await page.addStyleTag({ content: "nextjs-portal,nav,[data-testid=hero-overlay]{display:none!important}" });
await page.mouse.move(1599, 999);
await page.waitForTimeout(4000);
for (const [i, [rot, k]] of sets.entries()) {
  await page.evaluate(([rot, k]) => { for (const m of window.__desk3d.materials) { m.envMapRotation.set(0, rot, 0); m.envMapIntensity = k; m.needsUpdate = true; } }, [rot, k]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/sand/probe-${i}.png` });
}
await browser.close();

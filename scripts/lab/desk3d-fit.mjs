// The baked desk's live terms (light gains, probe strength) at a held settle frame, one capture per set.
//   node scripts/lab/desk3d-fit.mjs '[{"lamp":1,"rim":1,"bounce":1,"env":1}, ...]' [stframe=48]
import { chromium } from "playwright";
const sets = JSON.parse(process.argv[2]); const frame = process.argv[3] ?? "48";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 300)));
await page.goto(`http://localhost:3100/lab/sand?hero&still&wordmark=0&tier=low&stframe=${frame}&desk3d`);
await page.waitForFunction(() => window.__sand?.state && window.__desk3d, null, { timeout: 120000 });
await page.addStyleTag({ content: "nextjs-portal,nav,[data-testid=hero-overlay]{display:none!important}" });
await page.mouse.move(1599, 999);
await page.waitForTimeout(4000);
for (const [i, s] of sets.entries()) {
  await page.evaluate((s) => {
    const d = window.__desk3d;
    for (const n of ["lamp", "rim", "bounce"]) d.setLightGain(s[n] ?? 1, n);
    d.envIntensity = s.env ?? 1;
  }, s);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/sand/fit-${i}.png` });
}
await browser.close();
console.log("ok");

// Pull-back calibration: the live view held on path frames (still, no copy) at 1600x1000, for each desk-gain set.
//   node scripts/lab/pb-calib.mjs '30,60' 'lamp,rim,bounce;...'
import { chromium } from "playwright";
import fs from "node:fs";
const frames = process.argv[2].split(",");
const sets = (process.argv[3] === "@" ? fs.readFileSync(process.argv[4], "utf8").trim() : process.argv[3]).split("\n").join(";").split(";").filter(Boolean).map((s) => { const [g, look] = s.split("|"); return { g: g.split(",").map(Number), look: look ? JSON.parse(look) : {} }; });
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 200)));
for (const f of frames) {
  await page.goto(`http://localhost:3100/lab/sand?hero&still&wordmark=0&tier=high&pbframe=${f}`);
  await page.waitForFunction(() => window.__sand?.state && window.__pbGains, null, { timeout: 120000 });
  await page.addStyleTag({ content: "nextjs-portal,nav,[data-testid=hero-overlay]{display:none!important}" });
  await page.mouse.move(1599, 999);
  await page.waitForTimeout(3000);
  for (const [i, g] of sets.entries()) {
    await page.evaluate(({ g, look }) => { const { sat = 0.6, desk, filter, ...rest } = look; if (filter !== undefined && window.__sandFilter) window.__sandFilter(filter); window.__sand.field.setLook({ cursor: 0, ...rest }); window.__pbSat(sat); window.__pbGains(...g, desk ?? {}); }, g);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/sand/pb-${f}-${i}.png`, clip: { x: 0, y: 0, width: 1600, height: 1000 } });
  }
}
await browser.close();
console.log("ok");

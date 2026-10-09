// 2.1 calibration: the live view held on a settle frame with the ball formed (still, no copy), per look set.
//   node scripts/lab/st-calib.mjs <frame> '<look json>;...'   (or @ file)
import { chromium } from "playwright";
import fs from "node:fs";
const frame = process.argv[2];
const sets = (process.argv[3] === "@" ? fs.readFileSync(process.argv[4], "utf8").trim() : process.argv[3]).split("\n").join(";").split(";").filter(Boolean).map((s) => JSON.parse(s));
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 200)));
await page.goto(`http://localhost:3100/lab/sand?hero&still&wordmark=0&tier=high&stframe=${frame}`);
await page.waitForFunction(() => window.__sand?.state && window.__pbGains, null, { timeout: 120000 });
await page.addStyleTag({ content: "nextjs-portal,nav,[data-testid=hero-overlay]{display:none!important}" });
await page.mouse.move(1599, 999);
// scroll to the end so the ball has formed (the camera is held on the frame)
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(3500);
for (const [i, look] of sets.entries()) {
  await page.evaluate((l) => { const { filter, gains, desk, sat, ground, groundG, shadow, ...rest } = l; if (shadow) window.__pbShadow?.(...shadow); if (ground !== undefined) window.__pbGround?.(ground, groundG ?? 0.62); if (filter !== undefined) window.__sandFilter?.(filter); if (sat !== undefined) window.__pbSat?.(sat); if (gains) window.__pbGains(...gains, desk ?? {}); window.__sand.field.setLook({ cursor: 0, ...rest }); }, look);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/sand/st-${frame}-${i}.png`, clip: { x: 0, y: 0, width: 1600, height: 1000 } });
}
await browser.close();
console.log("ok");

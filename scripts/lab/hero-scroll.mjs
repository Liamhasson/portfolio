// The hero across the scroll: frames at several scroll positions, desktop and phone.
import { chromium, devices } from "playwright";
const stops = (process.argv[2] ?? "0,0.47,0.58,0.66,1").split(",").map(Number);
const only = process.argv[3];   // desktop | phone
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
for (const [dev, opts] of [["desktop", { viewport: { width: 1440, height: 900 } }], ["phone", { ...devices["iPhone 13"] }]].filter(([d]) => !only || d === only)) {
  const ctx = await browser.newContext(opts); const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && console.error(dev, m.text().slice(0, 200)));
  await page.goto("http://localhost:3100/lab/sand?hero&tier=mid");
  await page.waitForFunction(() => window.__sand?.state, null, { timeout: 120000 });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  if (dev === "desktop") await page.mouse.move(1430, 450);
  await page.waitForTimeout(2500);
  for (const [i, f] of stops.entries()) {
    await page.evaluate((f) => window.scrollTo(0, f * (document.documentElement.scrollHeight - innerHeight)), f);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `test-results/hero/scroll-${dev}-${i}.png` });
  }
  await ctx.close();
}
await browser.close();
console.log("ok");

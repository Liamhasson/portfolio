// The baked 3D desk vs the rendered plate, at a held frame of a move. node scripts/lab/desk3d-compare.mjs stframe 48
import { chromium } from "playwright";
const [param, frame] = [process.argv[2] ?? "stframe", process.argv[3] ?? "48"];
const extra = process.argv[4] ?? "";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.error(m.text().slice(0, 300)));
for (const v of ["plate", "desk3d"]) {
  await page.goto(`http://localhost:3100/lab/sand?hero&still&wordmark=0&tier=low&${param}=${frame}${v === "desk3d" ? "" : "&plates"}${extra}`);
  await page.waitForFunction(() => window.__sand?.state, null, { timeout: 120000 });
  await page.addStyleTag({ content: "nextjs-portal,nav,[data-testid=hero-overlay]{display:none!important}" });
  await page.mouse.move(1599, 999);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `test-results/sand/d3-${param}-${frame}-${v}.png` });
}
await browser.close();
console.log("ok");

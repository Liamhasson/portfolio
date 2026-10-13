// Records Nordic Logic's home page for its index card: the live hero, its 3D film playing into the client portal's
// overview, as a visitor sees it on arrival. The real site, nothing staged; PostHog blocked so no visit reaches it.
// Chrome on the GPU (the film is three.js), CDP screencast at 2x (Playwright's recordVideo is 1x and soft).
// Usage: node scripts/capture/nordic-logic-clip.mjs  -> test-results/work/nordic-logic-raw.mp4
// Then: the 0.6 s crossfade loop and the poster (see the commit that added this file for the ffmpeg lines).
import { chromium } from "playwright";
import fs from "node:fs";

const dir = "test-results/work/frames-nordic-logic";
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist", "--force-device-scale-factor=2"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.route(/\/ingest\//, (r) => r.abort());
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const stamps = [];
cdp.on("Page.screencastFrame", async (f) => {
  stamps.push(f.metadata.timestamp);
  fs.writeFileSync(`${dir}/f${String(stamps.length).padStart(5, "0")}.jpg`, Buffer.from(f.data, "base64"));
  await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
});
await page.goto("about:blank");
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 2880, maxHeight: 1800, everyNthFrame: 1 });
await page.goto("https://nordic-logic.vercel.app/", { waitUntil: "networkidle" });
const body = await page.locator("body").innerText();
if (!body.includes("Your carriers owe you.")) throw new Error("Nordic Logic's hero did not load; not saving.");
await page.waitForTimeout(17000); // the film plays once (~13 s) and lands on the portal; hold on it
await cdp.send("Page.stopScreencast");
await browser.close();
// the screencast only sends a frame when something changes: give each its real duration
const first = stamps.findIndex((_, i) => fs.statSync(`${dir}/f${String(i + 1).padStart(5, "0")}.jpg`).size > 40000); // skip about:blank
const list = stamps.slice(first).map((t, i, a) => `file 'f${String(first + i + 1).padStart(5, "0")}.jpg'\nduration ${((a[i + 1] ?? t + 1 / 30) - t).toFixed(4)}`);
fs.writeFileSync(`${dir}/list.txt`, list.join("\n") + "\n");
console.log("frames", stamps.length - first, "seconds", (stamps.at(-1) - stamps[first]).toFixed(1), `-> ${dir}/list.txt`);

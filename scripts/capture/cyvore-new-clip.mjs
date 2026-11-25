// Records the Cyvore new website's hero for its index card, from the portfolio's own snapshot (never the Cyvore
// deployment: what the card shows is what the teaser frames), untouched, as a visitor sees it on arrival; and the
// 1200x630 still of the same screen, with its text: the teaser's link preview and its reduced-motion stand-in.
// Chrome on the GPU, CDP screencast at 2x (as nordic-logic-clip.mjs). Needs the site on :3101
// (npm run build && npx next start -p 3101).
// Usage: node scripts/capture/cyvore-new-clip.mjs  -> test-results/work/frames-cyvore-new/list.txt + the still
// Then: the loop and poster (see the commit that added this file for the ffmpeg lines).
import { chromium } from "playwright";
import fs from "node:fs";

const SITE = "http://localhost:3101/cyvore-new/site/index.html";
const dir = "test-results/work/frames-cyvore-new";
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist", "--force-device-scale-factor=2", "--autoplay-policy=no-user-gesture-required"] });

// the still: the first screen at the preview's own size
const still = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await still.goto(SITE, { waitUntil: "networkidle" });
if (!(await still.locator("#hero h1").innerText()).includes("workspace security")) throw new Error("the hero did not load; not saving");
await still.waitForTimeout(2500);
fs.mkdirSync("public/case-studies/cyvore-new", { recursive: true });
await still.screenshot({ path: "public/case-studies/cyvore-new/peek.jpg", type: "jpeg", quality: 85 });
await still.close();
// and in the site's phone layout (the reduced-motion stand-in on phones)
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await phone.goto(SITE, { waitUntil: "networkidle" });
await phone.waitForTimeout(2500);
await phone.screenshot({ path: "public/case-studies/cyvore-new/peek-phone.jpg", type: "jpeg", quality: 82 });
await phone.close();

// the loop: 16:10 like every card
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const stamps = [];
cdp.on("Page.screencastFrame", async (f) => {
  stamps.push(f.metadata.timestamp);
  fs.writeFileSync(`${dir}/f${String(stamps.length).padStart(5, "0")}.jpg`, Buffer.from(f.data, "base64"));
  await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
});
await page.goto(SITE, { waitUntil: "networkidle" });
if (!(await page.locator("#hero h1").innerText()).includes("workspace security")) throw new Error("the hero did not load; not saving");
await page.waitForTimeout(2000);   // (the film and the layers settled in)
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 2880, maxHeight: 1800, everyNthFrame: 1 });
await page.waitForTimeout(12000);
await cdp.send("Page.stopScreencast");
await browser.close();
// the screencast only sends a frame when something changes: give each its real duration
const list = stamps.map((t, i, a) => `file 'f${String(i + 1).padStart(5, "0")}.jpg'\nduration ${((a[i + 1] ?? t + 1 / 30) - t).toFixed(4)}`);
fs.writeFileSync(`${dir}/list.txt`, list.join("\n") + "\n");
console.log("frames", stamps.length, "seconds", (stamps.at(-1) - stamps[0]).toFixed(1), `-> ${dir}/list.txt`);

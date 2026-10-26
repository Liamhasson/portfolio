// Records the live Nordic Logic site for its case study: the hero's full film in a window tall enough for the portal it
// lands on, "Where the money hides" and "What this costs" used by a cursor, and three phone screens.
// The real site, nothing staged; PostHog blocked so no visit reaches it. Chrome on the GPU (the hero film is three.js),
// CDP screencast at 2x (Playwright's recordVideo is 1x and soft). The cursor is the site's own, from the portal demo:
// Liam's purple arrow, eased the same way (850 ms, cubic-bezier(.45,0,.2,1)).
// Usage: node scripts/capture/nordic-logic-site.mjs hero|money|pricing|phones
//   clips  -> test-results/work/frames-nl-<clip>/list.txt (ffmpeg concat list, each frame at its real duration)
//   phones -> test-results/work/nl-phone-{hero,breakdown,pricing}.png
// test-results/ is Playwright's output folder and the e2e suite empties it: copy finished clips out first. The cuts and
// encodes that made public/case-studies/nordic-logic/{hero-film,money-hides,what-it-costs}.mp4 are in the commit message.
import { chromium } from "playwright";
import fs from "node:fs";

const SITE = "https://nordic-logic.vercel.app/";
const clip = process.argv[2];
if (!["hero", "money", "pricing", "phones"].includes(clip)) throw new Error("clip: hero | money | pricing | phones");

const gpu = ["--use-angle=metal", "--ignore-gpu-blocklist"];
// the screencast ignores deviceScaleFactor; the 2x has to be forced on the browser
const browser = await chromium.launch({ channel: "chrome", headless: true, args: clip === "phones" ? gpu : [...gpu, "--force-device-scale-factor=2"] });

if (clip === "phones") {
  // An iPhone 15's CSS size at 3x. The portal is desktop-only on the site, so the phone hero is title, line and buttons.
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.route(/\/ingest\//, (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "test-results/work/nl-phone-hero.png" });
  for (const [id, name] of [["breakdown", "breakdown"], ["pricing", "pricing"]]) {
    await page.evaluate((id) => {
      const el = document.getElementById(id);
      const sec = el.closest("section") ?? el;
      window.scrollTo(0, sec.getBoundingClientRect().top + window.scrollY - 24);
    }, id);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `test-results/work/nl-phone-${name}.png` });
  }
  await browser.close();
  process.exit(0);
}

const dir = `test-results/work/frames-nl-${clip}`;
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
// The hero needs the whole landed portal in frame (its bottom sits ~1250 px down at 1440 wide). The two sections are
// cropped later to 16:10 under the nav (88 px when it turns Onyx over "Where the money hides"), the same 16:10 as the
// case study's denial film: crop=2824:1765:28:180 at 2x.
const NAV = 73;
const viewport = clip === "hero" ? { width: 1440, height: 1300 } : { width: 1440, height: NAV + 900 };
const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
await ctx.route(/\/ingest\//, (r) => r.abort());
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const stamps = [];
let recording = false;
cdp.on("Page.screencastFrame", async (f) => {
  if (recording) {
    stamps.push(f.metadata.timestamp);
    fs.writeFileSync(`${dir}/f${String(stamps.length).padStart(5, "0")}.jpg`, Buffer.from(f.data, "base64"));
  }
  await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
});
const start = async () => {
  recording = true;
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: viewport.width * 2, maxHeight: viewport.height * 2, everyNthFrame: 1 });
};

/** The site's cursor, drawn over the page; the real mouse follows it so hovers and clicks are the page's own. */
const MOVE = 850;
async function addCursor(x, y) {
  await page.evaluate(({ x, y, MOVE }) => {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    c.id = "nl-cursor";
    c.setAttribute("width", "40"); c.setAttribute("height", "40"); c.setAttribute("viewBox", "0 0 40 40");
    c.innerHTML = '<path d="M4 4 L36 17 L21 21 L16 36 Z" fill="#a24fe0" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>';
    Object.assign(c.style, {
      position: "fixed", left: "-4px", top: "-4px", zIndex: 2147483647, pointerEvents: "none", opacity: "0",
      filter: "drop-shadow(0 3px 6px rgba(12,17,22,.25))", transform: `translate(${x}px, ${y}px)`,
      transition: `transform ${MOVE}ms cubic-bezier(0.45, 0, 0.2, 1), opacity 300ms`,
    });
    document.body.appendChild(c);
  }, { x, y, MOVE });
  await page.mouse.move(x, y);
}
const cursorShow = (on) => page.evaluate((on) => { document.getElementById("nl-cursor").style.opacity = on ? "1" : "0"; }, on);
// cubic-bezier(.45,0,.2,1) sampled for the real mouse, so the page's hover follows the drawn tip
function ease(t) {
  let lo = 0, hi = 1, u = t;
  for (let i = 0; i < 20; i++) { u = (lo + hi) / 2; const x = 3 * 0.45 * u * (1 - u) ** 2 + 3 * 0.2 * u * u * (1 - u) + u ** 3; if (x < t) lo = u; else hi = u; }
  return 3 * 0 * u * (1 - u) ** 2 + 3 * 1 * u * u * (1 - u) + u ** 3;
}
let at = { x: 0, y: 0 };
async function moveTo(x, y, ms = MOVE) {
  await page.evaluate(({ x, y, ms }) => {
    const c = document.getElementById("nl-cursor");
    c.style.transitionDuration = `${ms}ms, 300ms`;
    c.style.transform = `translate(${x}px, ${y}px)`;
  }, { x, y, ms });
  const from = { ...at };
  const t0 = Date.now();
  for (;;) {
    const t = Math.min(1, (Date.now() - t0) / ms);
    const k = ease(t);
    await page.mouse.move(from.x + (x - from.x) * k, from.y + (y - from.y) * k);
    if (t >= 1) break;
    await page.waitForTimeout(16);
  }
  at = { x, y };
}
const centre = (sel) => page.locator(sel).first().evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });

await page.goto("about:blank");
if (clip === "hero") {
  await start();
  await page.goto(SITE, { waitUntil: "networkidle" });
  if (!(await page.locator("body").innerText()).includes("Your carriers owe you.")) throw new Error("hero did not load");
  await page.waitForTimeout(30000); // the film (~13 s) lands on the portal, its cursor walks (~11 s) and leaves; hold on it
} else {
  await page.goto(SITE, { waitUntil: "networkidle" });
  const id = clip === "money" ? "money" : "pricing";
  // Centres the section's heading-to-last-row block in the 900 px under the nav (measured 2026-10-26: money 3216-3867,
  // pricing 4823-5580, section tops 3106 and 4713). Only scrolled; nothing on the page is changed.
  await page.evaluate(({ id, back }) => {
    const el = document.getElementById(id);
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - back);
  }, { id, back: id === "money" ? 88 : 19 });
  await page.waitForTimeout(3000); // reveals done, row one open / calculator at its default
  // The calculator's drag starts and ends on the x that gives its default back (pressing the track sets the value under
  // the pointer), so the loop closes on the same $500,000 it opens on. Found before recording starts.
  let slider;
  if (clip === "pricing") {
    const range = page.locator('#pricing input[type="range"]').first();
    const box = await range.boundingBox();
    const value = await range.evaluate((el) => ({ v: +el.value, min: +el.min, max: +el.max }));
    const xAt = (v) => box.x + 10 + ((v - value.min) / (value.max - value.min)) * (box.width - 20);
    const y = box.y + box.height / 2;
    const read = () => range.evaluate((el) => +el.value);
    let grab = null;
    for (let dx = 0; dx <= 24 && grab === null; dx++) {
      for (const x of dx ? [xAt(value.v) + dx, xAt(value.v) - dx] : [xAt(value.v)]) {
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up();
        if ((await read()) === value.v) { grab = x; break; }
      }
    }
    if (grab === null) throw new Error("no x on the slider gives its default back");
    slider = { grab, y: y + 6, up: xAt(value.v + (value.max - value.v) * 0.55), down: xAt(value.min + (value.v - value.min) * 0.35) };
  }
  await addCursor(1370, 930);
  at = { x: 1370, y: 930 };
  await page.waitForTimeout(2500);
  await start();
  await page.waitForTimeout(600);
  await cursorShow(true);
  if (clip === "money") {
    for (const key of ["fuel", "duplicate", "address", "residential", "dim"]) {
      const p = await centre(`[aria-controls="money-${key}"]`);
      await moveTo(p.x - 40, p.y + 4);
      await page.waitForTimeout(150);
      await page.mouse.down(); await page.mouse.up();
      await page.waitForTimeout(2300);
    }
  } else {
    await moveTo(slider.grab, slider.y);
    await page.waitForTimeout(250);
    await page.mouse.down();
    await moveTo(slider.up, slider.y, 1800);
    await page.waitForTimeout(900);
    await moveTo(slider.down, slider.y, 2200);
    await page.waitForTimeout(900);
    await moveTo(slider.grab, slider.y, 1400);
    await page.mouse.up();
    await page.waitForTimeout(1600);
  }
  await moveTo(1370, 930);
  await cursorShow(false);
  await page.waitForTimeout(1200);
}
await cdp.send("Page.stopScreencast");
await browser.close();
// the screencast only sends a frame when something changes: give each its real duration
const first = clip === "hero" ? stamps.findIndex((_, i) => fs.statSync(`${dir}/f${String(i + 1).padStart(5, "0")}.jpg`).size > 40000) : 0; // skip about:blank
const list = stamps.slice(first).map((t, i, a) => `file 'f${String(first + i + 1).padStart(5, "0")}.jpg'\nduration ${((a[i + 1] ?? t + 1 / 30) - t).toFixed(4)}`);
fs.writeFileSync(`${dir}/list.txt`, list.join("\n") + "\n");
console.log(clip, "frames", stamps.length - first, "seconds", (stamps.at(-1) - stamps[first]).toFixed(1), `-> ${dir}/list.txt`);

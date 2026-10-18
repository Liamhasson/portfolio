import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// The laptop goes to the work (desk-laptop.ts; Liam, 2026-10-18): on the desk, a hand over the laptop, and a click runs
// what the nav's Projects runs, ending at the index exactly where the nav does.
// Headless, on the GPU (the story's scene needs WebGL). LAPTOP_CLIP=dir: the hover and mid-glide frames saved there.
test.use({ viewport: { width: 1440, height: 900 }, launchOptions: { args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] } });
test.setTimeout(240_000);

interface Laptop { live: () => boolean; at: (x: number, y: number) => boolean; over: () => boolean }
const CLIP = process.env.LAPTOP_CLIP;

/** The story loaded, the desk in, then onto the desk in full view (BEATS.deskView's middle), settled. */
async function onDesk(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => {
    const w = window as unknown as { __desk3d?: unknown; __laptop?: Laptop };
    return !document.documentElement.dataset.loader && !!w.__desk3d && !!w.__laptop;
  }, null, { timeout: 180_000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const end = document.getElementById("projects")!.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, (2.8 / 5.1) * end);   // (STORY_SCREENS + SCREEN_HOLD screens to the index's anchor)
  });
  await page.waitForFunction(() => (window as unknown as { __laptop: Laptop }).__laptop.live(), null, { timeout: 10_000 });
  await page.waitForTimeout(1200);   // (the damped progress settles over the desk)
}

/** A point well inside the laptop on screen: of the grid's hits, the one nearest their middle. */
async function laptopPoint(page: Page): Promise<{ x: number; y: number }> {
  const p = await page.evaluate(() => {
    const l = (window as unknown as { __laptop: Laptop }).__laptop;
    const hits: [number, number][] = [];
    for (let y = 20; y < innerHeight; y += 20) for (let x = 20; x < innerWidth; x += 20) if (l.at(x, y)) hits.push([x, y]);
    if (!hits.length) return null;
    const cx = hits.reduce((s, h) => s + h[0], 0) / hits.length, cy = hits.reduce((s, h) => s + h[1], 0) / hits.length;
    const best = hits.reduce((b, h) => (Math.hypot(h[0] - cx, h[1] - cy) < Math.hypot(b[0] - cx, b[1] - cy) ? h : b));
    return { x: best[0], y: best[1], n: hits.length };
  });
  expect(p, "the laptop shows on the desk").not.toBeNull();
  expect(p!.n).toBeGreaterThan(20);
  return p!;
}

/** Records scrollY every frame from now (for `ms`), with the time since the start. */
async function track(page: Page, ms: number) {
  await page.evaluate((ms) => {
    const w = window as unknown as { __track: [number, number][] };
    w.__track = [];
    const t0 = performance.now();
    const rec = () => { const t = performance.now() - t0; w.__track.push([t, window.scrollY]); if (t < ms) requestAnimationFrame(rec); };
    requestAnimationFrame(rec);
  }, ms);
}
const tracked = async (page: Page, ms: number) => {
  await page.waitForFunction((ms) => { const t = (window as unknown as { __track: [number, number][] }).__track; return t.length > 0 && t.at(-1)![0] >= ms; }, ms, { timeout: ms + 10_000 });
  return page.evaluate(() => (window as unknown as { __track: [number, number][] }).__track);
};
const anchor = (page: Page) => page.evaluate(() => Math.round(document.getElementById("projects")!.getBoundingClientRect().top + window.scrollY));
/** When the page arrived within 2 px of where it ends, and where that is. */
const arrival = (t: [number, number][]) => {
  const end = t.at(-1)![1];
  return { end, at: t.find(([, y]) => Math.abs(y - end) <= 2)![0] };
};

test("on the desk, a click on the laptop ends at the index, as the nav's Projects does", async ({ page }) => {
  if (CLIP) mkdirSync(CLIP, { recursive: true });
  await onDesk(page);

  // a hand over the laptop, none over bare wood
  await page.mouse.move(60, 860);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => document.documentElement.style.cursor)).toBe("");
  const pt = await laptopPoint(page);
  await page.mouse.move(pt.x, pt.y);
  await page.waitForFunction(() => document.documentElement.style.cursor === "pointer", null, { timeout: 3000 });
  expect(await page.evaluate(() => (window as unknown as { __laptop: Laptop }).__laptop.over())).toBe(true);
  if (CLIP) {
    // (a headless screenshot draws no cursor: the hand is drawn in for the frame, where the pointer is, then taken out)
    await page.evaluate(({ x, y }) => {
      const d = document.createElement("div");
      d.id = "__hand";
      d.style.cssText = `position:fixed;left:${x - 6}px;top:${y - 1}px;width:22px;height:24px;z-index:99;pointer-events:none`;
      d.innerHTML = `<svg viewBox="0 0 22 24" width="22" height="24"><path d="M7 1.5c1 0 1.8.8 1.8 1.8V11l.6-.1V8.6c0-1 .8-1.7 1.7-1.7s1.7.8 1.7 1.7v2.6h.5V9.8c0-1 .8-1.7 1.7-1.7s1.7.8 1.7 1.7v1.9h.4c0-.9.8-1.6 1.6-1.6.9 0 1.6.7 1.6 1.6v5.8c0 3.6-2.8 6.5-6.4 6.5h-2.4c-2.1 0-3.7-.9-5-2.6L1.6 15.6c-.6-.8-.4-1.9.4-2.4.7-.5 1.7-.3 2.3.3l.9 1V3.3C5.2 2.3 6 1.5 7 1.5z" fill="#fff" stroke="#000" stroke-width="1.1"/></svg>`;
      document.body.appendChild(d);
    }, pt);
    await page.screenshot({ path: `${CLIP}/laptop-hover.png` });
    await page.evaluate(() => document.getElementById("__hand")?.remove());
  }

  // the laptop
  const from = await page.evaluate(() => window.scrollY);
  await track(page, 4000);
  await page.mouse.click(pt.x, pt.y);
  if (CLIP) {
    // the glide's first half, on the way in (it lasts about a second from the desk)
    const t0 = Date.now();
    for (const [i, ms] of [150, 350, 550].entries()) {
      await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
      await page.screenshot({ path: `${CLIP}/laptop-mid-glide-${i + 1}.png` });
    }
  }
  const viaLaptop = await tracked(page, 4000);
  const laptopEnd = arrival(viaLaptop);
  const hashLaptop = await page.evaluate(() => location.hash);
  expect(laptopEnd.end).toBeGreaterThan(from);
  expect(Math.abs(laptopEnd.end - (await anchor(page)))).toBeLessThanOrEqual(2);   // at the index's anchor
  // carried there (not a jump): the page moves through the frames between
  expect(viaLaptop.filter(([, y]) => y > from + 2 && y < laptopEnd.end - 2).length).toBeGreaterThan(10);
  // no hand left behind on the index
  expect(await page.evaluate(() => document.documentElement.style.cursor)).toBe("");

  // the nav's Projects, from the same spot
  await page.mouse.move(60, 860);
  await onDesk(page);
  await track(page, 4000);
  await page.locator('nav a[href$="#projects"]').first().click();
  const viaNav = await tracked(page, 4000);
  const navEnd = arrival(viaNav);
  const hashNav = await page.evaluate(() => location.hash);

  expect(Math.abs(laptopEnd.end - navEnd.end)).toBeLessThanOrEqual(2);   // the same place
  expect(hashLaptop).toBe(hashNav);                                       // the same anchor
  expect(Math.abs(laptopEnd.at - navEnd.at)).toBeLessThan(400);           // the same glide (Lenis's 1.5 s)
  console.log(`laptop: ${from} -> ${laptopEnd.end} px in ${Math.round(laptopEnd.at)} ms; nav: -> ${navEnd.end} px in ${Math.round(navEnd.at)} ms; hash ${hashLaptop}`);
});

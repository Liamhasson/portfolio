// e2e/about-pendant.spec.ts: the pendant on About (plan 2026-10-16-about-pendant Task 7; Task 8: readability, solved per screen).
// Run with `npx playwright test -c playwright.about.config.ts` (a GPU-backed Chromium: the pendant is WebGL2).
import { expect, test, type Page } from "@playwright/test";

const ready = (page: Page, timeout = 10_000) => page.waitForFunction(() => window.__pendant?.ready === true, null, { timeout });

/** Page errors and console errors; `ignore` drops the browser's own lines for requests a test aborts on purpose. */
function collectErrors(page: Page, ignore?: RegExp): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !(ignore && ignore.test(m.text()))) errors.push(m.text()); });
  return errors;
}

/** Bright (brass) pixels in a screen box: the page's own background there is near black. */
async function brightPixels(page: Page, box: { l: number; t: number; r: number; b: number }) {
  const clip = { x: Math.max(0, box.l), y: Math.max(0, box.t), width: Math.max(1, box.r - Math.max(0, box.l)), height: Math.max(1, box.b - Math.max(0, box.t)) };
  const png = (await page.screenshot({ clip })).toString("base64");
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = `data:image/png;base64,${src}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext("2d")!;
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 150) n++;
    return n;
  }, png);
}

test("the pendant draws on About with no console errors", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/about");
  const canvas = page.locator("canvas.ab-pendant");
  await expect(canvas).toBeVisible();
  await ready(page);
  await page.mouse.move(1430, 890);
  const hook = await page.evaluate(() => window.__pendant!);
  expect(hook.keys.map((k) => k.id)).toEqual([
    "opening", "letgo", "tumble", "worm", "above", "glass", "glide", "glideEnd", "whirl", "build", "buildEnd", "hero",
  ]);
  for (let i = 1; i < hook.keys.length; i++) expect(hook.keys[i].y).toBeGreaterThan(hook.keys[i - 1].y);
  // the opening: small, above the first line, in front of the words
  expect(hook.layer).toBe("front");
  expect(hook.box.r - hook.box.l).toBeGreaterThan(20);
  expect(hook.box.b - hook.box.t).toBeGreaterThan(60);
  await expect(canvas).toHaveAttribute("data-layer", "front");
  // real pixels: brass in its box (above the first line, no words there), and none once the canvas is hidden
  await page.waitForTimeout(900); // (its 0.6 s fade-in)
  const drawn = await brightPixels(page, hook.box);
  await canvas.evaluate((c) => { c.style.visibility = "hidden"; });
  const without = await brightPixels(page, hook.box);
  await canvas.evaluate((c) => { c.style.visibility = ""; });
  expect(drawn).toBeGreaterThan(500);
  expect(without).toBeLessThan(drawn / 20);
  expect(errors).toEqual([]);
});

test("About works when the pendant's model fails", async ({ page }) => {
  const errors = collectErrors(page, /Failed to load resource/); // (the aborted files' own network lines)
  let aborted = 0;
  await page.route("**/about/pendant/**", (r) => { aborted++; return r.abort(); });
  await page.goto("/about");
  await expect(page.getByText("I’m Liam. I love crafting products")).toBeVisible();
  await expect.poll(() => aborted, { timeout: 15_000 }).toBeGreaterThan(0);
  await expect(page.locator("canvas.ab-pendant")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 2, name: "Find the problem." })).toBeAttached();
  expect(errors).toEqual([]);
});

test("a lost WebGL context hides the canvas without errors", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/about");
  await ready(page);
  const canvas = page.locator("canvas.ab-pendant");
  await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.ab-pendant")!;
    const ext = c.getContext("webgl2")!.getExtension("WEBGL_lose_context")!;
    (window as unknown as { __lose: WEBGL_lose_context }).__lose = ext;
    ext.loseContext();
  });
  await expect(canvas).toBeHidden();
  expect(await page.evaluate(() => window.__pendant!.ready)).toBe(false);
  await page.evaluate(() => (window as unknown as { __lose: WEBGL_lose_context }).__lose.restoreContext());
  await ready(page, 15_000);
  await expect(canvas).toBeVisible();
  expect(errors).toEqual([]);
});

test("the glass sits in the gap between the quotes and touches neither", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/about");
  await ready(page);
  await page.mouse.move(1430, 890);
  const y = await page.evaluate(() => window.__pendant!.keys.find((k) => k.id === "glass")!.y);
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(2500); // (the follow settles)
  const m = await page.evaluate(() => {
    const g = window.__pendant!.glass!;
    const q1 = document.querySelector("[data-pendant='quote1']")!.getBoundingClientRect();
    const bq = document.querySelector("[data-pendant='quote2'] blockquote")!;
    const hang = 0.6 * parseFloat(getComputedStyle(bq).fontSize);
    const cx = g.x * innerWidth, R = g.r * innerHeight;
    return { left: cx - R, right: cx + R, R, q1: q1.right, q2: bq.getBoundingClientRect().left - hang };
  });
  expect(m.R).toBeGreaterThan(20);
  expect(m.left).toBeGreaterThan(m.q1);
  expect(m.right).toBeLessThan(m.q2);
  expect(errors).toEqual([]);
});

// ---------- Task 8: readability, solved per screen ----------

/** The words the pendant must never cover in front of them (Task 7's selectors, as in about-pendant.tsx), and the chrome that
 *  holds still on screen over the track: the wordmark, the pill nav, the burger (phones), the resume pill and progress bar. */
const TEXT = ".ab-big, .ab-quote blockquote, .ab-quote figcaption, .ab-verb .ab-mono, .ab-verb-title, .ab-skills li, .cap";
const CHROME = ".sh-name, .sh-nav, .sh-burger, .ab-resume, .ab-bar";

/** What the pendant covers right now while in front of the words: each line of text (one box per line, as the mount
 *  measures them: the text's own rects, not the element's block box) or chrome box its on-screen box overlaps by more than
 *  1 px both ways (sub-pixel rounding aside). Empty when it is behind, not drawn, or clear. The box is clipped to the
 *  screen: a part of the pendant past the screen's edge covers nothing anyone can read. Runs in the page. */
function coveredNow({ TEXT, CHROME }: { TEXT: string; CHROME: string }): string[] {
  const h = window.__pendant;
  if (!h?.ready || h.layer !== "front") return [];
  const c = document.querySelector("canvas.ab-pendant")!.getBoundingClientRect();
  const b = {
    l: Math.max(h.box.l + c.left, 0), r: Math.min(h.box.r + c.left, innerWidth),
    t: Math.max(h.box.t + c.top, 0), b: Math.min(h.box.b + c.top, innerHeight),
  };
  const boxes: { r: { left: number; right: number; top: number; bottom: number }; what: string }[] = [];
  const range = document.createRange();
  for (const el of document.querySelectorAll<HTMLElement>(TEXT)) {
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.textContent?.trim()) continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) boxes.push({ r, what: `"${n.textContent.trim().slice(0, 28)}"` });
    }
  }
  for (const el of document.querySelectorAll<HTMLElement>(CHROME)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) boxes.push({ r, what: `.${el.className.split(" ")[0]}` });
  }
  const out: string[] = [];
  for (const { r, what } of boxes) {
    const ox = Math.min(b.r, r.right) - Math.max(b.l, r.left), oy = Math.min(b.b, r.bottom) - Math.max(b.t, r.top);
    if (ox > 1 && oy > 1) out.push(`s ${Math.round(h.s)}: box ${[b.l, b.t, b.r, b.b].map(Math.round).join(",")} over ${what}`);
  }
  return out;
}
const frontOverlaps = (page: Page) => page.evaluate(coveredNow, { TEXT, CHROME });

/** The track's scroll range: the section's top to where its last screen pins. */
const trackRange = (page: Page) => page.evaluate(() => {
  const sec = document.querySelector<HTMLElement>(".ab")!;
  return { top: sec.offsetTop, end: sec.offsetTop + sec.offsetHeight - innerHeight };
});

for (const [w, h] of [[1440, 900], [1280, 800], [1920, 1080], [1024, 768]] as const) {
  test.describe(`at ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });
    test("never in front of a line, at any screen", async ({ page }) => {
      test.setTimeout(240_000);
      const errors = collectErrors(page);
      await page.goto("/about");
      await ready(page, 30_000);
      await page.waitForTimeout(1500); // (the arrival animation and the nav's entrance)
      const { top, end } = await trackRange(page);
      const bad: string[] = [];
      for (let i = 0; i <= 120; i++) {
        await page.evaluate((y) => window.scrollTo(0, y), top + ((end - top) * i) / 120);
        await page.waitForTimeout(400);
        bad.push(...(await frontOverlaps(page)).map((m) => `step ${i}: ${m}`));
      }
      expect(bad).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}

test("follows a resize from track to stack and back", async ({ page }) => {
  test.setTimeout(60_000);
  const errors = collectErrors(page);
  await page.goto("/about");
  await ready(page, 30_000);
  const { top, end } = await trackRange(page);
  await page.evaluate((y) => window.scrollTo(0, y), (top + end) / 2);
  await page.waitForTimeout(1500);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "stack");
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__pendant?.ready)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "track");
  await page.waitForTimeout(2500); // (the arrival animation replays on the way back to the track; the follow settles)
  expect(await page.evaluate(() => window.__pendant?.ready)).toBe(true);
  expect(await frontOverlaps(page)).toEqual([]);
  expect(errors).toEqual([]);
});

/** Every painted frame for `ms`: what the pendant covers in front, read after the frame's own updates (a task queued from
 *  the frame runs after every animation-frame callback, the track's transform included, has run). */
const watchFrames = (page: Page, ms: number) => page.evaluate(({ ms, TEXT, CHROME, fn }) => new Promise<string[]>((done) => {
  // (coveredNow travels as source: a function can't be handed into the page inside another)
  const covered = new Function(`return (${fn});`)() as (a: { TEXT: string; CHROME: string }) => string[];
  const out: string[] = [];
  const t0 = performance.now();
  const check = () => {
    out.push(...covered({ TEXT, CHROME }).map((m) => `${Math.round(performance.now() - t0)} ms, ${m}`));
    if (performance.now() - t0 < ms) requestAnimationFrame(() => setTimeout(check, 0));
    else done(out);
  };
  requestAnimationFrame(() => setTimeout(check, 0));
}), { ms, TEXT, CHROME, fn: coveredNow.toString() });

test("a jump doesn't put it over the words", async ({ page }) => {
  test.setTimeout(60_000);
  const errors = collectErrors(page);
  await page.goto("/about");
  await ready(page, 30_000);
  await page.waitForTimeout(1500);
  await page.keyboard.press("End");
  const down = await watchFrames(page, 1500);
  await page.waitForTimeout(3000);
  await page.keyboard.press("Home");
  const up = await watchFrames(page, 1500);
  expect(down).toEqual([]);
  expect(up).toEqual([]);
  expect(errors).toEqual([]);
});

test("a press on the pendant drags; elsewhere links work", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/about");
  await ready(page, 30_000);
  await page.waitForTimeout(1500);
  // the opening: in front, above the first line. A press on it is a grab: dragged and let go, it follows nothing.
  const box = await page.evaluate(() => window.__pendant!.box);
  expect(await page.evaluate(() => window.__pendant!.layer)).toBe("front");
  const cx = (box.l + box.r) / 2, cy = (box.t + box.b) / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(cx + i * 10, cy);
  await page.mouse.up();
  await page.mouse.click(cx, cy); // (a plain press and release on it too)
  await page.waitForTimeout(500);
  expect(new URL(page.url()).pathname).toBe("/about");
  // a proof link away from the pendant: a click follows it
  const y = await page.evaluate(() => window.__pendant!.keys.find((k) => k.id === "glideEnd")!.y);
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(2500);
  const target = await page.evaluate(() => {
    const h = window.__pendant!;
    for (const a of document.querySelectorAll<HTMLAnchorElement>("a.ab-proof")) {
      const r = a.getBoundingClientRect();
      const onScreen = r.left > 0 && r.right < innerWidth && r.top > 100 && r.bottom < innerHeight - 120;
      const clear = r.right < h.box.l || r.left > h.box.r || r.bottom < h.box.t || r.top > h.box.b;
      if (onScreen && clear) return { x: r.left + Math.min(40, r.width / 2), y: r.top + r.height / 2, href: a.getAttribute("href")! };
    }
    return null;
  });
  expect(target).not.toBeNull();
  await page.mouse.click(target!.x, target!.y);
  await page.waitForURL((u) => u.pathname !== "/about", { timeout: 10_000 });
  expect(new URL(page.url()).pathname).toBe(target!.href);
});

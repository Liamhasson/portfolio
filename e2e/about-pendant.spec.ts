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

test("the glass sits in the pictures' slot between the quotes and touches neither", async ({ page }) => {
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
    const slot = document.querySelector("[data-pendant='glass']")!.getBoundingClientRect();
    return { left: cx - R, right: cx + R, R, q1: q1.right, q2: bq.getBoundingClientRect().left - hang, slotMid: (slot.left + slot.right) / 2, slotW: slot.width };
  });
  expect(m.R).toBeGreaterThan(20);
  // the ball is the slot's: centred on it (the page's scroll, not the eased follow), radius 0.44 of its width
  expect(Math.abs((m.left + m.right) / 2 - m.slotMid)).toBeLessThan(2);
  expect(Math.abs(m.R - 0.44 * m.slotW)).toBeLessThan(2);
  expect(m.left).toBeGreaterThan(m.q1);
  expect(m.right).toBeLessThan(m.q2);
  expect(errors).toEqual([]);
});

/** The glass ball's inside, sorted into kinds of pixel: inside 0.8 of its radius (the rim's dark ring and edge left out).
 *  "clear" is the page seen through clear glass: within a few levels of the page itself, measured just outside the ball (the
 *  median of a ring from 1.1 to 1.3 radii, between the quotes), so an opaque black ball doesn't pass for it. */
async function ballPixels(page: Page, g: { x: number; y: number; r: number }) {
  const vp = page.viewportSize()!;
  const cx = g.x * vp.width, cy = g.y * vp.height, R = g.r * vp.height;
  const S = 1.3 * R; // (the clip reaches the ring round the ball)
  const clip = { x: Math.round(cx - S), y: Math.round(cy - S), width: Math.round(2 * S), height: Math.round(2 * S) };
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
    const mid = c.width / 2, r0 = mid / 1.3; // (the ball's radius in the clip)
    const dist = (px: number, py: number) => Math.hypot(px + 0.5 - mid, py + 0.5 - mid);
    // the page just outside the ball, channel by channel
    const ring: number[][] = [[], [], []];
    for (let py = 0; py < c.height; py++) {
      for (let px = 0; px < c.width; px++) {
        const q = dist(px, py);
        if (q < 1.1 * r0 || q > 1.3 * r0) continue;
        const i = (py * c.width + px) * 4;
        for (let k = 0; k < 3; k++) ring[k].push(d[i + k]);
      }
    }
    const pageRgb = ring.map((v) => v.sort((a, b) => a - b)[v.length >> 1]);
    let n = 0, brass = 0, grey = 0, clear = 0;
    for (let py = 0; py < c.height; py++) {
      for (let px = 0; px < c.width; px++) {
        if (dist(px, py) > 0.8 * r0) continue;
        const i = (py * c.width + px) * 4, r = d[i], gg = d[i + 1], b = d[i + 2], sum = r + gg + b;
        n++;
        if (sum > 150 && r - b > 25) brass++; // (the pendant, warm)
        else if (sum > 210 && sum < 600 && Math.max(r, gg, b) - Math.min(r, gg, b) < 14) grey++; // (milk: a flat mid grey)
        else if (Math.max(Math.abs(r - pageRgb[0]), Math.abs(gg - pageRgb[1]), Math.abs(b - pageRgb[2])) <= 6) clear++;
      }
    }
    return { n, page: pageRgb, brass: brass / n, grey: grey / n, clear: clear / n };
  }, png);
}

test("through the glass: the pendant inside, clear glass round it, no milk", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/about");
  await ready(page);
  await page.mouse.move(1430, 890);
  const y = await page.evaluate(() => window.__pendant!.keys.find((k) => k.id === "glass")!.y);
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(2500);
  const g = await page.evaluate(() => window.__pendant!.glass!);
  expect(g).not.toBeNull();
  const px = await ballPixels(page, g);
  expect(px.n).toBeGreaterThan(5000);
  expect(px.brass).toBeGreaterThan(0.08); // (the pendant, magnified, fills a good part of the ball)
  expect(Math.max(...px.page)).toBeGreaterThan(8); // (the page is a warm near-black, not black: an opaque black ball would differ)
  expect(px.clear).toBeGreaterThan(0.2); // (and round it the page shows through, as it is outside the ball)
  expect(px.grey).toBeLessThan(0.05); // (the placeholder's milky inside was about half flat grey)
  expect(errors).toEqual([]);
});

// ---------- Task 8: readability, solved per screen ----------

/** The words the pendant must never cover in front of them (Task 7's selectors, as in about-pendant.tsx), the chrome that
 *  holds still on screen over the track: the wordmark, the pill nav, the burger (phones) and the resume pill (the 1 px
 *  progress bar is not avoided: Liam's ruling), and the pictures (coveredNow: each frame whole and its caption's lines,
 *  where the track draws them). */
const TEXT = ".ab-big, .ab-quote blockquote, .ab-quote figcaption, .ab-verb .ab-mono:not(.ab-pic-cap), .ab-verb-title, .ab-skills li, .cap";
const CHROME = ".sh-name, .sh-nav, .sh-burger, .ab-resume";

/** What the pendant covers right now while in front of the words: each line of text (one box per line, as the mount
 *  measures them: the text's own rects, not the element's block box) or picture / chrome box its on-screen box overlaps by more than
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
  // the pictures, where the track draws them: not when hidden or emptied (inset(50%)), else from its clip's top and left in
  // (about-track.tsx writes `inset(T% -100vw 0 Lpx round R)`: T% of the picture's height, L px from its left). A frame whose
  // exit cut has started (L > 0) may be passed over, its caption with it (Liam, 2026-10-16: the hero over the leaving desk film).
  for (const pic of document.querySelectorAll<HTMLElement>(".ab-pic")) {
    if (pic.style.visibility === "hidden" || pic.style.clipPath === "inset(50%)") continue;
    const m = /^inset\(([-\d.e+]+)% -100vw 0(?:px)? ([-\d.e+]+)px/.exec(pic.style.clipPath);
    const p = pic.getBoundingClientRect();
    const minX = p.left + (m ? parseFloat(m[2]) : 0), minY = p.top + (m ? (parseFloat(m[1]) / 100) * p.height : 0);
    if (m !== null && parseFloat(m[2]) > 0) continue;
    const parts: DOMRect[] = [...pic.querySelectorAll<HTMLElement>(".ab-pic-f")].map((f) => f.getBoundingClientRect());
    for (const cap of pic.querySelectorAll<HTMLElement>(".ab-pic-cap")) {
      const walk = document.createTreeWalker(cap, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) { range.selectNodeContents(n); parts.push(...range.getClientRects()); }
    }
    for (const r of parts) {
      const left = Math.max(r.left, minX), top = Math.max(r.top, minY);
      if (r.right > left && r.bottom > top) boxes.push({ r: { left, top, right: r.right, bottom: r.bottom }, what: `picture ${pic.dataset.pic}` });
    }
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
    test("the hero plays its storyboard framing: in front, at the left edge", async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto("/about");
      await ready(page, 30_000);
      await page.waitForTimeout(1500);
      await page.mouse.move(w - 2, h - 2);
      const solve = await page.evaluate(() => window.__pendant!.solve);
      // the shot as written (alt 0, perhaps nudged and scaled clear of the site's name), never the bottom-right alternate
      expect(solve.behind).not.toContain("hero");
      expect(solve.moved.find((m) => m.id === "hero")?.alt ?? 0).toBe(0);
      const y = await page.evaluate(() => window.__pendant!.keys.find((k) => k.id === "hero")!.y);
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(2500);
      const hk = await page.evaluate(() => ({ box: window.__pendant!.box, layer: window.__pendant!.layer }));
      expect(hk.layer).toBe("front");
      expect(hk.box.l).toBeLessThan(0.02 * w); // (cut by the left edge)
      expect(hk.box.r).toBeLessThan(0.4 * w); // (left of the closing line's middle: the left side)
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
 *  the frame runs after every animation-frame callback, the track's transform included, has run), and the travel the
 *  pendant was drawn at, lowest and highest. */
const watchFrames = (page: Page, ms: number) => page.evaluate(({ ms, TEXT, CHROME, fn }) => new Promise<{ bad: string[]; sMin: number; sMax: number }>((done) => {
  // (coveredNow travels as source: a function can't be handed into the page inside another)
  const covered = new Function(`return (${fn});`)() as (a: { TEXT: string; CHROME: string }) => string[];
  const bad: string[] = [];
  let sMin = Infinity, sMax = -Infinity;
  const t0 = performance.now();
  const check = () => {
    bad.push(...covered({ TEXT, CHROME }).map((m) => `${Math.round(performance.now() - t0)} ms, ${m}`));
    const s = window.__pendant?.s ?? NaN;
    sMin = Math.min(sMin, s);
    sMax = Math.max(sMax, s);
    if (performance.now() - t0 < ms) requestAnimationFrame(() => setTimeout(check, 0));
    else done({ bad, sMin, sMax });
  };
  requestAnimationFrame(() => setTimeout(check, 0));
}), { ms, TEXT, CHROME, fn: coveredNow.toString() });

test("a jump doesn't put it over the words", async ({ page }) => {
  test.setTimeout(60_000);
  const errors = collectErrors(page);
  await page.goto("/about");
  await ready(page, 30_000);
  await page.waitForTimeout(1500);
  const travel = await page.evaluate(() => { const k = window.__pendant!.keys; return k[k.length - 1].y - k[0].y; });
  const bottom = () => page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await page.keyboard.press("End");
  const down = await watchFrames(page, 1500);
  expect(Math.abs((await page.evaluate(() => scrollY)) - (await bottom()))).toBeLessThan(5); // (it really jumped to the end)
  expect(down.sMax - down.sMin).toBeGreaterThan(0.8 * travel); // (and the pendant swept the track while it was watched)
  await page.waitForTimeout(3000);
  await page.keyboard.press("Home");
  const up = await watchFrames(page, 1500);
  expect(await page.evaluate(() => scrollY)).toBeLessThan(5);
  expect(up.sMax - up.sMin).toBeGreaterThan(0.8 * travel);
  expect(down.bad).toEqual([]);
  expect(up.bad).toEqual([]);
  expect(errors).toEqual([]);
});

test("a cursor parked in any corner doesn't make a moved shot pump between layers", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/about");
  await ready(page, 30_000);
  await page.waitForTimeout(1500);
  // every shot the solve moved to keep it in front on this screen
  const shots = await page.evaluate(() => {
    const h = window.__pendant!;
    return h.solve.moved.filter((m) => !h.solve.behind.includes(m.id)).map((m) => ({ id: m.id, y: h.keys.find((k) => k.id === m.id)!.y }));
  });
  expect(shots.length).toBeGreaterThan(0);
  const vp = page.viewportSize()!;
  const seen: { id: string; corner: number[]; layers: string[] }[] = [];
  for (const { id, y } of shots) {
    await page.mouse.move(vp.width / 2, vp.height / 2);
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(2500);
    for (const [x, cy] of [[2, 2], [vp.width - 2, 2], [2, vp.height - 2], [vp.width - 2, vp.height - 2]]) {
      await page.mouse.move(x, cy, { steps: 5 });
      await page.waitForTimeout(800); // (the lean eases in)
      const layers = await page.evaluate(() => new Promise<string[]>((done) => {
        const out: string[] = [];
        const t0 = performance.now();
        const tick = () => {
          out.push(window.__pendant!.layer);
          if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else done(out);
        };
        requestAnimationFrame(tick);
      }));
      seen.push({ id, corner: [x, cy], layers: [...new Set(layers)] });
    }
  }
  expect(seen.filter((x) => x.layers.length !== 1 || x.layers[0] !== "front")).toEqual([]);
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
  const yaw0 = await page.evaluate(() => window.__pendant!.yaw);
  const t0 = Date.now();
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(cx + i * 10, cy);
  await page.waitForTimeout(100);
  const held = await page.evaluate(() => ({ dragging: window.__pendant!.dragging, yaw: window.__pendant!.yaw }));
  const secs = (Date.now() - t0) / 1000;
  await page.mouse.up();
  // the hand turned it: held, and turned well beyond what its own spin (0.22 turns a second at the opening) gives
  expect(held.dragging).toBe(true);
  expect(held.yaw - yaw0 - 0.22 * 2 * Math.PI * secs).toBeGreaterThan(0.6); // (120 px of drag: 1.44 rad)
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

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
    "opening", "letgo", "tumble", "worm", "above", "glass", "hold", "holdEnd", "build", "buildEnd", "hero",
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
const TEXT = ".ab-big, .ab-quote blockquote, .ab-quote figcaption, .ab-verb .ab-mono, .ab-verb-title, .ab-skills li, .cap";
const CHROME = ".sh-name, .sh-nav, .sh-burger, .ab-resume";

/** What the pendant covers right now while in front of the words: each line of text (one box per line, as the mount
 *  measures them: the text's own rects, not the element's block box) or picture / chrome box its on-screen box overlaps by more than
 *  1 px both ways (sub-pixel rounding aside). Empty when it is behind, not drawn, fading out to go behind, or clear. The box is clipped to the
 *  screen: a part of the pendant past the screen's edge covers nothing anyone can read. Runs in the page. */
function coveredNow({ TEXT, CHROME, STILLS = "" }: { TEXT: string; CHROME: string; STILLS?: string }): string[] {
  const h = window.__pendant;
  // (mid-dip it is fading out of the front to go behind a line it has come onto (a jump, a hand): 0.15 s, the z flip at 0,
  // pinned by the motion pass's tests below. Whole, in front over a line, it always counts; and a dip-out that holds for
  // more than 10 calls in a row (frames, when watched every frame: 0.15 s is 9 at 60 fps) counts as well.)
  const run = window as unknown as { __dipRun?: number };
  if (h?.ready && h.layer === "front" && h.fade < 1 && h.goal === "back") {
    run.__dipRun = (run.__dipRun ?? 0) + 1;
    return run.__dipRun > 10 ? [`s ${Math.round(h.s)}: fading out in front for ${run.__dipRun} frames in a row`] : [];
  }
  run.__dipRun = 0;
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
  // exit cut has started (L > 0) may be passed over, its caption with it (Liam, 2026-10-16: a picture already leaving).
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
  // (stacked: pictures that hold still in the column, whole: Liam's photo)
  if (STILLS) for (const el of document.querySelectorAll<HTMLElement>(STILLS)) {
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
    test("the build, in its frame: the page pauses, the pendant is locked at the frame's centre, in front, lit, big, over no line, wire to brass", async ({ page }) => {
      test.setTimeout(90_000);
      await page.goto("/about?pendant-debug");
      await ready(page, 30_000);
      await page.waitForTimeout(1500);
      await page.mouse.move(w - 2, h - 2);
      const pause = await page.evaluate(() => { const s = document.querySelector<HTMLElement>("section.ab")!; return { top: s.offsetTop, at: Number(s.dataset.dwellAt), len: Number(s.dataset.dwellLen) }; });
      expect(pause.len).toBeGreaterThan(0.5 * h);
      const trackX = () => page.evaluate(() => getComputedStyle(document.querySelector(".ab-track")!).transform);
      const seen: { k: number; wire: number }[] = [];
      for (const k of [0.3, 0.5, 0.8]) {
        await page.evaluate((y) => window.scrollTo(0, y), Math.round(pause.top + pause.at + k * pause.len));
        await page.waitForTimeout(2500);
        const at = await page.evaluate(() => ({ layer: window.__pendant!.layer, bright: window.__pendant!.bright, box: window.__pendant!.box, pause: window.__pendant!.pause! }));
        const frame = await page.evaluate(() => { const r = document.querySelector("svg.ab-frame, .ab-frame")?.getBoundingClientRect(); return r ? { cx: r.left + r.width / 2, w: r.width } : null; });
        expect(at.pause.phase, `k ${k}`).toBe("build");
        expect(at.layer, `k ${k}`).toBe("front");
        expect(at.bright, `k ${k}`).toBeGreaterThan(0.95);
        const tall = Math.min(at.box.b, h) - Math.max(at.box.t, 0);
        expect(tall / h, `k ${k}: its box's share of the screen's height`).toBeGreaterThanOrEqual(0.5);
        if (frame && frame.w > 0) expect(Math.abs((at.box.l + at.box.r) / 2 - frame.cx), `k ${k}: centred in its frame`).toBeLessThanOrEqual(0.06 * w);
        expect(await frontOverlaps(page), `k ${k}`).toEqual([]);
        seen.push({ k, wire: at.pause.k });
      }
      // the track held still across the pause
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(pause.top + pause.at + 0.2 * pause.len));
      await page.waitForTimeout(300);
      const a = await trackX();
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(pause.top + pause.at + 0.7 * pause.len));
      await page.waitForTimeout(300);
      expect(await trackX()).toBe(a);
      expect(seen.map((x) => x.wire)).toEqual([...seen.map((x) => x.wire)].sort((p, q) => p - q));

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

test("a cursor parked in any corner never makes a shot pump between layers (hand placed)", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/about");
  await ready(page, 30_000);
  await page.waitForTimeout(1500);
  const shots = await page.evaluate(() => window.__pendant!.keys.filter((k) => ["opening", "worm", "above", "hero"].includes(k.id)));
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
  expect(seen.filter((x) => x.layers.length !== 1)).toEqual([]);

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
  // (mid-build: the page paused, the pendant in its frame at the stage, the skills' proof links on the left)
  const y = await page.evaluate(() => { const s = document.querySelector<HTMLElement>("section.ab")!; return s.offsetTop + Number(s.dataset.dwellAt) + 0.5 * Number(s.dataset.dwellLen); });
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

// ---------- the motion pass, Task 1: one eased brightness, layer swaps that never cut through the words ----------

/** Frames by hand, so every sample is exactly one of the pendant's steps (a deterministic stepping, not wall-clock frames):
 *  set before load, the mount's fixed step (1/60 s, read with ?pendant-debug) and a requestAnimationFrame that, once
 *  `__manual` is on, queues its callbacks for `__tick()` to run, one frame per call. */
function manualFrames() {
  const w = window as unknown as { __manual: boolean; __tick: () => void; __pendantStep: number };
  w.__pendantStep = 1000 / 60;
  w.__manual = false;
  const real = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
  let q: [number, FrameRequestCallback][] = [];
  let id = 1e9;
  window.requestAnimationFrame = (cb) => { if (!w.__manual) return real(cb); q.push([++id, cb]); return id; };
  window.cancelAnimationFrame = (n) => { q = q.filter(([k]) => k !== n); cancel(n); };
  w.__tick = () => { const run = q; q = []; const t = performance.now(); for (const [, cb] of run) cb(t); };
}

/** One sample a step: the canvas as the page paints it (opacity, z-index) and the hook, plus whether the pendant's box is
 *  over a line of the words right now. `stepAt(i)` returns the page y for step i (null to stop) or undefined to stay put;
 *  `then(i)` may change the asked layer. Runs in the page; each step yields one real frame (the scroll events fire, the
 *  track's own frame is queued) and then ticks exactly one frame. */
type Sample = { op: number; z: string; bright: number; fade: number; layer: string; s: number; over: boolean; face: number | null };
const stepFrames = (page: Page, args: { ys?: number[]; n?: number; force?: { at: number; layer: "front" | "back" | null }[] }) =>
  page.evaluate(async ({ ys, n, force, TEXT }) => {
    const w = window as unknown as { __manual: boolean; __tick: () => void; __pendantLayer?: string };
    const real = (cb: () => void) => setTimeout(cb, 16);
    const c = document.querySelector<HTMLCanvasElement>("canvas.ab-pendant")!;
    const lines = () => {
      const out: DOMRect[] = [];
      const range = document.createRange();
      for (const el of document.querySelectorAll<HTMLElement>(TEXT)) {
        const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let t = walk.nextNode(); t; t = walk.nextNode()) {
          if (!t.textContent?.trim()) continue;
          range.selectNodeContents(t);
          for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) out.push(r);
        }
      }
      return out;
    };
    const out: Sample[] = [];
    w.__manual = true;
    const steps = ys ? ys.length : n ?? 0;
    for (let i = 0; i < steps; i++) {
      for (const f of force ?? []) if (f.at === i) { if (f.layer) w.__pendantLayer = f.layer; else delete w.__pendantLayer; }
      if (ys) window.scrollTo(0, ys[i]);
      await new Promise<void>((r) => real(r));
      w.__tick();
      const h = window.__pendant!, cs = getComputedStyle(c), cr = c.getBoundingClientRect();
      const b = { l: h.box.l + cr.left, r: h.box.r + cr.left, t: h.box.t + cr.top, b: h.box.b + cr.top };
      const over = lines().some((r) => Math.min(b.r, r.right) - Math.max(b.l, r.left) > 1 && Math.min(b.b, r.bottom) - Math.max(b.t, r.top) > 1);
      // (how far the face drawn is from the one its lock asks, degrees: with ?pendant-debug, where a lock holds at least half)
      const p = h.pose, face = p && p.lock !== null && p.lockMix >= 0.5 ? ((((p.yaw * 180) / Math.PI - p.lock) % 360) + 540) % 360 - 180 : null;
      out.push({ op: Number(cs.opacity), z: cs.zIndex, bright: h.bright, fade: h.fade, layer: h.layer, s: h.s, over, face });
    }
    delete w.__pendantLayer;
    w.__manual = false;
    w.__tick(); // (the queued frames back on the real clock)
    return out;
  }, { ys: args.ys, n: args.n, force: args.force, TEXT });

/** The largest change between one sample and the next. */
const maxStep = (xs: number[]) => xs.slice(1).reduce((m, x, i) => Math.max(m, Math.abs(x - xs[i])), 0);

test.describe("the motion pass: brightness and layers", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("a slow scroll through the tumble and the worm: softly dimmed all the way, the opacity and the brightness never stepping more than 0.08 a frame", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    await page.addInitScript(manualFrames);
    await page.goto("/about?pendant-debug");
    await ready(page, 30_000);
    await page.mouse.move(1430, 890); // (the cursor parked in a corner)
    const keys = await page.evaluate(() => window.__pendant!.keys);
    const at = (id: string) => keys.find((k) => k.id === id)!.y;
    const from = at("letgo"), to = (at("worm") + at("above")) / 2;
    await page.evaluate((y) => window.scrollTo(0, y), from);
    await page.waitForTimeout(2500); // (the arrival, the follow and the 0.6 s fade-in settle)
    // 4 px of page a frame: a slow, steady scroll (240 px a second at 60 fps)
    const ys: number[] = [];
    for (let y = from; y <= to; y += 4) ys.push(y);
    const got = await stepFrames(page, { ys });
    expect(got.length).toBeGreaterThan(200);
    // softly dimmed all the way (Liam, 2026-10-18: no lit shot here), never stepping
    expect(got.every((g) => g.bright <= 0.45)).toBe(true);
    expect(maxStep(got.map((g) => g.op))).toBeLessThanOrEqual(0.08);
    expect(maxStep(got.map((g) => g.bright))).toBeLessThanOrEqual(0.08);
    // and every z change on the way happened clear of the words, or at the bottom of a fade dip
    const flips = got.flatMap((g, i) => (i > 0 && g.z !== got[i - 1].z ? [{ i, ...g }] : []));
    expect(flips.filter((f) => f.over && f.op >= 0.05)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("a brisk scroll (16 px a frame), down the track and back up: the brightness holds at the dim everywhere but the glass and the build", async ({ page }) => {
    test.setTimeout(240_000);
    const errors = collectErrors(page);
    await page.addInitScript(manualFrames);
    await page.goto("/about?pendant-debug");
    await ready(page, 30_000);
    await page.mouse.move(1430, 890);
    const keys = await page.evaluate(() => window.__pendant!.keys);
    const key = (id: string) => keys.find((k) => k.id === id)!.y;
    const from = key("letgo"), to = key("hold") + 200;
    await page.evaluate((y) => window.scrollTo(0, y), from);
    await page.waitForTimeout(2500);
    const down: number[] = [];
    for (let y = from; y <= to; y += 16) down.push(y);
    const up = [...down].reverse();
    const got = [...(await stepFrames(page, { ys: down })), ...(await stepFrames(page, { ys: up }))];
    // away from the glass (its shot and the moves either side are lit), the brightness is the dim and never moves
    const glass = key("glass"), far = (y: number) => Math.abs(y - glass) > 1.2 * 1440;
    const ys = [...down, ...up];
    const off = got.filter((g, i) => far(ys[i]) && (g.bright < 0.37 || g.bright > 0.43)).map((g, i) => `${Math.round(ys[i])}: ${g.bright.toFixed(2)}`);
    expect(off).toEqual([]);
    expect(maxStep(got.map((g) => g.bright))).toBeLessThanOrEqual(0.08);
    expect(errors).toEqual([]);

  });

  test("a dip during the canvas's 0.6 s fade-in starts from what shows: no jump", async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await page.addInitScript(manualFrames);
    await page.goto("/about?pendant-debug");
    // opened at the tumble (behind the words, over them), asked in front the moment it is drawn
    const y = await page.evaluate(async () => {
      const sec = document.querySelector<HTMLElement>(".ab")!;
      return sec.offsetTop + 0.12 * (sec.offsetHeight - innerHeight);
    });
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForFunction(() => window.__pendant?.ready === true, null, { timeout: 30_000, polling: 10 });
    const got = await stepFrames(page, { n: 45, force: [{ at: 0, layer: "front" }] });
    expect(got[0].op).toBeLessThan(0.9); // (caught inside the fade-in)
    expect(got.some((g) => g.layer === "front")).toBe(true); // (and the dip ran)
    expect(maxStep(got.map((g) => g.op))).toBeLessThan(0.15);
    expect(got.at(-1)!.op).toBe(1);
    expect(errors).toEqual([]);
  });

  test("over a line, a forced layer change fades out, flips z at fade 0, and fades back in", async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await page.addInitScript(manualFrames);
    await page.goto("/about?pendant-debug");
    await ready(page, 30_000);
    await page.mouse.move(1430, 890);
    // the tumble: behind "eight years managing two rock bands", its box well over the words
    const y = await page.evaluate(() => window.__pendant!.keys.find((k) => k.id === "tumble")!.y);
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(2500);
    // asked in front, held there; then handed back to the solve and the guard (behind), each over a line throughout
    const got = await stepFrames(page, { n: 150, force: [{ at: 5, layer: "front" }, { at: 75, layer: null }] });
    const flips = got.flatMap((g, i) => (i > 0 && g.z !== got[i - 1].z ? [{ i, ...g }] : []));
    expect(got[0]).toMatchObject({ layer: "back", fade: 1, over: true });
    expect(flips.map((f) => f.layer)).toEqual(["front", "back"]);
    for (const f of flips) {
      expect(f.over).toBe(true);
      expect(f.fade).toBeLessThan(0.05);
      expect(f.op).toBeLessThan(0.05);
      // out before it (the fade only falls), in after it (only rises, back to whole)
      const before = got.slice(Math.max(0, f.i - 6), f.i + 1).map((g) => g.op);
      const after = got.slice(f.i, f.i + 7).map((g) => g.op);
      for (let k = 1; k < before.length; k++) expect(before[k]).toBeLessThanOrEqual(before[k - 1]);
      for (let k = 1; k < after.length; k++) expect(after[k]).toBeGreaterThanOrEqual(after[k - 1]);
    }
    expect(got[74]).toMatchObject({ layer: "front", fade: 1, op: 1 });
    expect(got.at(-1)).toMatchObject({ layer: "back", fade: 1, op: 1 });
    // no step of the dip is a cut: 0.15 s each way at 1/60 s is about 0.11 a frame
    expect(maxStep(got.map((g) => g.op))).toBeLessThan(0.12);
    expect(errors).toEqual([]);
  });
});

// ---------- the motion pass, Task 2: an even pace between sections ----------

/** The controller's ruling (2026-10-18) for a steady 1500 px/s at 1440 x 900, in place of the brief's absolute 1.2 vw a
 *  frame (which would have needed about double the travel): no transition's peak speed (the pendant's middle on screen, vw
 *  a 1/60 s frame) over 1.6x the median transition's; that median at most 1.86 (the pre-motion-pass median); no transition's
 *  height changing more than 6% a frame; About's travel at most 15% over its 9239 px before the motion pass. Those stay the
 *  design target, which scripts/about/pendant-motion.cjs reports (measured at Part B: 1.57x, 1.85, 4.6%, +14.9%). The test
 *  allows a little more (EVEN, MEDIAN_MAX, TRAVEL_MAX) so a measuring wobble doesn't fail it; any layout change near "Find the
 *  problem" (the glide and the moves either side of it, the tightest) needs the meter run again. */
/** Hand placed (2026-10-18): the centre hold stands still, so a median of moves means nothing; every move has an absolute
 *  ceiling instead (the busiest, opening to let-go, is about 3 vw a frame at 1500 px/s). */
const PEAK_MAX = 4, MAX_DH = 6, TRAVEL_BEFORE = 9239, TRAVEL_MAX = 1.16;

type PassFrame = { index: number; s: number; cx: number; cy: number; h: number; face: number | null; bad: string[] };
/** One frame a step through `ys` (page y), the pendant's frames run by hand (manualFrames): its pose, how far its face is off
 *  its lock (degrees, where a lock holds at least half), and what it covers in front of the words (coveredNow). */
const steadyPass = (page: Page, ys: number[]) => page.evaluate(async ({ ys, TEXT, CHROME, fn }) => {
  const covered = new Function(`return (${fn});`)() as (a: { TEXT: string; CHROME: string }) => string[];
  const w = window as unknown as { __manual: boolean; __tick: () => void };
  const out: PassFrame[] = [];
  w.__manual = true;
  for (const y of ys) {
    window.scrollTo(0, y);
    await new Promise<void>((r) => setTimeout(r, 16));
    w.__tick();
    const p = window.__pendant!.pose!;
    const face = p.lock !== null && p.lockMix >= 0.5 ? ((((p.yaw * 180) / Math.PI - p.lock) % 360) + 540) % 360 - 180 : null;
    out.push({ index: p.index, s: p.s, cx: p.cx, cy: p.cy, h: p.h, face, bad: covered({ TEXT, CHROME }) });
  }
  w.__manual = false;
  w.__tick();
  return out;
}, { ys, TEXT, CHROME, fn: coveredNow.toString() });

test.describe("the motion pass: an even pace between sections", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("at a steady 1500 px/s every section change stays calm, and buildEnd to the hero covers no line, down or up", async ({ page }) => {
    test.setTimeout(240_000);
    const errors = collectErrors(page);
    await page.addInitScript(manualFrames);
    await page.goto("/about?pendant-debug&governor=0");
    await ready(page, 30_000);
    await page.mouse.move(1430, 890);
    const keys = await page.evaluate(() => window.__pendant!.keys);
    const y0 = keys[0].y, y1 = keys[keys.length - 1].y;
    expect(y1 - y0, "About's travel").toBeLessThanOrEqual(TRAVEL_MAX * TRAVEL_BEFORE);
    await page.evaluate((y) => window.scrollTo(0, y), y0);
    await page.waitForTimeout(3000); // (the arrival, the follow and the fade-in settle)
    // 25 px of page a frame (1500 px/s at 60 fps), one frame a step, then held at the end while the follow catches up
    const ys: number[] = [];
    for (let y = y0; y < y1; y += 25) ys.push(y);
    for (let i = 0; i < 60; i++) ys.push(y1);
    const got = await steadyPass(page, ys);
    // per transition (shot i to i + 1, by the later frame's blend): the peak speed of the middle and the peak height change
    const n = keys.length - 1;
    const peakV = new Array<number>(n).fill(0), peakDh = new Array<number>(n).fill(0);
    for (let k = 1; k < got.length; k++) {
      const a = got[k - 1], b = got[k], i = Math.min(b.index, n - 1);
      peakV[i] = Math.max(peakV[i], Math.hypot((b.cx - a.cx) * 1440, (b.cy - a.cy) * 900) / 14.4);
      peakDh[i] = Math.max(peakDh[i], Math.abs(b.h / a.h - 1) * 100);
    }
    const table = keys.slice(0, n).map((k, i) => `${k.id} -> ${keys[i + 1].id}: ${peakV[i].toFixed(2)} vw/f, ${peakDh[i].toFixed(2)} %/f`);
    for (let i = 0; i < n; i++) {
      expect(peakV[i], table.join("\n")).toBeLessThanOrEqual(PEAK_MAX);
      expect(peakDh[i], table[i]).toBeLessThanOrEqual(MAX_DH);
    }
    // buildEnd to the hero, both locked (0 to -62 degrees): the lock turns faster than its pull follows, so the face drawn
    // trails it mid-blend, on the side the blend came from (buildEnd's going down, the hero's going up). The solve takes the
    // faces either side of the one asked, so the pendant drawn never covers a line in front, either way.
    const be = keys.findIndex((k) => k.id === "buildEnd");
    const check = (pass: PassFrame[], dir: string) => {
      const sweep = pass.filter((g) => g.index === be);
      expect(sweep.length, dir).toBeGreaterThan(5);
      expect(sweep.flatMap((g) => g.bad.map((b) => `${dir}: ${b}`))).toEqual([]);
    };
    check(got, "down");
    // and up from the end, at the same pace, back past the build key
    await page.waitForTimeout(3000);
    const kb = keys.find((k) => k.id === "build")!.y;
    const up: number[] = [];
    for (let y = y1; y > kb - 400; y -= 25) up.push(y);
    for (let i = 0; i < 30; i++) up.push(up[up.length - 1]);
    check(await steadyPass(page, up), "up");
    expect(errors).toEqual([]);
  });
});

// ---------- Task 11: phones and reduced motion (About stacked) ----------

/** The stacked column's still pictures, avoided like the words (Liam's photo above the first line). */
const STILLS = ".ab-portrait";
const stackedOverlaps = (page: Page) => page.evaluate(coveredNow, { TEXT, CHROME, STILLS });
/** The stack's scroll range: the section's top to where its last screen shows, and on through the outro to its foot. */
const stackRange = (page: Page) => page.evaluate(() => {
  const sec = document.querySelector<HTMLElement>(".ab")!;
  return { top: sec.offsetTop, end: sec.offsetTop + sec.offsetHeight - innerHeight, foot: sec.offsetTop + sec.offsetHeight };
});

/** The canvas as the page really paints it: fixed to the screen, its z-index the layer's (2 in front, -1 behind the stacked
 *  words), and its opacity; plus, while it shows at all, whatever of the pull to Contact's lines the pendant's box is over. */
const stackPaint = (page: Page) => page.evaluate(() => {
  const h = window.__pendant!;
  const c = document.querySelector<HTMLCanvasElement>("canvas.ab-pendant")!;
  const cs = getComputedStyle(c);
  const op = Number(cs.opacity);
  const pull: string[] = [];
  if (op > 0.01) {
    const range = document.createRange();
    const walk = document.createTreeWalker(document.querySelector(".ab-end")!, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.textContent?.trim()) continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        const ox = Math.min(h.box.r, r.right) - Math.max(h.box.l, r.left), oy = Math.min(h.box.b, r.bottom, innerHeight) - Math.max(h.box.t, r.top);
        if (r.width > 0 && ox > 1 && oy > 1) pull.push(`opacity ${op.toFixed(2)} over "${n.textContent.trim().slice(0, 20)}"`);
      }
    }
  }
  return { position: cs.position, zIndex: cs.zIndex, layer: h.layer, opacity: op, pull };
});

for (const [w, h] of [[390, 844], [430, 932]] as const) {
  test.describe(`on a ${w}x${h} phone`, () => {
    test.use({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    test("stacked: the six phone shots, at most 2x, never in front of a line, and gone before Contact", async ({ page }) => {
      test.setTimeout(300_000);
      const errors = collectErrors(page);
      await page.goto("/about");
      await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "stack");
      await ready(page, 30_000);
      await page.waitForTimeout(1500); // (the nav's entrance)
      const hook = await page.evaluate(() => ({ mode: window.__pendant!.mode, ids: window.__pendant!.keys.map((k) => k.id), pr: window.__pendant!.pixelRatio, fxaa: window.__pendant!.fxaa }));
      expect(hook.mode).toBe("stack");
      expect(hook.ids).toEqual(["opening", "tumble", "above", "glass", "whirl", "hero"]);
      expect(hook.pr).toBeLessThanOrEqual(2); // (a 3x phone draws at 2x at most)
      expect(hook.fxaa).toBe(true); // (and so is smoothed: under the screen's own ratio there is no multisampling)
      await expect(page.locator("canvas.ab-pendant")).toBeVisible();
      // at the page's top the opening's gap is still under the resume pill: unseen there, never a dim sliver behind it
      const atLoad = await page.evaluate(() => {
        const h = window.__pendant!;
        const op = Number(getComputedStyle(document.querySelector("canvas.ab-pendant")!).opacity);
        const on = [...document.querySelectorAll<HTMLElement>(".sh-name, .sh-nav, .sh-burger, .ab-resume")].map((e) => e.getBoundingClientRect())
          .filter((r) => r.width > 0 && h.box.l < r.right && h.box.r > r.left && Math.max(h.box.t, 0) < r.bottom && Math.min(h.box.b, innerHeight) > r.top);
        return { s: h.s, op, onChrome: on.length };
      });
      expect(atLoad.s).toBe(0);
      expect(atLoad.op === 0 || atLoad.onChrome === 0).toBe(true);
      const { top, end, foot } = await stackRange(page);
      const bad: string[] = [];
      let front = 0;
      // the section, then on through the outro to the section's foot (the pull to Contact coming up)
      const ys = [...Array.from({ length: 121 }, (_, i) => top + ((end - top) * i) / 120), ...Array.from({ length: 20 }, (_, i) => end + ((foot - end) * (i + 1)) / 20)];
      for (const [i, y] of ys.entries()) {
        await page.evaluate((y) => window.scrollTo(0, y), y);
        await page.waitForTimeout(400);
        bad.push(...(await stackedOverlaps(page)).map((m) => `step ${i}: ${m}`));
        const paint = await stackPaint(page);
        if (paint.position !== "fixed") bad.push(`step ${i}: the canvas is ${paint.position}, not fixed`);
        if (paint.zIndex !== (paint.layer === "front" ? "2" : "-1")) bad.push(`step ${i}: layer ${paint.layer} painted at z-index ${paint.zIndex}`);
        bad.push(...paint.pull.map((m) => `step ${i}: ${m}`));
        if (paint.layer === "front" && y <= end) front++;
      }
      expect(bad).toEqual([]);
      expect(front).toBeGreaterThan(30); // (and it was in front for a good part of the way: the check had something to check)
      // where the pull's first line comes up into view the canvas has already faded right out (About still on screen, so
      // this is the outro's own fade, not the pause off screen)
      const pullIn = await page.evaluate(() => {
        const range = document.createRange();
        const walk = document.createTreeWalker(document.querySelector(".ab-end")!, NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) {
          if (!n.textContent?.trim()) continue;
          range.selectNodeContents(n);
          return range.getClientRects()[0].top + scrollY - innerHeight;
        }
        return null;
      });
      expect(pullIn).not.toBeNull();
      await page.evaluate((y) => window.scrollTo(0, y), pullIn!);
      await page.waitForTimeout(600);
      expect(await page.evaluate(() => document.querySelector(".ab")!.getBoundingClientRect().bottom > 0)).toBe(true);
      expect((await stackPaint(page)).opacity).toBe(0);
      // and at the section's foot
      await page.evaluate((y) => window.scrollTo(0, y), foot);
      await page.waitForTimeout(400);
      expect((await stackPaint(page)).opacity).toBe(0);
      expect(errors).toEqual([]);
    });
  });
}

test.describe("on a phone, the glass", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  test("the ball sits in the slot between the stacked quotes, touches neither, the pendant inside it", async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await page.goto("/about");
    await ready(page, 30_000);
    const y = await page.evaluate(() => window.__pendant!.keys.find((k) => k.id === "glass")!.y);
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(2500);
    const m = await page.evaluate(() => {
      const g = window.__pendant!.glass!;
      const rows = (sel: string) => {
        const range = document.createRange();
        const out: DOMRect[] = [];
        const walk = document.createTreeWalker(document.querySelector(sel)!, NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) { range.selectNodeContents(n); out.push(...[...range.getClientRects()].filter((r) => r.height > 0)); }
        return out;
      };
      const slot = document.querySelector("[data-pendant='glass']")!.getBoundingClientRect();
      const cy = g.y * innerHeight, R = g.r * innerHeight;
      return {
        g, top: cy - R, bottom: cy + R, R, slotMid: (slot.top + slot.bottom) / 2, slotW: slot.width,
        q1: Math.max(...rows("[data-pendant='quote1']").map((r) => r.bottom)), q2: Math.min(...rows("[data-pendant='quote2']").map((r) => r.top)),
      };
    });
    expect(m.g).not.toBeNull();
    expect(Math.abs((m.top + m.bottom) / 2 - m.slotMid)).toBeLessThan(2); // (the slot's, as the page shows it)
    expect(Math.abs(m.R - 0.44 * m.slotW)).toBeLessThan(2);
    expect(m.top).toBeGreaterThan(m.q1);
    expect(m.bottom).toBeLessThan(m.q2);
    const px = await ballPixels(page, m.g);
    expect(px.brass).toBeGreaterThan(0.08); // (the pendant, magnified, inside)
    expect(px.grey).toBeLessThan(0.05);
    expect(errors).toEqual([]);
  });
});

test.describe("on a phone, without the pendant", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  // (with the pendant's files blocked but WebGL there, the testimonials' light draws its own ball in the slot instead:
  // about-testimonials.spec.ts, Task 5. Here nothing can draw one.)
  test("no WebGL at all: no empty glass slot between the quotes", async ({ page }) => {
    test.setTimeout(60_000);
    await page.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
        return /webgl/i.test(id) ? null : (get as (...a: unknown[]) => RenderingContext | null).call(this, id, ...rest);
      } as typeof get;
    });
    await page.goto("/about");
    await expect(page.locator("canvas.ab-pendant")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator("canvas.ab-light")).toHaveCount(0, { timeout: 15_000 });
    expect(await page.locator("[data-pendant='glass']").evaluate((el) => el.getBoundingClientRect().height)).toBe(0);
    await expect(page.locator("section.ab")).not.toHaveAttribute("data-glass", "on");
  });
});

test.describe("on a phone, the toolbar", () => {
  test.use({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  test("its showing (a height-only resize under 150 px) neither resizes the canvas, moves a key nor solves again", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/about");
    await ready(page, 30_000);
    await page.waitForTimeout(1500);
    const read = () => page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>("canvas.ab-pendant")!;
      return { coarse: matchMedia("(pointer: coarse)").matches, w: c.width, h: c.height, keys: window.__pendant!.keys.map((k) => Math.round(k.y)) };
    });
    const before = await read();
    test.skip(!before.coarse, "this browser doesn't report a coarse pointer");
    // (Chromium's emulation can't show a toolbar: resizing the viewport changes lvh and svh too, which a real toolbar never
    // does. So the window reports the shorter height a toolbar leaves, as iOS does, and says so with a resize event.)
    const solve0 = await page.evaluate(() => { (window as unknown as { __solve0: unknown }).__solve0 = window.__pendant!.solve; return true; });
    expect(solve0).toBe(true);
    await page.evaluate(() => {
      Object.defineProperty(window, "innerHeight", { configurable: true, get: () => 664 - 80 });
      window.dispatchEvent(new Event("resize"));
    });
    await page.waitForTimeout(600); // (past the solve's quiet spell)
    expect(await read()).toEqual(before);
    expect(await page.evaluate(() => (window as unknown as { __solve0: unknown }).__solve0 === window.__pendant!.solve)).toBe(true); // (not solved again)
  });
});

test.describe("under reduced motion", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  test("it stacks; each shot is held still and a change of shot crossfades the canvas", async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await page.goto("/about");
    await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "stack");
    await ready(page, 30_000);
    await expect(page.locator("canvas.ab-pendant")).toHaveAttribute("data-mode", "still");
    const keys = await page.evaluate(() => window.__pendant!.keys);
    expect(keys.map((k) => k.id)).toEqual(["opening", "tumble", "above", "glass", "whirl", "hero"]);
    await page.evaluate((y) => window.scrollTo(0, y), keys[0].y);
    await page.waitForTimeout(1500);
    // every frame: the hook, and the canvas's opacity as the page paints it
    const watch = (ms: number) => page.evaluate((ms) => new Promise<{ yaw: number; shot: number; op: number; fade: number; box: number[]; blur: boolean }[]>((done) => {
      const out: { yaw: number; shot: number; op: number; fade: number; box: number[]; blur: boolean }[] = [];
      const c = document.querySelector<HTMLCanvasElement>("canvas.ab-pendant")!;
      const t0 = performance.now();
      const tick = () => {
        const h = window.__pendant!;
        out.push({ yaw: h.yaw, shot: h.shot, op: Number(getComputedStyle(c).opacity), fade: h.fade, box: [h.box.l, h.box.t, h.box.r, h.box.b], blur: h.blur.on });
        if (performance.now() - t0 < ms) requestAnimationFrame(tick); else done(out);
      };
      requestAnimationFrame(tick);
    }), ms);
    // held on the opening, nothing moves between frames: the same turn, the same box, no blur, fully shown
    const still = await watch(1200);
    expect(new Set(still.map((f) => f.shot))).toEqual(new Set([0]));
    expect(Math.max(...still.map((f) => f.yaw)) - Math.min(...still.map((f) => f.yaw))).toBeLessThan(1e-6); // (no spin)
    expect(new Set(still.map((f) => f.box.map((v) => v.toFixed(2)).join()))).toHaveProperty("size", 1); // (no drift)
    expect(still.every((f) => f.op === 1 && !f.blur)).toBe(true);
    // and it is really drawn there: brass in its box (the page round it is near black)
    const held = await page.evaluate(() => ({ box: window.__pendant!.box, layer: window.__pendant!.layer }));
    expect(held.layer).toBe("front");
    expect(await brightPixels(page, held.box)).toBeGreaterThan(300);
    // just past the halfway point to the tumble's key: still held (no crossfade back and forth at the middle). The jump
    // brings a line onto the held opening, so it goes behind it through a layer dip (motion pass, Task 1): the canvas's
    // opacity is that dip's fade and nothing else (no crossfade: the crossfade's own factor stays 1)
    // (watched until the dip is whole again: going behind, its fade-in waits for the dimming, about a second)
    await page.evaluate((y) => window.scrollTo(0, y), keys[0].y + 0.53 * (keys[1].y - keys[0].y));
    const middle = await watch(2000);
    expect(middle.every((f) => f.shot === 0 && Math.abs(f.op - f.fade) < 0.002)).toBe(true);
    // one dip: the opacity falls (to nothing, at the flip), then only rises, and is whole at the end
    const low = middle.reduce((m, f, i) => (f.op < middle[m].op ? i : m), 0);
    expect(middle[low].op).toBeLessThan(0.05);
    for (let i = 1; i <= low; i++) expect(middle[i].op).toBeLessThanOrEqual(middle[i - 1].op);
    for (let i = low + 1; i < middle.length; i++) expect(middle[i].op).toBeGreaterThanOrEqual(middle[i - 1].op);
    expect(middle.at(-1)!.op).toBe(1);
    // well past it: out to nothing, the tumble put in place, back in, over about 0.6 s
    await page.evaluate((y) => window.scrollTo(0, y), keys[0].y + 0.7 * (keys[1].y - keys[0].y));
    const fade = await watch(1500);
    const at = fade.findIndex((f) => f.shot === 1);
    expect(at).toBeGreaterThan(0);
    expect(Math.min(...fade.map((f) => f.op))).toBeLessThan(0.05);
    expect(fade.slice(0, at).every((f) => f.shot === 0)).toBe(true);
    expect(fade.slice(at).every((f) => f.shot === 1)).toBe(true); // (one change, no flicker back)
    expect(fade.at(-1)!.op).toBe(1);
    // the opacity only falls before the change and only rises after it: a crossfade, not a flash
    for (let i = 1; i < at; i++) expect(fade[i].op).toBeLessThanOrEqual(fade[i - 1].op + 1e-6);
    for (let i = at + 1; i < fade.length; i++) expect(fade[i].op).toBeGreaterThanOrEqual(fade[i - 1].op - 1e-6);
    // and each held shot is still: no turn between frames on either side of the change
    const yaws = (fs: typeof fade) => Math.max(...fs.map((f) => f.yaw)) - Math.min(...fs.map((f) => f.yaw));
    expect(yaws(fade.slice(0, at))).toBeLessThan(1e-6);
    expect(yaws(fade.slice(at))).toBeLessThan(1e-6);
    expect(fade.every((f) => !f.blur)).toBe(true);
    expect(errors).toEqual([]);
  });
  test("held still, it is never in front of a line as the words scroll past it", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/about");
    await ready(page, 30_000);
    await page.waitForTimeout(1500);
    const { top, end } = await stackRange(page);
    const bad: string[] = [];
    let front = 0;
    for (let i = 0; i <= 80; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), top + ((end - top) * i) / 80);
      await page.waitForTimeout(400);
      bad.push(...(await stackedOverlaps(page)).map((m) => `step ${i}: ${m}`));
      if (await page.evaluate(() => window.__pendant!.layer === "front")) front++;
    }
    expect(bad).toEqual([]);
    expect(front).toBeGreaterThan(15);
  });
});

// ---------- final review: the glass on every stacked screen, reduced motion turned on live, the box against the pixels ----------

/** The glass ball at the glass shot's key, and the quotes' text rows round it (screen px). */
async function glassAtKey(page: Page) {
  const y = await page.evaluate(() => window.__pendant!.keys.find((k) => k.id === "glass")!.y);
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(2500);
  return page.evaluate(() => {
    const g = window.__pendant!.glass;
    const rows = (sel: string) => {
      const range = document.createRange();
      const out: DOMRect[] = [];
      const walk = document.createTreeWalker(document.querySelector(sel)!, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) { range.selectNodeContents(n); out.push(...[...range.getClientRects()].filter((r) => r.height > 0)); }
      return out;
    };
    if (!g) return null;
    const cx = g.x * innerWidth, cy = g.y * innerHeight, R = g.r * innerHeight;
    return {
      l: cx - R, r: cx + R, t: cy - R, b: cy + R, d: 2 * R, vw: innerWidth, vh: innerHeight,
      q1: Math.max(...rows("[data-pendant='quote1']").map((q) => q.bottom)), q2: Math.min(...rows("[data-pendant='quote2']").map((q) => q.top)),
    };
  });
}

test.describe("under reduced motion on a desktop, the glass", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  test("the stacked ball is sized for the screen: at most 42% of its height across", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/about");
    await ready(page, 30_000);
    await page.waitForTimeout(1500);
    const g = await glassAtKey(page);
    expect(g).not.toBeNull();
    expect(g!.d).toBeLessThanOrEqual(0.42 * g!.vh);
    expect(g!.t).toBeGreaterThan(g!.q1);
    expect(g!.b).toBeLessThan(g!.q2);
  });
});

test.describe("on a landscape phone (844x390, stacked), the glass", () => {
  test.use({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  test("the ball fits inside the screen and the quotes stay readable", async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await page.goto("/about");
    await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "stack");
    await ready(page, 30_000);
    await page.waitForTimeout(1500);
    const g = await glassAtKey(page);
    expect(g).not.toBeNull();
    expect(g!.t).toBeGreaterThanOrEqual(0);
    expect(g!.b).toBeLessThanOrEqual(g!.vh);
    expect(g!.l).toBeGreaterThanOrEqual(0);
    expect(g!.r).toBeLessThanOrEqual(g!.vw);
    expect(g!.t).toBeGreaterThan(g!.q1); // (between the quotes' words, touching neither)
    expect(g!.b).toBeLessThan(g!.q2);
    expect(await stackedOverlaps(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
});

test("reduced motion turned on mid-visit stacks the page and the pendant follows it", async ({ page }) => {
  test.setTimeout(60_000);
  const errors = collectErrors(page);
  await page.goto("/about");
  await ready(page, 30_000);
  await page.waitForTimeout(1500);
  await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "track");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "stack");
  await expect(page.locator("canvas.ab-pendant")).toHaveAttribute("data-mode", "still");
  await expect.poll(() => page.evaluate(() => window.__pendant!.mode)).toBe("stack");
  await expect.poll(() => page.evaluate(() => window.__pendant!.keys.map((k) => k.id))).toEqual(["opening", "tumble", "above", "glass", "whirl", "hero"]);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector("canvas.ab-pendant")!).position)).toBe("fixed");
  // and back: the track again
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "track");
  await expect.poll(() => page.evaluate(() => window.__pendant!.keys.length)).toBe(11);
  expect(errors).toEqual([]);
});

test("the pendant's box holds what is drawn: no brass outside it at the worm, the compass and the hero", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/about");
  await ready(page, 30_000);
  await page.waitForTimeout(1500);
  await page.mouse.move(1430, 890);
  const out: { id: string; inside: number; outside: number; at: number[][] }[] = [];
  for (const id of ["worm", "above", "hero"]) {
    const y = await page.evaluate((id) => window.__pendant!.keys.find((k) => k.id === id)!.y, id);
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(2500);
    // only the canvas painted (the page's words and pictures hidden; the ground stays near black), and the box recorded on
    // every frame while the screenshot is taken (the pendant never stops moving): the mask is their union plus 4 px. The
    // glass ball, drawn on the same canvas wherever its slot is on screen, is not the pendant: its disc (as recorded, plus
    // 4 px) is left out of the count.
    await page.evaluate(() => {
      const st = document.createElement("style");
      st.id = "only-pendant";
      st.textContent = "body * { visibility: hidden !important; } canvas.ab-pendant { visibility: visible !important; }";
      document.head.appendChild(st);
      const w = window as unknown as { __boxes: { l: number; t: number; r: number; b: number }[]; __balls: { x: number; y: number; r: number }[]; __stop: boolean };
      w.__boxes = [];
      w.__balls = [];
      w.__stop = false;
      const tick = () => {
        const h = window.__pendant!;
        w.__boxes.push({ ...h.box });
        if (h.glass) w.__balls.push({ x: h.glass.x * innerWidth, y: h.glass.y * innerHeight, r: h.glass.r * innerHeight });
        if (!w.__stop) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.waitForTimeout(100);
    const png = (await page.screenshot()).toString("base64");
    const r = await page.evaluate(async (src) => {
      const w = window as unknown as { __boxes: { l: number; t: number; r: number; b: number }[]; __balls: { x: number; y: number; r: number }[]; __stop: boolean };
      w.__stop = true;
      const balls = w.__balls;
      document.getElementById("only-pendant")!.remove();
      const bs = w.__boxes;
      const m = { l: Math.min(...bs.map((b) => b.l)) - 4, t: Math.min(...bs.map((b) => b.t)) - 4, r: Math.max(...bs.map((b) => b.r)) + 4, b: Math.max(...bs.map((b) => b.b)) + 4 };
      const img = new Image();
      img.src = `data:image/png;base64,${src}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const x = c.getContext("2d")!;
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const k = c.width / innerWidth;
      let inside = 0, outside = 0;
      const at: number[][] = [];
      for (let py = 0; py < c.height; py++) {
        for (let px = 0; px < c.width; px++) {
          const i = (py * c.width + px) * 4;
          if (d[i] + d[i + 1] + d[i + 2] <= 150) continue; // (bright: brass; the ground is near black)
          const X = (px + 0.5) / k, Y = (py + 0.5) / k;
          if (balls.some((g) => Math.hypot(X - g.x, Y - g.y) <= g.r + 4)) continue; // (the glass, not the pendant)
          if (X >= m.l && X <= m.r && Y >= m.t && Y <= m.b) inside++;
          else { outside++; if (at.length < 5) at.push([Math.round(X), Math.round(Y)]); }
        }
      }
      return { inside, outside, at };
    }, png);
    out.push({ id, ...r });
  }
  // a real pendant in every box, and almost nothing bright outside: at most 5 px (a stray antialiased or smeared pixel is
  // not a covered line; the old, ungrown box leaked 39 px at the glide and 78 at the hero, so a share of the inside would
  // have let the hero's leak through)
  for (const r of out) {
    expect(r.inside, r.id).toBeGreaterThan(5000);
    expect(r.outside, `${r.id}: ${r.outside} bright px outside the box, e.g. ${JSON.stringify(r.at)}`).toBeLessThanOrEqual(5);
  }
});

// ---------- testimonials final fix: the held ball dims as the words scroll over it ----------

/** The glass ball's disc on screen: its brightest pixels (the 99th percentile of r + g + b inside 0.95 of the radius: the
 *  brass and the rim's glints, a stray spark left out) and the count of text-bright pixels there (r + g + b over 600). */
async function discLevels(page: Page, g: { x: number; y: number; r: number }) {
  const vp = page.viewportSize()!;
  const cx = g.x * vp.width, cy = g.y * vp.height, R = g.r * vp.height;
  const clip = { x: Math.max(0, Math.round(cx - R)), y: Math.max(0, Math.round(cy - R)), width: Math.round(2 * R), height: Math.round(2 * R) };
  const png = (await page.screenshot({ clip })).toString("base64");
  return page.evaluate(async ({ png, ox, oy, R }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const x = c.getContext("2d")!;
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data, k = c.width / (2 * R);
    const sums: number[] = [];
    let text = 0;
    for (let py = 0; py < c.height; py++) {
      for (let px = 0; px < c.width; px++) {
        if (Math.hypot((px + 0.5) / k - ox, (py + 0.5) / k - oy) > 0.95 * R) continue;
        const i = (py * c.width + px) * 4, s = d[i] + d[i + 1] + d[i + 2];
        sums.push(s);
        if (s > 600) text++;
      }
    }
    sums.sort((a, b) => a - b);
    return { p99: sums[Math.floor(0.99 * (sums.length - 1))], text, n: sums.length };
  }, { png, ox: cx - clip.x, oy: cy - clip.y, R });
}

test.describe("under reduced motion on a phone, the held glass", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  test("as the quotes scroll over the held ball it dims with the pendant behind them, and the words read over it", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.goto("/about");
    await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "stack");
    await ready(page, 30_000);
    await page.waitForTimeout(1500);
    const keys = await page.evaluate(() => window.__pendant!.keys);
    const key = keys.find((k) => k.id === "glass")!;
    await page.evaluate((y) => window.scrollTo(0, y), key.y);
    await page.waitForTimeout(1500);
    const held = await page.evaluate(() => ({ shot: window.__pendant!.shot, g: window.__pendant!.glass, layer: window.__pendant!.layer }));
    expect(held.shot).toBe(keys.indexOf(key));
    expect(held.g).not.toBeNull();
    const hideWords = (on: boolean) => page.evaluate((on) => {
      const id = "only-pendant";
      document.getElementById(id)?.remove();
      if (!on) return;
      const st = document.createElement("style");
      st.id = id;
      st.textContent = "body * { visibility: hidden !important; } canvas.ab-pendant { visibility: visible !important; }";
      document.head.appendChild(st);
    }, on);
    // the reference: the ball in its slot between the quotes, at full brightness, the pendant inside (only the canvas painted)
    await hideWords(true);
    const ref = await discLevels(page, held.g!);
    await hideWords(false);
    expect(ref.p99, "the ball and the brass inside it, bright").toBeGreaterThan(300);
    // Yoav's last line scrolled down onto the held ball's middle (still nearer the glass key: the shot stays held)
    const to = await page.evaluate((g) => {
      const range = document.createRange();
      const rows: DOMRect[] = [];
      const walk = document.createTreeWalker(document.querySelector("[data-pendant='quote1'] blockquote")!, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) { range.selectNodeContents(n); rows.push(...[...range.getClientRects()].filter((r) => r.height > 0)); }
      const last = rows.reduce((a, b) => (b.bottom > a.bottom ? b : a));
      return window.scrollY - (g.y * innerHeight - (last.top + last.bottom) / 2);
    }, held.g!);
    // (the hold lets go only past the middle toward the shot before: shots.ts heldIndex)
    expect(key.y - to, "a scroll back toward the shot before, short of halfway to it").toBeLessThan(0.5 * (key.y - keys[keys.indexOf(key) - 1].y));
    await page.evaluate((y) => window.scrollTo(0, y), to);
    await page.waitForTimeout(3000); // (behind the words, the dim eased in: 0.6 s time constant)
    const over = await page.evaluate(() => ({
      shot: window.__pendant!.shot, g: window.__pendant!.glass, layer: window.__pendant!.layer,
      z: getComputedStyle(document.querySelector("canvas.ab-pendant")!).zIndex,
    }));
    expect(over.shot, "still held").toBe(held.shot);
    expect(over.g, "the ball where the held shot has it").toEqual(held.g);
    expect(over.layer).toBe("back");
    expect(over.z).toBe("-1"); // (painted under the words)
    // the ball's own pixels dimmed with the pendant: no brighter than solve.ts FORCED_DIM (0.4) of the reference, plus a
    // little for the page under the glass
    await hideWords(true);
    const dimmed = await discLevels(page, over.g!);
    await hideWords(false);
    expect(dimmed.p99, `dimmed ${dimmed.p99} against ${ref.p99}`).toBeLessThanOrEqual(0.4 * ref.p99 + 30);
    // and the words over it read: bright text in the disc, well above the dimmed ball
    const shown = await discLevels(page, over.g!);
    expect(shown.text, "the line's letters over the ball").toBeGreaterThan(100);
    expect(dimmed.p99).toBeLessThan(450);
    expect(errors).toEqual([]);
  });
});

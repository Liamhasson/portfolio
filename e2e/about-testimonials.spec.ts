// e2e/about-testimonials.spec.ts: the testimonials' light on About's desktop track (plan 2026-10-17-about-testimonials-light,
// Task 2). Run with `npx playwright test -c playwright.about.config.ts` (a GPU-backed Chromium at 1440 x 900).
import { expect, test, type Page } from "@playwright/test";

/** The pendant's model, blocked (its URL carries a ?v= cache token, so a plain glob wouldn't match). */
const PENDANT_GLB = /\/pendant\.glb(\?|$)/;

function collectErrors(page: Page, ignore?: RegExp): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !(ignore && ignore.test(m.text()))) errors.push(m.text()); });
  return errors;
}

const lightLoaded = (page: Page) => page.waitForFunction(() => window.__testimonials !== undefined, null, { timeout: 20_000 });
const hook = (page: Page) => page.evaluate(() => window.__testimonials!);

/** Scrolls the track to a place: Yoav's quote where q has risen to `q`, the glass slot centred (both quotes in: q 1), past
 *  Andrada (q 0 again, the slot gone), or the closing screen. Returns the slot's rect after a settle. */
async function scrollTo(page: Page, where: { q: number } | "slot" | "past" | "end" | "start") {
  await page.evaluate((where) => {
    const sec = document.querySelector<HTMLElement>("section.ab")!, tr = sec.querySelector(".ab-track")!, clip = tr.parentElement!;
    const trR = tr.getBoundingClientRect(), clipL = clip.getBoundingClientRect().left, vw = clip.clientWidth;
    const top = sec.getBoundingClientRect().top + window.scrollY;
    const off = (sel: string) => { const r = document.querySelector(sel)!.getBoundingClientRect(); return r.left - trR.left + r.width / 2; };
    let y = 0;
    if (typeof where === "object") {
      const u = (2 / Math.PI) * Math.acos(1 - where.q); // (q = sineIn(u))
      y = top + clipL + off("[data-pendant='quote1']") - (vw * 1.05 - u * 0.4 * vw);
    } else if (where === "slot") y = top + clipL + off("[data-pendant='glass']") - vw / 2;
    else if (where === "past") y = top + clipL + off("[data-pendant='quote2']") + 0.2 * vw; // (Andrada's centre at −20%)
    else if (where === "end") y = top + sec.offsetHeight - window.innerHeight;
    window.scrollTo(0, y);
  }, where);
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const r = document.querySelector("[data-pendant='glass']")!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
  });
}

/** Two PNG screenshots of one clip, compared in the page: the count of pixels that differ by more than 2 levels. */
async function changedPixels(a: Buffer, b: Buffer, page: Page) {
  return page.evaluate(async ({ a, b }) => {
    const read = async (src: string) => {
      const img = new Image();
      img.src = `data:image/png;base64,${src}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const x = c.getContext("2d")!;
      x.drawImage(img, 0, 0);
      return { d: x.getImageData(0, 0, c.width, c.height).data };
    };
    const A = await read(a), B = await read(b);
    let n = 0;
    for (let i = 0; i < A.d.length; i += 4) {
      if (Math.max(Math.abs(A.d[i] - B.d[i]), Math.abs(A.d[i + 1] - B.d[i + 1]), Math.abs(A.d[i + 2] - B.d[i + 2])) > 2) n++;
    }
    return n;
  }, { a: a.toString("base64"), b: b.toString("base64") });
}

/** Mean colour, and the count of bright pixels (r + g + b > 150), in a clip; `ring`: only pixels between two radii from its centre. */
async function colourIn(page: Page, clip: { x: number; y: number; width: number; height: number }, ring?: { r0: number; r1: number }) {
  const png = (await page.screenshot({ clip })).toString("base64");
  return page.evaluate(async ({ png, ring }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const x = c.getContext("2d")!;
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let r = 0, g = 0, b = 0, n = 0, bright = 0;
    for (let i = 0; i < d.length; i += 4) {
      const p = i / 4, px = p % c.width, py = Math.floor(p / c.width);
      if (ring) { const dist = Math.hypot(px + 0.5 - c.width / 2, py + 0.5 - c.height / 2); if (dist < ring.r0 || dist > ring.r1) continue; }
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
      if (d[i] + d[i + 1] + d[i + 2] > 150) bright++;
    }
    return { r: r / n, g: g / n, b: b / n, bright, n };
  }, { png, ring });
}

const setLight = (page: Page, shown: boolean) =>
  page.locator("canvas.ab-light").evaluate((c, shown) => { (c as HTMLElement).style.visibility = shown ? "" : "hidden"; }, shown);

test("q scrubs with the track: 0 at the portrait, about 0.3 mid-arrival, 1 with both quotes in; no console errors", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/about");
  await lightLoaded(page);
  await page.waitForFunction(() => window.__pendant?.ready === true, null, { timeout: 20_000 });
  await expect(page.locator("canvas.ab-light")).toHaveAttribute("aria-hidden", "true");
  expect(await page.locator("canvas.ab-light").evaluate((c) => getComputedStyle(c).pointerEvents)).toBe("none");
  await scrollTo(page, "start");
  await expect.poll(async () => (await hook(page)).q).toBe(0);
  expect((await hook(page)).drawing).toBe(false);
  await scrollTo(page, { q: 0.3 });
  await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.25);
  expect((await hook(page)).q).toBeLessThan(0.35);
  expect((await hook(page)).drawing).toBe(true);
  await expect(page.locator("canvas.ab-light")).toBeVisible();
  await scrollTo(page, "slot");
  await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
  // the mood behind the words follows: 0.6 x q
  expect(Number(await page.locator(".ab-mood").evaluate((m) => getComputedStyle(m).opacity))).toBeCloseTo(0.6, 2);
  // the pendant holds the glass: one ball, the pendant's
  expect((await hook(page)).ownBall).toBe(false);
  expect(errors).toEqual([]);
});

test("the arrival wave plays once; a jump past Andrada and back doesn't play it again", async ({ page }) => {
  await page.goto("/about");
  await lightLoaded(page);
  await scrollTo(page, { q: 0.005 });
  await expect.poll(async () => (await hook(page)).q).toBeLessThan(0.02);
  expect((await hook(page)).pulse).toBe(-1);
  // a slow arrival, through 0.02
  for (const q of [0.01, 0.03, 0.08, 0.2, 0.5, 0.9]) await scrollTo(page, { q });
  await expect.poll(async () => (await hook(page)).pulse).toBeGreaterThanOrEqual(0);
  await page.waitForTimeout(2200); // (the wave's 2 s)
  await expect.poll(async () => (await hook(page)).pulse).toBe(1);
  // past the exit (q falls through 0.02) and straight back in: no new wave
  await scrollTo(page, "past");
  await expect.poll(async () => (await hook(page)).q).toBe(0);
  await scrollTo(page, "slot");
  await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
  for (let i = 0; i < 5; i++) {
    expect((await hook(page)).pulse).toBe(1);
    await page.waitForTimeout(100);
  }
});

test("at q 1 the far edges are warm and the words in the middle are untouched", async ({ page }) => {
  await page.goto("/about");
  await lightLoaded(page);
  await page.waitForFunction(() => window.__pendant?.ready === true, null, { timeout: 20_000 });
  await page.mouse.move(1430, 890);
  await scrollTo(page, "slot");
  await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
  // (the arrival wave has crossed: as it passes it tints the whole screen faintly, as the mockup's does)
  await expect.poll(async () => (await hook(page)).pulse, { timeout: 5000 }).toBe(1);
  // the left and right edges: warm light (every corner colour is full red), dark without the light
  for (const x of [0, 1432]) {
    const clip = { x, y: 600, width: 8, height: 140 }; // (below the quotes and their captions, above the resume)
    const lit = await colourIn(page, clip);
    await setLight(page, false);
    const dark = await colourIn(page, clip);
    await setLight(page, true);
    // (the band breathes in and out and its colours travel, so: clearly lit, red leading, over a near-black ground)
    expect(dark.r).toBeLessThan(40);
    expect(lit.r).toBeGreaterThan(dark.r + 30);
    expect(lit.r).toBeGreaterThanOrEqual(lit.g);
    expect(lit.r).toBeGreaterThanOrEqual(lit.b);
  }
  // the middle (160 px in from every edge, past the light's reach): the same with the light and without. (The pendant, which
  // moves on its own and holds the glass, is hidden for the comparison: the light draws no ball while the pendant owns it.)
  await page.locator("canvas.ab-pendant").evaluate((c) => { (c as HTMLElement).style.visibility = "hidden"; });
  const inset = 160, vp = page.viewportSize()!;
  const clip = { x: inset, y: inset, width: vp.width - 2 * inset, height: vp.height - 2 * inset };
  const lit = await page.screenshot({ clip });
  await setLight(page, false);
  const bare = await page.screenshot({ clip });
  await setLight(page, true);
  expect((await hook(page)).ownBall).toBe(false);
  expect(await changedPixels(lit, bare, page)).toBeLessThanOrEqual(5);
});

test("the light stays idle on the closing screen", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/about");
  await lightLoaded(page);
  await scrollTo(page, "slot");
  await expect.poll(async () => (await hook(page)).drawing).toBe(true);
  await scrollTo(page, "end");
  await expect.poll(async () => (await hook(page)).drawing).toBe(false);
  expect((await hook(page)).q).toBe(0);
  await expect(page.locator("canvas.ab-light")).toBeHidden();
  // idle: no frame runs (each one rewrites the hook; it is the same object several frames later)
  expect(await page.evaluate(() => {
    const h = window.__testimonials;
    return new Promise<boolean>((done) => { let n = 0; const f = () => (++n < 6 ? requestAnimationFrame(f) : done(h === window.__testimonials)); requestAnimationFrame(f); });
  })).toBe(true);
  expect(errors).toEqual([]);
});

test("without the pendant, the light draws its own ball in the slot", async ({ page }) => {
  const errors = collectErrors(page, /Failed to load resource/); // (the aborted file's own network line)
  let aborted = 0;
  await page.route(PENDANT_GLB, (r) => { aborted++; return r.abort(); });
  await page.goto("/about");
  await lightLoaded(page);
  await expect.poll(() => aborted, { timeout: 15_000 }).toBeGreaterThan(0);
  await expect(page.locator("canvas.ab-pendant")).toHaveCount(0, { timeout: 15_000 }); // (the pendant draws none)
  await page.mouse.move(1430, 890);
  const slot = await scrollTo(page, "slot");
  await expect.poll(async () => (await hook(page)).ownBall).toBe(true);
  await page.waitForTimeout(300);
  // bright glints at its rim (r ± 3 px), none there without the light
  const r = 0.44 * slot.w, S = Math.ceil(r + 6);
  const clip = { x: Math.round(slot.x - S), y: Math.round(slot.y - S), width: 2 * S, height: 2 * S };
  const lit = await colourIn(page, clip, { r0: r - 3, r1: r + 3 });
  await setLight(page, false);
  const bare = await colourIn(page, clip, { r0: r - 3, r1: r + 3 });
  await setLight(page, true);
  expect(lit.bright).toBeGreaterThan(lit.n * 0.15);
  expect(bare.bright).toBeLessThan(5);
  // mostly glass: the inside (within 0.6 of the radius) is dark, no colour fill
  const inner = await colourIn(page, clip, { r0: 0, r1: r * 0.6 });
  expect(inner.bright).toBeLessThan(inner.n * 0.15);
  expect(errors).toEqual([]);
});

test("handed to the pendant, the ball never leaves the slot: the light's fades out as the pendant's fades in", async ({ page }) => {
  const errors = collectErrors(page);
  // the pendant's model held back until the light's ball is showing in the slot (a reload into the testimonials)
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  await page.route(PENDANT_GLB, async (r) => { await gate; await r.continue(); });
  await page.goto("/about");
  await lightLoaded(page);
  await page.mouse.move(1430, 890);
  const slot = await scrollTo(page, "slot");
  await expect.poll(async () => (await hook(page)).ownBall).toBe(true);
  await expect.poll(async () => (await hook(page)).pulse, { timeout: 5000 }).toBe(1);
  const r = 0.44 * slot.w, S = Math.ceil(r + 6);
  const clip = { x: Math.round(slot.x - S), y: Math.round(slot.y - S), width: 2 * S, height: 2 * S };
  // the slot as the page alone shows it (both canvases hidden: the edge light doesn't reach it)
  const hideCanvases = (hidden: boolean) => page.evaluate((hidden) => {
    document.querySelectorAll<HTMLElement>("canvas.ab-light, canvas.ab-pendant").forEach((c) => { c.style.visibility = hidden ? "hidden" : ""; });
  }, hidden);
  await hideCanvases(true);
  const bare = (await page.screenshot({ clip })).toString("base64");
  await hideCanvases(false);
  /** The ball's mark: the share of the disc (to r + 3 px) that differs from the bare page by more than 24 levels (r + g + b),
   *  and the bright rim pixels (r + g + b > 150, at r ± 3 px). Either ball shows in the first: the light's in its glass and
   *  rim glints, the pendant's in its rim and the brass inside. */
  const mark = async () => {
    const png = (await page.screenshot({ clip })).toString("base64");
    return page.evaluate(async ({ png, bare, r }) => {
      const read = async (src: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${src}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        const x = c.getContext("2d")!;
        x.drawImage(img, 0, 0);
        return { d: x.getImageData(0, 0, c.width, c.height).data, w: c.width };
      };
      const A = await read(png), B = await read(bare);
      let disc = 0, changed = 0, rim = 0;
      for (let i = 0; i < A.d.length; i += 4) {
        const p = i / 4, dist = Math.hypot((p % A.w) + 0.5 - A.w / 2, Math.floor(p / A.w) + 0.5 - A.w / 2);
        if (dist > r + 3) continue;
        disc++;
        const v = A.d[i] + A.d[i + 1] + A.d[i + 2];
        if (Math.abs(v - (B.d[i] + B.d[i + 1] + B.d[i + 2])) > 24) changed++;
        if (dist >= r - 3 && v > 150) rim++;
      }
      return { changed: changed / disc, rim };
    }, { png, bare, r });
  };
  const before = await mark();
  expect(before.rim).toBeGreaterThan(100); // (the light's ball, its rim glints)
  // the pendant's fade-in slowed to 3 s, so a gap between the balls (the light's dropped at the claim) lasts long enough
  // for the samples to see it; the light follows the canvas's opacity whatever its pace
  await page.addStyleTag({ content: ".ab-pendant{transition-duration:3s !important}" });
  release();
  // sampled from the release until the pendant's canvas has fully faded in (and 300 ms on): a ball in every sample
  const samples: { t: number; own: boolean; changed: number }[] = [];
  let claimedAt = 0, fadedAt = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 30_000) {
    const own = (await hook(page)).ownBall;
    const { ready, opacity } = await page.evaluate(() => ({
      ready: window.__pendant?.ready === true,
      opacity: Number(getComputedStyle(document.querySelector("canvas.ab-pendant") ?? document.body).opacity),
    }));
    const m = await mark();
    samples.push({ t: Date.now() - t0, own, changed: m.changed });
    if (ready && !claimedAt) claimedAt = Date.now();
    if (opacity < 1) fadedAt = 0; else if (claimedAt && !fadedAt) fadedAt = Date.now();
    if (fadedAt && Date.now() - fadedAt > 300) break;
  }
  expect(claimedAt, "the pendant took the glass").toBeGreaterThan(0);
  // (the light's ball alone marks about 0.45 of the disc and the pendant's about 0.5; dropped at the claim, the slot reads empty)
  for (const s of samples) expect(s.changed, `a ball in the slot at ${s.t} ms (light's own: ${s.own})`).toBeGreaterThan(0.3);
  expect(samples.filter((s) => s.own).length, "samples during the cross-fade").toBeGreaterThan(5);
  // and the handoff is done: the pendant's ball alone
  expect((await hook(page)).ownBall).toBe(false);
  expect(errors).toEqual([]);
});

// ---------- Task 3: the pendant's ball catches the light ----------

/** With the slot centred, q held at `q` (< 1) by shifting Yoav's quote (hidden) to where the light's scrub reads that q; 1
 *  puts it back. The ball and the light then show that q, wherever the slot is. */
async function holdQ(page: Page, q: number) {
  await page.evaluate((q) => {
    const el = document.querySelector<HTMLElement>("[data-pendant='quote1']")!;
    el.style.transform = ""; el.style.visibility = "";
    if (q >= 1) return;
    const vw = document.querySelector<HTMLElement>(".ab-clip")!.clientWidth, r = el.getBoundingClientRect();
    const want = q <= 0 ? 1.2 * vw : 1.05 * vw - (2 / Math.PI) * Math.acos(1 - q) * 0.4 * vw;
    el.style.transform = `translateX(${want - (r.left + r.width / 2)}px)`;
    el.style.visibility = "hidden";
  }, q);
}

/** The pendant's ball as drawn (screen px), from its hook. */
const pendantBall = (page: Page) => page.evaluate(() => {
  const g = window.__pendant?.glass;
  return g ? { x: g.x * innerWidth, y: g.y * innerHeight, r: g.r * innerHeight } : null;
});

/** The ball's rim, round its outline (r ± 5 px: off the screen's middle a sphere in perspective shows a few percent wider
 *  across than its radius, so its outline lies a little past r at the sides), in 24 sectors round it: each sector's mean colour, and the
 *  share of warm pixels (red above 60, leading, and over green or blue by more than 30; the glass's own grey reflections
 *  are neutral). The light's own canvas is hidden first, so this is the
 *  pendant's ball alone. */
async function rimSectors(page: Page, ball: { x: number; y: number; r: number }) {
  await setLight(page, false);
  const S = Math.ceil(ball.r + 8);
  const clip = { x: Math.round(ball.x - S), y: Math.round(ball.y - S), width: 2 * S, height: 2 * S };
  const png = (await page.screenshot({ clip })).toString("base64");
  await setLight(page, true);
  return page.evaluate(async ({ png, r, ox, oy }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const x = c.getContext("2d")!;
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const N = 24, sum = Array.from({ length: N }, () => [0, 0, 0, 0]);
    let warm = 0, n = 0;
    for (let py = 0; py < c.height; py++) {
      for (let px = 0; px < c.width; px++) {
        const dx = px + 0.5 - ox, dy = py + 0.5 - oy, dist = Math.hypot(dx, dy);
        if (dist < r - 5 || dist > r + 5) continue;
        const i = (py * c.width + px) * 4, k = Math.min(N - 1, Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * N));
        sum[k][0] += d[i]; sum[k][1] += d[i + 1]; sum[k][2] += d[i + 2]; sum[k][3]++;
        n++;
        // (every edge colour has red full: pink, orange, yellow and coral all lead with red, over green or blue by far)
        if (d[i] > 60 && d[i] >= Math.max(d[i + 1], d[i + 2]) - 4 && d[i] - Math.min(d[i + 1], d[i + 2]) > 30) warm++;
      }
    }
    const sectors = sum.map(([r, g, b, m]) => ({ r: r / m, g: g / m, b: b / m }));
    return { sectors, warm: warm / n, n };
  }, { png, r: ball.r, ox: ball.x - clip.x, oy: ball.y - clip.y });
}

/** The rim sampled `n` times, 250 ms apart: its arcs come and go (for a second or two at a time all of it can rest at the
 *  arcs' floor, a quarter of their brightness) and its colours travel, so one look can catch a quiet moment. */
async function rimSamples(page: Page, ball: { x: number; y: number; r: number }, n = 12) {
  const out: Awaited<ReturnType<typeof rimSectors>>[] = [];
  for (let i = 0; i < n; i++) {
    out.push(await rimSectors(page, ball));
    await page.waitForTimeout(250);
  }
  return out;
}

test.describe("the pendant's ball catches the light", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/about");
    await lightLoaded(page);
    await page.waitForFunction(() => window.__pendant?.ready === true, null, { timeout: 20_000 });
    await page.mouse.move(1430, 890);
  });

  test("at q 1 its rim glints warm, in arcs: the colour and the brightness differ round the rim", async ({ page }) => {
    const errors = collectErrors(page);
    await scrollTo(page, "slot");
    await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
    await page.waitForTimeout(2500); // (the pendant's follow settles)
    expect((await hook(page)).ownBall).toBe(false); // (the pendant draws the ball)
    const ball = (await pendantBall(page))!;
    expect(ball).not.toBeNull();
    const samples = await rimSamples(page, ball);
    const best = samples.reduce((a, b) => (b.warm > a.warm ? b : a));
    expect(best.warm, `warm rim pixels (${samples.map((x) => x.warm.toFixed(3)).join(", ")})`).toBeGreaterThan(0.15);
    for (const rim of samples.filter((x) => x.warm > 0.05)) {
      const lum = rim.sectors.map((s) => s.r + s.g + s.b);
      expect(Math.max(...lum)).toBeGreaterThan(2 * Math.min(...lum)); // (arcs, not an even ring)
    }
    // the edges' colours, not one tint: the green share differs round the rim (orange and yellow against pink and red)
    const green = best.sectors.map((s) => s.g / Math.max(1, s.r + s.g + s.b));
    expect(Math.max(...green) - Math.min(...green)).toBeGreaterThan(0.05);
    expect(errors).toEqual([]);
  });

  test("at q 0 its rim has no warm hue: the ball as it was before the light", async ({ page }) => {
    await scrollTo(page, "slot");
    await holdQ(page, 0);
    await page.waitForTimeout(400);
    await expect.poll(async () => (await hook(page)).q).toBe(0);
    await page.waitForTimeout(2500);
    const ball = (await pendantBall(page))!;
    expect(ball).not.toBeNull();
    const dark = await rimSamples(page, ball);
    expect(Math.max(...dark.map((x) => x.warm)), `warm rim pixels at q 0: ${dark.map((x) => x.warm.toFixed(3))}`).toBeLessThan(0.01);
    // and the light's colour comes back with q: at 1 the same rim is warm
    await holdQ(page, 1);
    await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
    await page.waitForTimeout(300);
    const lit = await rimSamples(page, (await pendantBall(page))!);
    expect(Math.max(...lit.map((x) => x.warm)), `warm rim pixels at q 1: ${lit.map((x) => x.warm.toFixed(3))}`).toBeGreaterThan(0.15);
  });

  test("the ball is there whenever the slot is on screen, full size, far from the glass shot too", async ({ page }) => {
    const errors = collectErrors(page);
    const slot = await scrollTo(page, "slot");
    const full = 0.44 * slot.w;
    // the slot near either edge of the screen, the shot far from the glass key (0.4 of a screen of travel away)
    for (const at of [0.9, 0.1]) {
      await page.evaluate((at) => window.scrollTo(0, window.scrollY + (0.5 - at) * innerWidth), at);
      await page.waitForTimeout(2500);
      const ball = await pendantBall(page);
      expect(ball, `a ball with the slot at ${at} of the width`).not.toBeNull();
      expect(Math.abs(ball!.r - full)).toBeLessThan(2); // (full size: not grown in with the shot)
      expect(Math.abs(ball!.x - at * page.viewportSize()!.width)).toBeLessThan(2);
      // drawn, and catching the light (q is 1 there)
      const rim = await rimSamples(page, ball!);
      expect(Math.max(...rim.map((x) => x.warm)), `warm rim pixels with the slot at ${at}: ${rim.map((x) => x.warm.toFixed(3))}`).toBeGreaterThan(0.1);
      await page.evaluate((at) => window.scrollTo(0, window.scrollY - (0.5 - at) * innerWidth), at);
    }
    // and none once the slot is more than its width off the screen
    await page.evaluate((w) => window.scrollTo(0, window.scrollY - 0.5 * innerWidth - 1.2 * w), slot.w);
    await page.waitForTimeout(600);
    expect(await pendantBall(page)).toBeNull();
    expect(errors).toEqual([]);
  });
});

// ---------- Task 3, fix round 1: one outline for both balls, wherever the slot is ----------

/** The slot as the page shows it now (screen px). */
const slotNow = (page: Page) => page.evaluate(() => {
  const r = document.querySelector("[data-pendant='glass']")!.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
});

/** The drawn ball's outline, from pixels: with only `canvas` painted (everything else hidden, the page `ground`), scanned
 *  along the slot's centre row from the side facing the screen's middle (the far side can sit in the edge light, or off the
 *  screen) and down its centre column from above (the pendant can pass below the ball). `edge` says which pixels are the
 *  ball's: the first one met is its outline. Returns the half-width and half-height from the slot's centre (px). */
async function drawnOutline(page: Page, canvas: string, ground: string, edge: "dark" | "bright", slot: { x: number; y: number; w: number }) {
  await page.addStyleTag({ content: `html, body { background: ${ground} !important; } body * { visibility: hidden !important; } ${canvas} { visibility: visible !important; }` });
  await page.waitForTimeout(150);
  const vp = page.viewportSize()!, R = 0.44 * slot.w, S = Math.ceil(1.4 * R);
  const toMiddle = slot.x < vp.width / 2 ? 1 : -1; // (+1: the middle is to the right, scan from the right)
  const clip = { x: Math.max(0, Math.round(slot.x - S)), y: Math.max(0, Math.round(slot.y - S)), width: 0, height: 0 };
  clip.width = Math.min(vp.width, Math.round(slot.x + S)) - clip.x;
  clip.height = Math.round(slot.y) + 1 - clip.y;
  const png = (await page.screenshot({ clip })).toString("base64");
  return page.evaluate(async ({ png, clip, slot, toMiddle, edge }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const x = c.getContext("2d")!;
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    // dark: the glass's rim over a white ground (its edge reflects nearly everything); bright: the light's rim glints over black
    const hit = (px: number, py: number) => {
      const i = (py * c.width + px) * 4;
      return edge === "dark" ? Math.min(d[i], d[i + 1], d[i + 2]) < 200 : d[i] > 60;
    };
    const row = Math.round(slot.y - clip.y - 0.5), col = Math.round(slot.x - clip.x - 0.5);
    let side = NaN, top = NaN;
    if (toMiddle > 0) { for (let px = c.width - 1; px >= 0; px--) if (hit(px, row)) { side = clip.x + px + 0.5 - slot.x; break; } }
    else { for (let px = 0; px < c.width; px++) if (hit(px, row)) { side = slot.x - (clip.x + px + 0.5); break; } }
    for (let py = 0; py < c.height; py++) if (hit(col, py)) { top = slot.y - (clip.y + py + 0.5); break; }
    return { halfW: side, halfH: top };
  }, { png, clip, slot, toMiddle, edge });
}

test.describe("both balls keep the slot's size across the screen", () => {
  for (const at of [0.1, 0.9]) {
    test(`the pendant's ball, with the slot at ${at} of the width: drawn 0.44 x the slot across and down, within 4%`, async ({ page }) => {
      await page.goto("/about");
      await lightLoaded(page);
      await page.waitForFunction(() => window.__pendant?.ready === true, null, { timeout: 20_000 });
      await page.mouse.move(1430, 890);
      await scrollTo(page, "slot");
      await page.evaluate((at) => window.scrollTo(0, window.scrollY + (0.5 - at) * innerWidth), at);
      await page.waitForTimeout(1500);
      expect(await pendantBall(page)).not.toBeNull();
      const slot = await slotNow(page);
      const o = await drawnOutline(page, "canvas.ab-pendant", "#fff", "dark", slot);
      const R = 0.44 * slot.w;
      expect(Math.abs(o.halfW / R - 1), `half-width ${o.halfW} against ${R}`).toBeLessThan(0.04);
      expect(Math.abs(o.halfH / R - 1), `half-height ${o.halfH} against ${R}`).toBeLessThan(0.04);
    });

    test(`the light's own ball (no pendant), with the slot at ${at} of the width: the same outline, within 4%`, async ({ page }) => {
      await page.route(PENDANT_GLB, (r) => r.abort());
      await page.goto("/about");
      await lightLoaded(page);
      await expect(page.locator("canvas.ab-pendant")).toHaveCount(0, { timeout: 15_000 });
      await scrollTo(page, "slot");
      await page.evaluate((at) => window.scrollTo(0, window.scrollY + (0.5 - at) * innerWidth), at);
      await page.waitForTimeout(600);
      await expect.poll(async () => (await hook(page)).ownBall).toBe(true);
      const slot = await slotNow(page);
      const o = await drawnOutline(page, "canvas.ab-light", "#000", "bright", slot);
      const R = 0.44 * slot.w;
      expect(Math.abs(o.halfW / R - 1), `half-width ${o.halfW} against ${R}`).toBeLessThan(0.04);
      expect(Math.abs(o.halfH / R - 1), `half-height ${o.halfH} against ${R}`).toBeLessThan(0.04);
    });
  }
});

// ---------- Task 4: the glass edges ----------

/** The page under the lens alone, made still: the light, the mood and the pendant hidden (each moves or tints on its own). */
const stillPage = (page: Page) => page.evaluate(() => {
  document.querySelectorAll<HTMLElement>("canvas.ab-light, canvas.ab-pendant, .ab-mood").forEach((el) => { el.style.visibility = "hidden"; });
});

/** Yoav's quote moved so its lines start `left` px from the screen's left edge, straddling the lens band. q stays 1 (with
 *  the slot centred, Yoav's centre is well left of 65%); Andrada hidden in place. */
async function quoteAtLeftEdge(page: Page, left: number) {
  await page.evaluate((left) => {
    const q1 = document.querySelector<HTMLElement>("[data-pendant='quote1']")!;
    q1.style.transform = "";
    const r = q1.querySelector("blockquote")!.getBoundingClientRect();
    q1.style.transform = `translateX(${left - r.left}px)`;
    document.querySelector<HTMLElement>("[data-pendant='quote2']")!.style.visibility = "hidden";
  }, left);
}

/** q 0 with the screen otherwise unchanged: Andrada (hidden) moved past −5% of the width (q's falling half done), or back. */
const andradaPast = (page: Page, past: boolean) => page.evaluate((past) => {
  const q2 = document.querySelector<HTMLElement>("[data-pendant='quote2']")!;
  q2.style.transform = "";
  if (!past) return;
  const r = q2.getBoundingClientRect(), vw = document.querySelector<HTMLElement>(".ab-clip")!.clientWidth;
  q2.style.transform = `translateX(${-0.2 * vw - (r.left + r.width / 2)}px)`;
}, past);

/** The text's pixels (r + g + b > 150) in a clip: their count and mean x (clip px). */
async function inkIn(page: Page, clip: { x: number; y: number; width: number; height: number }) {
  const png = (await page.screenshot({ clip })).toString("base64");
  return page.evaluate(async (png) => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const x = c.getContext("2d")!;
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let n = 0, sx = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 150) { n++; sx += (i / 4) % c.width; }
    return { n, meanX: n ? sx / n : NaN };
  }, png);
}

test.describe("the glass edges", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/about");
    await lightLoaded(page);
    await page.waitForFunction(() => window.__pendant?.ready === true, null, { timeout: 20_000 });
    await page.mouse.move(1430, 890);
  });

  test("the lens: Chromium, fixed over the frame at 3, never taking the pointer, shown only while q > 0.01", async ({ page }) => {
    const errors = collectErrors(page);
    const lens = page.locator(".ab-lens");
    await expect(lens).toHaveCount(1);
    await expect(lens).toHaveAttribute("aria-hidden", "true");
    expect(await lens.evaluate((el) => {
      const s = getComputedStyle(el);
      return { pe: s.pointerEvents, z: s.zIndex, pos: s.position, bf: s.backdropFilter };
    })).toEqual({ pe: "none", z: "3", pos: "fixed", bf: 'url("#ab-edge-lens")' });
    // the filter as the mockup's: the region the lens's own box
    expect(await page.locator("#ab-edge-lens").evaluate((f) => [f.getAttribute("filterUnits"), f.getAttribute("x"), f.getAttribute("y"), f.getAttribute("width"), f.getAttribute("height")]))
      .toEqual(["objectBoundingBox", "0", "0", "1", "1"]);
    await scrollTo(page, "start");
    await expect(lens).toBeHidden();
    await scrollTo(page, { q: 0.005 });
    await expect.poll(async () => (await hook(page)).q).toBeLessThan(0.01);
    await expect(lens).toBeHidden();
    await scrollTo(page, { q: 0.5 });
    await expect(lens).toBeVisible();
    await expect.poll(async () => (await hook(page)).lens).toBeGreaterThan(0.5 * 52 * 0.8 - 0.1);
    expect((await hook(page)).lens).toBeLessThan(0.5 * 52 * 1.2 + 0.1);
    await scrollTo(page, "slot");
    await expect.poll(async () => (await hook(page)).lens).toBeGreaterThan(52 * 0.8 - 0.1);
    // the pointer passes through it: what's under the screen's middle is the page, not the lens
    expect(await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest(".ab-lens") ?? null)).toBeNull();
    await scrollTo(page, "end");
    await expect(lens).toBeHidden();
    expect((await hook(page)).lens).toBe(0);
    expect(errors).toEqual([]);
  });

  test("at q 1 the words at the left edge move toward the rim; the middle of the screen and the resume are pixel-identical", async ({ page }) => {
    await scrollTo(page, "slot");
    await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
    await stillPage(page);
    await quoteAtLeftEdge(page, 24);
    await page.waitForTimeout(200);
    await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
    await expect(page.locator(".ab-lens")).toBeVisible();
    const vp = page.viewportSize()!;
    const qr = await page.locator("[data-pendant='quote1'] blockquote").boundingBox();
    // the band (56 px at 1440 x 900) and a little past it, over the quote's lines
    const band = { x: 0, y: Math.round(qr!.y), width: 80, height: Math.round(qr!.height) };
    const inset = 90; // (past the band and the 26 px pull)
    const middle = { x: inset, y: inset, width: vp.width - 2 * inset, height: vp.height - 2 * inset };
    const resume = await page.locator(".ab-resume").boundingBox();
    const resumeClip = { x: Math.floor(resume!.x) - 4, y: Math.floor(resume!.y) - 4, width: Math.ceil(resume!.width) + 8, height: Math.ceil(resume!.height) + 8 };
    const bent = await inkIn(page, band);
    const midBent = await page.screenshot({ clip: middle });
    const resumeBent = await page.screenshot({ clip: resumeClip });
    // q 0: the same screen, the lens gone
    await andradaPast(page, true);
    await expect.poll(async () => (await hook(page)).q).toBe(0);
    await expect(page.locator(".ab-lens")).toBeHidden();
    const flat = await inkIn(page, band);
    const midFlat = await page.screenshot({ clip: middle });
    const resumeFlat = await page.screenshot({ clip: resumeClip });
    expect(flat.n, "the quote's letters straddle the band").toBeGreaterThan(200);
    // magnified toward the rim: the ink moves left (outward)
    expect(bent.meanX, `mean ink x: bent ${bent.meanX.toFixed(1)}, flat ${flat.meanX.toFixed(1)}`).toBeLessThan(flat.meanX - 2);
    expect(await changedPixels(midBent, midFlat, page)).toBe(0);
    expect(await changedPixels(resumeBent, resumeFlat, page)).toBe(0);
    // and back at q 1: bent again
    await andradaPast(page, false);
    await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
    await expect(page.locator(".ab-lens")).toBeVisible();
  });

  test("after a resize mid-testimonials the lens's map is the new screen's size", async ({ page }) => {
    const errors = collectErrors(page);
    await scrollTo(page, "slot");
    await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
    const img = page.locator("#ab-edge-lens feImage");
    expect(await img.evaluate((el) => [el.getAttribute("width"), el.getAttribute("height")])).toEqual(["1440", "900"]);
    const before = await img.evaluate((el) => el.getAttribute("href"));
    expect(before).toMatch(/^data:image\/png;base64,/);
    await page.setViewportSize({ width: 1200, height: 760 });
    await page.waitForTimeout(500); // (the 150 ms debounce, then the rebuild)
    expect(await img.evaluate((el) => [el.getAttribute("width"), el.getAttribute("height")])).toEqual(["1200", "760"]);
    const after = await img.evaluate((el) => el.getAttribute("href"));
    expect(after).not.toBe(before);
    // the rebuilt map is half the new screen
    expect(await page.evaluate(async (src) => { const i = new Image(); i.src = src!; await i.decode(); return [i.width, i.height]; }, after)).toEqual([600, 380]);
    expect(errors).toEqual([]);
  });
});

// e2e/about-testimonials.spec.ts: the testimonials' light on About's desktop track (plan 2026-10-17-about-testimonials-light,
// Task 2), and stacked on phones (Task 5). Run with `npx playwright test -c playwright.about.config.ts` (a GPU-backed Chromium at 1440 x 900).
import { expect, test, type Page } from "@playwright/test";
import { lensBand, lensDepth, lensMap, lensStrips } from "../src/app/about/edge-lens";
import { testimonialsQ } from "../src/app/about/testimonials-q";

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

/** Two PNG screenshots of one clip, compared in the page (a pixel differs when a channel is more than 2 levels apart): the
 *  count that differ; the busiest row and column (clip px, −1 where nothing differs) with their counts, the most any pixel
 *  on them differs (levels) and how many differ off them; and on the lines given (`at`, clip px: the strips' origins) the
 *  most any pixel differs. */
async function diffLines(a: Buffer, b: Buffer, page: Page, at: { row: number; col: number }) {
  return page.evaluate(async ({ a, b, at }) => {
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
    const A = await read(a), B = await read(b);
    const delta = new Uint8Array(A.d.length / 4);
    const rows = new Map<number, number>(), cols = new Map<number, number>();
    let n = 0, maxOnOrigin = 0;
    for (let i = 0; i < A.d.length; i += 4) {
      const p = i / 4, x = p % A.w, y = Math.floor(p / A.w);
      const dl = (delta[p] = Math.max(Math.abs(A.d[i] - B.d[i]), Math.abs(A.d[i + 1] - B.d[i + 1]), Math.abs(A.d[i + 2] - B.d[i + 2])));
      if (y === at.row || x === at.col) maxOnOrigin = Math.max(maxOnOrigin, dl);
      if (dl <= 2) continue;
      n++;
      rows.set(y, (rows.get(y) ?? 0) + 1); cols.set(x, (cols.get(x) ?? 0) + 1);
    }
    const busiest = (m: Map<number, number>) => [...m.entries()].reduce((best, e) => (e[1] > best[1] ? e : best), [-1, 0]);
    const [row, rowN] = busiest(rows), [col, colN] = busiest(cols);
    let maxOnLine = 0, offLine = 0;
    for (let p = 0; p < delta.length; p++) {
      const x = p % A.w, y = Math.floor(p / A.w);
      if (y === row || x === col) maxOnLine = Math.max(maxOnLine, delta[p]);
      else if (delta[p] > 2) offLine++;
    }
    return { n, row, rowN, col, colN, maxOnLine, offLine, maxOnOrigin };
  }, { a: a.toString("base64"), b: b.toString("base64"), at });
}

/** Mean colour, and the count of bright pixels (r + g + b > 150), in a clip; `ring`: only pixels between two radii from its centre. */
async function colourIn(page: Page, clip: { x: number; y: number; width: number; height: number }, ring?: { r0: number; r1: number }) {
  // (one pixel per CSS px, so the ring's radii hold on a phone's 3x screen too)
  const png = (await page.screenshot({ clip, scale: "css" })).toString("base64");
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
async function drawnOutline(page: Page, canvas: string, ground: string, edge: "dark" | "bright", slot: { x: number; y: number; w: number }, from?: "left" | "right") {
  await page.addStyleTag({ content: `html, body { background: ${ground} !important; } body * { visibility: hidden !important; } ${canvas} { visibility: visible !important; }` });
  await page.waitForTimeout(150);
  const vp = page.viewportSize()!, R = 0.44 * slot.w, S = Math.ceil(1.4 * R);
  // (+1: scan from the right. By default from the screen's middle; `from` when the pendant is beside the ball on one side,
  // as it leaves the ball for the glide (since the motion pass's spacing, 2026-10-18, still close by with the slot at 0.1):
  // then from the other side, so the side scanned is the ball's own rim, not the pendant)
  const toMiddle = from ? (from === "right" ? 1 : -1) : slot.x < vp.width / 2 ? 1 : -1;
  const clip = { x: Math.max(0, Math.round(slot.x - S)), y: Math.max(0, Math.round(slot.y - S)), width: 0, height: 0 };
  clip.width = Math.min(vp.width, Math.round(slot.x + S)) - clip.x;
  clip.height = Math.round(slot.y) + 1 - clip.y;
  const png = (await page.screenshot({ clip, scale: "css" })).toString("base64"); // (one pixel per CSS px, whatever the screen)
  return page.evaluate(async ({ png, clip, slot, toMiddle, edge }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const x = c.getContext("2d")!;
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    // dark: the glass's rim over a white ground (its edge reflects nearly everything). bright: the light's ball over black,
    // found as a step up from the pixel scanned before it (more than 24 levels in any channel): the rim's first pixel is dim
    // (red about 60, green and blue moving with the glints), and the edge light's falloff can lift the ground near a screen
    // edge, but only gradually.
    const lum = (px: number, py: number) => { const i = (py * c.width + px) * 4; return Math.max(d[i], d[i + 1], d[i + 2]); };
    let prev = -1;
    const hit = (px: number, py: number) => {
      if (edge === "dark") { const i = (py * c.width + px) * 4; return Math.min(d[i], d[i + 1], d[i + 2]) < 200; }
      const v = lum(px, py), step = prev >= 0 && v - prev > 24;
      prev = v;
      return step;
    };
    const row = Math.round(slot.y - clip.y - 0.5), col = Math.round(slot.x - clip.x - 0.5);
    let side = NaN, top = NaN;
    if (toMiddle > 0) { for (let px = c.width - 1; px >= 0; px--) if (hit(px, row)) { side = clip.x + px + 0.5 - slot.x; break; } }
    else { for (let px = 0; px < c.width; px++) if (hit(px, row)) { side = slot.x - (clip.x + px + 0.5); break; } }
    prev = -1;
    for (let py = 0; py < c.height; py++) if (hit(col, py)) { top = slot.y - (clip.y + py + 0.5); break; }
    return { halfW: side, halfH: top };
  }, { png, clip, slot, toMiddle, edge });
}

/** The pendant's ball with the slot at `at` of the screen's width: the slot and the drawn outline. */
async function pendantOutlineAt(page: Page, at: number) {
  await page.goto("/about");
  await lightLoaded(page);
  await page.waitForFunction(() => window.__pendant?.ready === true, null, { timeout: 20_000 });
  await page.mouse.move(1430, 890);
  await scrollTo(page, "slot");
  await page.evaluate((at) => window.scrollTo(0, window.scrollY + (0.5 - at) * innerWidth), at);
  await page.waitForTimeout(1500);
  expect(await pendantBall(page)).not.toBeNull();
  const slot = await slotNow(page);
  // (scanned from the side away from the pendant itself: from the left when it is right of the ball's middle. Its box is
  // the canvas's own px, the slot the viewport's: the canvas's left edge added, as coveredNow does)
  const mid = await page.evaluate(() => {
    const b = window.__pendant!.box, c = document.querySelector("canvas.ab-pendant")!.getBoundingClientRect();
    return c.left + (b.l + b.r) / 2;
  });
  const from: "left" | "right" = mid > slot.x ? "left" : "right";
  return { slot, from, o: await drawnOutline(page, "canvas.ab-pendant", "#fff", "dark", slot, from) };
}

/** The light's own ball (the pendant's model blocked) with the slot at `at` of the screen's width: the slot and the drawn
 *  outline. */
async function lightOutlineAt(page: Page, at: number, from?: "left" | "right") {
  await page.route(PENDANT_GLB, (r) => r.abort());
  await page.goto("/about");
  await lightLoaded(page);
  await expect(page.locator("canvas.ab-pendant")).toHaveCount(0, { timeout: 15_000 });
  await scrollTo(page, "slot");
  await page.evaluate((at) => window.scrollTo(0, window.scrollY + (0.5 - at) * innerWidth), at);
  await page.waitForTimeout(600);
  await expect.poll(async () => (await hook(page)).ownBall).toBe(true);
  const slot = await slotNow(page);
  return { slot, o: await drawnOutline(page, "canvas.ab-light", "#000", "bright", slot, from) };
}

test.describe("both balls keep the slot's size across the screen", () => {
  for (const at of [0.1, 0.9]) {
    test(`the pendant's ball, with the slot at ${at} of the width: drawn 0.44 x the slot across and down, within 4%`, async ({ page }) => {
      const { slot, o } = await pendantOutlineAt(page, at);
      const R = 0.44 * slot.w;
      expect(Math.abs(o.halfW / R - 1), `half-width ${o.halfW} against ${R}`).toBeLessThan(0.04);
      expect(Math.abs(o.halfH / R - 1), `half-height ${o.halfH} against ${R}`).toBeLessThan(0.04);
    });

    test(`the light's own ball (no pendant), with the slot at ${at} of the width: the same outline, within 4%`, async ({ page }) => {
      const { slot, o } = await lightOutlineAt(page, at);
      const R = 0.44 * slot.w;
      expect(Math.abs(o.halfW / R - 1), `half-width ${o.halfW} against ${R}`).toBeLessThan(0.04);
      expect(Math.abs(o.halfH / R - 1), `half-height ${o.halfH} against ${R}`).toBeLessThan(0.04);
    });
  }

  // (each within 4% of the nominal size could still leave the two up to 8 px apart, which would show as two outlines while
  // they cross-fade: so the two, measured at the same slot position, against each other. Measured 10-17: identical at 0.1
  // and 0.5; at 0.9 the pendant's is about 2 px narrower and 2 px taller (108.3 x 107.5 against 110.3 x 105.5), on every
  // run. Not jitter: both take their outline from field.ts ballCone, but the pendant's cone is set about its camera's view
  // axis, which the shot's lens shift moves off the screen's middle, while the light's eye sits over the middle; so at 0.9
  // the two see the slot a little differently off-axis, and the ellipse each draws (its half-axes multiplying to r²) leans
  // a little differently. A change here past 3 px is a real change to one ball's placement.)
  for (const at of [0.1, 0.5, 0.9]) {
    test(`with the slot at ${at} of the width, the pendant's ball and the light's own draw the same outline, within 3 px`, async ({ page, context }) => {
      const bare = await context.newPage();
      try {
        const p = await pendantOutlineAt(page, at);
        const l = await lightOutlineAt(bare, at, p.from); // (the same side scanned)
        // (the same place: the two pages scrolled alike)
        expect(Math.abs(p.slot.x - l.slot.x), `slot ${p.slot.x} against ${l.slot.x}`).toBeLessThan(0.5);
        expect(Math.abs(p.slot.y - l.slot.y)).toBeLessThan(0.5);
        expect(p.slot.w).toBeCloseTo(l.slot.w, 1);
        const msg = `pendant ${p.o.halfW} x ${p.o.halfH}, light ${l.o.halfW} x ${l.o.halfH} (nominal ${0.44 * p.slot.w})`;
        expect(Math.abs(p.o.halfW - l.o.halfW), msg).toBeLessThanOrEqual(3);
        expect(Math.abs(p.o.halfH - l.o.halfH), msg).toBeLessThanOrEqual(3);
      } finally {
        await bare.close();
      }
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

/** The lens's scale held at the full 52 (the breath eases it), on the strips and any reference alike. */
const holdScale = (page: Page) => page.evaluate(() => {
  document.querySelectorAll(".ab-lens-defs feDisplacementMap").forEach((d) => {
    const set = d.setAttribute.bind(d);
    d.setAttribute = (k: string, v: string) => (k === "scale" ? undefined : set(k, v));
    set("scale", "52");
  });
}).then(() => page.waitForTimeout(200));

/** The reference: one full-screen fixed layer whose map is lensMap's own, at the size the page builds it (half the screen,
 *  rounded up, at exactly twice its size): no slices in it, so a slice put in the wrong place can't hide in both. The
 *  page's strips are hidden. */
async function addReferenceLens(page: Page, W: number, H: number) {
  const w = Math.ceil(W / 2), h = Math.ceil(H / 2);
  const rgba = Buffer.from(lensMap(w, h, lensBand(W, H) * 0.5).buffer).toString("base64");
  await page.evaluate(({ rgba, w, h }) => {
    const bin = atob(rgba), data = new Uint8ClampedArray(bin.length);
    for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d")!.putImageData(new ImageData(data, w, h), 0, 0);
    const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.style.position = "absolute";
    svg.innerHTML = `<filter id="t4-ref" x="0" y="0" width="1" height="1" filterUnits="objectBoundingBox" color-interpolation-filters="sRGB"><feImage href="${c.toDataURL()}" result="map" x="0" y="0" width="${2 * w}" height="${2 * h}" preserveAspectRatio="none"/><feDisplacementMap in="SourceGraphic" in2="map" scale="52" xChannelSelector="R" yChannelSelector="G"/></filter>`;
    const ref = document.createElement("div");
    ref.id = "t4-ref-layer";
    ref.style.cssText = "position:fixed;inset:0;z-index:3;pointer-events:none;backdrop-filter:url(#t4-ref)";
    const lens = document.querySelector(".ab-lens")!;
    lens.before(svg, ref);
    document.querySelectorAll<HTMLElement>(".ab-lens-strip").forEach((s) => { s.style.display = "none"; });
  }, { rgba, w, h });
}

/**
 * Strips against the reference at an odd size. The right and bottom strips start on odd pixels, so their slices sit a pixel
 * off their own origin (at the same place on the screen), and the filter samples the map a hair differently: where the bent
 * text's edge sits on a rounding boundary, one row or column of pixels comes out a few levels apart (measured 10-17: up to 9
 * levels, along one row 69 px into the bottom strip, or a few pixels down one column; never on a strip's origin). So: the
 * strips' origins match to 2 levels; whatever differs is one line, at most a few levels and a few dozen pixels; off it, at
 * most two. (A slice misplaced by one map pixel differs in hundreds of pixels per corner, all over its band and on its
 * origin. Negative control, run once (Task 6): the right strip's slice moved by +1 map px gives about 2000 differing pixels
 * in its corner, about 1900 of them off the busiest line, and 7 levels on the origin column, at both sizes; every check
 * here fails on it.)
 */
function expectOddSeam(d: Awaited<ReturnType<typeof diffLines>>, where: string) {
  expect(d.maxOnOrigin, where).toBeLessThanOrEqual(2);
  expect(d.maxOnLine, where).toBeLessThanOrEqual(12);
  expect(Math.max(d.rowN, d.colN), where).toBeLessThanOrEqual(60);
  expect(d.offLine, where).toBeLessThanOrEqual(2);
}

test.describe("the glass edges", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/about");
    await lightLoaded(page);
    await page.waitForFunction(() => window.__pendant?.ready === true, null, { timeout: 20_000 });
    await page.mouse.move(1430, 890);
  });

  test("the lens: Chromium, on the track the two side strips at 3, each the full height, never taking the pointer, shown only while q > 0.01", async ({ page }) => {
    const errors = collectErrors(page);
    const lens = page.locator(".ab-lens");
    const top = page.locator(".ab-lens-strip[data-edge='right']"); // (the track's strips show and hide together)
    await expect(lens).toHaveCount(1);
    await expect(lens).toHaveAttribute("aria-hidden", "true");
    await scrollTo(page, "slot");
    await expect(top).toBeVisible();
    // the track's top and bottom strips never show (Liam, 2026-10-17: the sides only, 120 Hz beside the pendant)
    await expect(page.locator(".ab-lens-strip[data-edge='top']")).toBeHidden();
    await expect(page.locator(".ab-lens-strip[data-edge='bottom']")).toBeHidden();
    // each side strip: fixed, at 3, no pointer, its own filter; 90 px wide at 1440 x 900, the screen's full height
    expect(await page.locator(".ab-lens-strip").evaluateAll((els) => els.filter((el) => getComputedStyle(el).display !== "none").map((el) => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return { edge: (el as HTMLElement).dataset.edge, pe: s.pointerEvents, z: s.zIndex, pos: s.position, bf: s.backdropFilter, box: [r.x, r.y, r.width, r.height] };
    }))).toEqual([
      { edge: "right", pe: "none", z: "3", pos: "fixed", bf: 'url("#ab-edge-lens-right")', box: [1350, 0, 90, 900] },
      { edge: "left", pe: "none", z: "3", pos: "fixed", bf: 'url("#ab-edge-lens-left")', box: [0, 0, 90, 900] },
    ]);
    // the filters as the mockup's: each region its strip's own box
    expect(await page.locator(".ab-lens-defs filter").evaluateAll((fs) => fs.map((f) => ["filterUnits", "x", "y", "width", "height"].map((a) => f.getAttribute(a)))))
      .toEqual(Array(4).fill(["objectBoundingBox", "0", "0", "1", "1"]));
    await scrollTo(page, "start");
    await expect(top).toBeHidden();
    await scrollTo(page, { q: 0.005 });
    await expect.poll(async () => (await hook(page)).q).toBeLessThan(0.01);
    await expect(top).toBeHidden();
    await scrollTo(page, { q: 0.5 });
    await expect(top).toBeVisible();
    await expect.poll(async () => (await hook(page)).lens).toBeGreaterThan(0.5 * 52 * 0.8 - 0.1);
    expect((await hook(page)).lens).toBeLessThanOrEqual(0.5 * 52 + 0.1);
    await scrollTo(page, "slot");
    await expect.poll(async () => (await hook(page)).lens).toBeGreaterThan(52 * 0.8 - 0.1);
    expect((await hook(page)).lens).toBeLessThanOrEqual(52);
    // the pointer passes through them: what's under a strip is the page, not the lens
    expect(await page.evaluate(() => [[innerWidth / 2, innerHeight / 2], [20, innerHeight / 2], [innerWidth / 2, 20], [innerWidth - 20, innerHeight - 20]]
      .map(([x, y]) => document.elementFromPoint(x, y)?.closest(".ab-lens") ?? null))).toEqual([null, null, null, null]);
    await scrollTo(page, "end");
    await expect(top).toBeHidden();
    expect((await hook(page)).lens).toBe(0);
    expect(errors).toEqual([]);
  });

  for (const [W, H] of [[1440, 900], [1441, 901]] as const) {
    test(`${W} x ${H}, the track: the side strips bend their columns as one full-screen lens with the map from lensMap would; the top and bottom bands between them stay as they are`, async ({ page }) => {
      if (W !== 1440 || H !== 900) {
        await page.setViewportSize({ width: W, height: H });
        await page.waitForTimeout(500); // (the strips rebuilt for the new size)
      }
      await scrollTo(page, "slot");
      await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
      await stillPage(page);
      // Yoav's lines across the top-left corner: through the left strip's top end and on past it (x 90) into the top band
      await page.evaluate(() => {
        const q1 = document.querySelector<HTMLElement>("[data-pendant='quote1']")!;
        const r = q1.querySelector("blockquote")!.getBoundingClientRect();
        q1.style.transform = `translate(${10 - r.left}px, ${30 - r.top}px)`;
        document.querySelector<HTMLElement>("[data-pendant='quote2']")!.style.visibility = "hidden";
      });
      await holdScale(page);
      await expect(page.locator(".ab-lens-strip[data-edge='left']")).toBeVisible();
      expect(await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.clientHeight])).toEqual([W, H]);
      const d = lensDepth(lensBand(W, H));
      // each corner in two parts: its side strip's columns (the strip's end), and the band beside them
      const SH = 220, SW = 260;
      const parts = [{ x: 0, y: 0 }, { x: W - SW, y: 0 }, { x: 0, y: H - SH }, { x: W - SW, y: H - SH }].map((c) => {
        const left = c.x === 0;
        return {
          side: { x: left ? 0 : W - d, y: c.y, width: d, height: SH },
          band: { x: left ? d : W - SW, y: c.y, width: SW - d, height: SH },
          originCol: left ? -1 : 0, // (the right strip starts at its clip's first column; the left one at the screen's edge)
        };
      });
      const shoot = async () => { const out = []; for (const p of parts) out.push({ side: await page.screenshot({ clip: p.side }), band: await page.screenshot({ clip: p.band }) }); return out; };
      const strips = await shoot();
      await page.evaluate(() => { document.querySelectorAll<HTMLElement>(".ab-lens-strip").forEach((s) => { s.style.display = "none"; }); });
      await page.waitForTimeout(200);
      const bare = await shoot();
      await addReferenceLens(page, W, H);
      await page.waitForTimeout(300);
      const whole = await shoot();
      // (the corner does bend: the left strip's end with no lens differs)
      expect(await changedPixels(strips[0].side, bare[0].side, page)).toBeGreaterThan(200);
      // and the reference does bend the band beside it, where the track's lens now leaves it be
      expect(await changedPixels(whole[0].band, bare[0].band, page)).toBeGreaterThan(200);
      for (let i = 0; i < parts.length; i++) {
        // the bands beside the strips: exactly the page, unbent
        expect(await changedPixels(strips[i].band, bare[i].band, page), `corner ${i}'s band`).toBe(0);
        // the side strips' columns: as the full-screen lens (even sizes: identical; odd: as the four strips had it, below)
        const at = { row: -1, col: parts[i].originCol };
        const dl = await diffLines(strips[i].side, whole[i].side, page, at);
        const where = `corner ${i}'s side strip: ${dl.n} differ, busiest row ${dl.row} (${dl.rowN}), column ${dl.col} (${dl.colN}), ` +
          `up to ${dl.maxOnLine} levels on them, ${dl.offLine} off them; up to ${dl.maxOnOrigin} levels on the strip's origin`;
        if (W % 2 === 0 && H % 2 === 0) { expect(dl.n, where).toBe(0); continue; }
        expectOddSeam(dl, where);
      }
    });
  }

  test("at q 1 the words at the left edge move toward the rim; the middle of the screen and the resume are pixel-identical", async ({ page }) => {
    await scrollTo(page, "slot");
    await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
    await stillPage(page);
    await quoteAtLeftEdge(page, 24);
    await page.waitForTimeout(200);
    await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
    await expect(page.locator(".ab-lens-strip[data-edge='left']")).toBeVisible();
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
    await expect(page.locator(".ab-lens-strip[data-edge='left']")).toBeHidden();
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
    await expect(page.locator(".ab-lens-strip[data-edge='left']")).toBeVisible();
  });

  test("after a resize mid-testimonials the side strips and their maps cover the new screen", async ({ page }) => {
    const errors = collectErrors(page);
    await scrollTo(page, "slot");
    await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
    /** Each strip's box and its slice as placed (screen px), and the slice's own pixel size. */
    const strips = () => page.evaluate(async () => Promise.all([...document.querySelectorAll<HTMLElement>(".ab-lens-strip")].filter((el) => getComputedStyle(el).display !== "none").map(async (el) => {
      const r = el.getBoundingClientRect(), img = document.querySelector(`#ab-edge-lens-${el.dataset.edge} feImage`)!;
      const i = new Image(); i.src = img.getAttribute("href")!; await i.decode();
      return { edge: el.dataset.edge, box: [r.x, r.y, r.width, r.height], img: ["x", "y", "width", "height"].map((a) => Number(img.getAttribute(a))), px: [i.width, i.height], href: img.getAttribute("href") };
    })));
    const before = await strips();
    expect(before.map((s) => [s.edge, ...s.box])).toEqual([["right", 1350, 0, 90, 900], ["left", 0, 0, 90, 900]]);
    await page.setViewportSize({ width: 1200, height: 760 });
    await page.waitForTimeout(500); // (the 150 ms debounce, then the rebuild)
    const after = await strips();
    // 1200 x 760: the band 49.4 px, the side strips 84 px wide, the full height
    expect(after.map((s) => [s.edge, ...s.box])).toEqual([["right", 1116, 0, 84, 760], ["left", 0, 0, 84, 760]]);
    for (const s of after) {
      // each slice over its strip's whole box, at half its resolution, rebuilt
      expect(s.img, s.edge).toEqual([0, 0, s.box[2], s.box[3]]);
      expect(s.px, s.edge).toEqual([s.box[2] / 2, s.box[3] / 2]);
      expect(s.href).not.toBe(before.find((b) => b.edge === s.edge)!.href);
    }
    expect(errors).toEqual([]);
  });
});

// ---------- Task 5: the stack (portrait phones) ----------

/** Stacked, the column's places (page px, each slide's rise-in taken out, as the light measures them) and the screen's
 *  height as the light takes it (its canvas: 100lvh). */
const stackPlaces = (page: Page) => page.evaluate(() => {
  const mid = (sel: string) => {
    const el = document.querySelector<HTMLElement>(sel)!, r = el.getBoundingClientRect(), t = getComputedStyle(el).transform;
    const rise = t && t !== "none" ? new DOMMatrixReadOnly(t).m42 : 0;
    return r.top - rise + r.height / 2 + window.scrollY;
  };
  const c = document.querySelector<HTMLElement>("canvas.ab-light");
  return { y0: mid("[data-pendant='quote1']"), y1: mid("[data-pendant='quote2']"), slot: mid("[data-pendant='glass']"), vh: c?.clientHeight || innerHeight, scrollY: window.scrollY };
});

/** Stacked: scrolls so Yoav's centre stands where q has risen to `q`, or the slot is centred. Waits two frames and a settle. */
async function stackTo(page: Page, where: { q: number } | "slot" | { y: number }) {
  const p = await stackPlaces(page);
  let y: number;
  if (typeof where === "object" && "q" in where) {
    const u = (2 / Math.PI) * Math.acos(1 - where.q);
    y = p.y0 - (p.vh * 1.05 - u * 0.4 * p.vh);
  } else if (where === "slot") y = p.slot - p.vh / 2;
  else y = where.y;
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(300);
}

for (const [w, h] of [[390, 844], [430, 932]] as const) {
  test.describe(`stacked on a ${w} x ${h} phone`, () => {
    test.use({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

    test("q rises and falls with the vertical scroll, from the quotes' vertical centres and the screen's height", async ({ page }) => {
      test.setTimeout(90_000);
      const errors = collectErrors(page);
      await page.goto("/about");
      await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "stack");
      await lightLoaded(page);
      await expect(page.locator("canvas.ab-light")).toHaveCSS("position", "fixed");
      expect(await page.locator("canvas.ab-light").evaluate((c) => [c.getBoundingClientRect().top, c.clientHeight])).toEqual([0, h]);
      // from Yoav's centre below the screen (1.2 x its height) to Andrada's above it (−0.2): 30 steps
      const p = await stackPlaces(page);
      const from = p.y0 - 1.2 * p.vh, to = p.y1 + 0.2 * p.vh;
      const qs: number[] = [];
      for (let i = 0; i <= 30; i++) {
        await page.evaluate((y) => window.scrollTo(0, y), from + ((to - from) * i) / 30);
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        await page.waitForTimeout(60);
        const [q, now] = await Promise.all([hook(page).then((x) => x.q), stackPlaces(page)]);
        const off = now.scrollY;
        expect(q, `step ${i}`).toBeCloseTo(testimonialsQ(now.y0 - off, now.y1 - off, now.vh), 2);
        qs.push(q);
      }
      expect(qs[0]).toBe(0);
      expect(qs[30]).toBe(0);
      const top = qs.findIndex((q) => q > 0.999), last = qs.length - 1 - [...qs].reverse().findIndex((q) => q > 0.999);
      expect(top, `q along the scroll: ${qs.map((q) => q.toFixed(2)).join(" ")}`).toBeGreaterThan(0);
      for (let i = 1; i <= top; i++) expect(qs[i]).toBeGreaterThanOrEqual(qs[i - 1] - 1e-6); // (rises)
      for (let i = last + 1; i <= 30; i++) expect(qs[i]).toBeLessThanOrEqual(qs[i - 1] + 1e-6); // (falls)
      expect(qs.slice(1, top).some((q) => q > 0.1 && q < 0.9), "a scrub, not a switch").toBe(true);
      expect(errors).toEqual([]);
    });

    test("the light at the edges leaves the stacked quotes' text in the middle untouched; the mood paints under the words", async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto("/about");
      await lightLoaded(page);
      await page.waitForFunction(() => window.__pendant?.ready === true, null, { timeout: 30_000 });
      // Yoav's quote across the middle of the screen: q 1
      const p = await stackPlaces(page);
      await stackTo(page, { y: p.y0 - p.vh / 2 });
      await page.waitForTimeout(1200); // (the slide's rise-in done)
      await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
      expect((await hook(page)).drawing).toBe(true);
      await expect.poll(async () => (await hook(page)).pulse, { timeout: 5000 }).toBe(1);
      await page.locator("canvas.ab-pendant").evaluate((c) => { (c as HTMLElement).style.visibility = "hidden"; });
      // the middle: past the light's reach (about 3.2 x its padding in from every edge)
      const pad = Math.min(50, 0.1 * Math.min(w, h)), inset = Math.ceil(3.2 * pad);
      const clip = { x: inset, y: inset, width: w - 2 * inset, height: h - 2 * inset };
      const lit = await page.screenshot({ clip });
      await setLight(page, false);
      const bare = await page.screenshot({ clip });
      await setLight(page, true);
      expect((await inkIn(page, clip)).n, "the quote's words are in the middle").toBeGreaterThan(500);
      expect(await changedPixels(lit, bare, page)).toBeLessThanOrEqual(5);
      // the mood under the words: painted solid blue at full strength, the words still show over it (a layer over them
      // would leave pure blue)
      await setLight(page, false);
      await page.addStyleTag({ content: ".ab-mood { background: #00f !important; opacity: 1 !important; }" });
      await page.waitForTimeout(100);
      const over = await colourIn(page, clip);
      expect(over.b, "the mood shows").toBeGreaterThan(150);
      expect(over.bright, "the words over the mood").toBeGreaterThan(500);
      expect(await page.locator(".ab-mood").evaluate((m) => [getComputedStyle(m).position, getComputedStyle(m).zIndex])).toEqual(["fixed", "-1"]);
    });

    test("the pendant draws the ball in the opened slot; the light draws none of its own", async ({ page }) => {
      test.setTimeout(60_000);
      const errors = collectErrors(page);
      await page.goto("/about");
      await lightLoaded(page);
      await page.waitForFunction(() => window.__pendant?.ready === true, null, { timeout: 30_000 });
      await expect(page.locator("section.ab")).toHaveAttribute("data-glass", "on");
      const y = await page.evaluate(() => window.__pendant!.keys.find((k) => k.id === "glass")!.y);
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(2500);
      const slot = await slotNow(page);
      expect(slot.w).toBeGreaterThan(0.4 * w); // (open: 50vw, capped)
      const ball = await pendantBall(page);
      expect(ball, "the pendant's ball").not.toBeNull();
      expect(Math.abs(ball!.y - slot.y)).toBeLessThan(2);
      expect((await hook(page)).ownBall).toBe(false);
      // and the light's canvas shows no ball of its own: the pendant hidden, no rim glints at r ± 3 px round the slot
      // (the light's own ball glints there brightly: the next test)
      await expect.poll(async () => (await hook(page)).pulse, { timeout: 5000 }).toBe(1);
      await page.locator("canvas.ab-pendant").evaluate((c) => { (c as HTMLElement).style.visibility = "hidden"; });
      await page.waitForTimeout(100);
      expect((await hook(page)).drawing).toBe(true);
      const r = 0.44 * slot.w, S = Math.ceil(r + 6);
      const clip = { x: Math.round(slot.x - S), y: Math.round(slot.y - S), width: 2 * S, height: 2 * S };
      const rim = await colourIn(page, clip, { r0: r - 3, r1: r + 3 });
      expect(rim.bright, `bright rim pixels on the light's canvas (of ${rim.n})`).toBeLessThan(5);
      expect(errors).toEqual([]);
    });

    test("without the pendant the light draws its own ball in the opened slot: no empty square", async ({ page }) => {
      test.setTimeout(60_000);
      const errors = collectErrors(page, /Failed to load resource/);
      let aborted = 0;
      await page.route(PENDANT_GLB, (r) => { aborted++; return r.abort(); });
      await page.goto("/about");
      await lightLoaded(page);
      await expect.poll(() => aborted, { timeout: 15_000 }).toBeGreaterThan(0);
      await expect(page.locator("canvas.ab-pendant")).toHaveCount(0, { timeout: 15_000 });
      await expect(page.locator("section.ab")).toHaveAttribute("data-glass", "on");
      await stackTo(page, "slot");
      await page.waitForTimeout(1200); // (the slot's rise-in done)
      await expect.poll(async () => (await hook(page)).ownBall).toBe(true);
      const slot = await slotNow(page);
      expect(slot.w).toBeGreaterThan(0.4 * w);
      expect(Math.abs(slot.y - h / 2)).toBeLessThan(2);
      // its rim glints (r ± 3 px), none there without the light; mostly glass inside
      const r = 0.44 * slot.w, S = Math.ceil(r + 6);
      const clip = { x: Math.round(slot.x - S), y: Math.round(slot.y - S), width: 2 * S, height: 2 * S };
      const lit = await colourIn(page, clip, { r0: r - 3, r1: r + 3 });
      await setLight(page, false);
      const bare = await colourIn(page, clip, { r0: r - 3, r1: r + 3 });
      await setLight(page, true);
      expect(lit.bright).toBeGreaterThan(lit.n * 0.15);
      expect(bare.bright).toBeLessThan(5);
      const inner = await colourIn(page, clip, { r0: 0, r1: r * 0.6 });
      expect(inner.bright).toBeLessThan(inner.n * 0.15);
      expect(errors).toEqual([]);
    });

    test("the glass edges show on Chromium at q 1, and hide again above the testimonials", async ({ page }) => {
      test.setTimeout(60_000);
      const errors = collectErrors(page);
      await page.goto("/about");
      await lightLoaded(page);
      const top = page.locator(".ab-lens-strip[data-edge='top']");
      await expect(top).toBeHidden();
      await stackTo(page, "slot");
      await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
      await expect(top).toBeVisible();
      await expect.poll(async () => (await hook(page)).lens).toBeGreaterThan(52 * 0.8 - 0.1);
      expect(await page.locator(".ab-lens-strip").evaluateAll((els) => els.map((el) => {
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        return { pos: s.position, pe: s.pointerEvents, w: r.width, h: r.height, x: r.x, y: r.y };
      }))).toEqual(expect.arrayContaining([expect.objectContaining({ pos: "fixed", pe: "none", x: 0, y: 0, w })]));
      // each strip's map is in place (a slice of the screen's map)
      expect(await page.evaluate(() => [...document.querySelectorAll(".ab-lens-defs feImage")].every((i) => (i.getAttribute("href") ?? "").startsWith("data:image/png")))).toBe(true);
      // back above the testimonials: hidden
      await stackTo(page, { y: 0 });
      await expect(top).toBeHidden();
      expect(errors).toEqual([]);
    });
  });
}

test.describe("stacked on a phone, the toolbar", () => {
  test.use({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  test("its showing (a height-only change under 150 px) resizes neither the light's canvas nor moves q", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/about");
    await lightLoaded(page);
    await stackTo(page, { q: 0.5 });
    await page.waitForTimeout(1200);
    await expect.poll(async () => (await hook(page)).drawing).toBe(true);
    const read = () => page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>("canvas.ab-light")!;
      return { coarse: matchMedia("(pointer: coarse)").matches, w: c.width, h: c.height, q: window.__testimonials!.q };
    });
    const before = await read();
    test.skip(!before.coarse, "this browser doesn't report a coarse pointer");
    expect([before.w, before.h]).toEqual([Math.round(390 * 1.5), Math.round(664 * 1.5)]);
    // (as the pendant's toolbar test: the window reports the shorter height a toolbar leaves, and says so with a resize
    // event. And the canvas's own box made to follow it, as 100vh does where lvh isn't known: the light keeps the box it
    // measured.)
    await page.evaluate(() => {
      Object.defineProperty(window, "innerHeight", { configurable: true, get: () => 664 - 80 });
      document.querySelector<HTMLElement>("canvas.ab-light")!.style.height = `${664 - 80}px`;
      window.dispatchEvent(new Event("resize"));
    });
    await page.evaluate(() => window.scrollBy(0, 1)); // (a frame runs)
    await page.waitForTimeout(400);
    const after = await read();
    expect([after.w, after.h]).toEqual([before.w, before.h]);
    expect(Math.abs(after.q - before.q)).toBeLessThan(0.01);
    // a real resize (the width changes, a rotation): the canvas follows its box
    await page.setViewportSize({ width: 400, height: 664 });
    await page.evaluate(() => window.scrollBy(0, 1));
    await page.waitForTimeout(400);
    const rotated = await read();
    expect(rotated.w).toBe(Math.round(400 * 1.5));
  });
});

// ---------- Task 6, fix round 2: the stack keeps all four strips, and they meet without a seam ----------

for (const [W, H] of [[390, 844], [391, 845]] as const) {
  test.describe(`stacked on a ${W} x ${H} phone, the four strips`, () => {
    // (one device pixel per CSS px, so the comparison sees the strips' own pixels and their odd-size rounding)
    test.use({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    test("meet without a seam: every corner as one full-screen lens with the map from lensMap would bend it", async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto("/about");
      await lightLoaded(page);
      await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "stack");
      await stackTo(page, "slot");
      await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
      await page.waitForTimeout(800); // (the slides' rise-in done)
      await stillPage(page);
      // Yoav's lines across the top-left corner, over the seam between the top strip and the left one (q stays 1: his
      // centre well above 65% of the height, Andrada's below the middle, hidden in place)
      await page.evaluate(() => {
        const q1 = document.querySelector<HTMLElement>("[data-pendant='quote1']")!;
        q1.style.transform = "";
        const r = q1.querySelector("blockquote")!.getBoundingClientRect();
        q1.style.transform = `translate(${10 - r.left}px, ${30 - r.top}px)`;
        q1.style.transition = "none";
        document.querySelector<HTMLElement>("[data-pendant='quote2']")!.style.visibility = "hidden";
      });
      await holdScale(page);
      for (const e of ["top", "right", "bottom", "left"]) await expect(page.locator(`.ab-lens-strip[data-edge='${e}']`)).toBeVisible();
      expect(await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.clientHeight])).toEqual([W, H]);
      const S = { width: 180, height: 200 };
      const corners = [{ x: 0, y: 0 }, { x: W - S.width, y: 0 }, { x: 0, y: H - S.height }, { x: W - S.width, y: H - S.height }].map((c) => ({ ...c, ...S }));
      const strips = [];
      for (const c of corners) strips.push(await page.screenshot({ clip: c }));
      await addReferenceLens(page, W, H);
      await page.waitForTimeout(300);
      const whole = [];
      for (const c of corners) whole.push(await page.screenshot({ clip: c }));
      await page.evaluate(() => { document.getElementById("t4-ref-layer")!.style.display = "none"; });
      await page.waitForTimeout(200);
      const bare = await page.screenshot({ clip: corners[0] });
      expect(await changedPixels(strips[0], bare, page)).toBeGreaterThan(100); // (the corner does bend)
      const four = lensStrips(W, H, lensDepth(lensBand(W, H)));
      const originX = four[1].x, originY = four[2].y; // (the right strip's left edge, the bottom strip's top)
      for (let i = 0; i < corners.length; i++) {
        const at = { row: originY - corners[i].y, col: originX - corners[i].x };
        const d = await diffLines(strips[i], whole[i], page, at);
        const where = `corner ${i} (${corners[i].x}, ${corners[i].y}): ${d.n} differ, busiest row ${d.row} (${d.rowN}), column ${d.col} (${d.colN}), ` +
          `up to ${d.maxOnLine} levels on them, ${d.offLine} off them; up to ${d.maxOnOrigin} levels on the strip origins (row ${at.row}, column ${at.col})`;
        if (W % 2 === 0 && H % 2 === 0) { expect(d.n, where).toBe(0); continue; }
        expectOddSeam(d, where);
      }
    });
  });
}

// ---------- Task 5, fix round 1: the glass edges on Android, whatever the URL bar does ----------

/** Android Chrome as far as the lens can tell: the client height is the small viewport (`small` px, the URL bar showing)
 *  and stays put, while the fixed layer is the real viewport (the bar hidden). Installed before the page's own scripts. */
const smallClient = (page: Page, small: number) => page.addInitScript((small) => {
  const d = Object.getOwnPropertyDescriptor(Element.prototype, "clientHeight")!;
  Object.defineProperty(Element.prototype, "clientHeight", {
    configurable: true,
    get(this: Element) { return this === document.documentElement ? small : d.get!.call(this); },
  });
}, small);

/** Each strip's box (screen px) and its slice as placed in the strip's own space, and the slices' hrefs. */
const lensCover = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".ab-lens-strip")].map((el) => {
  const r = el.getBoundingClientRect(), img = document.querySelector(`#ab-edge-lens-${el.dataset.edge} feImage`)!;
  const [x, y, w, h] = ["x", "y", "width", "height"].map((a) => Number(img.getAttribute(a)));
  return { edge: el.dataset.edge!, box: { x: r.x, y: r.y, w: r.width, h: r.height }, img: { x, y, w, h }, href: img.getAttribute("href") };
}));

/** Every strip lies wholly inside its slice (its own space: the slice from (x, y), w by h). */
function expectCovered(cover: Awaited<ReturnType<typeof lensCover>>, when: string) {
  for (const s of cover) {
    expect(s.img.x, `${when}: ${s.edge} slice's left`).toBeLessThanOrEqual(0);
    expect(s.img.y, `${when}: ${s.edge} slice's top`).toBeLessThanOrEqual(0);
    expect(s.img.x + s.img.w, `${when}: ${s.edge} slice's right against the strip's ${s.box.w} px`).toBeGreaterThanOrEqual(s.box.w);
    expect(s.img.y + s.img.h, `${when}: ${s.edge} slice's foot against the strip's ${s.box.h} px`).toBeGreaterThanOrEqual(s.box.h);
  }
}

test.describe("stacked on an Android phone (390 x 844, the URL bar 56 px)", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  test("the side strips' maps cover them whole with the bar hidden and shown; the bottom strip sits on the light's foot; nothing is rebuilt", async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await smallClient(page, 844 - 56);
    await page.goto("/about");
    await lightLoaded(page);
    expect(await page.evaluate(() => document.documentElement.clientHeight)).toBe(788);
    await stackTo(page, "slot");
    await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
    await expect(page.locator(".ab-lens-strip[data-edge='left']")).toBeVisible();
    const hidden = await lensCover(page);
    // the bar hidden: the sides run the full 844 px between the top and bottom strips, and every slice covers its strip
    const d = hidden.find((s) => s.edge === "top")!.box.h;
    expect(hidden.find((s) => s.edge === "left")!.box.h).toBe(844 - 2 * d);
    expectCovered(hidden, "the bar hidden");
    // the bottom strip on the light canvas's foot (both stand on the large viewport)
    const lightFoot = await page.locator("canvas.ab-light").evaluate((c) => c.getBoundingClientRect().bottom);
    const bottom = hidden.find((s) => s.edge === "bottom")!.box;
    expect(bottom.y + bottom.h).toBe(lightFoot);
    // the bar showing: the window reports 56 px less, and says so (the large viewport and the client height unchanged)
    await page.evaluate(() => {
      Object.defineProperty(window, "innerHeight", { configurable: true, get: () => 844 - 56 });
      window.dispatchEvent(new Event("resize"));
    });
    await page.waitForTimeout(500); // (past the rebuild's 150 ms)
    const shown = await lensCover(page);
    expectCovered(shown, "the bar shown");
    expect(shown.map((s) => s.href), "nothing rebuilt").toEqual(hidden.map((s) => s.href));
    expect(shown.map((s) => s.img)).toEqual(hidden.map((s) => s.img));
    expect(errors).toEqual([]);
  });
});

test("on the track, a client height shorter than the fixed layer (an Android tablet's URL bar hidden): the side slices still cover their strips", async ({ page }) => {
  await smallClient(page, 900 - 56);
  await page.goto("/about");
  await lightLoaded(page);
  await scrollTo(page, "slot");
  await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
  await expect(page.locator(".ab-lens-strip[data-edge='left']")).toBeVisible();
  const cover = (await lensCover(page)).filter((s) => s.box.h > 0); // (the track: the sides only)
  expect(cover.map((s) => s.edge)).toEqual(["right", "left"]);
  expect(cover.find((s) => s.edge === "left")!.box.h).toBe(900); // (the fixed layer's full height, past the 844 px client)
  expectCovered(cover, "the track");
});

// ---------- Task 5, fix round 2: the page holds its place when the slot opens above it ----------

test.describe("stacked on a phone without scroll anchoring (as iOS Safari)", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  for (const [into, why] of [[300, "wholly above the screen"], [100, "straddling the screen's top"]] as const) test(`read into Andrada's quote below the closed slot, the slot opening ${why} doesn't move what's on screen`, async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await page.addInitScript(() => {
      // no anchoring: the page says so (CSS.supports) and does none (overflow-anchor: none), as iOS Safari
      const supports = CSS.supports.bind(CSS);
      CSS.supports = ((...a: [string, string?]) => (a[0] === "overflow-anchor" ? false : (supports as (...x: unknown[]) => boolean)(...a))) as typeof CSS.supports;
      document.addEventListener("DOMContentLoaded", () => {
        document.documentElement.style.overflowAnchor = "none";
        document.body.style.overflowAnchor = "none";
      });
      // the light and the pendant load after an idle moment: held until the test lets them, so the slot opens on cue
      const held: (() => void)[] = [];
      window.requestIdleCallback = ((cb: IdleRequestCallback) => { held.push(() => cb({ didTimeout: false, timeRemaining: () => 0 })); return held.length; }) as typeof window.requestIdleCallback;
      (window as unknown as { __idle: () => void }).__idle = () => held.splice(0).forEach((f) => f());
    });
    await page.goto("/about");
    await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "stack");
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => [CSS.supports("overflow-anchor", "auto"), document.querySelector("section.ab")!.hasAttribute("data-glass")])).toEqual([false, false]);
    expect(await page.locator("[data-pendant='glass']").evaluate((el) => el.getBoundingClientRect().height)).toBe(0);
    // Andrada's quote 300 px into it: where the slot will open (at the quote's old top) lies wholly above the screen
    await page.evaluate((into) => {
      const r = document.querySelector("[data-pendant='quote2']")!.getBoundingClientRect();
      window.scrollTo(0, r.top + window.scrollY + into);
    }, into);
    await page.waitForTimeout(1200); // (its rise-in done)
    const read = () => page.evaluate(() => ({
      y: window.scrollY,
      top: document.querySelector("[data-pendant='quote2']")!.getBoundingClientRect().top,
      glass: document.querySelector("section.ab")!.getAttribute("data-glass"),
      slot: document.querySelector("[data-pendant='glass']")!.getBoundingClientRect().height,
    }));
    const before = await read();
    expect(before.top, "the slot's place (the quote's top) above the screen's top").toBeLessThan(into === 300 ? -250 : -50);
    await page.evaluate(() => (window as unknown as { __idle: () => void }).__idle());
    await expect.poll(async () => (await read()).glass, { timeout: 20_000 }).toBe("on");
    await page.waitForTimeout(300);
    const after = await read();
    expect(after.slot).toBeGreaterThan(150); // (open: 50vw)
    expect(after.y - before.y, "the page scrolled by the slot's height").toBeCloseTo(after.slot, 0);
    expect(Math.abs(after.top - before.top), "Andrada's quote held its place on screen").toBeLessThan(3);
    expect(errors).toEqual([]);
  });
});

// ---------- Task 6, Step 2: Safari (WebKit). Run by the config's webkit project only (the @webkit tag; the chromium project
// leaves these out, as the webkit project leaves out everything else: the lens, its seams, the anchoring stub and the GPU
// timers are Chromium's). Playwright's WebKit runs WebGL and WebGL2 headless, so the light and the pendant both draw. ----------

test("Chromium keeps its lens: the quotes are never split into a bending copy (edge-bend.ts is WebKit's and Firefox's)", async ({ page }) => {
  await page.goto("/about");
  await lightLoaded(page);
  await page.mouse.move(1430, 890);
  await scrollTo(page, "slot");
  await expect.poll(async () => (await hook(page)).lens).toBeGreaterThan(0);
  expect((await hook(page)).bend).toBe(0);
  await expect(page.locator(".ab-bend, .ab-bendable")).toHaveCount(0);
});

test.describe("Safari (WebKit) @webkit", () => {
  test("no lens; at q 1 the light warms the far edges and the pendant's ball sits in the slot at its size; no console errors", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/about");
    await lightLoaded(page);
    await page.waitForFunction(() => window.__pendant?.ready === true, null, { timeout: 30_000 });
    // no lens at all: no strips, no filters (lensSupported: no userAgentData), the hook's scale 0
    await expect(page.locator(".ab-lens")).toHaveCount(0);
    await expect(page.locator(".ab-lens-defs")).toHaveCount(0);
    await page.mouse.move(1430, 890);
    await scrollTo(page, "slot");
    await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
    await expect.poll(async () => (await hook(page)).pulse, { timeout: 5000 }).toBe(1);
    expect(await hook(page)).toMatchObject({ drawing: true, lens: 0, ownBall: false });
    // the light: warm at the left and right edges, dark without it
    for (const x of [0, 1432]) {
      const clip = { x, y: 600, width: 8, height: 140 };
      const lit = await colourIn(page, clip);
      await setLight(page, false);
      const dark = await colourIn(page, clip);
      await setLight(page, true);
      expect(dark.r).toBeLessThan(40);
      expect(lit.r).toBeGreaterThan(dark.r + 30);
      expect(lit.r).toBeGreaterThanOrEqual(lit.g);
      expect(lit.r).toBeGreaterThanOrEqual(lit.b);
    }
    // the ball: the pendant's, centred on the slot, drawn 0.44 x the slot across and down (within 4%, from its pixels)
    await page.waitForTimeout(1500);
    const ball = await pendantBall(page);
    expect(ball, "the pendant's ball").not.toBeNull();
    const slot = await slotNow(page);
    expect(Math.abs(ball!.x - slot.x)).toBeLessThan(2);
    expect(Math.abs(ball!.y - slot.y)).toBeLessThan(2);
    expect(errors).toEqual([]);
    const o = await drawnOutline(page, "canvas.ab-pendant", "#fff", "dark", slot);
    const R = 0.44 * slot.w;
    expect(Math.abs(o.halfW / R - 1), `half-width ${o.halfW} against ${R}`).toBeLessThan(0.04);
    expect(Math.abs(o.halfH / R - 1), `half-height ${o.halfH} against ${R}`).toBeLessThan(0.04);
  });

  test("without the pendant the light draws its own ball in the slot; no lens, no console errors", async ({ page }) => {
    const errors = collectErrors(page, /Failed to load resource|pendant\.glb/); // (the aborted file's own network line)
    await page.route(PENDANT_GLB, (r) => r.abort());
    await page.goto("/about");
    await lightLoaded(page);
    await expect(page.locator("canvas.ab-pendant")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(".ab-lens")).toHaveCount(0);
    await page.mouse.move(1430, 890);
    const slot = await scrollTo(page, "slot");
    await expect.poll(async () => (await hook(page)).ownBall).toBe(true);
    await page.waitForTimeout(300);
    const r = 0.44 * slot.w, S = Math.ceil(r + 6);
    const clip = { x: Math.round(slot.x - S), y: Math.round(slot.y - S), width: 2 * S, height: 2 * S };
    const lit = await colourIn(page, clip, { r0: r - 3, r1: r + 3 });
    await setLight(page, false);
    const bare = await colourIn(page, clip, { r0: r - 3, r1: r + 3 });
    await setLight(page, true);
    expect(lit.bright).toBeGreaterThan(lit.n * 0.15);
    expect(bare.bright).toBeLessThan(5);
    expect(errors).toEqual([]);
  });

  test.describe("stacked on a 390 x 844 phone", () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    test("no lens; the light draws, the slot opens and holds a ball, the quotes read; no console errors", async ({ page }) => {
      test.setTimeout(60_000);
      const errors = collectErrors(page);
      await page.goto("/about");
      await lightLoaded(page);
      await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "stack");
      await expect(page.locator(".ab-lens")).toHaveCount(0);
      await stackTo(page, "slot");
      await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.999);
      expect(await hook(page)).toMatchObject({ drawing: true, lens: 0 });
      await expect(page.locator("section.ab")).toHaveAttribute("data-glass", "on");
      const slot = await slotNow(page);
      expect(slot.w).toBeGreaterThan(0.4 * 390); // (open: 50vw)
      // a ball in it: the pendant's (once ready) or, until then, the light's own
      await expect.poll(async () => (await pendantBall(page)) !== null || (await hook(page)).ownBall, { timeout: 30_000 }).toBe(true);
      // the quotes are there to read, the light's canvas fixed over the screen and taking no pointer
      for (const q of ["quote1", "quote2"]) await expect(page.locator(`[data-pendant='${q}'] blockquote`)).toBeVisible();
      expect(await page.locator("canvas.ab-light").evaluate((c) => [getComputedStyle(c).position, getComputedStyle(c).pointerEvents])).toEqual(["fixed", "none"]);
      expect(errors).toEqual([]);
    });
  });

  // ---------- the glass edges without the lens (edge-bend.ts; Liam, 2026-10-19): the words bend themselves ----------

  /** The quotes' bending letters (the aria-hidden copy's): each one's place on screen, as laid out (its line's box, its
   *  own advance: the transform left out) and whether it carries a transform, with the matrix's scale and shift. */
  const bendGlyphs = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".ab-bend-c")].map((g) => {
    const tf = g.style.transform;
    g.style.transform = "";
    const r = g.getBoundingClientRect(), row = g.parentElement!.getBoundingClientRect();
    g.style.transform = tf;
    const m = tf ? new DOMMatrixReadOnly(tf) : null;
    return { ch: g.textContent, x0: r.left, x1: r.right, y0: row.top, y1: row.bottom, bent: !!m && !m.isIdentity, a: m?.a ?? 1, d: m?.d ?? 1, e: m?.e ?? 0, f: m?.f ?? 0 };
  }));

  test.describe("stacked on a 428 x 926 phone, the glass edges", () => {
    test.use({ viewport: { width: 428, height: 926 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    test("the lines passing the top band bend (pulled up, stretched tall), the lines mid-screen don't; the copy is aria-hidden and the quote still reads", async ({ page }) => {
      test.setTimeout(90_000);
      const errors = collectErrors(page);
      await page.goto("/about");
      await lightLoaded(page);
      await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "stack");
      await expect(page.locator(".ab-lens")).toHaveCount(0);
      // far from the quotes: nothing bends, the originals show
      expect((await hook(page)).bend).toBe(0);
      await expect(page.locator(".ab-bendable[data-bend]")).toHaveCount(0);
      // Yoav's third line at the very top (its foot inside the band), q full
      await expect.poll(() => page.locator("[data-pendant='quote1'] blockquote .ab-bend-l").count(), { timeout: 15_000 }).toBeGreaterThan(2);
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          const row = document.querySelectorAll<HTMLElement>("[data-pendant='quote1'] blockquote .ab-bend-l")[2].getBoundingClientRect();
          window.scrollBy(0, Math.round(row.top - 4));
        });
        await page.waitForTimeout(500);
      }
      await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.5);
      await expect.poll(async () => (await hook(page)).bend).toBeGreaterThan(0);
      await expect(page.locator("[data-pendant='quote1'] blockquote")).toHaveAttribute("data-bend", "");
      const band = lensBand(428, await page.evaluate(() => document.querySelector<HTMLElement>("canvas.ab-light")!.clientHeight));
      const gs = await bendGlyphs(page);
      const top = gs.filter((g) => g.y0 >= 0 && g.y0 < band - 4 && g.x0 > band + 2 && g.x1 < 428 - band - 2);
      const mid = gs.filter((g) => g.y0 > 300 && g.y1 < 600);
      expect(top.length, "letters of the line in the top band").toBeGreaterThan(5);
      for (const g of top) {
        expect(g.bent, `"${g.ch}" in the band`).toBe(true);
        expect(g.d, `"${g.ch}" stretched tall`).toBeGreaterThan(1.02);
        expect(g.f, `"${g.ch}" pulled up`).toBeLessThan(0);
        expect(Math.abs(g.a - 1), `"${g.ch}" not stretched wide`).toBeLessThan(1e-6);
      }
      for (const g of mid) expect(g.bent, `"${g.ch}" mid-screen`).toBe(false);
      // the original stays, its text whole and readable; the copy is hidden from assistive tech and takes no pointer
      await expect(page.locator("[data-pendant='quote1'] blockquote")).toContainText("We weren't looking for a designer.");
      await expect(page.locator("[data-pendant='quote1'] blockquote .ab-bend")).toHaveAttribute("aria-hidden", "true");
      expect(await page.locator("[data-pendant='quote1'] blockquote .ab-bend").evaluate((c) => getComputedStyle(c).pointerEvents)).toBe("none");
      // back up, out of the testimonials: everything put back
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(async () => (await hook(page)).bend).toBe(0);
      await expect(page.locator(".ab-bendable[data-bend]")).toHaveCount(0);
      expect(await page.locator(".ab-bend-c").evaluateAll((els) => els.filter((e) => (e as HTMLElement).style.transform).length)).toBe(0);
      expect(errors).toEqual([]);
    });
  });

  test("on the desktop track the letters passing the left band bend (pulled out, stretched wide), the letters mid-screen don't", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.goto("/about");
    await lightLoaded(page);
    await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "track");
    await page.mouse.move(1430, 890);
    // Yoav's quote with its left edge 30 px in from the screen's left: its first letters inside the left band
    await expect.poll(() => page.locator("[data-pendant='quote1'] blockquote .ab-bend-c").count(), { timeout: 15_000 }).toBeGreaterThan(20);
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const r = document.querySelector("[data-pendant='quote1'] blockquote")!.getBoundingClientRect();
        window.scrollBy(0, Math.round(r.left - 30));
      });
      await page.waitForTimeout(500);
    }
    await expect.poll(async () => (await hook(page)).q).toBeGreaterThan(0.5);
    await expect.poll(async () => (await hook(page)).bend).toBeGreaterThan(0);
    expect((await hook(page)).lens).toBe(0);
    const band = lensBand(1440, 900);
    const gs = await bendGlyphs(page);
    // (past the pull's reach, ≈ 26 px at full strength: closer to the rim a letter shows off the screen, only shifted)
    const left = gs.filter((g) => g.x0 >= 27 && g.x1 < band - 2 && g.y0 > 200 && g.y1 < 700);
    const mid = gs.filter((g) => g.x0 > 300 && g.x1 < 1100);
    expect(left.length, "letters in the left band").toBeGreaterThan(1);
    for (const g of left) {
      expect(g.bent, `"${g.ch}" in the band`).toBe(true);
      expect(g.a, `"${g.ch}" stretched wide`).toBeGreaterThan(1.02);
      expect(g.e, `"${g.ch}" pulled out`).toBeLessThan(0);
      expect(Math.abs(g.d - 1), `"${g.ch}" its height kept`).toBeLessThan(1e-6);
    }
    expect(mid.length).toBeGreaterThan(20);
    for (const g of mid) expect(g.bent, `"${g.ch}" mid-screen`).toBe(false);
    expect(errors).toEqual([]);
  });
});

// ---------- About round 3, Task 5: the glass ball under the cursor (both balls) ----------

/** Two PNG screenshots of one square clip round a ball (centre `ox, oy` and radius `r` in clip px), compared in the page (a
 *  pixel changed when a channel moved by more than 2 levels): the changes inside the disc between `in0` and `in1` of the
 *  radius; on the outline (0.97 to 1.05 r) on the side facing `toward` (radians, screen y down: within 45 degrees of it); and
 *  outside 1.05 r (to the clip's edge). */
async function ballChanges(a: Buffer, b: Buffer, page: Page, ball: { ox: number; oy: number; r: number }, opts: { in0: number; in1: number; toward: number }) {
  return page.evaluate(async ({ a, b, ball, opts }) => {
    const read = async (src: string) => {
      const img = new Image();
      img.src = `data:image/png;base64,${src}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const x = c.getContext("2d")!;
      x.drawImage(img, 0, 0);
      return { d: x.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
    };
    const A = await read(a), B = await read(b);
    let inside = 0, outline = 0, outside = 0, worstOutside = 0;
    for (let py = 0; py < A.h; py++) {
      for (let px = 0; px < A.w; px++) {
        const i = (py * A.w + px) * 4;
        const dl = Math.max(Math.abs(A.d[i] - B.d[i]), Math.abs(A.d[i + 1] - B.d[i + 1]), Math.abs(A.d[i + 2] - B.d[i + 2]));
        const dx = px + 0.5 - ball.ox, dy = py + 0.5 - ball.oy, k = Math.hypot(dx, dy) / ball.r;
        if (k > 1.05) { worstOutside = Math.max(worstOutside, dl); if (dl > 2) outside++; continue; }
        if (dl <= 2) continue;
        let da = Math.abs(Math.atan2(dy, dx) - opts.toward);
        if (da > Math.PI) da = 2 * Math.PI - da;
        if (k >= opts.in0 && k <= opts.in1) inside++;
        if (k >= 0.97 && da < Math.PI / 4) outline++;
      }
    }
    return { inside, outline, outside, worstOutside };
  }, { a: a.toString("base64"), b: b.toString("base64"), ball, opts });
}

/** The track at the glass slot, q held at 0 (no light: both balls show a still glass room, their rim glints off), the cursor
 *  parked in the corner. Returns the ball (screen px) and a square clip round it, 1.35 r out. */
async function stillBallAtSlot(page: Page, own: "pendant" | "light") {
  await page.mouse.move(1430, 890);
  const slot = await scrollTo(page, "slot");
  await holdQ(page, 0);
  await expect.poll(async () => (await hook(page)).q).toBe(0);
  if (own === "light") await expect.poll(async () => (await hook(page)).ownBall).toBe(true);
  await page.waitForTimeout(700);
  const pb = own === "pendant" ? await pendantBall(page) : null;
  const ball = pb ?? { x: slot.x, y: slot.y, r: 0.44 * slot.w };
  const S = Math.ceil(1.35 * ball.r);
  const clip = { x: Math.round(ball.x - S), y: Math.round(ball.y - S), width: 2 * S, height: 2 * S };
  return { ball, clip, at: { ox: ball.x - clip.x, oy: ball.y - clip.y, r: ball.r } };
}

test.describe("the glass ball under the cursor", () => {
  for (const own of ["pendant", "light"] as const) {
    test(`${own === "pendant" ? "the pendant's ball" : "the light's own ball"}: hovering at its edge sends rings across the disc and leans the outline toward the cursor; nothing changes outside 1.05 r`, async ({ page }) => {
      test.setTimeout(90_000);
      const errors = collectErrors(page, own === "light" ? /Failed to load resource/ : undefined);
      if (own === "light") await page.route(PENDANT_GLB, (r) => r.abort());
      await page.goto("/about");
      await lightLoaded(page);
      if (own === "pendant") await page.waitForFunction(() => window.__pendant?.ready === true, null, { timeout: 30_000 });
      else await expect(page.locator("canvas.ab-pendant")).toHaveCount(0, { timeout: 15_000 });
      const { ball, clip, at } = await stillBallAtSlot(page, own);
      // still: two looks 300 ms apart (the pendant inside turns; the glass round it doesn't)
      const rest = await page.screenshot({ clip });
      await page.waitForTimeout(300);
      const rest2 = await page.screenshot({ clip });
      const still = await ballChanges(rest, rest2, page, at, { in0: 0.78, in1: 0.97, toward: 0 });
      expect(still.outside, "still: nothing outside the ball moves").toBe(0);
      expect(still.outline, "still: the outline holds").toBe(0);
      // onto the ball from the right, to 0.9 r: a ring starts there and the outline leans toward it
      await page.mouse.move(ball.x + 1.25 * ball.r, ball.y);
      await page.mouse.move(ball.x + 0.9 * ball.r, ball.y, { steps: 4 });
      await page.waitForTimeout(250);
      const hovered = await page.screenshot({ clip });
      const h = await page.evaluate(() => window.__glassRipple!);
      expect(h.over).toBe(true);
      expect(h.rings).toBeGreaterThanOrEqual(1);
      const moved = await ballChanges(rest2, hovered, page, at, { in0: 0.78, in1: 0.97, toward: 0 });
      expect(moved.inside, `rings inside the disc (still: ${still.inside})`).toBeGreaterThan(still.inside + 150);
      expect(moved.outline, "the outline leans toward the cursor").toBeGreaterThan(10);
      expect(moved.outside, `nothing outside 1.05 r (most a pixel moved there: ${moved.worstOutside})`).toBe(0);
      // and it settles: off the ball, the rings die away and the outline goes back
      await page.mouse.move(1430, 890, { steps: 3 });
      await page.waitForTimeout(2200);
      expect(await page.evaluate(() => window.__glassRipple!)).toMatchObject({ rings: 0, over: false });
      const after = await page.screenshot({ clip });
      const back = await ballChanges(rest2, after, page, at, { in0: 0.78, in1: 0.97, toward: 0 });
      expect(back.outline, "the outline back where it was").toBe(0);
      expect(back.outside).toBe(0);
      expect(errors).toEqual([]);
    });
  }

  test("under reduced motion, hovering the ball changes nothing: no rings, no lean", async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/about");
    await lightLoaded(page);
    await page.waitForFunction(() => window.__pendant?.ready === true, null, { timeout: 30_000 });
    await page.mouse.move(1430, 890);
    // (reduced motion stacks the page: the glass shot's place, the ball held there)
    const y = await page.evaluate(() => window.__pendant!.keys.find((k) => k.id === "glass")!.y);
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(4500); // (the brightness eases over 0.6 s: fully settled before the before/after shots)
    const ball = await pendantBall(page);
    expect(ball, "the pendant's ball").not.toBeNull();
    const S = Math.ceil(1.35 * ball!.r);
    const clip = { x: Math.round(ball!.x - S), y: Math.round(ball!.y - S), width: 2 * S, height: 2 * S };
    const before = await page.screenshot({ clip });
    await page.mouse.move(ball!.x + 1.25 * ball!.r, ball!.y);
    await page.mouse.move(ball!.x + 0.9 * ball!.r, ball!.y, { steps: 4 });
    await page.waitForTimeout(150);
    await page.mouse.move(ball!.x + 0.3 * ball!.r, ball!.y - 0.4 * ball!.r, { steps: 6 });
    await page.waitForTimeout(400);
    const after = await page.screenshot({ clip });
    expect(await changedPixels(before, after, page)).toBe(0);
    expect(await page.evaluate(() => window.__glassRipple)).toMatchObject({ rings: 0, lean: 0, spawned: 0 });
  });
});

test.describe("the glass ball under a finger, stacked on a 390 x 844 phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

  test("a tap on the ball sends one ring across it; nothing outside 1.05 r changes", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.goto("/about");
    await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "stack");
    await lightLoaded(page);
    await page.waitForFunction(() => window.__pendant?.ready === true, null, { timeout: 30_000 });
    const y = await page.evaluate(() => window.__pendant!.keys.find((k) => k.id === "glass")!.y);
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(2500);
    // the light off (both quotes moved far below: q 0), so the ball's rim doesn't glint and the glass round the pendant is still
    await page.evaluate(() => {
      for (const s of ["quote1", "quote2"]) { const el = document.querySelector<HTMLElement>(`[data-pendant='${s}']`)!; el.style.position = "relative"; el.style.top = "6000px"; }
    });
    await expect.poll(async () => (await hook(page)).q).toBe(0);
    await page.waitForTimeout(600);
    const b = await pendantBall(page);
    expect(b, "the pendant's ball in the opened slot").not.toBeNull();
    const S = Math.ceil(1.35 * b!.r);
    const clip = { x: Math.round(b!.x - S), y: Math.round(b!.y - S), width: 2 * S, height: 2 * S };
    const at = { ox: (b!.x - clip.x) * 3, oy: (b!.y - clip.y) * 3, r: b!.r * 3 }; // (the screenshots at the phone's 3x)
    const rest = await page.screenshot({ clip });
    await page.waitForTimeout(350);
    const rest2 = await page.screenshot({ clip });
    const still = await ballChanges(rest, rest2, page, at, { in0: 0.78, in1: 0.97, toward: 0 });
    expect(still.outside).toBe(0);
    expect(await page.evaluate(() => window.__glassRipple?.spawned ?? 0)).toBe(0);
    await page.touchscreen.tap(b!.x + 0.5 * b!.r, b!.y);
    await page.waitForTimeout(350);
    const tapped = await page.screenshot({ clip });
    expect(await page.evaluate(() => window.__glassRipple!)).toMatchObject({ spawned: 1, rings: 1, over: false });
    const moved = await ballChanges(rest2, tapped, page, at, { in0: 0.78, in1: 0.97, toward: 0 });
    expect(moved.inside, `the ring inside the disc (still: ${still.inside})`).toBeGreaterThan(still.inside + 300);
    expect(moved.outside, `nothing outside 1.05 r (most a pixel moved there: ${moved.worstOutside})`).toBe(0);
    // one ring, gone after about 1.5 s
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__glassRipple!)).toMatchObject({ spawned: 1, rings: 0 });
    expect(errors).toEqual([]);
  });
});

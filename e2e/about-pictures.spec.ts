import { expect, test, type Page } from "@playwright/test";

// About's pictures along the sideways track, seen in a real browser (spec 2026-10-16-about-pictures-design.md §2, §3).
// The expected state is picture-motion.ts's formula, re-implemented here from the spec (94% -> 70% rise, cut from the 6vw margin),
// and compared with what the page actually wrote on each picture: its clip-path and visibility, against its live rect.

const EVENTREAD = "eventread";

/** The rule, written out again from the spec (not imported: a test that imports the formula only tests that it equals itself). */
function expected(screenLeft: number, width: number, vw: number) {
  const margin = vw * 0.06;
  const t = Math.min(Math.max((vw * 0.94 - screenLeft) / (vw * 0.24), 0), 1);
  const top = (1 - t * t * (3 - 2 * t)) * 100;
  const left = screenLeft < margin ? Math.min(Math.max((margin - screenLeft) / width, 0), 1) * 100 : 0;
  return { top, left, hidden: top >= 100 || left >= 100 };
}

type Seen = { id: string; link: boolean; left: number; width: number; vw: number; clip: string; vis: string; topPct: number | null; leftPx: number | null };

/** Every picture: where it is on screen right now (rects ignore clip-path) and what the page has written on it. */
async function readPics(page: Page): Promise<Seen[]> {
  return page.evaluate(() => {
    const vw = document.querySelector<HTMLElement>(".ab-clip")!.clientWidth;
    return [...document.querySelectorAll<HTMLElement>(".ab-pic[data-pic]")].map((el) => {
      const r = el.getBoundingClientRect();
      const right = Math.max(r.right, ...[...el.children].map((c) => c.getBoundingClientRect().right));
      const cs = getComputedStyle(el);
      // computed clip-path: "inset(30.5% -1440px 0px 12.3px round 10px)" or "inset(50%)"
      const m = /^inset\(([\d.e+-]+)% (?:[\d.e+-]+px ){2}([\d.e+-]+)px/.exec(cs.clipPath);
      return { id: el.dataset.pic!, link: !!el.closest("a"), left: r.left, width: right - r.left, vw, clip: cs.clipPath, vis: cs.visibility, topPct: m ? +m[1] : null, leftPx: m ? +m[2] : null };
    });
  });
}

/** Let the page apply what a scroll or a resize asked for: scroll event -> rAF frame, so two animation frames. */
const settle = (page: Page) => page.evaluate(() => new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => res())))));

/** Scroll to `p` (0..1) of the pinned track. */
async function scrollTrack(page: Page, p: number) {
  await page.evaluate((p) => {
    const sec = document.querySelector<HTMLElement>("section.ab")!;
    window.scrollTo(0, sec.offsetTop + p * (sec.offsetHeight - window.innerHeight));
  }, p);
  await settle(page);
}

/** The state each picture shows must be the rule's, for its live position. Returns how many were checked in each regime. */
function expectRule(pics: Seen[], where: string) {
  const tally = { hidden: 0, risen: 0, rising: 0, cutting: 0 };
  for (const s of pics) {
    const e = expected(s.left, s.width, s.vw);
    const at = `${where}: ${s.id} at ${s.left.toFixed(1)}px (${((s.left / s.vw) * 100).toFixed(1)}%)`;
    if (e.hidden) {
      // gone: a link picture keeps its place in the tab order and gets an empty clip; any other is not visible at all
      if (s.link) { expect(s.vis, at).toBe("visible"); expect(s.clip, at).toBe("inset(50%)"); } else expect(s.vis, at).toBe("hidden");
      tally.hidden++;
    } else {
      expect(s.vis, at).toBe("visible");
      expect(s.topPct, `${at}: clip ${s.clip}`).not.toBeNull();
      expect(s.topPct!, at).toBeCloseTo(e.top, 0);
      expect(s.leftPx!, at).toBeCloseTo((e.left / 100) * s.width, 0);
      if (e.top === 0 && e.left === 0) tally.risen++; else if (e.left > 0) tally.cutting++; else tally.rising++;
    }
    // the spec's own words, independent of the formula above: hidden before 94%, fully shown from 70% on, until the margin
    if (s.left >= s.vw * 0.94) expect(s.link ? s.clip : s.vis, `${at} should be unrisen`).toBe(s.link ? "inset(50%)" : "hidden");
    if (s.left <= s.vw * 0.7 && s.left >= s.vw * 0.06) { expect(s.vis, at).toBe("visible"); expect(s.topPct, at).toBeCloseTo(0, 5); expect(s.leftPx!, at).toBeCloseTo(0, 5); }
    if (s.left + s.width <= s.vw * 0.06 - 1) expect(s.link ? s.clip : s.vis, `${at} should be cut away`).toBe(s.link ? "inset(50%)" : "hidden");
  }
  return tally;
}

/** Every .mp4 requested since the page began to load (the listener is set before the first request, so a regression to preload="auto" shows). */
let mp4s: string[] = [];
/** Every request for the desk film's files (its video or poster) since the page began to load: set before the first request too. */
let deskReqs: string[] = [];

test.beforeEach(async ({ page }) => {
  mp4s = [];
  deskReqs = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.endsWith(".mp4")) mp4s.push(new URL(r.url()).pathname);
    if (/desk-build/.test(r.url())) deskReqs.push(r.url());
  });
  await page.goto("/about");
  await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "track");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  await settle(page);
});

test("the desk film has left About (Liam, 2026-10-18): not in the DOM, never requested, an empty stage in its place", async ({ page }) => {
  for (let i = 0; i <= 10; i++) await scrollTrack(page, i / 10);
  const dom = await page.evaluate(() => ({
    film: document.querySelectorAll('[data-pic="desk"], [data-pendant="deskfilm"], .ab-deskvid, [src*="desk-build"], [poster*="desk-build"], [srcset*="desk-build"]').length,
    caption: (document.querySelector("section.ab")!.textContent ?? "").includes("This desk"),
    stage: (() => { const el = document.querySelector<HTMLElement>('[data-pendant="buildstage"]'); return el ? { kids: el.childElementCount, w: el.getBoundingClientRect().width, inBuild: !!el.closest('[data-pendant="build"]') } : null; })(),
  }));
  expect(dom.film).toBe(0);
  expect(dom.caption).toBe(false);
  expect(dom.stage).toEqual({ kids: 0, w: expect.any(Number), inBuild: true });
  expect(dom.stage!.w).toBeGreaterThan(0);
  expect([...mp4s, ...deskReqs].filter((u) => /desk-build/.test(u))).toEqual([]);
});

test("pictures rise and are cut as About scrolls, with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  const ids = (await readPics(page)).map((s) => s.id);
  expect(ids.sort()).toEqual(["cyvore", "eventread", "marni-came", "nordic-logic", "sanskrit", "studio"]);

  const seen = new Set<string>(), total = { hidden: 0, risen: 0, rising: 0, cutting: 0 };
  for (let i = 0; i <= 60; i++) {
    await scrollTrack(page, i / 60);
    const pics = await readPics(page);
    const t = expectRule(pics, `step ${i}/60`);
    for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += t[k];
    pics.filter((s) => !expected(s.left, s.width, s.vw).hidden).forEach((s) => seen.add(s.id));
  }
  // the walk covers every regime for real pictures, and every picture is shown at some point
  expect(total.hidden).toBeGreaterThan(0);
  expect(total.risen).toBeGreaterThan(0);
  expect(total.rising).toBeGreaterThan(0);
  expect(total.cutting).toBeGreaterThan(0);
  expect([...seen].sort()).toEqual(ids);
  expect(errors).toEqual([]);
});

test("a jump shows the right state at once", async ({ page }) => {
  const oneFrame = () => page.evaluate(() => new Promise<void>((res) => requestAnimationFrame(() => res())));
  // End, then Home, the way a visitor jumps: one frame after the key, and again once any scrolling animation has finished
  for (const key of ["End", "Home", "End", "Home"]) {
    await page.keyboard.press(key);
    await oneFrame();
    expectRule(await readPics(page), `one frame after ${key}`);
    await settle(page);
    await page.waitForTimeout(400);
    const settled = expectRule(await readPics(page), `settled after ${key}`);
    // Home is the start of the page (the first line's pictures not yet risen), End is past the track (every picture cut away by then)
    if (key === "Home") expect(settled.hidden).toBeGreaterThan(0);
  }
  // a plain jump with no in-between frames: the start to the middle to the end and back, one frame each
  for (const p of [0.3, 1, 0.1, 0, 0.9]) {
    await page.evaluate((p) => {
      const sec = document.querySelector<HTMLElement>("section.ab")!;
      window.scrollTo(0, sec.offsetTop + p * (sec.offsetHeight - window.innerHeight));
    }, p);
    await oneFrame();
    await oneFrame();
    expectRule(await readPics(page), `jump to ${p}`);
  }
});

test("resize keeps the rule", async ({ page }) => {
  await scrollTrack(page, 0.3);
  const before = expectRule(await readPics(page), "1440x900 mid-track");
  expect(before.risen).toBeGreaterThan(0);   // (the three case-study loops stand risen here)

  await page.setViewportSize({ width: 1280, height: 800 });
  await settle(page);
  const pics = await readPics(page);
  expect(pics[0].vw).toBe(1280);
  expectRule(pics, "1280x800 after resize");
  // and it keeps on following the scroll at the new size
  for (const p of [0.1, 0.3, 0.6, 0.9, 1]) { await scrollTrack(page, p); expectRule(await readPics(page), `1280x800 at ${p}`); }

  // and back: a width that makes the 6vw margin fractional (86.4px at 1440; 1333 -> 79.98px)
  await page.setViewportSize({ width: 1333, height: 850 });
  await settle(page);
  await scrollTrack(page, 0.45);
  expectRule(await readPics(page), "1333x850");
});

test("a focused strip link is visible", async ({ page }) => {
  const sel = `.ab-strip-link[href="/${EVENTREAD}"]`;
  // from the start of the page the strip is still far off to the right, its pictures not yet risen
  expect((await readPics(page)).find((s) => s.id === EVENTREAD)!.clip).toBe("inset(50%)");
  let focused = false;
  for (let i = 0; i < 80 && !focused; i++) {
    await page.keyboard.press("Tab");
    focused = await page.evaluate((s) => document.activeElement?.matches(s) ?? false, sel);
  }
  expect(focused, "tab reached the Eventread strip link").toBe(true);
  await settle(page);
  const pic = (await readPics(page)).find((s) => s.id === EVENTREAD)!;
  expect(pic.vis).not.toBe("hidden");
  expect(pic.clip).not.toBe("inset(50%)");
  expect(pic.topPct, pic.clip).toBeCloseTo(0, 5);   // risen
  expect(pic.leftPx, pic.clip).toBeCloseTo(0, 5);   // not cut
  expect(pic.left).toBeGreaterThanOrEqual(pic.vw * 0.06 - 1);
  expect(pic.left + pic.width).toBeLessThanOrEqual(pic.vw);
  expectRule(await readPics(page), "focused");
});

test("a link picture that is fully cut leaves no hairline", async ({ page }) => {
  // The margin is 6vw: 86.4px at 1440, a fractional edge. A fully cut link picture has an empty clip (inset(50%)), so the page must look exactly
  // as it does with that picture not there at all (visibility:hidden keeps the layout). Compared pixel for pixel, in a band just left of and
  // across the margin line (the next picture, risen and playing, starts further right and is not in the band) over the picture's height, for each link picture, scrolled to where its right edge has just passed the margin by 0 to 3px.
  const links = (await readPics(page)).filter((s) => s.link).map((s) => s.id);
  expect(links.sort()).toEqual(["cyvore", "eventread", "marni-came", "nordic-logic", "sanskrit"]);
  let compared = 0;
  // (the testimonials' light is already arriving at the strip's margin, animating at the screen's left edge: held off, so
  // the two shots compare the picture only)
  await page.addStyleTag({ content: ".ab-light{visibility:hidden !important}" });
  // (with the old clip, the empty one at the picture's right edge, a hairline showed for some of these at both widths: 1440 and 1333 put the margin on a fraction)
  for (const [w, h] of [[1440, 900], [1333, 850]]) {
    await page.setViewportSize({ width: w, height: h });
    await settle(page);
    for (const id of links) {
      for (const extra of [0, 1, 2, 3]) {
        await scrollTrack(page, 0);
        const s = (await readPics(page)).find((x) => x.id === id)!;
        const margin = s.vw * 0.06;
        // (rects come back in fractions; the page scrolls whole pixels: scroll on by just enough, plus `extra`)
        await page.evaluate((dy) => window.scrollBy(0, dy), Math.ceil(s.left + s.width - margin) + extra);
        await settle(page);
        const now = (await readPics(page)).find((x) => x.id === id)!;
        expect(now.left + now.width, `${id} just past the margin`).toBeLessThanOrEqual(margin + 1e-6);
        expect(now.clip, id).toBe("inset(50%)");
      // (and only just past it: scrolled by whole pixels, 0 to `extra` + 1 px beyond the margin, so the case is not vacuous far away)
      expect(margin - (now.left + now.width), `${id} how far past the margin`).toBeLessThan(extra + 2);
        const box = (await page.locator(`.ab-pic[data-pic="${id}"]`).boundingBox())!;
        const y0 = Math.max(box.y - 2, 0);
        const clip = { x: Math.floor(margin) - 8, y: y0, width: 12, height: Math.min(box.height + 4, h - y0) };
        const withIt = await page.screenshot({ clip });
        const rule = await page.addStyleTag({ content: `.ab-pic[data-pic="${id}"]{visibility:hidden !important}` });
        const without = await page.screenshot({ clip });
        await rule.evaluate((el) => (el as Element).remove());
        expect(withIt.equals(without), `${id}, ${extra}px on: the margin line differs with the picture there`).toBe(true);
        compared++;
      }
    }
  }
  expect(compared).toBe(40);
});

test("the loops play only while their picture is on screen", async ({ page }) => {
  const paused = (id: string) => page.evaluate((id) => document.querySelector<HTMLVideoElement>(`.ab-pic[data-pic="${id}"] video`)!.paused, id);
  const playing = (id: string) => expect.poll(() => paused(id), { message: `${id} playing`, timeout: 5000 }).toBe(false);
  const stopped = (id: string) => expect.poll(() => paused(id), { message: `${id} paused`, timeout: 5000 }).toBe(true);

  // the start of the page, loaded and settled: no loop is visible yet (chips and strip are off to the right), so no video file has been requested at all
  await stopped("eventread");
  expect(mp4s, "video files requested before any loop was visible").toEqual([]);

  // the band loops (in line 2) play while risen on screen, stop once cut away at the margin
  await scrollTrack(page, 0.1);
  await playing("marni-came");
  await playing("sanskrit");
  await scrollTrack(page, 0.2);
  await stopped("marni-came");
  await stopped("sanskrit");

  // the strip: playing while on screen, paused once it has left either side
  await scrollTrack(page, 0.3);
  for (const id of ["cyvore", "eventread", "nordic-logic"]) await playing(id);
  await stopped("marni-came");
  await scrollTrack(page, 0.5);
  for (const id of ["cyvore", "eventread", "nordic-logic"]) await stopped(id);
  await scrollTrack(page, 0);
  for (const id of ["cyvore", "eventread", "nordic-logic"]) await stopped(id);

  expect(mp4s).toContain("/about/loops/eventread.mp4");
});

test("a loop whose file fails keeps its poster and says nothing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  // nothing has been fetched yet (preload="none"), so a route set now catches the first request for the file
  let tries = 0;
  await page.route("**/about/loops/eventread.mp4", (r) => { tries++; return r.abort(); });
  await scrollTrack(page, 0.3);
  const state = () => page.evaluate(() => {
    const v = document.querySelector<HTMLVideoElement>('.ab-pic[data-pic="eventread"] video')!;
    return { poster: v.getAttribute("poster"), failed: v.error !== null || v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE, paused: v.paused };
  });
  await expect.poll(async () => (await state()).failed, { timeout: 8000 }).toBe(true);
  const s = await state();
  expect(s.poster).toBe("/work/eventread.jpg");
  expect(s.paused).toBe(true);
  // its neighbours are not affected
  await expect.poll(() => page.evaluate(() => document.querySelector<HTMLVideoElement>('.ab-pic[data-pic="cyvore"] video')!.paused)).toBe(false);
  // leaving and coming back does not retry (no second request), and the picture is still shown (poster) in its place
  expect(tries, "requests for the failed file so far").toBe(1);
  await scrollTrack(page, 0.5);
  await scrollTrack(page, 0.3);
  await page.waitForTimeout(500);
  expect(tries, "requests for the failed file after leaving and coming back").toBe(1);
  expect(mp4s.filter((u) => u === "/about/loops/eventread.mp4")).toHaveLength(1);
  expectRule(await readPics(page), "after the failure");
  // the only console line is the browser's own network error for the file
  expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  expect(errors.length).toBeLessThanOrEqual(1);
});

test("the portrait is fully cropped by the time the first line reaches it, even when the page hydrates mid-animation", async ({ page }) => {
  // The opening animations (the photo slides in from 0.15 s, the first line from 0.30 s, 1.1 s each) move the boxes while the page hydrates;
  // the crop distance must come from layout offsets, not from rects read then. Delaying the scripts puts hydration inside the animations.
  await page.route("**/_next/static/chunks/**", async (route) => { await new Promise((r) => setTimeout(r, 700)); await route.continue(); });
  await page.goto("/about");
  await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "track");
  // hydrated (the track has its pinned height) and the animations over
  await expect.poll(() => page.evaluate(() => (document.querySelector<HTMLElement>("section.ab")!.style.height)), { timeout: 15000 }).not.toBe("");
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))));
  await settle(page);
  // scroll by the gap between the portrait's box and the first line (layout): then the line's left edge is at the portrait's right edge
  const gap = await page.evaluate(() => {
    const fig = document.querySelector<HTMLElement>(".ab-photo")!, next = fig.nextElementSibling as HTMLElement;
    return next.offsetLeft - (fig.offsetLeft + fig.offsetWidth);
  });
  expect(gap).toBeGreaterThan(50);
  await page.evaluate((gap) => window.scrollTo(0, document.querySelector<HTMLElement>("section.ab")!.offsetTop + gap), gap);
  await settle(page);
  const s = await page.evaluate(() => {
    const img = document.querySelector<HTMLElement>(".ab-portrait")!, next = (img.parentElement!.nextElementSibling as HTMLElement);
    // (computed clip-path keeps the unit it was written in: "inset(0px 0px 0px 36.5% round 10px)")
    const m = /inset\(\S+ \S+ \S+ ([\d.e+-]+)(px|%)/.exec(getComputedStyle(img).clipPath);
    const width = img.getBoundingClientRect().width;
    return { line: next.getBoundingClientRect().left, photoRight: img.getBoundingClientRect().right, cropped: m ? (m[2] === "%" ? (+m[1] / 100) * width : +m[1]) : null, width, raw: getComputedStyle(img).clipPath };
  });
  // the first line's left edge is at the portrait's right edge (within a pixel), and nothing of the portrait is left showing
  expect(Math.abs(s.line - s.photoRight), `line ${s.line} vs portrait right ${s.photoRight}`).toBeLessThanOrEqual(1.5);
  expect(s.cropped, `clip-path left inset in ${s.raw}`).not.toBeNull();
  expect(s.cropped!, `portrait cropped ${s.cropped}px of ${s.width}px`).toBeGreaterThanOrEqual(s.width - 1);
});

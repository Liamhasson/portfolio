// e2e/about-frame.spec.ts: the construction frame round the build (plan 2026-10-18-about-round3, Task 4). Until the mount
// writes the frame's state (Task 3), these set it by hand through ?pendant-debug (window.__frame), on the build stage.
// Run with `npx playwright test -c playwright.about.config.ts about-frame` (headless).
import { expect, test, type Page } from "@playwright/test";

type Stage = { cx: number; cy: number; w: number; h: number };

/** To the build stage, fully on screen (the mockup's scroll at 1440 x 900), and its rect: the frame's place at size "i". */
async function toStage(page: Page, y = 10200): Promise<Stage> {
  await page.goto("/about?pendant-debug");
  await page.waitForFunction(() => !!window.__frame, null, { timeout: 15_000 });
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const r = document.querySelector("[data-pendant='buildstage']")!.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height };
  });
}
const setFrame = (page: Page, s: Stage & { phase: string; grow?: number; retract?: number }) =>
  page.evaluate((st) => window.__frame!.set({ grow: 1, retract: 0, ...st } as never), s);

test("the frame draws round the stage, fixed, behind the pendant's canvas and above the words", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const stage = await toStage(page);
  const svg = page.locator("svg.ab-frame");
  await expect(svg).toBeHidden();
  await setFrame(page, { ...stage, phase: "build" });
  await expect(svg).toBeVisible();
  await expect(svg).toHaveAttribute("data-phase", "build");
  const z = await page.evaluate(() => {
    const f = document.querySelector("svg.ab-frame")!, c = document.querySelector("canvas.ab-pendant")!, clip = document.querySelector(".ab-clip")!;
    const cs = getComputedStyle(f);
    return {
      frame: cs.zIndex, position: cs.position, pointer: cs.pointerEvents, canvas: getComputedStyle(c).zIndex, clip: getComputedStyle(clip).zIndex,
      sameParent: f.parentElement === c.parentElement && f.parentElement === clip.parentElement,
      before: !!(f.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING),
      hidden: f.getAttribute("aria-hidden"), tab: f.querySelectorAll("[tabindex]").length,
      box: f.querySelector("[data-frame='box']")!.getBoundingClientRect().toJSON(),
    };
  });
  expect(z.position).toBe("fixed");
  expect(z.pointer).toBe("none");
  expect(z.hidden).toBe("true");
  expect(z.tab).toBe(0);
  // above the words (1); level with the canvas in front (2) and before it in the pin, so the pendant paints over its lines
  // (and with the canvas behind the words, 0, the frame is still above the canvas: only the build's front pendant is in it)
  expect(z.sameParent).toBe(true);
  expect(Number(z.frame)).toBeGreaterThan(Number(z.clip));
  expect(Number(z.frame)).toBeLessThanOrEqual(2);
  expect(z.before).toBe(true);
  // the top edge on the stage's top, centred on the stage
  expect(z.box.left + z.box.width / 2).toBeCloseTo(stage.cx, 0);
  expect(z.box.top).toBeCloseTo(stage.cy - stage.h / 2, 0);
  expect(z.box.width).toBeCloseTo(stage.w, 0);
  // real pixels: the frame's left edge (clear of the pendant) shows its hairline; gone once the frame is hidden
  const x = Math.round(stage.cx - stage.w / 2), y0 = Math.round(stage.cy);
  const strip = { x: x - 3, y: y0 - 60, width: 7, height: 40 };
  const lum = async () => page.evaluate(async (src) => {
    const img = new Image();
    img.src = `data:image/png;base64,${src}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let m = 0;
    for (let i = 0; i < d.length; i += 4) m = Math.max(m, d[i] + d[i + 1] + d[i + 2]);
    return m;
  }, (await page.screenshot({ clip: strip })).toString("base64"));
  const drawn = await lum();
  await setFrame(page, { ...stage, phase: null as never });
  await expect(svg).toBeHidden();
  const bare = await lum();
  expect(drawn).toBeGreaterThan(bare + 150);
  expect(errors).toEqual([]);
});

/** The frame placed by the store's documented relation (build-frame-state.ts, still i-2) on the pendant's box as it stands:
 *  centred across on it, top 0.22 of its height below its top, bottom 0.045 of it below its base, the stage's width. (The
 *  hook's box is the projected bounds, a little loose: the frame comes out a little larger, the safe side here.) */
async function byPendant(page: Page, stage: Stage): Promise<Stage> {
  await page.waitForFunction(() => window.__pendant?.ready === true, null, { timeout: 15_000 });
  const b = await page.evaluate(() => window.__pendant!.box);
  const ph = b.b - b.t, top = b.t + 0.22 * ph, bottom = b.b + 0.045 * ph;
  return { cx: (b.l + b.r) / 2, cy: (top + bottom) / 2, w: stage.w, h: bottom - top };
}

for (const place of ["the stage", "the pendant's pivot"] as const) test(`no line of text crosses the frame or its guides while it holds (on ${place})`, async ({ page }) => {
  const stage = await toStage(page);
  await setFrame(page, { ...(place === "the stage" ? stage : await byPendant(page, stage)), phase: "build" });
  const hits = await page.evaluate(() => {
    // the frame's whole drawing: the box, and the guides' 16 px past it
    const f = document.querySelector("svg.ab-frame")!;
    const r = [...f.querySelectorAll("[data-frame='box'], [data-frame='gh'], [data-frame='gv']")].map((n) => n.getBoundingClientRect());
    const box = { l: Math.min(...r.map((b) => b.left)) - 3, t: Math.min(...r.map((b) => b.top)) - 3, r: Math.max(...r.map((b) => b.right)) + 3, b: Math.max(...r.map((b) => b.bottom)) + 3 };
    const out: string[] = [];
    const walk = document.createTreeWalker(document.querySelector(".ab-track")!, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const q of range.getClientRects()) {
        if (q.right < 0 || q.left > innerWidth || q.width === 0) continue;
        if (q.left < box.r && q.right > box.l && q.top < box.b && q.bottom > box.t) out.push(n.textContent.trim().slice(0, 40));
      }
    }
    return out;
  });
  expect(hits).toEqual([]);
});

test("it follows a resize: the frame covers the new screen and redraws at the new place", async ({ page }) => {
  let stage = await toStage(page);
  await setFrame(page, { ...stage, phase: "build" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);
  stage = await page.evaluate(() => {
    const r = document.querySelector("[data-pendant='buildstage']")!.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height };
  });
  await setFrame(page, { ...stage, phase: "build" });
  const m = await page.evaluate(() => {
    const f = document.querySelector("svg.ab-frame")!;
    return { svg: f.getBoundingClientRect().toJSON(), box: f.querySelector("[data-frame='box']")!.getBoundingClientRect().toJSON() };
  });
  expect(m.svg.width).toBe(1280);
  expect(m.svg.height).toBe(800);
  expect(m.box.left + m.box.width / 2).toBeCloseTo(stage.cx, 0);
  expect(m.box.width).toBeCloseTo(stage.w, 0);
});

test("stacked (a portrait phone): no frame, whatever the state says", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/about?pendant-debug");
  await page.waitForFunction(() => !!window.__frame, null, { timeout: 15_000 });
  await expect(page.locator("section.ab")).toHaveAttribute("data-mode", "stack");
  await setFrame(page, { cx: 195, cy: 422, w: 300, h: 260, phase: "build" });
  await expect(page.locator("svg.ab-frame")).toHaveAttribute("data-phase", "build");
  await expect(page.locator("svg.ab-frame")).toBeHidden();
  expect(await page.locator("svg.ab-frame").evaluate((el) => getComputedStyle(el).display)).toBe("none");
});

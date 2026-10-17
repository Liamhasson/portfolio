// src/app/about/about-testimonials.test.tsx
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// (jsdom has no WebGL: the light is mocked unless a test asks for the real one, the mount's own logic is what's under test)
const real = vi.hoisted(() => ({ on: false }));
const draw = vi.fn();
const resize = vi.fn();
const dispose = vi.fn();
vi.mock("@/three/edge-light/testimonials-light", async (orig) => {
  const mod = await orig<typeof import("@/three/edge-light/testimonials-light")>();
  return {
    ...mod,
    TestimonialsLight: {
      create: (c: HTMLCanvasElement) => (real.on ? mod.TestimonialsLight.create(c) : { draw, resize, dispose }),
    },
  };
});

import { claimGlass, glassLight, resetGlassForTests, setGlassLight } from "@/lib/about-glass";
import { AboutTestimonials } from "./about-testimonials";

const g = globalThis as unknown as Record<string, unknown>;

/** About's pinned frame with the two quotes and the glass slot between them, as about-track.tsx renders it. */
const Page = () => (
  <section className="ab" data-mode="track">
    <div className="ab-pin">
      <div className="ab-mood" aria-hidden />
      <div className="ab-clip">
        <div className="ab-track">
          <figure className="ab-quote" data-pendant="quote1" />
          <div className="ab-glass" data-pendant="glass" />
          <figure className="ab-quote" data-pendant="quote2" />
        </div>
      </div>
      <AboutTestimonials />
    </div>
  </section>
);

/** Where the quotes and the slot sit on screen (jsdom has no layout: the rects are stubbed; the track at 0, a 1000 px screen). */
let at = { q1: 0, slot: 0, q2: 0 };
const W = 1000, H = 800, SLOT = 170;
function rect(cx: number, w: number): DOMRect {
  return { left: cx - w / 2, right: cx + w / 2, top: H / 2 - w / 2, bottom: H / 2 + w / 2, width: w, height: w, x: cx - w / 2, y: H / 2 - w / 2, toJSON() {} } as DOMRect;
}

let rafs: FrameRequestCallback[] = [];
/** Reduced motion, switchable mid-test (the mount listens for the change). */
let reducedNow = false;
let onReducedChange: (() => void) | null = null;
const runFrame = async (now = 1000) => { await act(async () => { rafs.splice(0).forEach((cb) => cb(now)); }); };

function setup() {
  reducedNow = false;
  window.matchMedia = vi.fn(() => ({
    get matches() { return reducedNow; },
    addEventListener: (_: string, cb: () => void) => { onReducedChange = cb; },
    removeEventListener() {},
  })) as never;
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
  const idle: (() => void)[] = [];
  g.requestIdleCallback = vi.fn((cb: () => void) => idle.push(cb));
  g.cancelIdleCallback = vi.fn();
  rafs = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { rafs.push(cb); return rafs.length; });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => { rafs = []; });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: W });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: H });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const p = this.dataset.pendant;
    if (p === "quote1") return rect(at.q1, 500);
    if (p === "quote2") return rect(at.q2, 500);
    if (p === "glass") return rect(at.slot, SLOT);
    return rect(0, 0);   // (the track and the clip: at the screen's left, so a rect is its place on screen)
  });
  return {
    runIdle: async () => {
      await waitFor(() => expect(idle.length).toBeGreaterThan(0)); // (the fonts first)
      await act(async () => { idle.splice(0).forEach((cb) => cb()); });
    },
  };
}

/** Mounted and loaded: the light made, the first frame asked for. */
async function mount() {
  const { runIdle } = setup();
  const view = render(<Page />);
  await runIdle();
  await waitFor(() => expect(window.__testimonials).toBeDefined());
  return view;
}

beforeEach(() => {
  real.on = false;
  draw.mockReset(); resize.mockReset(); dispose.mockReset();
  at = { q1: 2400, slot: 2800, q2: 3200 }; // (far right: q 0, the slot off screen)
});
afterEach(() => {
  resetGlassForTests();
  vi.restoreAllMocks();
  delete g.requestIdleCallback;
  delete g.cancelIdleCallback;
  delete window.__testimonials;
});

test("renders the light canvas aria-hidden, never taking the pointer", () => {
  setup();
  const { container } = render(<Page />);
  const canvas = container.querySelector("canvas.ab-light") as HTMLCanvasElement;
  expect(canvas).not.toBeNull();
  expect(canvas).toHaveAttribute("aria-hidden", "true");
  expect(canvas.style.pointerEvents).toBe("none");
});

test("no WebGL: no canvas is left, the mood stays off, nothing in the console", async () => {
  real.on = true;
  const error = vi.spyOn(console, "error");
  const { runIdle } = setup();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => null) as never);
  const { container } = render(<Page />);
  await runIdle();
  await waitFor(() => expect(container.querySelector("canvas.ab-light")).toBeNull());
  expect((container.querySelector(".ab-mood") as HTMLElement).style.getPropertyValue("--q")).toBe("");
  expect(error).not.toHaveBeenCalled();
});

test("the loop stops when q is 0 and the slot is off screen", async () => {
  await mount();
  await runFrame();
  expect(window.__testimonials).toMatchObject({ q: 0, drawing: false });
  expect(draw).not.toHaveBeenCalled();
  expect(rafs).toHaveLength(0); // (no frame asked for)
});

test("runs while the slot is within a slot's width of the screen, and while q > 0", async () => {
  await mount();
  at = { q1: W + 1100, slot: W + SLOT - 10, q2: W + 1500 }; // (the slot just inside one width of the right edge; q still 0)
  window.dispatchEvent(new Event("scroll"));
  await runFrame();
  expect(window.__testimonials).toMatchObject({ q: 0, drawing: true });
  expect(rafs).toHaveLength(1);
  at = { q1: 600, slot: 900, q2: 1300 }; // (Yoav centred: q 1)
  await runFrame(1100);
  expect(window.__testimonials!.q).toBeCloseTo(1, 9);
  expect(draw).toHaveBeenLastCalledWith(expect.objectContaining({ pulseFrom: "right" }));
  expect((document.querySelector(".ab-mood") as HTMLElement).style.getPropertyValue("--q")).toBe("1.000");
  at = { q1: -2400, slot: -2000, q2: -1600 }; // (all gone past the left)
  await runFrame(1200);
  expect(window.__testimonials).toMatchObject({ q: 0, drawing: false });
  expect(rafs).toHaveLength(0);
});

/** The pendant's canvas, as about-pendant.tsx mounts it in `.ab-pin`, at an opacity (its fade-in, as the page computes it). */
function pendantCanvas(opacity: number) {
  const pc = document.createElement("canvas");
  pc.className = "ab-pendant";
  pc.style.opacity = String(opacity);
  document.querySelector(".ab-pin")!.appendChild(pc);
  return pc;
}

test("the light draws its own ball only while nobody has claimed the glass", async () => {
  await mount();
  const pc = pendantCanvas(0);
  at = { q1: 100, slot: 500, q2: 900 }; // (the slot centred)
  window.dispatchEvent(new Event("scroll"));
  await runFrame(1000);
  expect(window.__testimonials!.ownBall).toBe(true);
  const ball = draw.mock.lastCall![0].ball;
  expect(ball.x).toBeCloseTo(500, 9);
  expect(ball.y).toBeCloseTo(H / 2, 9);
  expect(ball.r).toBeCloseTo(0.44 * SLOT, 9);
  expect(ball.a).toBe(1);
  const release = claimGlass("pendant");
  pc.style.opacity = "1"; // (its fade done)
  await runFrame(1100);
  expect(window.__testimonials!.ownBall).toBe(false);
  expect(draw.mock.lastCall![0].ball).toBeNull();
  // given back (the pendant's context lost: its canvas hidden): the light's ball at once
  release();
  pc.hidden = true;
  await runFrame(1200);
  expect(window.__testimonials!.ownBall).toBe(true);
  expect(draw.mock.lastCall![0].ball.a).toBe(1);
});

test("handed to the pendant, the light's ball fades out as the pendant's canvas fades in: 1 − its opacity", async () => {
  await mount();
  const pc = pendantCanvas(0);
  at = { q1: 100, slot: 500, q2: 900 };
  window.dispatchEvent(new Event("scroll"));
  await runFrame(1000);
  claimGlass("pendant");
  await runFrame(1100); // (claimed, not drawn yet: the light's ball holds)
  expect(draw.mock.lastCall![0].ball.a).toBe(1);
  expect(window.__testimonials!.ownBall).toBe(true);
  pc.style.opacity = "0.25";
  await runFrame(1200);
  expect(draw.mock.lastCall![0].ball.a).toBeCloseTo(0.75, 9);
  pc.style.opacity = "0.9";
  await runFrame(1300);
  expect(draw.mock.lastCall![0].ball.a).toBeCloseTo(0.1, 9);
  pc.style.opacity = "1";
  await runFrame(1400);
  expect(draw.mock.lastCall![0].ball).toBeNull();
  expect(window.__testimonials!.ownBall).toBe(false);
  pc.style.opacity = "0.5"; // (done: the pendant's later fades, its outro, don't bring the light's ball back)
  await runFrame(1500);
  expect(draw.mock.lastCall![0].ball).toBeNull();
});

test("a pendant that claimed the glass before the light drew a ball: no ball fades in from nowhere", async () => {
  claimGlass("pendant");
  await mount();
  at = { q1: 100, slot: 500, q2: 900 };
  window.dispatchEvent(new Event("scroll"));
  await runFrame(1000);
  expect(draw.mock.lastCall![0].ball).toBeNull();
  expect(window.__testimonials!.ownBall).toBe(false);
});

test("a release and a fresh claim while the slot is away start the handoff afresh: no ball fades in from nowhere", async () => {
  await mount();
  const pc = pendantCanvas(0);
  at = { q1: 100, slot: 500, q2: 900 };
  window.dispatchEvent(new Event("scroll"));
  await runFrame(1000);
  const release = claimGlass("pendant");
  pc.style.opacity = "0.5";
  await runFrame(1100); // (a handoff under way)
  expect(draw.mock.lastCall![0].ball.a).toBeCloseTo(0.5, 9);
  at = { q1: 1000, slot: 1400, q2: 1800 }; // (the slot more than a width off the right; q still above 0: frames run)
  await runFrame(1200);
  expect(draw.mock.lastCall![0].ball).toBeNull();
  release(); // (the pendant's context lost, then back on a fresh canvas that claims again, fading in from 0)
  pc.remove();
  await runFrame(1300);
  pendantCanvas(0);
  claimGlass("pendant");
  await runFrame(1400);
  at = { q1: 100, slot: 500, q2: 900 }; // (back in the middle: the pendant's ball, no light's ball out of nowhere)
  await runFrame(1500);
  expect(draw.mock.lastCall![0].ball).toBeNull();
  expect(window.__testimonials!.ownBall).toBe(false);
});

test("tells the pendant the light every frame it draws (q, its own clock, the pulse), null at q 0 and when it goes", async () => {
  const { unmount } = await mount();
  setGlassLight({ q: 1, t: 1, pulse: 1 }); // (a stale value: the first frame at q 0 must clear it)
  at = { q1: W + 1100, slot: W + SLOT - 10, q2: W + 1500 }; // (drawing for the slot, q 0)
  window.dispatchEvent(new Event("scroll"));
  await runFrame(1000);
  expect(window.__testimonials).toMatchObject({ q: 0, drawing: true });
  expect(glassLight()).toBeNull();
  at = { q1: 600, slot: 900, q2: 1300 }; // (q 1)
  await runFrame(1500);
  const l = glassLight()!;
  expect(l.q).toBeCloseTo(1, 9);
  expect(l.t).toBe(draw.mock.lastCall![0].t);
  expect(l.pulse).toBe(draw.mock.lastCall![0].pulse);
  at = { q1: -2400, slot: -2000, q2: -1600 }; // (all gone past the left: idle)
  await runFrame(1600);
  expect(glassLight()).toBeNull();
  at = { q1: 600, slot: 900, q2: 1300 };
  window.dispatchEvent(new Event("scroll"));
  await runFrame(1700);
  expect(glassLight()).not.toBeNull();
  unmount();
  expect(glassLight()).toBeNull();
});

test("the light is sized from its own box (a classic scrollbar left out), not the window", async () => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) { return this instanceof HTMLCanvasElement ? 985 : 0; });
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) { return this instanceof HTMLCanvasElement ? 785 : 0; });
  await mount();
  at = { q1: 600, slot: 900, q2: 1300 };
  window.dispatchEvent(new Event("scroll"));
  await runFrame();
  expect(resize).toHaveBeenLastCalledWith(985, 785, expect.any(Number));
});

test("the hook publishes the pulse as drawn: −1 under reduced motion", async () => {
  await mount();
  at = { q1: 600, slot: 900, q2: 1300 }; // (straight in: a wave)
  window.dispatchEvent(new Event("scroll"));
  await runFrame(1000);
  await runFrame(1500);
  expect(window.__testimonials!.pulse).toBeCloseTo(0.25, 9);
  reducedNow = true;
  act(() => onReducedChange?.());
  await runFrame(1600);
  expect(draw.mock.lastCall![0].pulse).toBe(-1);
  expect(window.__testimonials!.pulse).toBe(-1);
});

test("the debug hook is read-only", async () => {
  await mount();
  expect(Object.isFrozen(window.__testimonials)).toBe(true);
});

test("unmounting stops the loop and frees the light", async () => {
  const { unmount } = await mount();
  at = { q1: 600, slot: 900, q2: 1300 };
  window.dispatchEvent(new Event("scroll"));
  await runFrame();
  unmount();
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(rafs).toHaveLength(0);
});

// ---------- Task 4: the glass edges ----------

/** Chromium, as far as the feature check can tell (jsdom has no userAgentData), with a 2D canvas for the lens's map. */
function asChromium() {
  Object.defineProperty(navigator, "userAgentData", { configurable: true, value: { brands: [{ brand: "Chromium", version: "130" }] } });
  const putImageData = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ({ putImageData })) as never);
  const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => "data:image/png;base64,TEST");
  if (typeof g.ImageData !== "function") {
    g.ImageData = class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} };
  }
  return { putImageData, toDataURL };
}
afterEach(() => {
  delete (navigator as unknown as Record<string, unknown>).userAgentData;
});

/** The strips' filters, top, right, bottom, left: each one's map slice and displacement. */
const filters = () => (["top", "right", "bottom", "left"] as const).map((e) => {
  const f = document.querySelector(`#ab-edge-lens-${e}`)!;
  return { img: f.querySelector("feImage")!, disp: f.querySelector("feDisplacementMap")! };
});
const placed = (img: Element) => ["x", "y", "width", "height"].map((a) => Number(img.getAttribute(a)));

test("no lens outside Chromium (no userAgentData): no element, no filter, the hook reads 0", async () => {
  await mount();
  at = { q1: 600, slot: 900, q2: 1300 };
  window.dispatchEvent(new Event("scroll"));
  await runFrame();
  expect(document.querySelector(".ab-lens")).toBeNull();
  expect(document.querySelector(".ab-lens-defs")).toBeNull();
  expect(window.__testimonials!.lens).toBe(0);
});

test("Chromium: four strips, each its slice of the map; shown only while q > 0.01, scale 2·26·q easing below full; reduced: 26·q", async () => {
  const { putImageData, toDataURL } = asChromium();
  await mount();
  const lens = document.querySelector<HTMLElement>(".ab-lens")!;
  expect(lens).not.toBeNull();
  expect(lens).toHaveAttribute("aria-hidden", "true");
  expect([...lens.querySelectorAll<HTMLElement>(".ab-lens-strip")].map((s) => s.dataset.edge)).toEqual(["top", "right", "bottom", "left"]);
  // 1000 x 800: the band 52 px, the strips 86 px deep (band + pull + margin)
  expect(lens.style.getPropertyValue("--lens-d")).toBe("86px");
  const fs = filters();
  // the map: built once on mount at half the screen's resolution, cut into the strips' four slices (map px)
  expect(toDataURL).toHaveBeenCalledTimes(4);
  const full = putImageData.mock.calls[0][0] as { width: number; height: number };
  expect([full.width, full.height]).toEqual([W / 2, H / 2]);
  expect(putImageData.mock.calls.map((c) => c.slice(1))).toEqual([
    [-0, -0, 0, 0, 500, 43],
    [-457, -43, 457, 43, 43, 314],
    [-0, -357, 0, 357, 500, 43],
    [-0, -43, 0, 43, 43, 314],
  ]);
  // each slice placed over its strip's own box (screen px, the strip's own space)
  expect(fs.map((f) => placed(f.img))).toEqual([[0, 0, 1000, 86], [0, 0, 86, 628], [0, 0, 1000, 86], [0, 0, 86, 628]]);
  for (const f of fs) expect(f.img.getAttribute("href")).toBe("data:image/png;base64,TEST");
  // q 0 (the slot near, the light drawing): hidden
  at = { q1: W + 1100, slot: W + SLOT - 10, q2: W + 1500 };
  window.dispatchEvent(new Event("scroll"));
  await runFrame(1000);
  expect(window.__testimonials).toMatchObject({ drawing: true, lens: 0 });
  expect(lens.dataset.on).toBeUndefined();
  // q 1: shown, at most the full pull (52), easing down to 0.8 of it; every strip the same
  at = { q1: 600, slot: 900, q2: 1300 };
  await runFrame(2000);
  expect(lens.dataset.on).toBe("");
  const s = Number(fs[0].disp.getAttribute("scale"));
  expect(s).toBeGreaterThanOrEqual(52 * 0.8 - 0.05);
  expect(s).toBeLessThanOrEqual(52);
  for (const f of fs) expect(f.disp.getAttribute("scale")).toBe(fs[0].disp.getAttribute("scale"));
  expect(window.__testimonials!.lens).toBe(s);
  // the same frame again: the DOM untouched (the scale moves by less than 0.1)
  const sets = fs.map((f) => vi.spyOn(f.disp, "setAttribute"));
  await runFrame(2000);
  for (const set of sets) expect(set).not.toHaveBeenCalled();
  // reduced motion: a fixed gentle bend, half the strength
  reducedNow = true;
  act(() => onReducedChange?.());
  await runFrame(5000);
  for (const f of fs) expect(f.disp.getAttribute("scale")).toBe("26.0");
  // gone past: hidden again
  at = { q1: -2400, slot: -2000, q2: -1600 };
  await runFrame(6000);
  expect(lens.dataset.on).toBeUndefined();
  expect(window.__testimonials!.lens).toBe(0);
});

test("a resize stretches each slice over its strip's new box at once and rebuilds the map 150 ms after the resize settles", async () => {
  const { toDataURL } = asChromium();
  await mount();
  const fs = filters();
  expect(toDataURL).toHaveBeenCalledTimes(4);
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 700 });
  window.dispatchEvent(new Event("resize"));
  window.dispatchEvent(new Event("resize"));
  // at once: the old 86 px strips over the new screen
  expect(fs.map((f) => placed(f.img))).toEqual([[0, 0, 1200, 86], [0, 0, 86, 528], [0, 0, 1200, 86], [0, 0, 86, 528]]);
  expect(toDataURL).toHaveBeenCalledTimes(4);
  await waitFor(() => expect(toDataURL).toHaveBeenCalledTimes(8), { timeout: 1000 });
  // rebuilt: 1200 x 700, the band 45.5 px, the strips 80 px deep
  expect(document.querySelector<HTMLElement>(".ab-lens")!.style.getPropertyValue("--lens-d")).toBe("80px");
  expect(fs.map((f) => placed(f.img))).toEqual([[0, 0, 1200, 80], [0, 0, 80, 540], [0, 0, 1200, 80], [0, 0, 80, 540]]);
  await new Promise((r) => setTimeout(r, 250));
  expect(toDataURL).toHaveBeenCalledTimes(8); // (debounced: one rebuild for the two events)
});

test("unmounting hides the lens and stops listening for resizes", async () => {
  const { toDataURL } = asChromium();
  const { unmount } = await mount();
  at = { q1: 600, slot: 900, q2: 1300 };
  window.dispatchEvent(new Event("scroll"));
  await runFrame();
  expect(document.querySelector<HTMLElement>(".ab-lens")!.dataset.on).toBe("");
  unmount();
  expect(document.querySelector(".ab-lens")).toBeNull();
  window.dispatchEvent(new Event("resize"));
  await new Promise((r) => setTimeout(r, 250));
  expect(toDataURL).toHaveBeenCalledTimes(4);
});

// ---------- Task 4, fix round 2: the map waits; no work after a failure or an unchanged resize ----------

test("no map is built before About has painted, nor while the section is stacked; it comes once on the track", async () => {
  const { toDataURL } = asChromium();
  const { runIdle } = setup();
  const { container } = render(<Page />);
  const sec = container.querySelector<HTMLElement>("section.ab")!;
  sec.dataset.mode = "stack"; // (the layout before paint: stacked)
  await act(async () => { await Promise.resolve(); });
  expect(toDataURL).not.toHaveBeenCalled(); // (before paint)
  await runIdle();
  await new Promise((r) => setTimeout(r, 0));
  expect(toDataURL).not.toHaveBeenCalled(); // (painted, but stacked: the lens can't show)
  expect(document.querySelector("#ab-edge-lens-top feImage")!.getAttribute("href")).toBeNull();
  sec.dataset.mode = "track";
  await waitFor(() => expect(toDataURL).toHaveBeenCalledTimes(4));
  expect(document.querySelector("#ab-edge-lens-top feImage")!.getAttribute("href")).toBe("data:image/png;base64,TEST");
});

test("after the light fails, the lens is gone and a resize builds nothing", async () => {
  const { toDataURL } = asChromium();
  await mount();
  expect(toDataURL).toHaveBeenCalledTimes(4);
  draw.mockImplementation(() => { throw new Error("context lost"); });
  at = { q1: 600, slot: 900, q2: 1300 };
  window.dispatchEvent(new Event("scroll"));
  await runFrame();
  await waitFor(() => expect(document.querySelector("canvas.ab-light")).toBeNull());
  expect(document.querySelector(".ab-lens")).toBeNull();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
  window.dispatchEvent(new Event("resize"));
  await new Promise((r) => setTimeout(r, 250));
  expect(toDataURL).toHaveBeenCalledTimes(4);
});

test("a resize that leaves the screen's size as it was rebuilds nothing and touches no placement", async () => {
  const { toDataURL } = asChromium();
  await mount();
  const fs = filters();
  const sets = fs.map((f) => vi.spyOn(f.img, "setAttribute"));
  window.dispatchEvent(new Event("resize")); // (the same 1000 x 800)
  await new Promise((r) => setTimeout(r, 250));
  expect(toDataURL).toHaveBeenCalledTimes(4);
  for (const set of sets) expect(set).not.toHaveBeenCalled();
  // away and straight back before the rebuild: stretched, then the exact placements put back, still no rebuild
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 700 });
  window.dispatchEvent(new Event("resize"));
  expect(placed(fs[1].img)).toEqual([0, 0, 86, 528]);
  Object.defineProperty(window, "innerHeight", { configurable: true, value: H });
  window.dispatchEvent(new Event("resize"));
  expect(fs.map((f) => placed(f.img))).toEqual([[0, 0, 1000, 86], [0, 0, 86, 628], [0, 0, 1000, 86], [0, 0, 86, 628]]);
  await new Promise((r) => setTimeout(r, 250));
  expect(toDataURL).toHaveBeenCalledTimes(4);
});

test("on a very short screen the strips' depth is clamped to half of it, as lensStrips clamps it", async () => {
  asChromium();
  const { runIdle } = setup();
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 70 }); // (band 4.55 px: 39 px strips, more than half)
  render(<Page />);
  await runIdle();
  await waitFor(() => expect(document.querySelector<HTMLElement>(".ab-lens")!.style.getPropertyValue("--lens-d")).toBe("35px"));
  // (the top and bottom strips meet: the side strips have no height left, their slices the 1 map px minimum)
  expect(placed(filters()[0].img)[3]).toBe(36); // (35 px, its slice rounded outward to whole map px: 18)
  expect(placed(filters()[1].img)[3]).toBeLessThanOrEqual(2);
});

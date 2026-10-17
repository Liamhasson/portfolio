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

import { claimGlass, resetGlassForTests } from "@/lib/about-glass";
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

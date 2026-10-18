import { afterEach, describe, expect, test, vi } from "vitest";
import { NO_RIPPLE, RIPPLE_BULGE, RIPPLE_LIFE, RIPPLE_MAX, type GlassRipple } from "@/three/edge-light/field";
import {
  BALL_OF_SLOT, glassPointer, glassPointerIn, liveRings, newPointer, packRipple, RIPPLE_EVERY, sampleHover, stepLean, tapAt,
} from "./glass-pointer";

const out = (): GlassRipple => ({ waves: new Float32Array(RIPPLE_MAX * 4), lean: new Float32Array(2) });
const started = (s: ReturnType<typeof newPointer>) => s.rings.filter((r) => Number.isFinite(r.t0)).map((r) => r.t0).sort((a, b) => a - b);

describe("the rings: when they start", () => {
  test("coming onto the ball starts one ring, where the cursor is", () => {
    const s = newPointer();
    sampleHover(s, { x: 0.9, y: 0.1 }, 10);
    expect(started(s)).toEqual([10]);
    const r = s.rings.find((x) => x.t0 === 10)!;
    expect([r.x, r.y]).toEqual([0.9, 0.1]);
    expect(s.over).toBe(true);
  });

  test("over the slot but off the ball (past its radius) starts nothing", () => {
    const s = newPointer();
    sampleHover(s, { x: 1.05, y: 0 }, 10);
    expect(started(s)).toEqual([]);
    expect(s.over).toBe(false);
  });

  test("moving over the ball starts one every 0.5 s, never more often", () => {
    const s = newPointer();
    // a move every frame (60 fps) for 2 s, from the right edge toward the middle
    for (let i = 0; i <= 120; i++) sampleHover(s, { x: 0.95 - i * 0.005, y: 0 }, 10 + i / 60);
    const t = [...new Set(started(s))];
    // (4 slots: the newest four of 10, 10.5, 11, 11.5, 12)
    expect(t.length).toBe(RIPPLE_MAX);
    for (let i = 1; i < t.length; i++) expect(t[i] - t[i - 1]).toBeGreaterThanOrEqual(RIPPLE_EVERY - 1e-9);
    for (let i = 1; i < t.length; i++) expect(t[i] - t[i - 1]).toBeLessThan(RIPPLE_EVERY + 1 / 60 + 1e-9);
    expect(t[t.length - 1]).toBeCloseTo(12, 6);
  });

  test("a cursor resting on the ball starts no more after the first", () => {
    const s = newPointer();
    for (let i = 0; i <= 180; i++) sampleHover(s, { x: 0.5, y: 0.5 }, 10 + i / 60);
    expect(started(s)).toEqual([10]);
  });

  test("leaving and coming back starts a ring at once, whatever the 0.5 s", () => {
    const s = newPointer();
    sampleHover(s, { x: 0.9, y: 0 }, 10);
    sampleHover(s, { x: 1.2, y: 0 }, 10.1);
    sampleHover(s, { x: 0.9, y: 0 }, 10.2);
    expect(started(s)).toEqual([10, 10.2]);
  });

  test("at most four: a fifth takes the oldest's place", () => {
    const s = newPointer();
    for (let i = 0; i < 5; i++) tapAt(s, 0, 0, i * 0.25);
    expect(started(s)).toEqual([0.25, 0.5, 0.75, 1]);
  });

  test("a tap on the ball starts one ring there; a tap off it none", () => {
    const s = newPointer();
    expect(tapAt(s, 0.3, -0.4, 5)).toBe(true);
    expect(tapAt(s, 0.9, 0.9, 5.1)).toBe(false);
    expect(started(s)).toEqual([5]);
    expect(s.over).toBe(false); // (a tap is no hover: no lean)
  });

  test("each ring is gone after RIPPLE_LIFE: its strength is 0 and it no longer counts", () => {
    const s = newPointer(), o = out();
    tapAt(s, 0, 0, 1);
    expect(liveRings(s, 1.2)).toBe(1);
    packRipple(s, 1.2, o);
    expect(o.waves[3]).toBeGreaterThan(0);
    expect(o.waves[2]).toBeCloseTo(0.2, 6);
    expect(liveRings(s, 1 + RIPPLE_LIFE)).toBe(0);
    packRipple(s, 1 + RIPPLE_LIFE, o);
    for (let i = 0; i < RIPPLE_MAX; i++) expect([o.waves[i * 4 + 2], o.waves[i * 4 + 3]]).toEqual([0, 0]); // (age, strength)
  });
});

describe("the lean: toward the cursor, back like liquid", () => {
  test("it eases toward the cursor on the ball and holds there", () => {
    const s = newPointer();
    for (let i = 0; i <= 120; i++) { sampleHover(s, { x: 0.8, y: 0 }, i / 60); stepLean(s, i / 60); }
    expect(s.lx).toBeCloseTo(0.8, 2);
    expect(s.ly).toBeCloseTo(0, 6);
  });

  test("it never leans past RIPPLE_BULGE: the swing past the cursor is clamped to length 1", () => {
    const s = newPointer(), o = out();
    let most = 0, spring = 0;
    for (let i = 0; i <= 120; i++) {
      sampleHover(s, { x: 0.99, y: 0 }, i / 60);
      stepLean(s, i / 60);
      packRipple(s, i / 60, o);
      spring = Math.max(spring, s.lx);
      most = Math.max(most, Math.hypot(o.lean[0], o.lean[1]));
    }
    expect(spring).toBeGreaterThan(1); // (the spring itself overshoots the cursor)
    expect(most).toBeLessThanOrEqual(1 + 1e-6);     // (what the shaders get doesn't)
    expect(RIPPLE_BULGE).toBeLessThanOrEqual(0.03);
  });

  test("on leave it swings a touch past rest, then settles to rest within about 1.5 s", () => {
    const s = newPointer();
    let t = 0;
    for (; t <= 2; t += 1 / 60) { sampleHover(s, { x: 0.9, y: 0 }, t); stepLean(s, t); }
    sampleHover(s, null, t);
    let least = Infinity;
    const t1 = t;
    for (; t <= t1 + 1.5; t += 1 / 60) { stepLean(s, t); least = Math.min(least, s.lx); }
    expect(least).toBeLessThan(-0.02);    // (past rest: liquid, not a plain ease)
    expect(least).toBeGreaterThan(-0.4);  // (a touch, not a bounce)
    expect(Math.abs(s.lx)).toBeLessThan(0.02);
  });

  test("after a long gap (the loop stopped) it is where it was heading, no swing", () => {
    const s = newPointer();
    sampleHover(s, { x: 0.9, y: 0 }, 0);
    stepLean(s, 0);
    stepLean(s, 1 / 60);
    sampleHover(s, null, 0.02);
    stepLean(s, 5);
    expect([s.lx, s.ly, s.vx, s.vy]).toEqual([0, 0, 0, 0]);
  });
});

describe("glassPointer: the slot's listener", () => {
  let reduced = false;
  const slotAt = (left: number, top: number, w: number) => {
    const el = document.createElement("div");
    el.setAttribute("data-pendant", "glass");
    el.getBoundingClientRect = () => ({ left, top, width: w, height: w, right: left + w, bottom: top + w, x: left, y: top, toJSON() {} }) as DOMRect;
    document.body.appendChild(el);
    return el;
  };
  const fire = (el: Element, type: string, init: { clientX?: number; clientY?: number; pointerType?: string; pointerId?: number; isPrimary?: boolean }) => {
    const e = new Event(type, { bubbles: false });
    Object.assign(e, { clientX: 0, clientY: 0, pointerType: "mouse", pointerId: 1, isPrimary: true, ...init });
    el.dispatchEvent(e);
  };
  const mockMedia = () => {
    window.matchMedia = vi.fn((q: string) => ({ get matches() { return reduced && q.includes("reduce"); }, addEventListener() {}, removeEventListener() {} })) as never;
  };
  afterEach(() => { document.body.innerHTML = ""; reduced = false; vi.restoreAllMocks(); });

  test("a mouse coming onto the ball (the slot's centre, radius 0.44 x its width) starts a ring in disc units, y up", () => {
    mockMedia();
    const el = slotAt(100, 100, 200), p = glassPointer(el), R = BALL_OF_SLOT * 200;
    const now = performance.now();
    fire(el, "pointerenter", { clientX: 200 + 0.5 * R, clientY: 200 - 0.25 * R });
    const w = p.read(now + 100);
    const k = [0, 1, 2, 3].find((i) => w.waves[i * 4 + 3] > 0)!;
    expect(k).toBeDefined();
    expect(w.waves[k * 4]).toBeCloseTo(0.5, 5);
    expect(w.waves[k * 4 + 1]).toBeCloseTo(0.25, 5);
    expect(window.__glassRipple?.over).toBe(true);
    expect(window.__glassRipple?.spawned).toBe(1);
    p.release();
  });

  test("a mouse over the slot's corner (off the ball) starts nothing; a touch's enter isn't a hover", () => {
    mockMedia();
    const el = slotAt(0, 0, 200), p = glassPointer(el);
    fire(el, "pointerenter", { clientX: 2, clientY: 2 });
    fire(el, "pointerenter", { clientX: 100, clientY: 100, pointerType: "touch" });
    p.read(performance.now() + 50);
    expect(window.__glassRipple?.spawned).toBe(0);
    p.release();
  });

  test("a tap (a touch down and up on the ball) starts one ring; a touch the page took for a scroll (cancelled) none", () => {
    mockMedia();
    const el = slotAt(0, 0, 200), p = glassPointer(el);
    fire(el, "pointerdown", { clientX: 100, clientY: 100, pointerType: "touch", pointerId: 7 });
    fire(el, "pointercancel", { pointerType: "touch", pointerId: 7 });
    fire(el, "pointerup", { clientX: 100, clientY: 100, pointerType: "touch", pointerId: 7 });
    p.read(performance.now());
    expect(window.__glassRipple?.spawned).toBe(0);
    fire(el, "pointerdown", { clientX: 110, clientY: 90, pointerType: "touch", pointerId: 8 });
    fire(el, "pointerup", { clientX: 110, clientY: 90, pointerType: "touch", pointerId: 8 });
    p.read(performance.now() + 20);
    expect(window.__glassRipple?.spawned).toBe(1);
    expect(window.__glassRipple?.rings).toBe(1);
    p.release();
  });

  test("under reduced motion: no rings, no lean, the shaders get NO_RIPPLE", () => {
    reduced = true;
    mockMedia();
    const el = slotAt(0, 0, 200), p = glassPointer(el);
    fire(el, "pointerenter", { clientX: 180, clientY: 100 });
    fire(el, "pointerdown", { clientX: 100, clientY: 100, pointerType: "touch", pointerId: 3 });
    fire(el, "pointerup", { clientX: 100, clientY: 100, pointerType: "touch", pointerId: 3 });
    expect(p.read(performance.now() + 30)).toBe(NO_RIPPLE);
    expect(window.__glassRipple).toMatchObject({ rings: 0, lean: 0, spawned: 0 });
    expect(Array.from(NO_RIPPLE.waves).every((v) => v === 0)).toBe(true);
    p.release();
  });

  test("one listener per slot, shared: both holders read the same water; the last release removes it", () => {
    mockMedia();
    const el = slotAt(0, 0, 200);
    const add = vi.spyOn(el, "addEventListener"), remove = vi.spyOn(el, "removeEventListener");
    const a = glassPointerIn(document.body)!, b = glassPointer(el);
    expect(add.mock.calls.filter(([t]) => t === "pointerenter")).toHaveLength(1);
    fire(el, "pointerenter", { clientX: 190, clientY: 100 });
    const now = performance.now() + 40;
    expect(a.read(now)).toBe(b.read(now));
    a.release();
    a.release(); // (twice: harmless)
    expect(remove).not.toHaveBeenCalled();
    b.release();
    expect(remove.mock.calls.filter(([t]) => t === "pointerenter")).toHaveLength(1);
    expect(window.__glassRipple).toBeUndefined();
  });

  test("glassPointerIn: null where there is no slot", () => {
    expect(glassPointerIn(document.createElement("div"))).toBeNull();
    expect(glassPointerIn(null)).toBeNull();
  });
});

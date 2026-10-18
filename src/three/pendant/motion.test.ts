// src/three/pendant/motion.test.ts
import { describe, expect, it } from "vitest";
import { breath, REST, stepMotion, type MotionInput, type MotionState } from "./motion";

const TAU = Math.PI * 2;
const D = Math.PI / 180;
const calm: MotionInput = { dt: 1 / 60, spin: 0, tumble: 0, lock: null, scrollVel: 0, dragging: false, dragDX: 0, dragDY: 0, reduced: false };

/** Steps `seconds` of 1/60 frames, each with the same input (and `each` free to adjust it per frame). */
function run(from: MotionState, seconds: number, input: Partial<MotionInput> = {}): MotionState {
  let s = from;
  for (let n = 0; n < Math.round(seconds * 60); n++) s = stepMotion(s, { ...calm, ...input });
  return s;
}

describe("stepMotion", () => {
  it("spin turns yaw by spin x 2pi x dt", () => {
    const s = stepMotion(REST, { ...calm, spin: 0.22 });
    expect(s.yaw).toBeCloseTo((0.22 * TAU) / 60, 9);
  });

  it("scroll speed adds spin", () => {
    const base = stepMotion(REST, { ...calm, dt: 0.1, spin: 0.22 });
    const pushed = stepMotion(REST, { ...calm, dt: 0.1, spin: 0.22, scrollVel: 1000 });
    expect(pushed.yaw - base.yaw).toBeCloseTo(0.0016 * 1000 * 0.1, 9);
  });

  it("lean follows scroll, clamped to 0.35", () => {
    const s = run(REST, 2, { scrollVel: 1e6 });
    expect(s.tilt).toBeCloseTo(0.35, 3);
    expect(run(REST, 2, { scrollVel: -1e6 }).tilt).toBeCloseTo(-0.35, 3);
  });

  it("lean is proportional below the clamp", () => {
    const s = run(REST, 2, { scrollVel: 400 });
    expect(s.tilt).toBeCloseTo(400 * 0.00025, 3);
  });

  it("lock pulls the nearest equivalent angle", () => {
    const s = run({ ...REST, yaw: 6.0 }, 3, { lock: -62 });
    const target = -62 * D;
    const k = Math.round((6.0 - target) / TAU);
    expect(k).toBe(1);
    expect(Math.abs(s.yaw - (target + k * TAU))).toBeLessThan(1e-3);
  });

  it("a locked face holds under a fast scroll's push (about 4000 px/s), and still settles once it stops", () => {
    const target = -62 * D;
    let s: MotionState = { ...REST, yaw: target };
    let far = 0;
    for (let n = 0; n < 5 * 60; n++) {
      s = stepMotion(s, { ...calm, lock: -62, scrollVel: 4000 });
      far = Math.max(far, Math.abs(s.yaw - target));
    }
    // pushed a little off the face but held: under a quarter turn away, never once round (with the whole push, the pull let
    // go above ~2450 px/s)
    expect(far).toBeLessThan(Math.PI / 2);
    // and at 10000 px/s too
    let fast: MotionState = { ...REST, yaw: target };
    for (let n = 0; n < 5 * 60; n++) fast = stepMotion(fast, { ...calm, lock: -62, scrollVel: 10_000 });
    expect(Math.abs(fast.yaw - target)).toBeLessThan(Math.PI / 2);
    // free (no lock), the same push turns it round and round
    expect(run(REST, 1, { scrollVel: 4000 }).yaw).toBeCloseTo(0.0016 * 4000, 6);
    const back = run(s, 3, { lock: -62 });
    expect(Math.abs(back.yaw - target)).toBeLessThan(1e-3);
    // and both ways: pushed backward just the same
    s = { ...REST, yaw: target };
    for (let n = 0; n < 5 * 60; n++) s = stepMotion(s, { ...calm, lock: -62, scrollVel: -4000 });
    expect(Math.abs(s.yaw - target)).toBeLessThan(Math.PI / 2);
  });

  it("tumble stops upright", () => {
    const s = run({ ...REST, pitch: 1.0 }, 3, { tumble: 0 });
    expect(Math.abs(s.pitch)).toBeLessThan(1e-3);
    const turned = run({ ...REST, pitch: TAU * 3 + 0.9 }, 3, { tumble: 0 });
    expect(Math.abs(turned.pitch - TAU * 3)).toBeLessThan(1e-3);
  });

  it("tumble turns pitch end over end while it is on", () => {
    const s = stepMotion(REST, { ...calm, tumble: 0.32 });
    expect(s.pitch).toBeGreaterThan(0.03);
  });

  it("dragging turns it by the hand", () => {
    const s = stepMotion(REST, { ...calm, dragging: true, dragDX: 100, dragDY: 50 });
    expect(s.yaw).toBeCloseTo(1.2, 9);
    expect(s.handVel).toBeCloseTo(60, 9);
    expect(s.handPitch).toBeCloseTo(50 * 0.004, 9);
  });

  it("letting go keeps momentum, then decays", () => {
    let s = stepMotion(REST, { ...calm, dragging: true, dragDX: 100 });
    const before = s.yaw;
    s = stepMotion(s, calm);
    expect(s.yaw).toBeGreaterThan(before);
    const start = s.handVel;
    s = run(s, 2);
    expect(Math.abs(s.handVel)).toBeLessThan(Math.abs(start) * 0.01);
  });

  it("does not mutate the state it is given", () => {
    const from: MotionState = { ...REST, yaw: 1 };
    const copy = { ...from };
    stepMotion(from, { ...calm, spin: 1, scrollVel: 500 });
    expect(from).toEqual(copy);
  });

  describe("reduced motion", () => {
    const reduced = { reduced: true };

    it("spin, tumble, lean and scroll coupling do nothing", () => {
      const s = run(REST, 2, { ...reduced, spin: 1.3, tumble: 0.32, scrollVel: 5000 });
      expect(s.yaw).toBe(0);
      expect(s.pitch).toBe(0);
      expect(s.tilt).toBe(0);
    });

    it("a drag still turns it, and its momentum does not keep turning it", () => {
      let s = stepMotion(REST, { ...calm, ...reduced, dragging: true, dragDX: 100, dragDY: 10 });
      expect(s.yaw).toBeCloseTo(1.2, 9);
      const held = s.yaw;
      s = run(s, 1, reduced);
      expect(s.yaw).toBe(held);
    });

    it("lean eases back to rest", () => {
      const s = run({ ...REST, tilt: 0.3 }, 2, reduced);
      expect(Math.abs(s.tilt)).toBeLessThan(1e-3);
    });

    it("lock and the upright spring still settle", () => {
      const s = run({ ...REST, yaw: 6.0, pitch: 1.0 }, 3, { ...reduced, lock: -62, spin: 1, tumble: 0.5 });
      expect(Math.abs(s.yaw - (-62 * D + TAU))).toBeLessThan(1e-3);
      expect(Math.abs(s.pitch)).toBeLessThan(1e-3);
    });
  });
});

describe("breath", () => {
  it("stays within +-1 and is not periodic over 60 s", () => {
    for (let t = 0; t <= 60; t += 0.05) for (const seed of [1, 2, 4, 7]) expect(Math.abs(breath(t, seed))).toBeLessThanOrEqual(1);
    expect(Math.abs(breath(5, 1) - breath(5 + TAU, 1))).toBeGreaterThan(0.01);
    expect(breath(3, 1)).not.toBeCloseTo(breath(3, 2), 3);
  });

  it("matches the prototype's layered sines", () => {
    expect(breath(2, 1.5)).toBeCloseTo(0.6 * Math.sin(0.73 * 2 + 1.5) + 0.3 * Math.sin(1.31 * 2 + 2.1 * 1.5) + 0.1 * Math.sin(2.17 * 2 + 3.7 * 1.5), 12);
  });
});

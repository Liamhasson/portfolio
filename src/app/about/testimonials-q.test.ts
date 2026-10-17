import { describe, expect, test } from "vitest";
import { pulsePhase, stepArrival, stepPulse, testimonialsQ, type Arrival, type Pulse } from "./testimonials-q";

const sineIn = (t: number) => 1 - Math.cos((t * Math.PI) / 2);

describe("testimonialsQ", () => {
  test("is 0 before Yoav reaches 105%, 1 between, 0 after Andrada passes −5%", () => {
    expect(testimonialsQ(1100, 1500, 1000)).toBe(0);
    expect(testimonialsQ(600, 800, 1000)).toBeCloseTo(1, 12);
    expect(testimonialsQ(-900, -60, 1000)).toBe(0);
  });

  test("Yoav at 850 of 1000 is half way up: sineIn(0.5)", () => {
    expect(testimonialsQ(850, 1250, 1000)).toBeCloseTo(sineIn(0.5), 12);
  });

  test("Andrada at 150 of 1000 is half way down: 1 − fit is 0.5", () => {
    expect(testimonialsQ(-250, 150, 1000)).toBeCloseTo(sineIn(0.5), 12);
  });

  test("both edges multiply while they overlap", () => {
    expect(testimonialsQ(850, 150, 1000)).toBeCloseTo(sineIn(0.25), 12);
  });

  test("always lies in 0..1", () => {
    for (let c = -2000; c < 3000; c += 37) {
      const q = testimonialsQ(c, c + 700, 1000);
      expect(q).toBeGreaterThanOrEqual(0);
      expect(q).toBeLessThanOrEqual(1);
    }
  });
});

describe("the arrival pulse", () => {
  const none: Pulse = { at: null, on: false };

  test("starts once as q rises past 0.02", () => {
    const p = stepPulse(none, 0.05, 1000, false);
    expect(p).toEqual({ at: 1000, on: true });
  });

  test("does not start at or under 0.02", () => {
    expect(stepPulse(none, 0.02, 1000, false)).toEqual({ at: null, on: false });
    expect(stepPulse(none, 0, 1000, false)).toEqual({ at: null, on: false });
  });

  test("does not start again while on", () => {
    const on = stepPulse(none, 0.05, 1000, false);
    expect(stepPulse(on, 0.5, 1500, false)).toEqual({ at: 1000, on: true });
  });

  test("does not start on the way down, and keeps the running wave", () => {
    const on = stepPulse(none, 0.5, 1000, false);
    const falling = stepPulse(on, 0.3, 1200, false);
    expect(falling.at).toBe(1000);
    expect(stepPulse(falling, 0.01, 1400, false)).toEqual({ at: 1000, on: false });
  });

  test("starts again when q has dropped under and rises past 0.02 once more", () => {
    let p = stepPulse(none, 0.5, 1000, false);
    p = stepPulse(p, 0.01, 1500, false);
    p = stepPulse(p, 0.4, 9000, false);
    expect(p).toEqual({ at: 9000, on: true });
  });

  test("never starts under reduced motion, but still tracks on", () => {
    const p = stepPulse(none, 0.5, 1000, true);
    expect(p).toEqual({ at: null, on: true });
    expect(stepPulse(p, 0.6, 1100, true).at).toBeNull();
  });

  test("stepPulse does not mutate its input", () => {
    const before: Pulse = { at: null, on: false };
    stepPulse(before, 0.5, 1000, false);
    expect(before).toEqual({ at: null, on: false });
  });

  test("pulsePhase is −1 with no pulse", () => {
    expect(pulsePhase(none, 5000)).toBe(-1);
  });

  test("pulsePhase runs 0 → 1 over 2000 ms, then holds 1", () => {
    const p: Pulse = { at: 1000, on: true };
    expect(pulsePhase(p, 1000)).toBe(0);
    expect(pulsePhase(p, 2000)).toBeCloseTo(0.5, 12);
    expect(pulsePhase(p, 3000)).toBe(1);
    expect(pulsePhase(p, 90_000)).toBe(1);
  });

  test("pulsePhase before the start clamps to 0", () => {
    expect(pulsePhase({ at: 1000, on: true }, 900)).toBe(0);
  });
});

describe("the arrival (the mount's pulse rule: stepPulse, for an arrival only)", () => {
  const W = 1000;
  // Yoav's centre before he arrives (1100: q 0), mid-arrival (850), both quotes in (600); Andrada gone (c0 −900, q 0)
  const start: Arrival = { at: null, on: false, armed: true };

  test("arriving from before Yoav fires the wave once", () => {
    let p = stepArrival(start, testimonialsQ(1100, 1500, W), 1100, W, 0, false);
    expect(p.at).toBeNull();
    p = stepArrival(p, testimonialsQ(850, 1250, W), 850, W, 100, false);
    expect(p.at).toBe(100);
    p = stepArrival(p, testimonialsQ(600, 1000, W), 600, W, 200, false);
    expect(p.at).toBe(100);
  });

  test("a jump past Andrada (q falling past 0.02) and back in doesn't fire it again", () => {
    let p = stepArrival(start, 0, 1100, W, 0, false);
    p = stepArrival(p, 1, 600, W, 100, false);
    expect(p.at).toBe(100);
    p = stepArrival(p, 0, -900, W, 5000, false); // (gone past the exit)
    expect(p.armed).toBe(false);
    p = stepArrival(p, 1, 600, W, 6000, false); // (straight back to the middle)
    expect(p.at).toBe(100);
    p = stepArrival(p, 0, -900, W, 7000, false);
    p = stepArrival(p, 0.5, -300, W, 8000, false); // (back into Andrada from the far side)
    expect(p.at).toBe(100);
  });

  test("going back before Yoav re-arms it: a new arrival fires a new wave", () => {
    let p = stepArrival(start, 1, 600, W, 100, false);
    p = stepArrival(p, 0, -900, W, 5000, false);
    p = stepArrival(p, 0, 1100, W, 6000, false);
    expect(p.armed).toBe(true);
    p = stepArrival(p, 0.3, 900, W, 7000, false);
    expect(p.at).toBe(7000);
  });

  test("jitter round 0.02 while a wave runs doesn't restart it", () => {
    let p = stepArrival(start, 0.03, 940, W, 100, false);
    expect(p.at).toBe(100);
    p = stepArrival(p, 0.01, 960, W, 300, false);
    p = stepArrival(p, 0.03, 940, W, 500, false);
    expect(p.at).toBe(100);
  });

  test("a reload straight into the middle fires one wave", () => {
    expect(stepArrival(start, 1, 600, W, 50, false).at).toBe(50);
  });

  test("never under reduced motion", () => {
    let p = stepArrival(start, 0, 1100, W, 0, true);
    p = stepArrival(p, 1, 600, W, 100, true);
    expect(p.at).toBeNull();
  });
});

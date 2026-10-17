import { describe, expect, test } from "vitest";
import { pulsePhase, stepPulse, testimonialsQ, type Pulse } from "./testimonials-q";

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

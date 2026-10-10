import { describe, expect, test } from "vitest";
import { attemptAt, burstAt } from "./attempts";

describe("attemptAt (2.2, ported from lookdev.py attempt_keys)", () => {
  test("starts and rests between attempts with no attempt", () => {
    expect(attemptAt(0)).toEqual([1, 0, 0]);
    expect(attemptAt((44 - 1) / 143)[0]).toBe(1);
    expect(attemptAt((98 - 1) / 143)[0]).toBe(1);
  });
  test("each attempt peaks bigger and clearer than the last", () => {
    const p1 = attemptAt((24 - 1) / 143), p2 = attemptAt((74 - 1) / 143), p3 = attemptAt(1);
    expect(p2[0]).toBeLessThan(p1[0]);
    expect(p3[0]).toBeLessThan(p2[0]);
    expect(p2[2]).toBeGreaterThan(p1[2]);
    expect(p3[2]).toBeGreaterThan(p2[2]);
  });
  test("the first two break up as they collapse; the third holds unbroken", () => {
    expect(attemptAt((38 - 1) / 143)[1]).toBeGreaterThan(0.5);
    expect(attemptAt((90 - 1) / 143)[1]).toBeGreaterThan(0.3);
    expect(attemptAt(1)).toEqual([0.68, 0, 1]);
  });
});

describe("burstAt (2.2 in sand only)", () => {
  test("rests between and around the bursts", () => {
    expect(burstAt(0)).toEqual({ index: -1, amount: 0, volume: 0, shape: 0 });
    expect(burstAt(0.34).index).toBe(-1);
    expect(burstAt(1).index).toBe(-1);
  });
  test("draws in, breaks as it swells, then settles, each attempt its own shape and a little stronger", () => {
    const a = burstAt(0.04 + 0.28 * 0.1), b = burstAt(0.04 + 0.28 * 0.45), c = burstAt(0.04 + 0.28 * 0.99);
    expect(a.amount).toBe(0); expect(a.volume).toBeLessThan(0);
    expect(b.amount).toBeCloseTo(0.7); expect(b.volume).toBeGreaterThan(0);
    expect(c.amount).toBeLessThan(0.01);
    const peaks = [0.04, 0.36, 0.68].map((f) => burstAt(f + 0.28 * 0.45));
    expect(peaks.map((p) => p.shape)).toEqual([0, 1, 2]);
    expect(peaks[0].amount).toBeLessThan(peaks[1].amount);
    expect(peaks[1].amount).toBeLessThan(peaks[2].amount);
  });
});

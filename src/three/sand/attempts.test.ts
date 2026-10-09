import { describe, expect, test } from "vitest";
import { attemptAt } from "./attempts";

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

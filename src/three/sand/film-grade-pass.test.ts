import { describe, expect, test } from "vitest";
import { GRADE, grainOffset, vignetteAlpha } from "./film-grade-pass";

describe("film grade pass (the CSS grade, drawn in WebGL)", () => {
  test("the vignette follows the CSS stops: clear at the centre, 0.44 black in the corners", () => {
    expect(vignetteAlpha(0)).toBe(0);
    expect(vignetteAlpha(0.25)).toBeCloseTo(0.035);
    expect(vignetteAlpha(0.5)).toBeCloseTo(0.13);
    expect(vignetteAlpha(0.75)).toBeCloseTo(0.28);
    expect(vignetteAlpha(1)).toBeCloseTo(0.44);
    expect(vignetteAlpha(0.6)).toBeCloseTo(0.13 + (0.28 - 0.13) * 0.4);
  });

  test("the grain steps as the CSS keyframes did: 8 positions per 0.66 s", () => {
    expect(grainOffset(0)).toEqual([0, 0]);
    expect(grainOffset(0.66 / 8 + 0.001)).toEqual([53, 97]);
    expect(grainOffset(0.66 * 3 / 8 + 0.001)).toEqual([(3 * 53) % 192, (3 * 97) % 192]);
    expect(grainOffset(0.66 + 0.001)).toEqual([0, 0]);
  });

  test("the lift is the warm near-black #0b0908, the grain 9%", () => {
    expect(GRADE.lift.map((v) => Math.round(v * 255))).toEqual([11, 9, 8]);
    expect(GRADE.grain).toBe(0.09);
  });
});

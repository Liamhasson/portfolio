import { describe, expect, test } from "vitest";
import { PARALLAX, parallaxWeight, stepParallax } from "./parallax";
import { SAND_VERTEX } from "./shaders";
import { looseGrainVertex } from "./loose-grain";

// (Liam, 2026-10-12: "the FRONT LAYER of the vortex to follow the cursor more than the BACK LAYER, so it feels like it's
// moving in a 3D motion")
describe("the vortex leans toward the cursor in depth", () => {
  test("the front follows the cursor fully, the back a fraction: depth reads as parallax", () => {
    expect(parallaxWeight(1)).toBe(1);
    expect(parallaxWeight(0)).toBeCloseTo(PARALLAX.back, 9);
    expect(parallaxWeight(0.5)).toBeGreaterThan(parallaxWeight(0.2));
  });
  test("it follows smoothly (no jump), reaches the cursor's lean, and settles back when the cursor leaves", () => {
    let o: [number, number] = [0, 0];
    for (let i = 0; i < 120; i++) {
      const n = stepParallax(o, [1, -1], 1 / 60);
      expect(Math.hypot(n[0] - o[0], n[1] - o[1])).toBeLessThan(PARALLAX.reach * 0.2);
      o = n;
    }
    expect(o[0]).toBeCloseTo(PARALLAX.reach, 2);
    expect(o[1]).toBeCloseTo(-PARALLAX.reach, 2);
    for (let i = 0; i < 240; i++) o = stepParallax(o, null, 1 / 60);
    expect(Math.hypot(...o)).toBeLessThan(1e-3);
  });
  test("both the sand and the loose grains lean by their depth in the cloud", () => {
    for (const v of [SAND_VERTEX, looseGrainVertex("", "")]) {
      expect(v).toMatch(/uniform vec3 uParallax;/);
      expect(v).toMatch(/uniform vec4 uParallaxC;/);
      expect(v).toMatch(/gl_Position\.xy \+= uParallax\.xy \* /);
    }
  });
});

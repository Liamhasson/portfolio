import { describe, expect, test } from "vitest";
import { ihash3 } from "./int-hash";
import { SWIRL_GLSL } from "./swirl";
import { WORDMARK_FRAGMENT } from "./wordmark";
import { PAINT_FRAGMENT } from "./paint";

// (Liam, 2026-10-12: the deployed hero, open ~8 hours, had smeared into streaks with no structure.) The noises that move
// with the page's clock hashed through sin(), which on the GPU loses its precision for large arguments: hours in, their
// "random" values stopped varying smoothly frame to frame and every grain jittered (the motion blur drew the jitter as
// streaks). Their hash is integer arithmetic now: exact at any age.
describe("noise that ages well", () => {
  test("no time-driven noise hashes through sin()", () => {
    for (const glsl of [SWIRL_GLSL, WORDMARK_FRAGMENT, PAINT_FRAGMENT]) expect(glsl).not.toMatch(/fract\(sin\(/);
  });
  test("the integer hash: in [0, 1), deterministic, and as lively at a million as at zero", () => {
    const vals: number[] = [];
    for (const base of [0, 1e6, 2.5e7]) for (let i = 0; i < 2000; i++) {
      const h = ihash3(base + i, -i, 7);
      expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThan(1);
      vals.push(h);
    }
    expect(ihash3(12, -3, 99)).toBe(ihash3(12, -3, 99));
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    expect(mean).toBeGreaterThan(0.45); expect(mean).toBeLessThan(0.55);
    // neighbours differ (no collapse to a constant at large inputs)
    let same = 0; for (let i = 0; i < 1000; i++) if (ihash3(2.5e7 + i, 0, 0) === ihash3(2.5e7 + i + 1, 0, 0)) same++;
    expect(same).toBe(0);
  });
});

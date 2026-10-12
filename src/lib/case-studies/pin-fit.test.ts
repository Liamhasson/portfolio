import { expect, test } from "vitest";
import { pinFit } from "./pin-fit";

const NAV = 96;

test("a pinned story that fits below the site's nav is centred there, at full size", () => {
  expect(pinFit(1000, 700, NAV)).toEqual({ top: 150, scale: 1 });
});

test("one too tall for a short screen is scaled down to sit below the nav, never under it (Liam, 2026-10-13: the nav collided with the Cyvore replica's own)", () => {
  const f = pinFit(700, 760, NAV);
  expect(f.top).toBe(NAV);
  expect(f.top + 760 * f.scale).toBeLessThanOrEqual(700 - 16 + 1e-9);
  expect(f.scale).toBeGreaterThan(0.6);
});

test("it fits between the nav and the bottom margin exactly when centring isn't possible but full size is", () => {
  const f = pinFit(900, 740, NAV);   // (free 160: centred would be 80, under the nav)
  expect(f.top).toBeGreaterThanOrEqual(NAV);
  expect(f.top + 740 * f.scale).toBeLessThanOrEqual(900 - 16 + 1e-9);
});

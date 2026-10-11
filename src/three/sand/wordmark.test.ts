import { expect, test } from "vitest";
import { WORDMARK, WORDMARK_FRAGMENT } from "./wordmark";

// (Liam, 2026-10-12: "the white letters in the hero shouldn't appear. remove the fill and add a light fill that follows
// the outline's shine animation … same style as the nav bar pills. not a flat fill, more like a light glow")
test("no flat fill: the letters' inside is lit only where the light is (the wave, the cursor)", () => {
  expect("fillColor" in WORDMARK).toBe(false);
  expect(WORDMARK_FRAGMENT).not.toMatch(/uniform vec3 uFill/);
  // the inside's light follows the outline's light (a pale veil, as the pills'), faded in from the rim
  expect(WORDMARK_FRAGMENT).toMatch(/vec3 inner = uInnerCol \* min\(light, 1\.2\) \* uInner \* inLetter \* rimK/);
});

test("a glow, as the pills' light: faint at its brightest, brightest at the rim, fading inward", () => {
  expect(WORDMARK.innerGlow).toBeGreaterThan(0.05);
  expect(WORDMARK.innerGlow).toBeLessThan(0.35);
  expect(WORDMARK.innerEdgePx).toBeGreaterThan(4);
});

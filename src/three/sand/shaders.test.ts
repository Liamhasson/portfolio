import { expect, test } from "vitest";
import { SAND_VERTEX } from "./shaders";

// (Liam, 2026-10-11: "remove the big sand grains"). The GPU's hash is fract(sin(x) * 43758.5) in float32: quantized, so
// ~0.3% of grains hash to exactly 0.0. step(hash, 0.0) is 1 there (0 >= 0), so with the pebble share at 0 some 430 of
// 160k grains were still drawn as 3-7x pebbles. A grain is a pebble only when its hash is strictly under the share.
test("no pebbles when the share is 0: the pick is strict, never step(hash, share)", () => {
  const pick = SAND_VERTEX.match(/float pebble = [^;]+;/)?.[0] ?? "";
  expect(pick).not.toMatch(/step\(\s*hash/);
  expect(pick).toMatch(/hash\(aPosA \+ 4\.4\) </);
});

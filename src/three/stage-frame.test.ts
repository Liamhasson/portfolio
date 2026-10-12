// src/three/stage-frame.test.ts
import { expect, test } from "vitest";
import { stepFrame } from "./stage-frame";

test("a frame that throws is caught and handed back, not left to kill the loop silently with the page locked (final review #3)", () => {
  const seen: string[] = [];
  const boom = new Error("boom");
  const err = stepFrame([() => seen.push("a"), () => { throw boom; }, () => seen.push("c")], 0.016, 1, () => seen.push("draw"));
  expect(err).toBe(boom);
  expect(seen).toEqual(["a"]);   // (nothing drawn from a half-run frame)
  expect(stepFrame([() => seen.push("x")], 0.016, 1, () => seen.push("draw"))).toBeNull();
  expect(seen).toEqual(["a", "x", "draw"]);
});

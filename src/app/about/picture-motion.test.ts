// src/app/about/picture-motion.test.ts: each picture rises out of its line and is cut at the margin line (v26 mockup, mode B)
import { expect, test } from "vitest";
import { pictureState } from "./picture-motion";

const vw = 1000;

test("before 94% of the screen it is not there yet: all the way down, hidden", () => {
  const s = pictureState(0.95 * vw, 200, vw);
  expect(s.top).toBe(100);
  expect(s.hidden).toBe(true);
});

test("at 70% and left of it it has fully risen", () => {
  expect(pictureState(0.70 * vw, 200, vw).top).toBe(0);
  expect(pictureState(0.4 * vw, 200, vw).top).toBe(0);
  expect(pictureState(0.4 * vw, 200, vw).hidden).toBe(false);
});

test("between 94% and 70% the rise is a smoothstep", () => {
  const s = pictureState(0.82 * vw, 200, vw);
  expect(s.top).toBeCloseTo(50, 6);
  expect(s.hidden).toBe(false);
  // eased: a quarter of the way in is less than a quarter risen (a smoothstep, not linear)
  expect(pictureState(0.88 * vw, 200, vw).top).toBeGreaterThan(75);
});

test("at the margin line (6%) the cut begins; halfway through the width it is at 50", () => {
  expect(pictureState(0.06 * vw, 200, vw).left).toBe(0);
  const s = pictureState(0.06 * vw - 100, 200, vw);
  expect(s.left).toBeCloseTo(50, 6);
  expect(s.hidden).toBe(false);
});

test("fully cut when its right edge has reached the margin line", () => {
  const s = pictureState(0.06 * vw - 200, 200, vw);
  expect(s.left).toBe(100);
  expect(s.hidden).toBe(true);
  expect(pictureState(-500, 200, vw).hidden).toBe(true);
});

test("right of the margin nothing is cut", () => {
  expect(pictureState(0.3 * vw, 200, vw).left).toBe(0);
});

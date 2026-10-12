import { describe, expect, test } from "vitest";
import { SKETCH_TIMES, sketchState } from "./desk-sketches";
import { SKETCHES } from "./sketch-data";

describe("the sketches behind the desk (Liam, 2026-10-12): drawn during the tilt, light 3D motion while drawing", () => {
  test("three sketches of the real work: Pulse, Cyvore, Eventread", () => {
    expect(SKETCHES.map((s) => s.id)).toEqual(["pulse", "cyvore", "eventread"]);
    for (const s of SKETCHES) expect(s.strokes.length).toBeGreaterThan(2);
  });
  test("nothing before the tilt; each drawn by the tilt's end, staggered left to right; gone early in the glide", () => {
    expect(sketchState(SKETCH_TIMES.from - 0.05, 0, false).opacity).toBe(0);
    const mid = SKETCH_TIMES.from + 0.15;
    expect(sketchState(mid, 0, false).reveal).toBeGreaterThan(sketchState(mid, 2, false).reveal);
    for (const i of [0, 1, 2]) expect(sketchState(SKETCH_TIMES.drawnBy + 0.01, i, false).reveal).toBe(1);
    expect(sketchState(SKETCH_TIMES.gone, 0, false).opacity).toBe(0);
  });
  test("a light tilt and spin while drawing (a few degrees, never more), easing to rest once drawn", () => {
    const drawing = sketchState(SKETCH_TIMES.from + 0.1, 0, false), drawn = sketchState(SKETCH_TIMES.drawnBy + 0.05, 0, false);
    expect(Math.abs(drawing.spin) + Math.abs(drawing.tilt)).toBeGreaterThan(0.03);
    expect(Math.abs(drawing.spin)).toBeLessThan(0.2);   // (under ~11 degrees)
    expect(Math.abs(drawing.tilt)).toBeLessThan(0.2);
    expect(Math.abs(drawn.spin) + Math.abs(drawn.tilt)).toBeLessThan(0.01);
  });
  test("reduced motion: already drawn, still", () => {
    const s = sketchState(SKETCH_TIMES.from + 0.1, 1, true);
    expect(s.reveal).toBe(1);
    expect(s.spin).toBe(0); expect(s.tilt).toBe(0);
  });
});

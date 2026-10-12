import { describe, expect, test } from "vitest";
import { circle, parsePath, rect, strokeStrip, strokeTimes } from "./sketch-strokes";

describe("the sketches' strokes: hand-drawn hairlines that draw themselves on", () => {
  test("a path's lines and curves become a polyline through its points", () => {
    const [p] = parsePath("M 0 0 L 10 0 Q 20 0 20 10");
    expect(p[0]).toEqual([0, 0]);
    expect(p).toContainEqual([10, 0]);
    expect(p.at(-1)).toEqual([20, 10]);
    expect(p.length).toBeGreaterThan(5);   // (the curve sampled)
  });
  test("Z closes back to the start; M starts a new stroke", () => {
    const s = parsePath("M 0 0 L 5 0 L 5 5 Z M 9 9 L 12 9");
    expect(s).toHaveLength(2);
    expect(s[0].at(-1)).toEqual([0, 0]);
  });
  test("rect and circle helpers make closed strokes of the right size", () => {
    const r = rect(0, 0, 10, 4)[0];
    expect(r).toContainEqual([10, 4]);
    const c = circle(0, 0, 5)[0];
    for (const [x, y] of c) expect(Math.hypot(x, y)).toBeCloseTo(5, 6);
  });
  test("each stroke draws in turn, by its length, the whole sketch over 0..1", () => {
    const t = strokeTimes([[[0, 0], [10, 0]], [[0, 0], [30, 0]]], 0.1);
    expect(t[0][0]).toBe(0);
    expect(t[1][1]).toBeCloseTo(1, 9);
    expect(t[1][0]).toBeGreaterThan(t[0][1]);              // (a short pause between strokes)
    expect(t[1][1] - t[1][0]).toBeGreaterThan(t[0][1] - t[0][0]);   // (the longer stroke takes longer)
  });
  test("a stroke's strip: two vertices a point, each with its reveal time along the stroke, the hand's slight wobble", () => {
    const st = strokeStrip([[0, 0], [10, 0], [20, 0]], [0.2, 0.6], 7);
    expect(st.positions.length / 2).toBe(st.times.length);
    expect(st.times[0]).toBeCloseTo(0.2, 9);
    expect(st.times.at(-1)).toBeCloseTo(0.6, 9);
    expect(Math.max(...st.positions.filter((_, i) => i % 2 === 1).map(Math.abs))).toBeLessThan(1);   // (wobble small)
    const again = strokeStrip([[0, 0], [10, 0], [20, 0]], [0.2, 0.6], 7);
    expect(again.positions).toEqual(st.positions);   // (deterministic)
  });
});

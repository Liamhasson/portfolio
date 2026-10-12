// src/app/lab/sand/brief-geometry.test.ts
import { describe, expect, test } from "vitest";
import { BRIEF, briefReturn, briefShapes, briefSize } from "./brief-geometry";

describe("the brief (spec §2.2, §2.4)", () => {
  test("its construction: anchors in the cascade's order, the box around the circle, the handles 0.5523 r", () => {
    const s = briefShapes(400, 300, 100);
    expect(s.anchors).toEqual([[400, 300], [400, 200], [500, 300], [400, 400], [300, 300], [300, 200], [500, 200], [500, 400], [300, 400]]);
    expect(s.box).toEqual({ x: 300, y: 200, s: 200 });
    const [x1, y1, x2, y2] = s.handles[0];   // the top anchor's tangent
    expect(y1).toBe(200); expect(y2).toBe(200);
    expect(x2 - x1).toBeCloseTo(2 * BRIEF.handle * 100, 6);
  });
  test("it scales with the viewport (a resize mid-load re-projects it)", () => {
    const a = briefShapes(400, 300, 100), b = briefShapes(800, 600, 200);
    expect(b.anchors.map(([x, y]) => [x / 2, y / 2])).toEqual(a.anchors);
  });
  test("it grows with the progress, never shrinks, and takes at least 1.2 s even when everything is cached", () => {
    let s = 0, t = 0;
    const dt = 1 / 60;
    while (t < 0.6) { s = briefSize(s, 1, t, dt); t += dt; }
    expect(s).toBeLessThan(0.6);   // cached: still growing at 0.6 s
    while (t < BRIEF.minGrow + 0.4) { const n = briefSize(s, 1, t, dt); expect(n).toBeGreaterThanOrEqual(s); s = n; t += dt; }
    expect(s).toBeCloseTo(1, 2);
    expect(briefSize(0.8, 0.5, 5, dt)).toBe(0.8);   // never shrinks
  });
  test("it follows a stall and a burst smoothly (no jump over 0.1 in a frame)", () => {
    let s = 0;
    for (let i = 0; i < 300; i++) { const p = i < 100 ? 0.3 : 0.95; const n = briefSize(s, p, i / 60, 1 / 60); expect(n - s).toBeLessThan(0.1); s = n; }
  });
  test("it returns for a beat as the ball locks in", () => {
    expect(briefReturn(0.5)).toBe(0);
    expect(briefReturn(0.75)).toBe(0);
    expect(briefReturn(0.88)).toBe(1);
    expect(briefReturn(1)).toBe(0);
  });
});

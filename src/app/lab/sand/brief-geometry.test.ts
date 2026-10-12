// src/app/lab/sand/brief-geometry.test.ts
import { describe, expect, test } from "vitest";
import { BRIEF, briefReturn, briefShapes } from "./brief-geometry";

describe("the brief (spec §2.2, §2.4)", () => {
  test("its construction: anchors in the cascade's order, the box around the circle, the handles 0.5523 r", () => {
    const s = briefShapes(400, 300, 100);
    expect(s.anchors).toEqual([[400, 300], [400, 200], [500, 300], [400, 400], [300, 300], [300, 200], [500, 200], [500, 400], [300, 400]]);
    expect(s.box).toEqual({ x: 300, y: 200, s: 200 });
    // the top anchor's tangent: the two corners' handles that meet there, together 2 x 0.5523 r along the top edge
    const top = s.handles.filter(([, y1, , y2]) => y1 === 200 && y2 === 200);
    expect(top).toHaveLength(2);
    expect(top.reduce((w, [x1, , x2]) => w + Math.abs(x2 - x1), 0)).toBeCloseTo(2 * BRIEF.handle * 100, 6);
  });
  test("it scales with the viewport (a resize mid-load re-projects it)", () => {
    const a = briefShapes(400, 300, 100), b = briefShapes(800, 600, 200);
    expect(b.anchors.map(([x, y]) => [x / 2, y / 2])).toEqual(a.anchors);
  });
  test("it returns as the ball locks in and stays around the formed ball until the camera tilts down (Liam, 2026-10-12)", () => {
    expect(briefReturn(0.5, 1.0)).toBe(0);
    expect(briefReturn(0.75, 1.2)).toBe(0);
    expect(briefReturn(0.88, 1.4)).toBe(1);
    expect(briefReturn(1, 1.7)).toBe(1);          // (the formed ball, the hold: still drawn)
    expect(briefReturn(1, 1.9)).toBeGreaterThan(0);
    expect(briefReturn(1, 1.9)).toBeLessThan(1);  // (fading as the tilt starts)
    expect(briefReturn(1, 2.05)).toBe(0);
  });
});

describe("the square that rounds into a circle (Liam, 2026-10-12): a designer's corner radius, dragged from 0 to the full", () => {
  test("at 0 it is the square: its path runs through the box's corners", () => {
    const s = briefShapes(400, 300, 100, 0);
    for (const [x, y] of [[300, 200], [500, 200], [500, 400], [300, 400]]) expect(s.path).toContain(`${x} ${y}`);
  });
  test("at 1 it is the circle: the eight corner ends meet in pairs at the edges' midpoints, the handles 0.5523 r", () => {
    const s = briefShapes(400, 300, 100, 1);
    const mids = [[400, 200], [500, 300], [400, 400], [300, 300]];
    for (const [x, y] of s.ends) expect(mids.some(([mx, my]) => Math.hypot(x - mx, y - my) < 1e-9)).toBe(true);
    for (const [x1, y1, x2, y2] of s.handles) expect(Math.hypot(x2 - x1, y2 - y1)).toBeCloseTo(BRIEF.handle * 100, 6);
  });
  test("in between, the corners open smoothly: each end moves along its edge as the radius grows", () => {
    const a = briefShapes(400, 300, 100, 0.25), b = briefShapes(400, 300, 100, 0.5);
    expect(b.ends[0][0]).toBeGreaterThan(a.ends[0][0]);   // (the top-left corner's top end moves right, toward the midpoint)
    expect(b.ends[0]).toEqual([300 + 50, 200]);
  });
});

describe("the square grows smoothly (Liam, 2026-10-12: 'something feels slightly stuck as the square is getting bigger')", () => {
  test("a burst in the download never jolts it: its speed changes gently from frame to frame", async () => {
    const { BriefGrowth } = await import("./brief-geometry");
    const g = new BriefGrowth();
    let prev = 0, prevStep = 0;
    for (let i = 0; i < 240; i++) {
      const p = i < 90 ? 0.25 : 0.95, s = g.step(p, i / 60, 1 / 60);
      const step = s - prev;
      if (i > 1) expect(Math.abs(step - prevStep)).toBeLessThan(0.0035);
      prev = s; prevStep = step;
    }
  });
  test("a stalled download never stops it dead: it keeps creeping, never far past the real progress", async () => {
    const { BriefGrowth } = await import("./brief-geometry");
    const g = new BriefGrowth();
    let s = 0;
    for (let i = 0; i < 60 * 4; i++) s = g.step(0.5, i / 60, 1 / 60);
    const a = s;
    for (let i = 0; i < 30; i++) s = g.step(0.5, 4 + i / 60, 1 / 60);
    expect(s).toBeGreaterThan(a);          // still moving
    expect(s).toBeLessThan(0.5 + 0.09);    // but never far ahead
  });
  test("cached: whole within the minimum ramp plus a beat, never shrinking", async () => {
    const { BriefGrowth } = await import("./brief-geometry");
    const g = new BriefGrowth();
    let s = 0, t = 0;
    while (t < 0.6) { s = g.step(1, t, 1 / 60); t += 1 / 60; }
    expect(s).toBeLessThan(0.6);
    while (t < BRIEF.minGrow + 0.7) { const n = g.step(1, t, 1 / 60); expect(n).toBeGreaterThanOrEqual(s); s = n; t += 1 / 60; }
    expect(s).toBe(1);
  });
});

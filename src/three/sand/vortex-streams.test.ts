import { describe, expect, test } from "vitest";
import { FRAME, vortexStreams } from "./vortex-streams";

const r = (p: number[]) => Math.hypot(p[0], p[1]);
const off = (p: number[]) => Math.abs(p[0]) > FRAME.x || Math.abs(p[1]) > FRAME.y;

describe("streams in and out of the frame (Liam, 2026-10-11)", () => {
  const s = vortexStreams();

  test("half come in from beyond the frame and end at the vortex; half leave it and go out of the frame", () => {
    const incoming = s.filter((c) => c.name.startsWith("in")), outgoing = s.filter((c) => c.name.startsWith("out"));
    expect(incoming.length).toBeGreaterThanOrEqual(3);
    expect(outgoing.length).toBe(incoming.length);
    for (const c of incoming) { expect(off(c.points[0])).toBe(true); expect(r(c.points[c.points.length - 1])).toBeLessThan(0.8); }
    for (const c of outgoing) { expect(r(c.points[0])).toBeLessThan(0.8); expect(off(c.points[c.points.length - 1])).toBe(true); }
  });

  test("they meet the vortex turning its way (counter-clockwise on screen)", () => {
    for (const c of s) {
      const i = c.name.startsWith("in") ? c.points.length - 2 : 0;
      const a = c.points[i], b = c.points[i + 1];
      const rim = c.name.startsWith("in") ? b : a;
      const cross = rim[0] * (b[1] - a[1]) - rim[1] * (b[0] - a[0]);   // > 0: turning counter-clockwise
      expect(cross).toBeGreaterThan(0);
    }
  });

  test("each its own: paces, widths and spreads differ", () => {
    expect(new Set(s.map((c) => c.pace)).size).toBe(s.length);
    expect(new Set(s.map((c) => c.width)).size).toBeGreaterThan(1);
    expect(new Set(s.map((c) => c.fan)).size).toBeGreaterThan(1);
    for (const c of s) expect(c.length).toBeGreaterThan(0.5);
  });
});

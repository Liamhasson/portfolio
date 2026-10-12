import { describe, expect, test } from "vitest";
import { drawSketch, type Mark } from "./sketch-hand";

const xs = (m: Mark[]) => m.flatMap((k) => k.pts.map((p) => p[0]));
const ys = (m: Mark[]) => m.flatMap((k) => k.pts.map((p) => p[1]));

describe("the sketches' hand (Liam, 2026-10-12: like Oryzo's and the pencil reference, not perfect lines)", () => {
  test("the same seed draws the same sketch", () => {
    const prims = [{ k: "box", x: 0, y: 0, w: 60, h: 100, guides: true } as const];
    expect(drawSketch(prims, 3)).toEqual(drawSketch(prims, 3));
    expect(drawSketch(prims, 4)).not.toEqual(drawSketch(prims, 3));
  });

  test("a box is drawn in more than one pass, its sides overshooting the corners", () => {
    const { marks } = drawSketch([{ k: "box", x: 0, y: 0, w: 60, h: 100 }], 1);
    const lines = marks.filter((m) => m.layer === "line");
    expect(lines.length).toBeGreaterThanOrEqual(8);   // (4 sides, twice)
    expect(Math.min(...xs(lines))).toBeLessThan(-0.5);
    expect(Math.max(...xs(lines))).toBeGreaterThan(60.5);
    expect(Math.max(...xs(lines))).toBeLessThan(70);  // (overshoot, not a scribble)
    expect(lines.some((m) => m.alpha < 1)).toBe(true); // (the second pass lighter)
  });

  test("its guides run well past it, drawn first and faint", () => {
    const { marks } = drawSketch([{ k: "box", x: 0, y: 0, w: 60, h: 100, guides: true }], 2);
    const guides = marks.filter((m) => m.layer === "guide");
    expect(guides.length).toBeGreaterThanOrEqual(2);
    const reach = Math.max(-Math.min(...xs(guides), ...ys(guides)), Math.max(...xs(guides)) - 60, Math.max(...ys(guides)) - 100);
    expect(reach).toBeGreaterThan(10);
    expect(marks.findIndex((m) => m.layer !== "guide")).toBe(guides.length);   // (all guides before anything else)
  });

  test("a circle never quite closes: it overlaps past its start, and wanders off the true radius", () => {
    const { marks } = drawSketch([{ k: "ring", cx: 0, cy: 0, r: 20 }], 5);
    const first = marks.filter((m) => m.layer === "line")[0].pts;
    const a0 = Math.atan2(first[0][1], first[0][0]);
    let turn = 0;
    for (let i = 1; i < first.length; i++) {
      let d = Math.atan2(first[i][1], first[i][0]) - Math.atan2(first[i - 1][1], first[i - 1][0]);
      d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
      turn += d;
    }
    expect(Math.abs(turn)).toBeGreaterThan(2 * Math.PI * 1.05);
    const radii = first.map(([x, y]) => Math.hypot(x, y));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(0.4);
    for (const r of radii) expect(Math.abs(r - 20)).toBeLessThan(20 * 0.15);
    expect(Number.isFinite(a0)).toBe(true);
  });

  test("hatching fills its area with parallel strokes, inside it, after the lines", () => {
    const { marks } = drawSketch([{ k: "box", x: 0, y: 0, w: 40, h: 30 }, { k: "hatch", x: 0, y: 0, w: 40, h: 30, gap: 3 }], 7);
    const hatch = marks.filter((m) => m.layer === "hatch");
    expect(hatch.length).toBeGreaterThan(10);
    for (const x of xs(hatch)) { expect(x).toBeGreaterThan(-2.5); expect(x).toBeLessThan(42.5); }
    for (const y of ys(hatch)) { expect(y).toBeGreaterThan(-2.5); expect(y).toBeLessThan(32.5); }
    const firstHatch = marks.findIndex((m) => m.layer === "hatch");
    expect(marks.slice(firstHatch).every((m) => m.layer === "hatch")).toBe(true);
  });

  test("a round hatch stays inside its circle", () => {
    const { marks } = drawSketch([{ k: "hatch", x: -10, y: -10, w: 20, h: 20, round: true, gap: 2 }], 8);
    for (const m of marks) for (const [x, y] of m.pts) expect(Math.hypot(x, y)).toBeLessThan(10 + 2.5);
  });

  test("tone comes out as soft areas for the texture, not strokes", () => {
    const out = drawSketch([{ k: "tone", x: 0, y: 0, w: 30, h: 20, alpha: 0.5 }], 9);
    expect(out.marks).toHaveLength(0);
    expect(out.tones).toHaveLength(1);
    expect(out.tones[0].alpha).toBe(0.5);
    expect(out.tones[0].pts.length).toBeGreaterThan(8);
  });
});

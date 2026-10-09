import { describe, expect, test } from "vitest";
import { cubicBezier, REVEAL, REVEAL_SECONDS, revealAt } from "./screen-reveal";

describe("cubicBezier (CSS timing functions)", () => {
  test("ease-out matches the browser's values", () => {
    const easeOut = cubicBezier(0, 0, 0.58, 1);
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeCloseTo(0.6846, 3);   // by bisection on the curve
  });
  test("linear control points give a straight line", () => {
    const lin = cubicBezier(1 / 3, 1 / 3, 2 / 3, 2 / 3);
    for (const t of [0.1, 0.37, 0.8]) expect(lin(t)).toBeCloseTo(t, 5);
  });
});

describe("revealAt (the index's first reveal on the laptop screen)", () => {
  test("starts dark, every element hidden, low and blurred", () => {
    const f = revealAt(0);
    expect(f.wake).toBe(1);
    expect(f.light).toBe(0);
    for (const e of f.elements) {
      expect(e.opacity).toBe(0);
      expect(e.offset).toBeCloseTo(REVEAL.surface.rise, 6);
      expect(e.blur).toBe(REVEAL.surface.blur_px);
    }
  });
  test("the rows surface in turn", () => {
    const f = revealAt(1.2);   // every row has started, the first furthest along
    const rows = f.elements.filter((_, i) => REVEAL.elements[i].name.startsWith("row"));
    for (let i = 1; i < rows.length; i++) expect(rows[i].opacity).toBeLessThan(rows[i - 1].opacity);
  });
  test("ends on the finished index at full light", () => {
    const f = revealAt(REVEAL_SECONDS);
    expect(f.wake).toBe(0);
    expect(f.light).toBeCloseTo(1, 2);
    for (const e of f.elements) expect([e.opacity, e.offset, e.blur]).toEqual([1, 0, 0]);
  });
});

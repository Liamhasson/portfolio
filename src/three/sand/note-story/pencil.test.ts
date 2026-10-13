import { describe, expect, it } from "vitest";
import { Pencil } from "./pencil";
import { STORIES } from "./stories";

/** A 2D context that only counts what's drawn. */
function countingCtx() {
  const n = { lines: 0, texts: 0, fills: 0 };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (_t, k) => {
      if (k === "stroke") return () => { n.lines++; };
      if (k === "fillText") return () => { n.texts++; };
      if (k === "fill") return () => { n.fills++; };
      if (k === "measureText") return (s: string) => ({ width: s.length * 10 });
      return () => {};
    },
    set: () => true,
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, n };
}

describe("the notes' pencil", () => {
  it("counts a sketch's marks without drawing any", () => {
    const { ctx, n } = countingCtx();
    const p = new Pencil(ctx);
    const step = STORIES[0].steps[0];
    p.reset(step.seed, 0); step.draw(p);
    expect(p.used).toBeGreaterThan(100);
    expect(n.lines + n.texts + n.fills).toBe(0);
  });

  it("draws on in pieces exactly what it draws at once (each mark once, the same marks)", () => {
    for (const story of STORIES) for (const step of [story.insight, ...story.steps]) {
      const whole = countingCtx(), parts = countingCtx();
      const a = new Pencil(whole.ctx), b = new Pencil(parts.ctx);
      a.reset(step.seed, 0); step.draw(a);
      const total = a.used;
      a.reset(step.seed, total); step.draw(a);
      let drawn = 0;
      for (const share of [0.13, 0.4, 0.41, 0.77, 1]) {
        const to = Math.round(share * total);
        b.reset(step.seed, to, drawn); step.draw(b);
        drawn = to;
      }
      expect(parts.n).toEqual(whole.n);
    }
  });
});

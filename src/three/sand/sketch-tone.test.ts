import { describe, expect, test } from "vitest";
import { rubTone } from "./sketch-tone";

/** A 2D context that records what is drawn. */
function recorder() {
  const calls: { op: string; alpha: number }[] = [];
  const g = {
    globalAlpha: 1, lineWidth: 1, strokeStyle: "", fillStyle: "", lineCap: "butt",
    save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    clip() { calls.push({ op: "clip", alpha: this.globalAlpha }); },
    fill() { calls.push({ op: "fill", alpha: this.globalAlpha }); },
    stroke() { calls.push({ op: "stroke", alpha: this.globalAlpha }); },
  };
  return { g: g as unknown as CanvasRenderingContext2D, calls };
}

describe("tone: soft graphite rubbed in (Liam, 2026-10-12: hatching and a soft tone)", () => {
  const square: [number, number][] = [[0, 0], [20, 0], [20, 20], [0, 20]];
  test("clipped to its area before anything is drawn, then a faint base and streaks", () => {
    const { g, calls } = recorder();
    rubTone(g, square, 0.5, 4, 0, 0, 1);
    expect(calls[0].op).toBe("clip");
    expect(calls.filter((c) => c.op === "fill")).toHaveLength(1);
    expect(calls.filter((c) => c.op === "stroke").length).toBeGreaterThan(5);
  });
  test("never stronger than its own strength (a tone, never a light)", () => {
    const { g, calls } = recorder();
    rubTone(g, square, 0.5, 4, 0, 0, 2);
    for (const c of calls.slice(1)) expect(c.alpha).toBeLessThanOrEqual(0.5 * 0.35 + 1e-9);
  });
});

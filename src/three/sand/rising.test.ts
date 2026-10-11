import { describe, expect, test } from "vitest";
import { RISE, grainAt, rNoise, spillToHero } from "./rising";

const seeds = (n: number) => Array.from({ length: n }, (_, i) => [((i * 0.6180339) % 1), ((i * 0.4142135) % 1), ((i * 0.7320508) % 1), ((i * 0.2360679) % 1)] as [number, number, number, number]);

describe("rising sand", () => {
  test("a grain fades out at the top and grows back in at rest: never a pop at the cycle's turn", () => {
    const rest: [number, number, number] = [1.2, -4.6, -0.8], seed: [number, number, number, number] = [0.3, 0.7, 0.4, 0.5];
    for (let t = 0; t < 200; t += 0.01) {
      const a = grainAt(rest, seed, t), b = grainAt(rest, seed, t + 0.01);
      if (a.cycle !== b.cycle) {
        expect(a.alpha).toBeLessThan(0.02);
        expect(b.alpha).toBeLessThan(0.05);
      }
    }
  });

  test("it rests on its spot, then only rises, faster as it climbs", () => {
    const rest: [number, number, number] = [0, -4.6, 0], seed: [number, number, number, number] = [0.5, 0.5, 0.5, 0.5];
    let prev = grainAt(rest, seed, 0), prevStep = 0;
    for (let t = 0.05; t < 60; t += 0.05) {
      const g = grainAt(rest, seed, t);
      if (g.cycle === prev.cycle) {
        expect(g.lift).toBeGreaterThanOrEqual(prev.lift);
        if (g.lift > 0.05 && prev.lift > 0.05) { expect(g.lift - prev.lift).toBeGreaterThanOrEqual(prevStep - 1e-6); prevStep = g.lift - prev.lift; }
      } else prevStep = 0;
      if (g.lift === 0) expect(g.pos[1]).toBeCloseTo(rest[1], 6);
      prev = g;
    }
  });

  test("a few at a time, like the rocks on Lusion's floor (Liam): between 3% and 15% in the air at any moment", () => {
    const S = seeds(3000);
    for (const t of [0, 7.3, 31, 120, 999]) {
      let up = 0;
      S.forEach((s, i) => { if (grainAt([((i * 37) % 120) / 10 - 6, -4.6, ((i * 53) % 60) / 10 - 3], s, t).lift > 0) up++; });
      expect(up / S.length).toBeGreaterThan(0.03);
      expect(up / S.length).toBeLessThan(0.15);
    }
  });

  test("waves: grains close together lift close together, far apart they don't", () => {
    const s: [number, number, number, number] = [0.5, 0.5, 0.5, 0.5];
    const near = Math.abs(rNoise(1.0, 1.0) - rNoise(1.02, 1.0));
    const far = Math.abs(rNoise(1.0, 1.0) - rNoise(4.0, -2.0));
    expect(near).toBeLessThan(0.05);
    expect(far).toBeGreaterThan(near);
    // two grains 0.1 apart start lifting within a few seconds of each other
    const startOf = (x: number) => { for (let t = 0; t < 400; t += 0.05) if (grainAt([x, -4.6, 0], s, t).lift > 0) return t; return 400; };
    expect(Math.abs(startOf(2.0) - startOf(2.1))).toBeLessThan(3);
  });

  test("hours in: still smooth, no jumps in view", () => {
    const rest: [number, number, number] = [0.4, -4.6, 1.1], seed: [number, number, number, number] = [0.2, 0.9, 0.1, 0.6];
    for (let t = 100000; t < 100030; t += 1 / 60) {
      const a = grainAt(rest, seed, t), b = grainAt(rest, seed, t + 1 / 60);
      if (a.cycle === b.cycle && a.alpha > 0.05) expect(Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2])).toBeLessThan(0.5);
    }
  });

  test("the spill's spots in the hero's units: the ball's place is the origin, the desk 4.6 below", () => {
    const raw = new Float32Array([0, 0.03, 0.46, 0.5, 0.1, -0.07, 0, 0.7]);
    const h = spillToHero(raw, [0, 0.03, 0.46], 0.1);
    [0, 0, 0, 0.5].forEach((v, i) => expect(h[i]).toBeCloseTo(v, 5));   // (float32 in: ~1e-7 off)
    expect(h[4]).toBeCloseTo(1); expect(h[5]).toBeCloseTo(-4.6); expect(h[6]).toBeCloseTo(1); expect(h[7]).toBeCloseTo(0.7);
    expect(RISE.height).toBeGreaterThan(4.6);   // they rise past the ball's height, out of frame
  });
});

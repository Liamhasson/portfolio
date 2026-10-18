// src/three/pendant/snap.test.ts
import { describe, expect, test } from "vitest";
import { stepSnap } from "./snap";

/** Runs the snap from 0 to 1 at a steady `dt` for `seconds`, returning each step's time and position. */
const run = (dt: number, seconds: number, start = { x: 0, v: 0 }, target = 1) => {
  const s = { ...start };
  const out: { t: number; x: number }[] = [];
  const n = Math.round(seconds / dt);
  for (let i = 1; i <= n; i++) {
    stepSnap(s, target, dt);
    out.push({ t: i * dt, x: s.x });
  }
  return { s, out };
};

describe("the snap (plan 2026-10-18 round 3, Task 3: about 0.25 s, a tiny overshoot that settles)", () => {
  test("it settles within 2% of the jump in about 0.25 s, and stays", () => {
    const { out } = run(1 / 600, 1);
    const lastOut = out.filter((p) => Math.abs(p.x - 1) > 0.02).at(-1)!.t;
    expect(lastOut).toBeGreaterThan(0.2);
    expect(lastOut).toBeLessThan(0.3);
  });

  test("its overshoot is under 4% of the jump, but there is one (it reads as a snap, not an ease)", () => {
    const { out } = run(1 / 600, 1);
    const peak = Math.max(...out.map((p) => p.x)) - 1;
    expect(peak).toBeLessThanOrEqual(0.04);
    expect(peak).toBeGreaterThan(0.005);
  });

  test("the same at any frame rate: 30, 60 and 144 Hz land on the same path", () => {
    // 1/6 s is a whole number of frames at each rate
    const at = (dt: number) => run(dt, 1 / 6).s;
    const a = at(1 / 30), b = at(1 / 60), c = at(1 / 144);
    expect(b.x).toBeCloseTo(a.x, 9);
    expect(c.x).toBeCloseTo(a.x, 9);
    expect(c.v).toBeCloseTo(a.v, 6);
    // and the overshoot holds at the coarse and fine rates
    for (const dt of [1 / 30, 1 / 144]) expect(Math.max(...run(dt, 1).out.map((p) => p.x))).toBeLessThanOrEqual(1.04);
  });

  test("an uneven mix of frames lands where a steady rate does", () => {
    const s = { x: 0, v: 0 };
    for (const dt of [1 / 30, 1 / 144, 1 / 60, 1 / 144, 1 / 30, 1 / 72]) stepSnap(s, 1, dt);
    const total = 1 / 30 + 1 / 144 + 1 / 60 + 1 / 144 + 1 / 30 + 1 / 72;
    const steady = { x: 0, v: 0 };
    stepSnap(steady, 1, total);
    expect(s.x).toBeCloseTo(steady.x, 9);
  });

  test("it works on any span and from a moving start, and a zero or negative dt leaves it alone", () => {
    const { s } = run(1 / 60, 1, { x: 400, v: -2000 }, 120);
    expect(s.x).toBeCloseTo(120, 3);
    expect(Math.abs(s.v)).toBeLessThan(1);
    const still = { x: 5, v: 3 };
    stepSnap(still, 0, 0);
    stepSnap(still, 0, -1);
    expect(still).toEqual({ x: 5, v: 3 });
  });

  test("at the target and at rest it stays put", () => {
    const s = { x: 2, v: 0 };
    stepSnap(s, 2, 1 / 60);
    expect(s).toEqual({ x: 2, v: 0 });
  });
});

import { expect, test } from "vitest";
import { MOVES, OFF, burnBreath, stepMoves } from "./moves";

test("the four moves the video uses (Slice went, Liam 2026-10-22)", () => {
  expect(MOVES).toEqual(["burn", "doubled", "lens", "blowout"]);
  expect(OFF).toEqual({ burn: 0, doubled: 0, lens: 0, blowout: 0 });
});

test("reduced motion jumps straight to the target", () => {
  expect(stepMoves(OFF, { ...OFF, burn: 1 }, 0.016, true).burn).toBe(1);
});

test("a full change takes about 0.35 s, so it never flashes", () => {
  const s = stepMoves(OFF, { ...OFF, lens: 1 }, 0.1, false).lens;
  expect(s).toBeGreaterThan(0);
  expect(s).toBeLessThan(0.5);
  let cur = OFF;
  for (let i = 0; i < 30; i++) cur = stepMoves(cur, { ...OFF, lens: 1 }, 1 / 60, false);
  expect(cur.lens).toBeGreaterThan(0.95);
});

test("a step never overshoots, in either direction", () => {
  expect(stepMoves({ ...OFF, lens: 0.99 }, { ...OFF, lens: 1 }, 1, false).lens).toBe(1);
  expect(stepMoves({ ...OFF, lens: 0.01 }, OFF, 1, false).lens).toBe(0);
});

test("the burn breathes once every 8.6 s, far slower than 3 flashes a second", () => {
  expect(burnBreath(0)).toBeCloseTo(burnBreath(8.6), 5);
  expect(burnBreath(4.3)).toBeGreaterThan(burnBreath(0));
  for (let t = 0; t < 9; t += 0.37) { expect(burnBreath(t)).toBeGreaterThanOrEqual(0); expect(burnBreath(t)).toBeLessThanOrEqual(1); }
});

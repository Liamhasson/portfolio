import { describe, expect, test } from "vitest";
import { HERO_LAYOUT, heroShift } from "./hero-layout";

// the hero camera (public/lab/sand/sand.json) and a cloud a little off its axis
const cam: [number, number, number] = [0, 0.6, 9.5], target: [number, number, number] = [0, 0.1, 0];
const centre: [number, number, number] = [-0.3, 0.2, 0.4];
const tanHalfW = Math.tan((2 * Math.atan(36 / 2 / 45)) / 2);   // 45 mm on a 36 mm sensor, horizontal
const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
const norm = (a: number[]) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const ndcX = (p: number[]) => {
  const f = norm(sub(target, cam)), r = norm([-f[2], 0, f[0]]);   // f x up
  const d = sub(p, cam);
  return dot(d, r) / (dot(d, f) * tanHalfW);
};

describe("the vortex to the right of the copy (Liam, 2026-10-11)", () => {
  test("on a wide screen the cloud's centre lands right of the copy", () => {
    const s = heroShift(cam, target, centre, tanHalfW, 1.6);
    expect(ndcX(centre.map((v, i) => v + s[i]))).toBeCloseTo(HERO_LAYOUT.ndcX, 5);
    expect(HERO_LAYOUT.ndcX).toBeGreaterThan(0.2);
  });

  test("on a phone (portrait: the copy spans the width) it stays where it is", () => {
    expect(heroShift(cam, target, centre, tanHalfW, 0.5).every((v) => v === 0)).toBe(true);
  });

  test("sideways only: never nearer the lens, so no grain grows", () => {
    const s = heroShift(cam, target, centre, tanHalfW, 1.6);
    expect(Math.abs(dot(s, norm(sub(target, cam))))).toBeLessThan(1e-9);
    expect(Math.hypot(...s)).toBeGreaterThan(0.5);
  });
});

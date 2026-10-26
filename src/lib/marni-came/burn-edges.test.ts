import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { MC_ASSETS } from "./assets";
import { HIT, MAX_BURNS, MIN_GAP, SHAPES, brightness, decodeEnergy, edgeTransform, envelope, follow, makeBurn, pickEdge, reach, sample, step, type Burn } from "./burn-edges";

const seeded = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

test("each track's numbers decode to 20 a second for its whole length, between 0 and 1", () => {
  for (const t of Object.values(MC_ASSETS.tracks)) {
    const e = decodeEnergy(JSON.parse(readFileSync(path.join(process.cwd(), "public", t.energy), "utf8")));
    const peaks = JSON.parse(readFileSync(path.join(process.cwd(), "public", t.peaks), "utf8"));
    expect(e.fps).toBe(20);
    expect(Math.abs(e.level.length / 20 - peaks.duration)).toBeLessThan(1);
    expect(e.hit).toHaveLength(e.level.length);
    for (const v of [...e.level, ...e.hit]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  }
});

test("sampling reads the frame at that time, and nothing outside the track", () => {
  const e = decodeEnergy({ fps: 20, level: "A/", hit: "/A" });
  expect(sample(e, 0)).toEqual({ level: 0, hit: 1 });
  expect(sample(e, 0.06)).toEqual({ level: 1, hit: 0 });
  expect(sample(e, 5)).toEqual({ level: 0, hit: 0 });
  expect(sample(e, -1)).toEqual({ level: 0, hit: 0 });
});

test("the bottom leads: it reaches furthest in, and further when it's loud; the sides and top stay thin", () => {
  expect(reach("b", 1)).toBeCloseTo(0.22);
  expect(reach("b", 0)).toBeCloseTo(0.1);
  for (const e of ["l", "r", "t"] as const) expect(reach(e, 1)).toBeLessThanOrEqual(0.1);
});

test("the loudness swells quickly and falls back slowly", () => {
  const up = follow(0, 1, 0.1), down = 1 - follow(1, 0, 0.1);
  expect(up).toBeGreaterThan(down * 2);
});

test("mostly the bottom: across many picks, it wins at least half, and the top is rare", () => {
  const r = seeded(7), n: Record<string, number> = { b: 0, l: 0, r: 0, t: 0 };
  for (let i = 0; i < 2000; i++) n[pickEdge(0.5, r())]++;
  expect(n.b).toBeGreaterThan(1000);
  expect(n.t).toBeLessThan(n.l);
});

test("a burn crossfades between two different shapes, and rises softly instead of popping", () => {
  const r = seeded(3);
  for (let i = 0; i < 200; i++) {
    const b = makeBurn("b", 0, Math.random(), r);
    expect(b.a).not.toBe(b.b);
    expect(b.a).toBeLessThan(SHAPES); expect(b.b).toBeLessThan(SHAPES);
    expect(b.rise).toBeGreaterThanOrEqual(0.12);
  }
});

test("a burn's brightness rises, holds and fades, and is 0 before and after it", () => {
  const b: Burn = { edge: "b", at: 0.5, width: 0.4, a: 0, b: 1, born: 10, life: 2, rise: 0.2, flip: false };
  expect(envelope(b, 9.9)).toBe(0);
  expect(envelope(b, 10.1)).toBeCloseTo(0.5);
  expect(envelope(b, 10.8)).toBe(1);
  expect(envelope(b, 11.9)).toBeLessThan(0.2);
  expect(envelope(b, 12.1)).toBe(0);
});

test("there's always a burn resting at the bottom while the music plays", () => {
  const { burns } = step([], 0, 0, 0, -1, seeded(2));
  expect(burns.some((b) => b.edge === "b")).toBe(true);
});

test("never more than three new burns a second, and never more than seven at once, however busy the song", () => {
  const r = seeded(5);
  let burns: Burn[] = [], lastNew = -1;
  const starts: number[] = [];
  for (let t = 0; t < 20; t += 1 / 60) {
    const before = burns.length;
    ({ burns, lastNew } = step(burns, t, 1, 1, lastNew, r));
    if (lastNew === t) starts.push(t);
    expect(burns.length).toBeLessThanOrEqual(MAX_BURNS + 1);
    void before;
  }
  for (let i = 3; i < starts.length; i++) expect(starts[i] - starts[i - 3]).toBeGreaterThanOrEqual(1 - 1e-9);
  expect(MIN_GAP * 3).toBeGreaterThanOrEqual(1);
});

test("no hit, no new burn (only the resting one)", () => {
  const r = seeded(9);
  let burns: Burn[] = [], lastNew = -1;
  for (let t = 0; t < 3; t += 1 / 60) ({ burns, lastNew } = step(burns, t, 0.5, HIT - 0.01, lastNew, r));
  expect(lastNew).toBe(-1);
  expect(burns.every((b) => b.edge === "b")).toBe(true);
});

test("dim when quiet, never past full when loud", () => {
  expect(brightness(0)).toBeLessThan(0.5);
  expect(brightness(1)).toBe(1);
});

test("each edge's transform puts the shape's lit side on that edge of the screen", () => {
  const W = 1000, H = 600, d = 80;
  const at = (m: number[], x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  expect(at(edgeTransform("b", 0.5, d, W, H), 0, d)).toEqual([500, 600]);
  expect(at(edgeTransform("t", 0.5, d, W, H), 0, d)).toEqual([500, 0]);
  expect(at(edgeTransform("l", 0.5, d, W, H), 0, d)).toEqual([0, 300]);
  expect(at(edgeTransform("r", 0.5, d, W, H), 0, d)).toEqual([1000, 300]);
});

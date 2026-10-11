import { describe, expect, test } from "vitest";
import { GrainGovernor } from "./quality";

function feedQ(g: GrainGovernor, frameMs: number, frames: number) {
  const changes: { grains: number; pixelRatio: number }[] = [];
  for (let i = 0; i < frames; i++) {
    const next = g.sample(frameMs);
    if (next !== null) changes.push(next);
  }
  return changes;
}

describe("GrainGovernor (grains, then sharpness, follow the frame time; never pixelated)", () => {
  const make = (start = 260_000, pr = 2) => new GrainGovernor({ min: 160_000, max: 400_000, start }, { min: 1.5, max: 2, start: pr });

  test("ignores the start: loading and shader compiles never count against the device", () => {
    expect(feedQ(make(), 80, 30)).toEqual([]);
  });

  test("slow frames lower the grains first, then the sharpness in 0.25 steps, never below their floors", () => {
    const g = make();
    feedQ(g, 16, 200);
    const down = feedQ(g, 40, 1200);
    const firstPr = down.findIndex((c) => c.pixelRatio < 2);
    expect(firstPr).toBeGreaterThan(0);
    expect(down.slice(0, firstPr).every((c) => c.pixelRatio === 2)).toBe(true);
    expect(down[firstPr - 1].grains).toBe(160_000);
    expect(down.map((c) => c.pixelRatio)).toContain(1.75);
    expect(Math.min(...down.map((c) => c.pixelRatio))).toBe(1.5);
    expect(g.starved).toBe(true);
  });

  test("fast frames bring the sharpness back first, then the grains, up to the most loaded", () => {
    const g = make(160_000, 1.5);
    const up = feedQ(g, 6, 4000);
    const prFull = up.findIndex((c) => c.pixelRatio === 2);
    expect(prFull).toBeGreaterThanOrEqual(0);
    expect(up.slice(0, prFull + 1).every((c) => c.grains === 160_000)).toBe(true);
    expect(up[up.length - 1]).toEqual({ grains: 400_000, pixelRatio: 2 });
  });

  test("a frame in the target band changes nothing", () => {
    expect(feedQ(make(), 15, 2000)).toEqual([]);
  });

  test("stalls (a tab switch, a texture upload) are not frames", () => {
    const g = make();
    feedQ(g, 15, 200);
    for (let i = 0; i < 20; i++) { expect(g.sample(15)).toBeNull(); expect(g.sample(400)).toBeNull(); }
  });
});

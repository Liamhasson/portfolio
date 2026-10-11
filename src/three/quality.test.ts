import { describe, expect, test } from "vitest";
import { GrainGovernor, QualityGovernor } from "./quality";

function feed(g: QualityGovernor, frameMs: number, frames: number) {
  const changes: string[] = [];
  for (let i = 0; i < frames; i++) {
    const next = g.sample(frameMs);
    if (next) changes.push(next);
  }
  return changes;
}

describe("QualityGovernor", () => {
  test("steps down one tier when the average frame is slow over a window", () => {
    const g = new QualityGovernor("high");
    expect(feed(g, 33, 70)).toEqual(["mid"]);
  });

  test("a cooldown stops it dropping twice in a row, then it can drop again", () => {
    const g = new QualityGovernor("high");
    expect(feed(g, 33, 70)).toEqual(["mid"]);
    expect(feed(g, 33, 60)).toEqual([]);
    expect(feed(g, 33, 200)).toEqual(["low"]);
  });

  test("never goes below low", () => {
    const g = new QualityGovernor("low");
    expect(feed(g, 60, 400)).toEqual([]);
  });

  test("never changes when frames are fast", () => {
    const g = new QualityGovernor("high");
    expect(feed(g, 16.7, 1200)).toEqual([]);
  });

  test("one long hitch in an otherwise smooth window does not trigger a drop", () => {
    const g = new QualityGovernor("high");
    expect(feed(g, 16, 119)).toEqual([]);
    expect(g.sample(300)).toBeNull();
    expect(feed(g, 16, 10)).toEqual([]);
  });
});

function feedGrains(g: GrainGovernor, frameMs: number, frames: number) {
  const changes: number[] = [];
  for (let i = 0; i < frames; i++) {
    const next = g.sample(frameMs);
    if (next !== null) changes.push(next);
  }
  return changes;
}

describe("GrainGovernor (the sand's grain count follows the frame time; sharpness stays)", () => {
  test("ignores the start: loading and shader compiles never count against the device", () => {
    const g = new GrainGovernor(160_000, 400_000, 260_000);
    expect(feedGrains(g, 80, 30)).toEqual([]);   // 2.4 s of awful frames, all inside the warm-up
  });

  test("slow frames after the warm-up lower the count, in steps, never below the floor", () => {
    const g = new GrainGovernor(160_000, 400_000, 260_000);
    feedGrains(g, 16, 200);                       // past the warm-up, smooth
    const down = feedGrains(g, 30, 600);
    expect(down.length).toBeGreaterThan(1);
    expect(down.every((n, i) => i === 0 || n < down[i - 1])).toBe(true);
    expect(Math.min(...down)).toBe(160_000);
  });

  test("fast frames raise it again, up to the most the device loaded", () => {
    const g = new GrainGovernor(160_000, 400_000, 160_000);
    const up = feedGrains(g, 8, 3000);
    expect(up.length).toBeGreaterThan(1);
    expect(Math.max(...up)).toBe(400_000);
    expect(up.every((n, i) => i === 0 || n > up[i - 1])).toBe(true);
  });

  test("a frame in the target band changes nothing", () => {
    const g = new GrainGovernor(160_000, 400_000, 260_000);
    expect(feedGrains(g, 15, 2000)).toEqual([]);
  });

  test("stalls (a tab switch, a texture upload) are not frames: they never count", () => {
    const g = new GrainGovernor(160_000, 400_000, 260_000);
    feedGrains(g, 15, 200);
    for (let i = 0; i < 20; i++) { expect(g.sample(15)).toBeNull(); expect(g.sample(400)).toBeNull(); }
  });

  test("says when it is out of room (at the floor and still slow): the stage may then lower the resolution", () => {
    const g = new GrainGovernor(160_000, 400_000, 160_000);
    feedGrains(g, 16, 200);
    feedGrains(g, 40, 300);
    expect(g.starved).toBe(true);
    const h = new GrainGovernor(160_000, 400_000, 260_000);
    feedGrains(h, 15, 600);
    expect(h.starved).toBe(false);
  });
});

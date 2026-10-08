import { describe, expect, test } from "vitest";
import { QualityGovernor } from "./quality";

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

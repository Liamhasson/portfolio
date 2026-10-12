// src/app/lab/sand/loader-timeline.test.ts
import { describe, expect, test } from "vitest";
import { LOADER, loaderAt } from "./loader-timeline";

describe("the loader at 100% (spec §2.3)", () => {
  test("the anchors become grains in order: the centre, the corners, the curve's anchors", () => {
    expect(loaderAt(0.1).squares[0]).toBeLessThan(1);   // the centre goes first
    expect(loaderAt(0.1).squares[5]).toBe(1);
    expect(loaderAt(0.3).squares[5]).toBeLessThan(1);   // a corner by 0.3 s
    expect(loaderAt(0.3).squares[1]).toBe(1);           // the curve's top still a square
    expect(loaderAt(0.8).squares.every((s) => s === 0)).toBe(true);
  });
  test("the lines dissolve from 0.2 s and are gone by 1.4 s", () => {
    expect(loaderAt(0.1).dash).toBe(0);
    expect(loaderAt(0.6).dash).toBeGreaterThan(0);
    expect(loaderAt(1.4).briefAlpha).toBe(0);
  });
  test("the light comes up 0.9 to 2.4 s, never below its floor; the copy at 2.8 to 3.6 s; scrolling unlocks at 3.6 s", () => {
    expect(loaderAt(0).lightK).toBeCloseTo(LOADER.lightFloor, 6);
    expect(loaderAt(2.4).lightK).toBeCloseTo(1, 6);
    expect(loaderAt(2.7).copy).toBe(0);
    expect(loaderAt(3.6).copy).toBe(1);
    expect(loaderAt(3.59).unlocked).toBe(false);
    expect(loaderAt(3.6).unlocked).toBe(true);
  });
  test("driven by accumulated frame time: a paused tab resumes where it was (no skip to the end)", () => {
    let t = 0;
    for (let i = 0; i < 30; i++) t += 1 / 60;   // half a second of frames, then the tab hides (no frames), then resumes
    expect(loaderAt(t).unlocked).toBe(false);
    expect(loaderAt(t).light).toBe(0);
  });
});

// src/app/lab/sand/loader-timeline.test.ts
import { describe, expect, test } from "vitest";
import { LOADER, loaderAt } from "./loader-timeline";

describe("the loader at 100% (spec §2.3), timed from the circle's closing (after the rounding beat)", () => {
  const R = LOADER.round;
  test("the anchors become grains in order: the centre, the corners, the curve's anchors", () => {
    expect(loaderAt(R + 0.1).squares[0]).toBeLessThan(1);   // the centre goes first
    expect(loaderAt(R + 0.1).squares[5]).toBe(1);
    expect(loaderAt(R + 0.3).squares[5]).toBeLessThan(1);   // a corner by 0.3 s
    expect(loaderAt(R + 0.3).squares[1]).toBe(1);           // the curve's top still a square
    expect(loaderAt(R + 0.8).squares.every((s) => s === 0)).toBe(true);
  });
  test("the lines dissolve from 0.2 s and are gone by 1.4 s", () => {
    expect(loaderAt(R + 0.1).dash).toBe(0);
    expect(loaderAt(R + 0.6).dash).toBeGreaterThan(0);
    expect(loaderAt(R + 1.4).briefAlpha).toBe(0);
  });
  test("the light comes up 0.9 to 2.4 s, never below its floor; the copy at 2.8 to 3.6 s; scrolling unlocks at 3.6 s", () => {
    expect(loaderAt(R + 0).lightK).toBeCloseTo(LOADER.lightFloor, 6);
    expect(loaderAt(R + 2.4).lightK).toBeCloseTo(1, 6);
    expect(loaderAt(R + 2.7).copy).toBe(0);
    expect(loaderAt(R + 3.6).copy).toBe(1);
    expect(loaderAt(R + 3.59).unlocked).toBe(false);
    expect(loaderAt(R + 3.6).unlocked).toBe(true);
  });
  test("driven by accumulated frame time: a paused tab resumes where it was (no skip to the end)", () => {
    let t = 0;
    for (let i = 0; i < 30; i++) t += 1 / 60;   // half a second of frames, then the tab hides (no frames), then resumes
    expect(loaderAt(t).unlocked).toBe(false);
    expect(loaderAt(t).light).toBe(0);
  });
});

test("at 100% the square rounds into the circle first (its own beat), then its points become sand", () => {
  expect(loaderAt(0).round).toBe(0);
  expect(loaderAt(LOADER.round / 2).round).toBeGreaterThan(0.2);
  expect(loaderAt(LOADER.round).round).toBe(1);
  expect(loaderAt(LOADER.round - 0.01).squares.every((s) => s === 1)).toBe(true);   // no point turns to sand mid-rounding
  expect(loaderAt(LOADER.round + 0.1).squares[0]).toBeLessThan(1);                  // the centre first, right after
  expect(loaderAt(LOADER.round + LOADER.unlock - 0.01).unlocked).toBe(false);
  expect(loaderAt(LOADER.round + LOADER.unlock).unlocked).toBe(true);
});

test("the loader's clock runs until the release, even when the cascade ends first (it stopped there and the page never unlocked: Liam, 2026-10-12)", async () => {
  const { cascadeEnd } = await import("@/three/sand/cascade");
  const { loaderRunning } = await import("./loader-timeline");
  // (with no settle the cascade now ends before the unlock)
  expect(LOADER.round + cascadeEnd(160000)).toBeLessThan(LOADER.round + LOADER.unlock);
  expect(loaderRunning({ cascadeDone: true, released: false })).toBe(true);
  expect(loaderRunning({ cascadeDone: false, released: true })).toBe(true);
  expect(loaderRunning({ cascadeDone: true, released: true })).toBe(false);
});

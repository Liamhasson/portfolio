// src/app/about/track.test.ts
import { describe, expect, test } from "vitest";
import { sectionHeight, trackLayout, trackProgress, trackX } from "./track";

describe("About's sideways track (spec 2026-10-12 §3)", () => {
  test("the page is a screen plus the track's overflow: one pixel of scroll moves it one pixel", () => {
    expect(sectionHeight(5000, 1440, 900)).toBe(900 + 3560);
    expect(sectionHeight(1000, 1440, 900)).toBe(900);
  });
  test("progress runs 0..1 across the pinned stretch, clamped", () => {
    expect(trackProgress(100, 200, 4460, 900)).toBe(0);
    expect(trackProgress(200 + 1780, 200, 4460, 900)).toBeCloseTo(0.5, 9);
    expect(trackProgress(99999, 200, 4460, 900)).toBe(1);
    expect(trackProgress(500, 200, 900, 900)).toBe(0);
  });
  test("the track moves left by exactly its overflow", () => {
    expect(trackX(0, 5000, 1440)).toBeCloseTo(0, 9);
    expect(trackX(1, 5000, 1440)).toBe(-3560);
    expect(trackX(1, 1000, 1440)).toBeCloseTo(0, 9);
  });
  test("portrait phones and reduced motion stack it: never a sideways scroll (Review Focus 3)", () => {
    expect(trackLayout({ w: 1440, h: 900, reduced: false })).toBe("track");
    expect(trackLayout({ w: 390, h: 844, reduced: false })).toBe("stack");
    expect(trackLayout({ w: 1440, h: 900, reduced: true })).toBe("stack");
  });
});

// src/lib/pull.test.ts
import { describe, expect, test } from "vitest";
import { PULL, pullDone, pullStart, pullStep } from "./pull";

const vh = 1000;
/** A gesture: wheel events `dy` each, `every` seconds apart, from `t0`. */
function gesture(s = pullStart(), { t0 = 0, n = 10, dy = 60, every = 0.016, atEnd = (): boolean => true } = {}) {
  for (let k = 0; k < n; k++) s = pullStep(s, { dy, t: t0 + k * every, atEnd: atEnd(), vh });
  return s;
}

describe("the pull at a page's end (spec 2026-10-12 §2)", () => {
  test("a scroll that starts at the end fills it, about 0.6 of a screen to full", () => {
    const s = gesture(undefined, { n: 5, dy: 60 });
    expect(s.fill).toBeCloseTo(300 / (PULL.need * vh), 6);
    expect(pullDone(gesture(undefined, { n: 11, dy: 60 }))).toBe(true);
  });
  test("momentum from a flick that reached the end never fills it: momentum only ever slows (Review Focus 1)", () => {
    let atEnd = false;
    let s = pullStart();
    for (let k = 0; k < 120; k++) {
      if (k === 20) atEnd = true;   // (the page reaches its end mid-flick; the momentum keeps coming, 16 ms apart, dying)
      s = pullStep(s, { dy: 90 * Math.pow(0.95, k), t: k * 0.016, atEnd, vh });
    }
    expect(pullDone(s)).toBe(false);
    expect(s.fill).toBeLessThan(0.1);
  });
  test("one continuous scroll down that reaches the end and keeps going fills it, wherever it started (Liam, 2026-10-12)", () => {
    let atEnd = false;
    let s = pullStart();
    for (let k = 0; k < 80; k++) {
      if (k === 20) atEnd = true;   // (the finger keeps scrolling at its own pace, a little uneven)
      s = pullStep(s, { dy: 60 + (k % 3) * 4, t: k * 0.016, atEnd, vh });
    }
    expect(pullDone(s)).toBe(true);
  });
  test("a pause, then a fresh scroll at the end, counts", () => {
    let s = gesture(pullStart(), { n: 5, atEnd: () => false });
    s = gesture(s, { t0: 0.5, n: 3 });
    expect(s.fill).toBeGreaterThan(0);
  });
  test("stopping holds it; scrolling back empties it", () => {
    const s = gesture(undefined, { n: 4 });
    const held = pullStep(s, { dy: 0, t: 5, atEnd: true, vh });
    expect(held.fill).toBe(s.fill);
    const back = gesture(held, { t0: 6, n: 10, dy: -60 });
    expect(back.fill).toBe(0);
  });
  test("never past full", () => {
    expect(gesture(undefined, { n: 100 }).fill).toBe(1);
  });
});

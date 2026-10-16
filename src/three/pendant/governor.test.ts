import { describe, expect, test } from "vitest";
import { PendantGovernor, PR_FLOOR } from "./governor";

/** Feeds `ms` long frames for `forMs`; returns every change. */
function feed(g: PendantGovernor, ms: number, forMs: number): number[] {
  const out: number[] = [];
  for (let t = 0; t < forMs; t += ms) {
    const c = g.sample(ms);
    if (c !== null) out.push(c);
  }
  return out;
}

/** Feeds `ms` long frames until the first change (at most `forMs`); returns it, or null. */
function feedUntilChange(g: PendantGovernor, ms: number, forMs = 20_000): number | null {
  for (let t = 0; t < forMs; t += ms) {
    const c = g.sample(ms);
    if (c !== null) return c;
  }
  return null;
}

describe("PendantGovernor (the pixel ratio follows the frame time, both ways)", () => {
  test("starts at the screen's ratio and holds while frames keep the display's pace", () => {
    const g = new PendantGovernor(2);
    expect(feed(g, 16.7, 20_000)).toEqual([]);
    expect(feed(g, 8.3, 20_000)).toEqual([]);
    expect(g.pixelRatio).toBe(2);
  });

  test("under load it steps down to the 1.5 floor and no further", () => {
    const g = new PendantGovernor(2);
    feed(g, 16.7, 3000); // (past the warm-up)
    expect(feed(g, 33, 20_000)).toEqual([1.75, 1.5]);
    expect(g.pixelRatio).toBe(PR_FLOOR);
  });

  test("and steps back up once frames are good again (at 60 Hz too, where frames can't be faster than 16.7 ms)", () => {
    const g = new PendantGovernor(2);
    feed(g, 16.7, 3000);
    feed(g, 33, 20_000);
    expect(feed(g, 16.7, 20_000)).toEqual([1.75, 2]);
  });

  test("hysteresis: frames between good and slow hold the ratio either way", () => {
    const g = new PendantGovernor(2);
    feed(g, 16.7, 3000);
    expect(feedUntilChange(g, 33)).toBe(1.75); // one step down
    expect(feed(g, 18.5, 30_000)).toEqual([]);
  });

  test("a step up that makes frames slow again doubles the wait before the next try (no pumping)", () => {
    const g = new PendantGovernor(2, { upAfterMs: 3000 });
    feed(g, 16.7, 3000);
    expect(feedUntilChange(g, 33)).toBe(1.75);
    // good for a while: it tries 2 again, which is slow, so it comes back down
    expect(feedUntilChange(g, 16.7)).toBe(2);
    expect(feedUntilChange(g, 33)).toBe(1.75);
    // the next try now needs 6 s of good frames: 5 s isn't enough
    expect(feed(g, 16.7, 5000)).toEqual([]);
    expect(feed(g, 16.7, 2000)).toEqual([2]);
  });

  test("a screen at or under the floor is never touched", () => {
    for (const pr of [1, 1.25, 1.5]) {
      const g = new PendantGovernor(pr);
      feed(g, 16.7, 3000);
      expect(feed(g, 40, 20_000)).toEqual([]);
      expect(g.pixelRatio).toBe(pr);
    }
  });

  test("the warm-up and stalls never count", () => {
    const g = new PendantGovernor(2);
    expect(feed(g, 40, 2400)).toEqual([]); // (still warming up)
    const h = new PendantGovernor(2);
    feed(h, 16.7, 3000);
    expect(feed(h, 400, 20_000)).toEqual([]); // (a hidden tab's gaps)
    expect(h.sample(Number.NaN)).toBeNull();
  });

  test("a new screen ratio starts over from it", () => {
    const g = new PendantGovernor(2);
    feed(g, 16.7, 3000);
    feed(g, 33, 20_000);
    g.setMax(1.75);
    expect(g.pixelRatio).toBe(1.75);
    expect(g.floor).toBe(1.5);
  });
});

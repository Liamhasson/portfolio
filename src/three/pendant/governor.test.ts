import { describe, expect, test } from "vitest";
import { ladder, PendantGovernor, PR_FLOOR, type PendantLevel } from "./governor";

const L = (l: PendantLevel | null) => (l === null ? null : `${l.pr}${l.bokehHalf ? "+half" : ""}`);

/** Feeds `ms` long frames for `forMs`; returns every change. */
function feed(g: PendantGovernor, ms: number, forMs: number): string[] {
  const out: string[] = [];
  for (let t = 0; t < forMs; t += ms) {
    const c = g.sample(ms);
    if (c !== null) out.push(L(c)!);
  }
  return out;
}

/** Feeds `ms` long frames until the first change (at most `forMs`); returns it, or null. */
function feedUntilChange(g: PendantGovernor, ms: number, forMs = 30_000): string | null {
  for (let t = 0; t < forMs; t += ms) {
    const c = g.sample(ms);
    if (c !== null) return L(c);
  }
  return null;
}

/** Frames whose time follows the level (a device the pendant loads), for `forMs`; returns every change. */
function feedLoad(g: PendantGovernor, cost: Record<string, number>, forMs: number): string[] {
  const out: string[] = [];
  for (let t = 0; t < forMs;) {
    const ms = cost[L(g.level)!];
    const c = g.sample(ms);
    if (c !== null) out.push(L(c)!);
    t += ms;
  }
  return out;
}

/** Slow at every level, but less so the lower it goes (stepping down helps, not enough). */
const HEAVY = { "2": 40, "1.75": 37, "1.5": 33, "1.5+half": 30 };

/** A governor past its warm-up at a 60 Hz screen's pace. */
const at60 = (max = 2) => {
  const g = new PendantGovernor(max);
  feed(g, 16.7, 3000);
  return g;
};

describe("the ladder", () => {
  test("the pixel ratio down to 1.5, then the half-resolution bokeh at 1.5", () => {
    expect(ladder(2).map(L)).toEqual(["2", "1.75", "1.5", "1.5+half"]);
    expect(ladder(1.8).map(L)).toEqual(["1.8", "1.55", "1.5", "1.5+half"]);
  });

  test("a screen at or under 1.5x: the bokeh step only", () => {
    for (const pr of [1, 1.25, 1.5]) expect(ladder(pr).map(L)).toEqual([`${pr}`, `${pr}+half`]);
  });
});

describe("PendantGovernor (the level follows the frame time, both ways)", () => {
  test("starts at the screen's ratio, full bokeh, and holds while frames keep the display's pace", () => {
    const g = new PendantGovernor(2);
    expect(feed(g, 16.7, 20_000)).toEqual([]);
    expect(L(g.level)).toBe("2");
    const h = new PendantGovernor(2);
    expect(feed(h, 8.3, 20_000)).toEqual([]);
  });

  test("under load it steps down to the 1.5 floor, then turns the half-resolution bokeh on, and no further", () => {
    const g = at60();
    expect(feedLoad(g, HEAVY, 60_000)).toEqual(["1.75", "1.5", "1.5+half"]);
    expect(g.pixelRatio).toBe(PR_FLOOR);
    expect(g.bokehHalf).toBe(true);
  });

  test("going up turns the half-resolution bokeh off before the pixel ratio rises", () => {
    const g = at60();
    feedLoad(g, HEAVY, 60_000);
    expect(feed(g, 16.7, 30_000)).toEqual(["1.5", "1.75", "2"]);
  });

  test("a screen at or under 1.5x gets the bokeh step only, both ways", () => {
    for (const pr of [1, 1.5]) {
      const g = at60(pr);
      const cost = { [`${pr}`]: 40, [`${pr}+half`]: 30 };
      // (a one-step ladder: the window that saw the load start was half good frames, so stepping down can look like it
      // didn't help, and it may try the top once more; the next descent sees the full load, and it settles)
      expect(feedLoad(g, cost, 60_000)[0]).toBe(`${pr}+half`);
      expect(feedLoad(g, cost, 60_000)).toEqual([]);
      expect(L(g.level)).toBe(`${pr}+half`);
      expect(g.pixelRatio).toBe(pr);
      expect(feed(g, 16.7, 30_000)).toEqual([`${pr}`]);
    }
  });

  test("hysteresis: frames between good and slow hold the level either way", () => {
    const g = at60();
    expect(feedUntilChange(g, 33)).toBe("1.75");
    expect(feed(g, 18.5, 30_000)).toEqual([]);
  });

  test("a step up that makes frames slow again doubles the wait before the next try (no pumping)", () => {
    const g = at60();
    expect(feedUntilChange(g, 33)).toBe("1.75");
    expect(feedUntilChange(g, 16.7)).toBe("2");
    expect(feedUntilChange(g, 33)).toBe("1.75");
    // the next try now needs 6 s of good frames: 5 s isn't enough
    expect(feed(g, 16.7, 5000)).toEqual([]);
    expect(feed(g, 16.7, 2000)).toEqual(["2"]);
  });

  test("the backoff applies to the bokeh step too", () => {
    const g = at60(1.5);
    expect(feedUntilChange(g, 33)).toBe("1.5+half");
    expect(feedUntilChange(g, 16.7)).toBe("1.5");
    expect(feedUntilChange(g, 33)).toBe("1.5+half");
    expect(feed(g, 16.7, 5000)).toEqual([]);
    expect(feed(g, 16.7, 2000)).toEqual(["1.5"]);
  });

  test("a steady 30 fps cap (or a 50 Hz screen) isn't load: it never steps down", () => {
    const g = new PendantGovernor(2);
    expect(feed(g, 33.3, 120_000)).toEqual([]);
    expect(g.base).toBeCloseTo(33.3, 5);
    const h = new PendantGovernor(2);
    expect(feed(h, 20, 120_000)).toEqual([]);
  });

  test("load is read against that pace: on a 30 fps cap, 45 ms frames step down", () => {
    const g = new PendantGovernor(2);
    feed(g, 33.3, 3000);
    expect(feedUntilChange(g, 45)).toBe("1.75");
  });

  test("a slowdown that stepping down doesn't help (a 30 fps cap switched on mid-session) becomes the base: it climbs back", () => {
    const g = at60();
    const changes = feed(g, 33.3, 120_000);
    expect(changes.slice(0, 3)).toEqual(["1.75", "1.5", "1.5+half"]);
    expect(L(g.level)).toBe("2"); // (back at the top, and staying there)
    expect(g.base).toBeCloseTo(33.3, 5);
    expect(feed(g, 33.3, 60_000)).toEqual([]);
    // and the cap switched off again: the base comes back down, so load is read against 60 Hz once more
    feed(g, 16.7, 3000);
    expect(g.base).toBeCloseTo(16.7, 5);
    expect(feedUntilChange(g, 33.3)).toBe("1.75");
  });

  test("load the pendant does cause (frames speed up as it steps down) is shed, never re-based away", () => {
    // a device whose frame time follows the level: 2x 30 ms, 1.75x 24 ms, 1.5x 17 ms, 1.5x + half 16.7 ms
    const cost: Record<string, number> = { "2": 30, "1.75": 24, "1.5": 17, "1.5+half": 16.7 };
    const g = at60();
    for (let t = 0; t < 120_000;) {
      const ms = cost[L(g.level)!];
      g.sample(ms);
      t += ms;
    }
    expect(g.base).toBeCloseTo(16.7, 5);
    expect(["1.5", "1.5+half"]).toContain(L(g.level));
  });

  test("a base measured before the pendant drew wins over the warm-up's (a device slow from the first frame)", () => {
    const g = new PendantGovernor(2);
    g.setBase(16.7);
    expect(feedUntilChange(g, 33.3)).toBe("1.75"); // (the warm-up alone would have taken 33 ms as the screen's pace)
    const h = new PendantGovernor(2);
    h.setBase(Number.NaN);
    h.setBase(1000);
    feed(h, 33.3, 3000);
    expect(h.base).toBeCloseTo(33.3, 5);
  });

  test("the base is the warm-up's median: a few compile hitches don't move it", () => {
    const g = new PendantGovernor(2);
    for (let i = 0; i < 140; i++) g.sample(i % 10 === 0 ? 120 : 16.7);
    feed(g, 16.7, 1000);
    expect(g.base).toBeCloseTo(16.7, 5);
  });

  test("the warm-up and stalls never count", () => {
    const g = new PendantGovernor(2);
    expect(feed(g, 40, 2400)).toEqual([]); // (still warming up)
    const h = at60();
    expect(feed(h, 400, 20_000)).toEqual([]); // (a hidden tab's gaps)
    expect(h.sample(Number.NaN)).toBeNull();
  });

  test("a new screen ratio starts over from its own ladder", () => {
    const g = at60();
    feedLoad(g, HEAVY, 60_000);
    g.setMax(1.75);
    expect(L(g.level)).toBe("1.75");
    expect(g.floor).toBe(1.5);
  });
});

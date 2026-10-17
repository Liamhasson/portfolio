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

/** A seeded random (Park-Miller), as the review's simulation used. */
function seeded(seed: number): () => number {
  let x = seed;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
}

/** Frames costing `costAt(level)` for `forMs`: the number of level changes and the share of time at each level. */
function run(g: PendantGovernor, costAt: (level: string) => number, forMs: number): { changes: number; share: Record<string, number> } {
  let changes = 0;
  const time: Record<string, number> = {};
  for (let t = 0; t < forMs;) {
    const lv = L(g.level)!;
    const ms = costAt(lv);
    if (g.sample(ms) !== null) changes++;
    time[lv] = (time[lv] ?? 0) + ms;
    t += ms;
  }
  return { changes, share: Object.fromEntries(Object.entries(time).map(([k, v]) => [k, v / forMs])) };
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
    // (the window that saw the load start was part good frames, so the first step can look like no gain and be undone
    // once; the next reading sees the whole load and it steps on down)
    expect(feedLoad(g, HEAVY, 60_000).slice(-3)).toEqual(["1.75", "1.5", "1.5+half"]);
    expect(feedLoad(g, HEAVY, 60_000)).toEqual([]);
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

  test("load is read against that pace: on a 30 fps cap, 45 ms frames step down", () => {
    const g = new PendantGovernor(2);
    feed(g, 33.3, 3000);
    expect(feedUntilChange(g, 45)).toBe("1.75");
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

  test("a steady 30 fps cap isn't load: at most a rare probe, never stuck low", () => {
    // the display probed at 60 Hz while loading, then capped at 30 fps (Low Power Mode, a throttled tab): every step down,
    // and the try at the bottom after it, is undone (neither helped), and the waits between tries double to a minute
    const g = new PendantGovernor(2);
    g.setBase(16.7);
    const r = run(g, () => 33.3, 600_000);
    expect(r.changes).toBeLessThanOrEqual(45);
    expect(r.share["2"]).toBeGreaterThan(0.9);
    expect(L(g.level)).toBe("2");
    expect(g.base).toBeCloseTo(16.7, 5);
    // a screen at 30 fps (or 50 Hz) from the start: nothing at all
    for (const ms of [33.3, 20]) {
      const h = new PendantGovernor(2);
      expect(run(h, () => ms, 600_000).changes).toBe(0);
    }
  });

  test("load one step can't pull under a vsync boundary is still shed: it tries the bottom, then climbs to what holds", () => {
    // a 60 Hz laptop whose GPU makes 2x and 1.75x miss every other vsync (30 fps) and 1.5x make every one
    const cost: Record<string, number> = { "2": 33.3, "1.75": 33.3, "1.5": 16.7, "1.5+half": 16.7 };
    const g = at60();
    const r = run(g, (l) => cost[l], 1_800_000);
    expect(r.share["1.5"]).toBeGreaterThan(0.9); // (the highest level at 60 fps; the rest is step-up tries at 1.75x)
    expect(r.share["2"] ?? 0).toBeLessThan(0.01);
    // (the run may end in a step-up try: within a few seconds of the same load it is back where it holds)
    feedLoad(g, cost, 5000);
    expect(L(g.level)).toBe("1.5");
  });

  test("HEAVY load sheds to the right level and stays there, the base unchanged", () => {
    const g = at60();
    feedLoad(g, HEAVY, 60_000);
    expect(L(g.level)).toBe("1.5+half");
    expect(feedLoad(g, HEAVY, 540_000)).toEqual([]);
    expect(g.base).toBeCloseTo(16.7, 5);
  });

  test("one 25 ms spike doesn't change the long-run level", () => {
    const cost: Record<string, number> = { "2": 30, "1.75": 24, "1.5": 19.5, "1.5+half": 17 };
    const g = at60();
    feedLoad(g, cost, 60_000);
    feed(g, 25, 1000);
    const r = run(g, (l) => cost[l], 300_000);
    expect(r.share["1.5+half"]).toBeGreaterThan(0.9);
    feedLoad(g, cost, 5000); // (as above: past any step-up try still under way)
    expect(L(g.level)).toBe("1.5+half");
  });

  test("120 Hz: the base is never under 60 fps, so 2x at 9 to 10 ms frames stays 2x", () => {
    const g = new PendantGovernor(2);
    g.setBase(8.3);
    const rnd = seeded(3);
    const r = run(g, () => 9 + rnd(), 600_000);
    expect(g.base).toBeCloseTo(1000 / 60, 5);
    expect(r.changes).toBe(0);
    expect(L(g.level)).toBe("2");
  });

  test("noisy vsync-quantised load (frames miss vsync at a rate the level sets): few changes in 30 minutes", () => {
    // the review's simulation: each frame is 16.7 or 33.3 ms, missing with these odds per level
    const miss: Record<string, number> = { "2": 0.6, "1.75": 0.4, "1.5": 0.2, "1.5+half": 0.17 };
    for (const seed of [1, 2, 3, 4]) {
      const rnd = seeded(seed);
      const g = at60();
      expect(run(g, (l) => (rnd() < miss[l] ? 33.3 : 16.7), 1_800_000).changes).toBeLessThanOrEqual(15);
    }
  });

  test("resume() drops the partial window, the good run and the step being judged", () => {
    // a partial slow window before a pause doesn't count after it
    const g = at60();
    g.resume();
    feed(g, 16.7, 750); // (past the cooldown: a fresh window has begun)
    expect(feed(g, 40, 600)).toEqual([]); // (600 ms of slow frames: not a full window yet)
    g.resume();
    expect(feed(g, 16.7, 20_000)).toEqual([]);
    // a pause during a step still being judged returns it, untested, to the level it left (resume says so, for the mount)
    const h = at60();
    expect(feedUntilChange(h, 33)).toBe("1.75");
    expect(L(h.resume())).toBe("2");
    expect(L(h.level)).toBe("2");
    expect(h.resume()).toBeNull(); // (nothing pending now: no change)
    expect(feedUntilChange(h, 33)).toBe("1.75"); // (a fresh reading, the step-down wait back at its start)
    // and a good run doesn't carry over a pause
    const k = at60();
    feedLoad(k, HEAVY, 60_000);
    feed(k, 16.7, 2500);
    k.resume();
    expect(feed(k, 16.7, 2000)).toEqual([]);
  });

  test("failed climbs space out, doubling, to at most a minute apart", () => {
    // 2x misses every other vsync, 1.75x doesn't: each climb back to 2x fails at once
    const cost: Record<string, number> = { "2": 33.3, "1.75": 16.7, "1.5": 16.7, "1.5+half": 16.7 };
    const g = at60();
    const ups: number[] = [];
    let t = 0;
    for (; t < 1_200_000;) {
      const ms = cost[L(g.level)!];
      const c = g.sample(ms);
      t += ms;
      if (c !== null && L(c) === "2") ups.push(t);
    }
    const gaps = ups.slice(1).map((x, i) => x - ups[i]);
    expect(gaps.length).toBeGreaterThan(5);
    expect(Math.max(...gaps)).toBeGreaterThan(55_000); // (it reached the cap...)
    expect(Math.max(...gaps)).toBeLessThan(66_000); // (...a minute, plus the window and cooldown round each try)
    expect(gaps.at(-1)!).toBeGreaterThan(55_000); // (and stays there)
  });

  test("a short pause keeps the step-down wait; one over pauseResetMs starts it over", () => {
    /** ms of slow frames until the next change. */
    const until = (g: PendantGovernor) => { let t = 0; for (; t < 120_000; t += 33) if (g.sample(33) !== null) return t; return Infinity; };
    // slow at every level alike (not the pendant's load): each step down is tried, then the bottom, then undone, and the
    // wait before the next try doubles (5 s, then 10 s)
    const make = () => {
      const g = at60();
      const changes: string[] = [];
      while (changes.filter((c) => c === "2").length < 2) { const c = feedUntilChange(g, 33, 120_000); if (c === null) break; changes.push(c); }
      return g; // (two undone tries: the next waits 10 s)
    };
    const short = make();
    short.resume(5_000);
    const long = make();
    long.resume(45_000);
    const tShort = until(short), tLong = until(long);
    expect(tShort).toBeGreaterThan(tLong + 3000); // (the short pause kept the longer wait)
    expect(tLong).toBeLessThan(7000); // (the long one started over at 5 s)
  });

  test("a new screen ratio starts over from its own ladder", () => {
    const g = at60();
    feedLoad(g, HEAVY, 60_000);
    g.setMax(1.75);
    expect(L(g.level)).toBe("1.75");
    expect(g.floor).toBe(1.5);
  });
});

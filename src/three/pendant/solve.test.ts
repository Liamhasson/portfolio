// src/three/pendant/solve.test.ts
import { describe, expect, it } from "vitest";
import type { Box } from "./camera";
import { SAME, type TextRect } from "./layout";
import { SHOTS, shotAt, type Shot } from "./shots";
import { applySpot, FORCED_DIM, MIN_SHOWN, outlineOf, PAD, solve, type SolveInput } from "./solve";

// A stand-in pendant: a cylinder of radius 0.2 and height 1 about its own axis (the wire copy's vertices in the real scene).
const cylinder = (() => {
  const p: number[] = [];
  for (let j = 0; j <= 10; j++) for (let a = 0; a < 16; a++) {
    const t = (a / 16) * 2 * Math.PI;
    p.push(0.2 * Math.cos(t), -0.5 + j / 10, 0.2 * Math.sin(t));
  }
  return new Float32Array(p);
})();
const outline = outlineOf(cylinder);

// Two plain shots, both in front: "a" rests at the top of a 1000 px track, centred; "b" at its end, centred too.
const base: Shot = { ...SHOTS[0], ax: 0.5, ay: 0.5, h: 0.4, layer: "front", dim: 1, lock: null, tumble: 0, alt: undefined };
const shots: Shot[] = [{ ...base, id: "a", anchor: "start" }, { ...base, id: "b", anchor: "end" }];
const input = (texts: TextRect[], fixed: Box[] = [], over: Partial<SolveInput> = {}): SolveInput => ({
  shots, keys: [0, 1000], travel: 1000, vw: 1440, vh: 900,
  at: () => ({ line1: 0.5, glass: { x: 0.5, y: 0.5 } }),
  texts, fixed, outline, lookMax: 0.035, ...over,
});

describe("solve", () => {
  it("leaves a screen with nothing to cover alone", () => {
    const r = solve(input([]));
    expect(r.spots).toEqual([SAME, SAME]);
    expect(r.shots).toEqual(shots);
    expect(r.moved).toEqual([]);
    expect(r.behind).toEqual([]);
    for (const s of [0, 300, 700, 1000]) expect(r.layer(s)).toBe("front");
  });

  it("moves a shot whose rest covers a line to the nearest spot clear by the motion's reach, and keeps it in front", () => {
    const line: TextRect = { l: 700, t: 440, w: 40, h: 20 }; // right under the middle of the screen at the top of the track
    const r = solve(input([line]));
    expect(r.moved.map((m) => m.id)).toEqual(["a"]);
    expect(r.spots[0]).not.toEqual(SAME);
    expect(r.spots[1]).toEqual(SAME);
    expect(r.layer(0)).toBe("front");
    expect(r.behind).toEqual([]);
  });

  it("tells where the pendant at rest is over a line (by the guard's PAD / 2, not the motion's reach): what the dim looks ahead to", () => {
    expect([0, 500, 1000].map(solve(input([])).over)).toEqual([false, false, false]);
    // a bar that holds still across the middle: over it all along the track
    const bar = solve(input([], [{ l: 0, t: 400, r: 1440, b: 500 }]));
    expect([0, 500, 1000].map(bar.over)).toEqual([true, true, true]);
    // shots that rest behind the words (the tumble's way): a line just clear of the rest outline is behind but not over it;
    // one into it is over it
    const back = shots.map((x) => ({ ...x, layer: "back" as const }));
    const top = 0.5 * 900 - 0.2 * 900; // (the outline's top: h 0.4 about the middle)
    const clear = solve(input([], [{ l: 0, t: 0, r: 1440, b: top - PAD }], { shots: back }));
    expect(clear.layer(500)).toBe("back");
    expect(clear.over(500)).toBe(false);
    const into = solve(input([], [{ l: 0, t: 0, r: 1440, b: top + 20 }], { shots: back }));
    expect(into.over(500)).toBe(true);
  });

  it("puts a shot behind the words when nothing within the limits clears it", () => {
    // a bar across the whole middle of the screen that holds still (chrome): no move or shrink gets clear of it
    const r = solve(input([], [{ l: 0, t: 400, r: 1440, b: 500 }]));
    expect(r.spots).toEqual([SAME, SAME]);
    expect(r.behind).toEqual(["a", "b"]);
    expect(r.layer(0)).toBe("back");
    expect(r.layer(1000)).toBe("back");
  });

  it("tries the shot's alternates in order when the shot as written can't be cleared", () => {
    // a wall over the left two thirds; the shot rests at 0.3 (no move within a quarter of the width clears it), its
    // alternate at 0.88 is clear
    const wall: TextRect = { l: 0, t: 0, w: 1000, h: 900 };
    const alt: Shot[] = [{ ...shots[0], ax: 0.3, alt: [{ ax: 0.88 }] }, { ...shots[1], ax: 0.88 }];
    const r = solve(input([wall], [], { shots: alt }));
    expect(r.moved).toEqual([expect.objectContaining({ id: "a", alt: 1 })]);
    expect(r.shots[0].ax).toBe(0.88);
    expect(r.layer(0)).toBe("front");
    expect(r.behind).toEqual([]);
  });

  it("never pushes the pendant off the screen to dodge a line: it goes behind instead", () => {
    // the shot rests at the left edge; a line covers the screen right of x 40 at every height
    const edge = shots.map((sh) => ({ ...sh, ax: 0.01 }));
    const r = solve(input([{ l: 40, t: 0, w: 3000, h: 900 }], [], { shots: edge }));
    expect(r.spots[0]).toEqual(SAME);
    expect(r.behind).toContain("a");
    expect(MIN_SHOWN).toBe(0.35);
  });

  it("counts only what is on screen: a line past the screen's edge is not covered", () => {
    const r = solve(input([{ l: 2000, t: 0, w: 400, h: 900 }])); // (on screen only past s 560, between the shots)
    expect(r.layer(0)).toBe("front");
  });

  it("keeps the motion's reach plus PAD clear round a front frame at rest", () => {
    // a line just outside the pendant's own outline (about 76 x 360 px at the middle): too close for the motion's reach
    const near: TextRect = { l: 720 + 38 + 10, t: 300, w: 200, h: 300 };
    const r = solve(input([near]));
    expect(r.spots[0]).not.toEqual(SAME);
    expect(PAD).toBe(8);
  });

  it("dims a shot resting behind the words to the tumble's value", () => {
    expect(FORCED_DIM).toBe(0.4);
  });
});

describe("applySpot", () => {
  it("adds the spots blended as shotAt blends ax, ay and h: exact at both keys", () => {
    const at = { line1: 0.5, glass: { x: 0.5, y: 0.5 } };
    const spots = [{ dx: 0.1, dy: 0.05, k: 0.8 }, { dx: -0.2, dy: 0, k: 1 }];
    const f0 = shotAt(0, [0, 1000], shots, at), f1 = shotAt(1000, [0, 1000], shots, at), fm = shotAt(500, [0, 1000], shots, at);
    for (const f of [f0, f1, fm]) applySpot(f, spots);
    expect(f0.ax).toBeCloseTo(0.6, 9);
    expect(f0.ay).toBeCloseTo(0.55, 9);
    expect(f0.h).toBeCloseTo(0.32, 9);
    expect(f1.ax).toBeCloseTo(0.3, 9);
    expect(f1.h).toBeCloseTo(0.4, 9);
    expect(fm.ax).toBeCloseTo(0.45, 9); // (t 0.5: +0.1 and -0.2 average to -0.05)
    expect(fm.h).toBeCloseTo(0.4 * 0.9, 9);
  });
});

describe("outlineOf", () => {
  it("the ring holds the pendant at any spin: wide enough at every height", () => {
    const { ring, hull, all } = outlineOf(cylinder);
    expect(all).toBe(cylinder);
    let rMin = Infinity;
    for (let i = 0; i < ring.length; i += 3) rMin = Math.min(rMin, Math.hypot(ring[i], ring[i + 2]));
    expect(rMin).toBeGreaterThanOrEqual(0.2); // (the polygon is drawn round the circle, never inside it)
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 1; i < ring.length; i += 3) { y0 = Math.min(y0, ring[i]); y1 = Math.max(y1, ring[i]); }
    expect(y0).toBeCloseTo(-0.5, 5);
    expect(y1).toBeCloseTo(0.5, 5);
    expect(hull.length / 3).toBeLessThanOrEqual(24 * 24 + 2);
    expect(hull.length / 3).toBeGreaterThan(50);
  });
  it("is empty for no points", () => {
    expect(outlineOf(new Float32Array(0)).ring.length).toBe(0);
  });
});

describe("a shot pinned to the glass ball", () => {
  it("is only ever made smaller, never moved off the ball", () => {
    const line: TextRect = { l: 700, t: 440, w: 40, h: 20 };
    const glass: Shot[] = [{ ...shots[0], ax: "glass", ay: "glass" }, shots[1]];
    const r = solve(input([line], [], { shots: glass }));
    expect(r.spots[0].dx).toBe(0);
    expect(r.spots[0].dy).toBe(0);
  });
});

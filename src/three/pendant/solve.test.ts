// src/three/pendant/solve.test.ts
import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import type { Box } from "./camera";
import type { TextRect } from "./layout";
import { SHOTS, shotAt, type Shot } from "./shots";
import { FORCED_DIM, onScreen, shiftAx, solve, type SolveInput } from "./solve";

// Two plain shots, both in front: "a" rests at the top of a 1000 px track, centred; "b" at its end, centred too.
const base: Shot = { ...SHOTS[0], ax: 0.5, ay: 0.5, h: 0.4, layer: "front", dim: 1, lock: null, tumble: 0 };
const shots: Shot[] = [{ ...base, id: "a", anchor: "start" }, { ...base, id: "b", anchor: "end" }];
const input = (texts: TextRect[], fixed: Box[] = []): SolveInput => ({
  shots, keys: [0, 1000], travel: 1000, vw: 1440, vh: 900,
  at: () => ({ line1: 0.5, glass: { x: 0.5, y: 0.5 } }),
  texts, fixed, bounds: new Box3(new Vector3(-0.2, -0.5, -0.2), new Vector3(0.2, 0.5, 0.2)),
});

describe("solve", () => {
  it("leaves a screen with nothing to cover alone", () => {
    const r = solve(input([]));
    expect(r.shift).toEqual([0, 0]);
    expect(r.moved).toEqual([]);
    expect(r.behind).toEqual([]);
    for (const s of [0, 300, 700, 1000]) expect(r.layer(s)).toBe("front");
  });

  it("nudges a shot whose resting spot covers a line to the nearest clear spot, and keeps it in front", () => {
    // a short line right under the middle of the screen at the top of the track (the pendant stands about 144 x 360 px there)
    const r = solve(input([{ l: 700, t: 440, w: 40, h: 20 }]));
    expect(r.moved.map((m) => m.id)).toEqual(["a"]);
    expect(r.shift[0]).toBeGreaterThan(0.05); // (right first at equal distance, as freeSpot)
    expect(r.shift[0]).toBeLessThan(0.15);
    expect(r.shift[1]).toBe(0);
    expect(r.layer(0)).toBe("front");
    expect(r.behind).toEqual([]);
  });

  it("puts a shot behind the words when no nudge within a quarter of the screen clears it", () => {
    // a bar across the whole middle of the screen that holds still (chrome): nowhere to go
    const r = solve(input([], [{ l: 0, t: 440, r: 1440, b: 460 }]));
    expect(r.shift).toEqual([0, 0]);
    expect(r.behind).toEqual(["a", "b"]);
    expect(r.layer(0)).toBe("back");
    expect(r.layer(1000)).toBe("back");
  });

  it("never pushes the pendant off the screen to dodge a line: it goes behind instead", () => {
    // the shot rests at the left edge, 30% of the way in; a line covers the screen right of x 120 at its height
    const edge = shots.map((sh) => ({ ...sh, ax: 0.03 }));
    const r = solve({ ...input([{ l: 120, t: 300, w: 2000, h: 300 }]), shots: edge });
    expect(r.shift[0]).toBe(0); // (only a nudge to the left clears it, and that would hide the pendant past the edge)
    expect(r.behind).toContain("a");
  });

  it("counts only what is on screen: a line past the screen's edge is not covered", () => {
    const r = solve(input([{ l: 2000, t: 0, w: 400, h: 900 }])); // (on screen only past s 560, where the pendant is between shots)
    expect(r.layer(0)).toBe("front");
  });

  it("dims a forced-behind shot to the tumble's value", () => {
    expect(FORCED_DIM).toBe(0.4);
  });
});

describe("shiftAx", () => {
  it("adds the nudges blended as shotAt blends ax: exact at both keys", () => {
    const at = { line1: 0.5, glass: { x: 0.5, y: 0.5 } };
    const f0 = shotAt(0, [0, 1000], shots, at), f1 = shotAt(1000, [0, 1000], shots, at), fm = shotAt(500, [0, 1000], shots, at);
    shiftAx(f0, [0.1, -0.2]);
    shiftAx(f1, [0.1, -0.2]);
    shiftAx(fm, [0.1, -0.2]);
    expect(f0.ax).toBeCloseTo(0.6, 9);
    expect(f1.ax).toBeCloseTo(0.3, 9);
    expect(fm.ax).toBeCloseTo(0.5 - 0.05, 9); // (t 0.5 halfway: +0.1 and -0.2 average to -0.05)
  });
});

describe("onScreen", () => {
  it("grows, moves and clips; a box wholly off screen overlaps nothing", () => {
    expect(onScreen({ l: 100, t: 100, r: 200, b: 300 }, 1000, 800, 0.1, 50)).toEqual({ l: 145, t: 90, r: 255, b: 310 });
    expect(onScreen({ l: -100, t: -50, r: 100, b: 900 }, 1000, 800)).toEqual({ l: 0, t: 0, r: 100, b: 800 });
    const gone = onScreen({ l: 1100, t: 0, r: 1300, b: 100 }, 1000, 800);
    expect(gone.r > 0).toBe(false);
  });
});

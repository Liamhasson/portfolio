// src/three/sand/cascade.test.ts
import { describe, expect, test } from "vitest";
import { CASCADE, anchorsWorld, cascadeAt, cascadeEnd, type V3, ballRestOf } from "./cascade";

const N = 9 * 1024;
const anchors = anchorsWorld([0, 0.1, 0], 1.1, [1, 0, 0], [0, 1, 0]);
// each grain's own place in the cloud: spread about the vortex
const rest = (i: number): V3 => { const a = i * 2.399963, r = 2.2 * Math.sqrt(((i * 0.6180339) % 1)); return [1.2 + Math.cos(a) * r, 0.2 + Math.sin(a) * r * 0.7, Math.sin(i * 1.7) * 0.8]; };
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const parentOf = (i: number) => { const a = i % 9, j = Math.floor(i / 9); return Math.floor((j - 1) / 2) * 9 + a; };

describe("the cascade (spec §5.2): the anchors' grains split into the cloud", () => {
  test("the anchors in the brief's order, on the plane through the ball", () => {
    expect(anchors[0]).toEqual([0, 0.1, 0]);
    expect(anchors[1]).toEqual([0, 1.2000000000000002, 0]);
    expect(anchors[5]).toEqual([-1.1, 1.2000000000000002, 0]);
  });
  test("never a pop: a grain is born exactly where its parent is at that moment", () => {
    for (const i of [9, 10, 26, 100, 513, 4000, 9000]) {
      let t = 0; while (!cascadeAt(i, t, anchors, rest).born) t += 0.001;
      expect(dist(cascadeAt(i, t, anchors, rest).pos, cascadeAt(parentOf(i), t, anchors, rest).pos)).toBeLessThan(0.02);
    }
  });
  test("smooth: once born it never jumps", () => {
    for (const i of [0, 9, 77, 1234, 9000]) for (let t = 0; t < cascadeEnd(N); t += 1 / 60) {
      const a = cascadeAt(i, t, anchors, rest), b = cascadeAt(i, t + 1 / 60, anchors, rest);
      if (a.born) expect(dist(a.pos, b.pos)).toBeLessThan(0.4);   // (a burst: fast, never a jump)
    }
  });
  test("the count doubles each generation (the centre's tree: 2^(k+1) - 1 born by generation k)", () => {
    const bornAt = (t: number) => { let c = 0; for (let i = 0; i < N; i += 9) if (cascadeAt(i, t, anchors, rest).born) c++; return c; };
    expect(bornAt(3 * CASCADE.gen + CASCADE.jitter + 1e-6)).toBe(15);
    expect(bornAt(4 * CASCADE.gen + CASCADE.jitter + 1e-6)).toBe(31);
  });
  test("every grain is home by the end", () => {
    const end = cascadeEnd(N);
    expect(end).toBeLessThan(3.3);
    for (let i = 0; i < N; i += 97) expect(dist(cascadeAt(i, end, anchors, rest).pos, rest(i))).toBeLessThan(1e-6);
  });
  test("siblings part: in flight, the two halves of a split are apart", () => {
    const a = 9 * 5 + 2, b = 9 * 6 + 2;   // nodes 5 and 6 of anchor 2: siblings
    let t = 0; while (!cascadeAt(b, t, anchors, rest).born || !cascadeAt(a, t, anchors, rest).born) t += 0.001;
    expect(dist(cascadeAt(a, t + 0.2, anchors, rest).pos, cascadeAt(b, t + 0.2, anchors, rest).pos)).toBeGreaterThan(0.1);
  });
});


describe("the cascade can end on the ball (Contact, spec 2026-10-12 §4)", () => {
  const pack = (ox: number, oy: number, dist: number) => ((Math.round(((ox + 1) / 2) * 4095)) | (Math.round(((oy + 1) / 2) * 4095) << 12) | (dist << 24)) >>> 0;
  test("a grain's ball spot: its octahedral direction from the centre, at its distance (the shader's own decoding)", () => {
    const c: [number, number, number] = [1, 2, 3];
    const front = ballRestOf(pack(0, 0, 255), c, 0.5);
    expect(front[0]).toBeCloseTo(1, 2); expect(front[1]).toBeCloseTo(2, 2); expect(front[2]).toBeCloseTo(3.5, 2);
    const side = ballRestOf(pack(1, 0, 128), c, 0.5);
    expect(side[0] - 1).toBeCloseTo((128 / 255) * 0.5, 2);
    // the back half folds: a direction with z < 0
    const back = ballRestOf(pack(0.5, 0.6, 255), c, 0.5);
    expect(back[2]).toBeLessThan(3);
    expect(Math.hypot(back[0] - 1, back[1] - 2, back[2] - 3)).toBeCloseTo(0.5, 2);
  });
});

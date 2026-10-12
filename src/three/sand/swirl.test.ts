import { describe, expect, test } from "vitest";
import { SWIRL, swirlAt } from "./swirl";

const R = 2.5;
const C: [number, number, number] = [0, 0, 0];
// a cloud of rest spots: a lumpy ball of radius R
const rests = Array.from({ length: 1500 }, (_, i) => {
  const u = ((i * 0.618034) % 1) * 2 - 1, th = i * 2.399963, rr = R * Math.cbrt(((i * 0.414214) % 1));
  const s = Math.sqrt(1 - u * u);
  return { p: [rr * s * Math.cos(th), rr * u, rr * s * Math.sin(th)] as [number, number, number], seed: [(i * 0.7548) % 1, (i * 0.5698) % 1, (i * 0.3247) % 1] as [number, number, number] };
});
const len = (v: number[]) => Math.hypot(v[0], v[1], v[2]);

describe("the chaos at rest: Lusion's flow and a strong inward vortex (Liam, 2026-10-11)", () => {
  test("never a pop: a grain shrinks away at the core and grows back in at its spot", () => {
    for (const { p, seed } of rests.slice(0, 60)) {
      for (let t = 0; t < 240; t += 1 / 30) {
        const a = swirlAt(p, seed, C, R, t), b = swirlAt(p, seed, C, R, t + 1 / 30);
        if (a.life !== b.life) {
          expect(a.size).toBeLessThan(0.05);
          expect(b.size).toBeLessThan(0.05);
        }
      }
    }
  }, 30000);   // (heavy: ~430k samples; ~1 s alone, past the 5 s default when the whole suite runs at once)

  test("it travels inward over its life (the vortex draws it in) and turns around the axis", () => {
    const { p, seed } = rests[700];
    const r0 = len(swirlAt(p, seed, C, R, 0).pos);
    let inward = 0, samples = 0;
    for (let t = 0.5; t < 120; t += 0.5) {
      const a = swirlAt(p, seed, C, R, t - 0.5), b = swirlAt(p, seed, C, R, t);
      if (a.life === b.life) { samples++; if (len(b.pos) <= len(a.pos) + 0.02 * R) inward++; }
    }
    expect(inward / samples).toBeGreaterThan(0.85);
    expect(r0).toBeGreaterThan(0);
  });

  test("the cloud keeps its size: the grains' mean distance from the centre stays within 12% of the rest cloud's", () => {
    const restMean = rests.reduce((s, { p }) => s + len(p), 0) / rests.length;
    for (const t of [0, 13, 47, 120, 600]) {
      const mean = rests.reduce((s, { p, seed }) => s + len(swirlAt(p, seed, C, R, t).pos), 0) / rests.length;
      expect(Math.abs(mean / restMean - 1)).toBeLessThan(0.12);
    }
  });

  test("in sheets, as Lusion's: neighbours move together (the cloud keeps its filaments); far grains differently", () => {
    const off = (p: [number, number, number], seed: [number, number, number], t: number) => { const q = swirlAt(p, seed, C, R, t).pos; return [q[0] - p[0], q[1] - p[1], q[2] - p[2]]; };
    // (medians, rebirths left out: a pair straddling a region's rebirth, or the core where the turn is steepest, is
    // rightly apart; the typical pair is what makes the sheets)
    const near: number[] = [], far: number[] = [];
    for (let i = 0; i < 40; i++) {
      const p: [number, number, number] = [((i * 0.37) % 2 - 1) * R * 0.8, ((i * 0.61) % 2 - 1) * R * 0.6, ((i * 0.23) % 2 - 1) * R * 0.7];
      const q: [number, number, number] = [p[0] + 0.03 * R, p[1], p[2]];
      const w: [number, number, number] = [-p[0], -p[1] + 0.4 * R, p[2] * 0.3];
      const t = 7 + i * 3.1;
      if (swirlAt(p, [0.2, 0.4, 0.6], C, R, t).life !== swirlAt(q, [0.7, 0.1, 0.9], C, R, t).life) continue;
      const a = off(p, [0.2, 0.4, 0.6], t), b = off(q, [0.7, 0.1, 0.9], t), c = off(w, [0.2, 0.4, 0.6], t);
      near.push(len([a[0] - b[0], a[1] - b[1], a[2] - b[2]]));
      far.push(len([a[0] - c[0], a[1] - c[1], a[2] - c[2]]));
    }
    const median = (v: number[]) => [...v].sort((x, y) => x - y)[v.length >> 1];
    expect(near.length).toBeGreaterThan(30);
    expect(median(near)).toBeLessThan(0.1 * R);
    expect(median(far) / median(near)).toBeGreaterThan(4);
  });

  test("smooth: within a life a grain moves a little each frame (its streak), never jumps", () => {
    const { p, seed } = rests[300];
    for (let t = 0; t < 200; t += 1 / 60) {
      const a = swirlAt(p, seed, C, R, t), b = swirlAt(p, seed, C, R, t + 1 / 60);
      if (a.life === b.life) expect(len([b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2]])).toBeLessThan(0.05 * R);
    }
    expect(SWIRL.lifeMin).toBeGreaterThanOrEqual(20);
  });
});

test("never toward the lens: the spiral draws grains in around the axis, never out along it (Liam: no big grains)", () => {
  const ax = SWIRL.axis, al = Math.hypot(ax[0], ax[1], ax[2]);
  for (const { p, seed } of rests.slice(0, 400)) {
    const along0 = (p[0] * ax[0] + p[1] * ax[1] + p[2] * ax[2]) / al;
    for (const t of [3, 17, 41]) {
      const q = swirlAt(p, seed, C, R, t).pos;
      const along = (q[0] * ax[0] + q[1] * ax[1] + q[2] * ax[2]) / al;
      expect(Math.abs(along)).toBeLessThanOrEqual(Math.abs(along0) + SWIRL.turb * R * 1.8);
    }
  }
});

test("it never ages (Liam, 2026-10-12: a tab open for hours had lost every stream): hours in, neighbours still move together", () => {
  // each region kept its own life, so its phase (time / life) drifted from its neighbours' a little more every second;
  // after minutes the sheets were noise. A shared pace with each region's own bounded wobble keeps them together forever.
  const R2 = 2.5, C2: [number, number, number] = [0, 0, 0];
  const spread = (t0: number) => {
    const d: number[] = [];
    for (let i = 0; i < 60; i++) {
      const p: [number, number, number] = [((i * 0.37) % 2 - 1) * R2 * 0.8, ((i * 0.61) % 2 - 1) * R2 * 0.6, ((i * 0.23) % 2 - 1) * R2 * 0.7];
      const q: [number, number, number] = [p[0] + 0.03 * R2, p[1], p[2]];
      const t = t0 + i * 3.1;
      const a = swirlAt(p, [0.2, 0.4, 0.6], C2, R2, t), b = swirlAt(q, [0.7, 0.1, 0.9], C2, R2, t);
      if (a.life !== b.life) continue;
      d.push(Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]));
    }
    return [...d].sort((x, y) => x - y)[d.length >> 1];
  };
  for (const hours of [1, 8, 30]) expect(spread(hours * 3600)).toBeLessThan(0.12 * R2);
});

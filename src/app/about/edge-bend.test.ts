// src/app/about/edge-bend.test.ts
import { describe, expect, test } from "vitest";
import { bendBox, bendField, bendOffset, bendPoint, bendPull, bendShown, type BendScreen, type Pt } from "./edge-bend";
import { LENS_MAX, lensAmp, lensBand, lensDepth, lensMap, lensScale } from "./edge-lens";

const pt = (): Pt => ({ x: 0, y: 0 });

describe("bendPull", () => {
  test("the rim's pull as the filter applies the map: the full scale pulls LENS_MAX on a deep band, less on a narrow one", () => {
    expect(bendPull(2 * LENS_MAX, 56)).toBeCloseTo(2 * LENS_MAX * (127 / 255), 9); // (≈ 25.9 px)
    const phone = lensBand(428, 926); // (27.8 px: the map scaled down to keep its slope)
    expect(bendPull(2 * LENS_MAX, phone)).toBeCloseTo(2 * LENS_MAX * lensAmp(phone) * (127 / 255), 9);
    expect(lensAmp(phone)).toBeLessThan(0.55);
    expect(bendPull(0, 56)).toBe(0);
    expect(bendPull(-3, 56)).toBe(0);
  });

  test("the pull matches the map lensMap builds (its rim channel, 128 + 127 × amp), within the 8-bit step", () => {
    const W = 428, H = 926, band = lensBand(W, H), w = Math.ceil(W / 2), h = Math.ceil(H / 2);
    const d = lensMap(w, h, band * 0.5);
    const rim = (d[(Math.round(h / 2) * w + 0) * 4] - 128) / 255; // (the left rim, mid-height: channel / 255 − 0.5)
    const scale = 2 * LENS_MAX;
    expect(Math.abs(scale * rim - bendPull(scale, band))).toBeLessThan(scale / 255);
  });

  test("reduced motion: the fixed gentle bend, half the strength, no breathing", () => {
    const band = 56;
    expect(bendPull(lensScale(1, 0, true), band)).toBeCloseTo(bendPull(2 * LENS_MAX, band) / 2, 9);
    expect(bendPull(lensScale(1, 0, true), band)).toBe(bendPull(lensScale(1, 7.3, true), band));
    // (full motion breathes between 0.8 and 1 of the full pull, never above)
    for (let t = 0; t < 20; t += 0.37) {
      const p = bendPull(lensScale(1, t, false), band) / bendPull(2 * LENS_MAX, band);
      expect(p).toBeGreaterThanOrEqual(0.8 - 1e-9);
      expect(p).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

describe("bendShown (where something u px from the rim shows)", () => {
  const band = 56, pull = bendPull(2 * LENS_MAX, band);

  test("inverts the lens's sampling: the point it shows at samples it", () => {
    for (let u = pull + 0.01; u < band; u += 0.37) {
      const s = bendShown(u, band, pull);
      expect(s + bendOffset(s, band, pull)).toBeCloseTo(u, 5);
    }
  });

  test("pulled toward the rim, never past the band, nothing changed beyond it", () => {
    for (let u = 0; u < 2 * band; u += 0.5) {
      const s = bendShown(u, band, pull);
      expect(s).toBeLessThanOrEqual(u + 1e-9);
      if (u >= band) expect(s).toBe(u);
    }
    // (within the pull of the rim it shows off the screen, shifted by the whole pull)
    expect(bendShown(3, band, pull)).toBeCloseTo(3 - pull, 9);
    expect(bendShown(-10, band, pull)).toBeCloseTo(-10 - pull, 9);
  });

  test("magnifies toward the rim, smoothly, at most about 3.3× (the lens's slope bound), never folding over", () => {
    let last = -Infinity, lastMag = Infinity;
    for (let u = pull + 0.2; u < band - 0.2; u += 0.2) {
      const s = bendShown(u, band, pull);
      const mag = (bendShown(u + 0.01, band, pull) - bendShown(u - 0.01, band, pull)) / 0.02;
      expect(s).toBeGreaterThan(last);
      expect(mag).toBeGreaterThanOrEqual(1 - 1e-6);
      expect(mag).toBeLessThan(1 / (1 - 0.7) + 0.05);
      expect(mag).toBeLessThanOrEqual(lastMag + 1e-3); // (easing off toward the band's inner edge)
      last = s; lastMag = mag;
    }
    // (straight at the rim: the profile's last third is linear, 1 / (1 − pull × 1.5 / band))
    const rimMag = (bendShown(pull + 1.01, band, pull) - bendShown(pull + 0.99, band, pull)) / 0.02;
    expect(rimMag).toBeCloseTo(1 / (1 - (pull * 1.5) / band), 3);
  });

  test("no pull, no band: unchanged", () => {
    expect(bendShown(10, band, 0)).toBe(10);
    expect(bendShown(10, 0, pull)).toBe(10);
  });
});

/** A 428 × 926 phone stacked (all four bands) and a 1440 × 900 desktop track (the side strips only), at full strength. */
const phone = (): BendScreen => {
  const band = lensBand(428, 926);
  return { w: 428, h: 926, band, pull: bendPull(2 * LENS_MAX, band), sides: false, depth: lensDepth(band) };
};
const desk = (): BendScreen => {
  const band = lensBand(1440, 900);
  return { w: 1440, h: 900, band, pull: bendPull(2 * LENS_MAX, band), sides: true, depth: lensDepth(band) };
};

describe("bendPoint / bendField", () => {
  test("mid-screen nothing moves; along an edge only the normal moves", () => {
    const s = phone(), o = pt();
    expect(bendPoint(214, 463, s, o)).toEqual({ x: 214, y: 463 });
    bendPoint(200, 20, s, o); // (the top band: pulled up toward the rim, x as it was)
    expect(o.x).toBe(200);
    expect(o.y).toBeLessThan(20);
    bendPoint(200, 906, s, o); // (the bottom band: pulled down)
    expect(o.y).toBeGreaterThan(906);
    bendPoint(15, 400, s, o); // (the left band)
    expect(o.x).toBeLessThan(15);
    expect(o.y).toBe(400);
  });

  test("the desktop track bends at the side strips only: the top band's middle stays put, the corners within the strips bend", () => {
    const s = desk(), o = pt();
    expect(bendPoint(720, 10, s, o)).toEqual({ x: 720, y: 10 });
    bendPoint(20, 450, s, o);
    expect(o.x).toBeLessThan(20);
    bendPoint(1420, 450, s, o);
    expect(o.x).toBeGreaterThan(1420);
    bendPoint(30, 30, s, o); // (the top-left corner: out along the diagonal)
    expect(o.x).toBeLessThan(30);
    expect(o.y).toBeLessThan(30);
    expect(Math.abs((30 - o.x) - (30 - o.y))).toBeLessThan(1e-3);
  });

  test("in a corner the shown point samples the content (the iteration has settled)", () => {
    const s = phone(), o = pt(), f = pt();
    for (const [x, y] of [[12, 12], [25, 8], [8, 30], [420, 918], [410, 10]]) {
      bendPoint(x, y, s, o);
      bendField(o.x, o.y, s, f);
      expect(o.x + f.x).toBeCloseTo(x, 3);
      expect(o.y + f.y).toBeCloseTo(y, 3);
    }
  });

  test("the field matches the map lensMap builds (direction and strength), a few px in from the left rim", () => {
    const W = 428, H = 926, band = lensBand(W, H), w = Math.ceil(W / 2), h = Math.ceil(H / 2);
    const d = lensMap(w, h, band * 0.5);
    const s = { ...phone(), pull: bendPull(2 * LENS_MAX, band) }, f = pt();
    for (const mx of [1, 4, 8, 12]) {
      const my = Math.round(h / 2), ch = (d[(my * w + mx) * 4] - 128) / 255;
      bendField(2 * mx, 2 * my, s, f);
      expect(Math.abs(f.x - 2 * LENS_MAX * ch)).toBeLessThan(0.6); // (the map's half resolution and 8 bits)
      expect(f.y).toBeCloseTo(0, 9);
    }
  });
});

describe("bendBox (a piece's transform)", () => {
  test("clear of the bands: null (no transform)", () => {
    expect(bendBox(100, 400, 120, 430, phone())).toBeNull();
    expect(bendBox(600, 10, 620, 40, desk())).toBeNull(); // (the track's top band holds no strip)
    expect(bendBox(100, 10, 120, 40, { ...phone(), pull: 0 })).toBeNull();
  });

  test("a line in the top band: pulled up and stretched tall; in the bottom band pulled down and stretched; no shear", () => {
    const s = phone();
    const top = bendBox(100, 14, 112, 42.8, s)!;
    expect(top).not.toBeNull();
    const [a, b, c, d, e, f] = top;
    expect(a).toBeCloseTo(1, 9); expect(b).toBe(0); expect(c).toBe(0); expect(e).toBe(0);
    expect(d).toBeGreaterThan(1);
    expect(f).toBeLessThan(0);
    const bot = bendBox(100, 900, 112, 928.8, s)!;
    expect(bot[3]).toBeGreaterThan(1);
    expect(bot[5] + bot[3] * 28.8).toBeGreaterThan(28.8); // (its foot further down than it was)
  });

  test("a letter in a side band on the track: pulled out and stretched wide, its height as it was", () => {
    const s = desk();
    const left = bendBox(30, 400, 52, 454, s)!;
    expect(left[0]).toBeGreaterThan(1);
    expect(left[4]).toBeLessThan(0);
    expect(left[3]).toBeCloseTo(1, 9);
    expect(left[5]).toBeCloseTo(0, 9);
    const right = bendBox(1400, 400, 1420, 454, s)!;
    expect(right[0]).toBeGreaterThan(1);
    expect(right[4] + right[0] * 20).toBeGreaterThan(20); // (its right edge further right)
  });

  test("neighbours meet: the right edge of one letter shows where the next one's left edge does", () => {
    const s = desk();
    for (let x = s.pull + 1; x < s.band; x += 3) {
      const I = [1, 0, 0, 1, 0, 0]; // (past the band: as it is)
      const A = bendBox(x, 400, x + 3, 440, s) ?? I, B = bendBox(x + 3, 400, x + 6, 440, s) ?? I;
      expect(x + A[4] + A[0] * 3).toBeCloseTo(x + 3 + B[4], 6);
    }
  });

  test("a piece straddling the rim is fitted on what shows: its visible edge lands at the rim's pull exactly", () => {
    const s = phone();
    const m = bendBox(100, -10, 112, 18.8, s)!; // (from above the screen into the band)
    // the content at the pull's depth shows at the rim (0)
    expect(-10 + m[5] + m[3] * (s.pull + 10)).toBeCloseTo(0, 6);
    // and its foot where the lens shows it
    expect(-10 + m[5] + m[3] * 28.8).toBeCloseTo(bendShown(18.8, s.band, s.pull), 6);
  });
});

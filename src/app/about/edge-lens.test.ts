// src/app/about/edge-lens.test.ts
import { describe, expect, test } from "vitest";
import { breath, warpTime } from "@/three/edge-light/field";
import { LENS_MAX, lensBand, lensDepth, lensMap, lensProfile, lensScale, lensStrips, lensSupported } from "./edge-lens";

describe("lensMap", () => {
  const w = 720, h = 450, band = lensBand(1440, 900) * 0.5; // (the half-resolution map at 1440 x 900: band 28 px)
  const d = lensMap(w, h, band);
  const at = (x: number, y: number) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };

  test("the map is neutral in the middle, points inward at the rim, nothing past the band", () => {
    expect(d.length).toBe(w * h * 4);
    expect(band).toBeCloseTo(28, 5);
    // the centre: neutral, opaque
    expect(at(w / 2, h / 2)).toEqual([128, 128, 128, 255]);
    // the four edge midpoints, at the rim: pulled inward along the edge's normal, most strongly (t² = 1 at the very edge)
    const [lr, lg] = at(0, h / 2), [rr, rg] = at(w - 1, h / 2), [tr, tg] = at(w / 2, 0), [br, bg] = at(w / 2, h - 1);
    expect(lr).toBeGreaterThan(240); expect(lg).toBe(128);   // left: points right (+x)
    expect(rr).toBeLessThan(16); expect(rg).toBe(128);       // right: points left (−x)
    expect(tg).toBeGreaterThan(240); expect(tr).toBe(128);   // top: points down (+y)
    expect(bg).toBeLessThan(16); expect(br).toBe(128);       // bottom: points up (−y)
    // easing toward the band's inner edge: halfway in, the profile's share of the pull (t²-like there: 1.125 t²)
    const half = at(Math.round(band / 2), h / 2)[0] - 128;
    expect(Math.abs(half - 127 * lensProfile(0.5))).toBeLessThan(1.5);
    expect(lensProfile(0.5)).toBeCloseTo(1.125 * 0.25, 9);
    // just inside the band's inner edge: nothing
    const inner = Math.ceil(band) + 1;
    expect(at(inner, h / 2)).toEqual([128, 128, 128, 255]);
    expect(at(w / 2, inner)).toEqual([128, 128, 128, 255]);
    // blue is always neutral (unused)
    expect(at(0, 0)[2]).toBe(128);
  });

  test("the corner is rounded: its pull points inward along the diagonal", () => {
    const [r, g] = at(1, 1);
    expect(r).toBeGreaterThan(128 + 60);
    expect(g).toBeGreaterThan(128 + 60);
    expect(Math.abs(r - g)).toBeLessThan(4);
  });
});

/** The map's displacement at a point (screen px, at full strength: scale 52), bilinear between its pixels. */
function displacement(d: Uint8ClampedArray, w: number, h: number, x: number, y: number): [number, number] {
  const x0 = Math.max(0, Math.min(w - 2, Math.floor(x))), y0 = Math.max(0, Math.min(h - 2, Math.floor(y)));
  const fx = Math.min(1, Math.max(0, x - x0)), fy = Math.min(1, Math.max(0, y - y0));
  const px = (xx: number, yy: number, c: number) => (d[(yy * w + xx) * 4 + c] - 128) / 127 * LENS_MAX; // (scale × (C/255 − ½) ≈ 26 × (C − 128) / 127)
  const lerp = (c: number) =>
    (px(x0, y0, c) * (1 - fx) + px(x0 + 1, y0, c) * fx) * (1 - fy) + (px(x0, y0 + 1, c) * (1 - fx) + px(x0 + 1, y0 + 1, c) * fx) * fy;
  return [lerp(0), lerp(1)];
}

describe("the rim bends without folding", () => {
  test("the profile's slope never passes 1.5: 26 px over the 56 px band changes ≤ 0.75 px per px", () => {
    expect(lensProfile(0)).toBe(0);
    expect(lensProfile(1)).toBeCloseTo(1, 12);
    let worst = 0;
    for (let t = 0; t < 1; t += 1e-4) worst = Math.max(worst, (lensProfile(t + 1e-4) - lensProfile(t)) / 1e-4);
    expect(worst).toBeLessThanOrEqual(1.5 + 1e-6);
    expect((LENS_MAX * worst) / 56).toBeLessThanOrEqual(0.75);
  });

  for (const [W, H] of [[1440, 900], [1024, 600], [1920, 1080]] as const) {
    test(`${W} x ${H}: the map's derivative along the normal is ≤ 0.75 everywhere in the band (at most 4× magnified)`, () => {
      const k = 0.5, w = Math.round(W * k), h = Math.round(H * k), band = lensBand(W, H) * k, rad = band * 1.4;
      const d = lensMap(w, h, band, k);
      const sd = (x: number, y: number) => {
        const qx = Math.abs(x - w / 2) - (w / 2 - rad), qy = Math.abs(y - h / 2) - (h / 2 - rad);
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
      };
      let worst = 0, n = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const inn = -sd(x, y);
          if (inn <= 0 || inn >= band) continue; // (the band; past the rounded corner the pull is constant)
          if (x > band + 2 && x < w - band - 3 && y > band + 2 && y < h - band - 3) continue;
          const gx = sd(x + 1, y) - sd(x - 1, y), gy = sd(x, y + 1) - sd(x, y - 1), gl = Math.hypot(gx, gy) || 1;
          const nx = -gx / gl, ny = -gy / gl; // inward
          // the inward displacement along the normal, one map px either side: per screen px (a map px is 1 / k of them)
          const along = (s: number) => { const [dx, dy] = displacement(d, w, h, x + s * nx, y + s * ny); return dx * nx + dy * ny; };
          const deriv = Math.abs(along(1) - along(-1)) / (2 / k);
          worst = Math.max(worst, deriv);
          n++;
        }
      }
      expect(n).toBeGreaterThan(1000);
      expect(worst, `steepest: ${worst.toFixed(3)} px per px`).toBeLessThanOrEqual(0.75);
      expect(worst).toBeGreaterThan(0.5); // (and it does bend)
      expect(1 / (1 - worst)).toBeLessThanOrEqual(4);
    });
  }
});

describe("the four strips", () => {
  for (const [W, H] of [[1440, 900], [1200, 760], [1024, 600], [2560, 1440], [1441, 901]] as const) {
    test(`${W} x ${H}: every point near an edge is in exactly one strip, none in the middle, deep enough for the pull and the corner`, () => {
      const band = lensBand(W, H), D = lensDepth(band), strips = lensStrips(W, H, D);
      expect(strips.map((s) => s.edge)).toEqual(["top", "right", "bottom", "left"]);
      expect(D).toBeGreaterThanOrEqual(band + LENS_MAX + 4);
      expect(D).toBeGreaterThan(band * 1.4); // (the corner's curve ends inside the top and bottom strips)
      for (let y = 0.5; y < H; y += 7) {
        for (let x = 0.5; x < W; x += 7) {
          const inside = strips.filter((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h).length;
          const nearEdge = x < D || x >= W - D || y < D || y >= H - D;
          expect(inside, `(${x}, ${y})`).toBe(nearEdge ? 1 : 0);
        }
      }
    });
  }
  test("1440 x 900: 90 px strips", () => {
    expect(lensDepth(lensBand(1440, 900))).toBe(90);
  });
});

test("the band is min(56 px, 6.5% of the shorter side)", () => {
  expect(lensBand(1440, 900)).toBe(56);
  expect(lensBand(390, 844)).toBeCloseTo(25.35, 5);
  expect(LENS_MAX).toBe(26);
});

test("lensScale is 0 at q 0, breathes only below full strength (never above 52·q), holds 26·q under reduced motion", () => {
  for (const t of [0, 1.3, 7, 42, 300]) expect(lensScale(0, t, false)).toBe(0);
  const full = 2 * 26;
  for (const q of [0.05, 0.3, 0.5, 1]) {
    for (let t = 0; t < 600; t += 0.13) {
      const s = lensScale(q, t, false);
      expect(s).toBeLessThanOrEqual(full * q + 1e-9);
      expect(s).toBeGreaterThanOrEqual(full * q * 0.8 - 1e-9);
      expect(s).toBeCloseTo(full * q * Math.min(1, 0.9 + 0.1 * breath(warpTime(t))), 9);
    }
  }
  // it does breathe
  const all = Array.from({ length: 400 }, (_, i) => lensScale(1, i * 0.25, false));
  expect(Math.max(...all) - Math.min(...all)).toBeGreaterThan(full * 0.1);
  // reduced motion: a fixed gentle bend, half the full strength, no breathing
  for (const t of [0, 5, 99]) {
    expect(lensScale(1, t, true)).toBe(26);
    expect(lensScale(0.4, t, true)).toBeCloseTo(10.4, 9);
    expect(lensScale(0, t, true)).toBe(0);
  }
});

describe("lensSupported", () => {
  const nav = (ua: string, brands?: string[]) =>
    ({ userAgent: ua, ...(brands ? { userAgentData: { brands: brands.map((brand) => ({ brand, version: "130" })) } } : {}) }) as unknown as Navigator;
  const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

  test("lensSupported: Chrome yes; Safari, Firefox and iOS Chrome (no userAgentData) no", () => {
    expect(lensSupported(nav(CHROME, ["Chromium", "Google Chrome", "Not?A_Brand"]))).toBe(true);
    expect(lensSupported(nav(CHROME.replace("Safari/537.36", "Safari/537.36 Edg/130.0"), ["Chromium", "Microsoft Edge", "Not?A_Brand"]))).toBe(true);
    // Safari: WebKit, no userAgentData
    expect(lensSupported(nav("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"))).toBe(false);
    // Firefox: no userAgentData
    expect(lensSupported(nav("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0"))).toBe(false);
    // iOS Chrome: WebKit underneath, "CriOS" in its UA and no userAgentData
    expect(lensSupported(nav("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1"))).toBe(false);
    // a userAgentData without Chromium among its brands
    expect(lensSupported(nav(CHROME, ["Not?A_Brand"]))).toBe(false);
    expect(lensSupported(nav(CHROME, []))).toBe(false);
  });
});

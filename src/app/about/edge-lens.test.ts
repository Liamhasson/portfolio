// src/app/about/edge-lens.test.ts
import { describe, expect, test } from "vitest";
import { breath, warpTime } from "@/three/edge-light/field";
import { LENS_MAX, lensBand, lensMap, lensScale, lensSupported } from "./edge-lens";

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
    // easing t² toward the band's inner edge: halfway in, a quarter of the pull
    const half = at(Math.round(band / 2), h / 2)[0] - 128;
    expect(half).toBeGreaterThan(127 * 0.25 - 4);
    expect(half).toBeLessThan(127 * 0.25 + 4);
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

test("the band is min(56 px, 6.5% of the shorter side)", () => {
  expect(lensBand(1440, 900)).toBe(56);
  expect(lensBand(390, 844)).toBeCloseTo(25.35, 5);
  expect(LENS_MAX).toBe(26);
});

test("lensScale is 0 at q 0, breathes within ±20% at q 1, holds 26·q under reduced motion", () => {
  for (const t of [0, 1.3, 7, 42, 300]) expect(lensScale(0, t, false)).toBe(0);
  const full = 2 * 26;
  for (let t = 0; t < 120; t += 0.37) {
    const s = lensScale(1, t, false);
    expect(s).toBeGreaterThanOrEqual(full * 0.8 - 1e-9);
    expect(s).toBeLessThanOrEqual(full * 1.2 + 1e-9);
    expect(s).toBeCloseTo(full * (1 + 0.2 * breath(warpTime(t))), 9);
  }
  // it does breathe
  const all = Array.from({ length: 200 }, (_, i) => lensScale(1, i * 0.25, false));
  expect(Math.max(...all) - Math.min(...all)).toBeGreaterThan(full * 0.2);
  expect(lensScale(0.5, 3, false)).toBeCloseTo(0.5 * full * (1 + 0.2 * breath(warpTime(3))), 9);
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

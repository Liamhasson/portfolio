// src/app/about/edge-lens.ts
/**
 * The screen's far edges as glass (plan 2026-10-17-about-testimonials-light, Task 4; ported from the mockup
 * about-pictures-v26, Liam 10-16): a crisp lens band at the screen's rounded edge that bends what passes under it, the words
 * magnifying toward the rim, no blur. An SVG displacement on the backdrop (about-testimonials.tsx: `.ab-lens`, the filter
 * `#ab-edge-lens`), so Chromium only. The pure parts live here: the displacement map, its strength, and the feature check.
 */
import { breath, warpTime } from "@/three/edge-light/field";

/** px: the furthest a point is pulled, at the very rim. (34 with a steeper curve smeared the letters into streaks.) */
export const LENS_MAX = 26;

/** The band's width (px) for a screen: min(56 px, 6.5% of the shorter side). */
export function lensBand(w: number, h: number): number {
  return Math.min(56, Math.min(w, h) * 0.065);
}

/**
 * The displacement map, w × h RGBA (built at half the screen's resolution; the filter stretches it over the screen).
 * Neutral (128) everywhere but a band at the screen's rounded edge (corner radius 1.4 × the band), where R/G hold the edge's
 * inward normal × t², t running from 1 at the rim to 0 at the band's inner edge: each point there samples from further in,
 * most at the very edge, so the content stretches toward the rim like thick glass. `band` in the map's own pixels.
 */
export function lensMap(w: number, h: number, band: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  const rad = band * 1.4, hw = w / 2, hh = h / 2;
  /** The rounded screen's signed distance: < 0 inside. */
  const sd = (x: number, y: number) => {
    const qx = Math.abs(x - hw) - (hw - rad), qy = Math.abs(y - hh) - (hh - rad);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, inn = -sd(x, y);
      let dx = 0, dy = 0;
      if (inn < band) {
        const t = 1 - Math.max(inn, 0) / band, m = t * t; // strongest at the rim, easing to nothing at the band's inner edge
        const gx = sd(x + 1, y) - sd(x - 1, y), gy = sd(x, y + 1) - sd(x, y - 1), gl = Math.hypot(gx, gy) || 1;
        dx = (-gx / gl) * m; dy = (-gy / gl) * m; // inward
      }
      d[i] = 128 + dx * 127; d[i + 1] = 128 + dy * 127; d[i + 2] = 128; d[i + 3] = 255;
    }
  }
  return d;
}

/**
 * feDisplacementMap's scale: the full pull (2 × LENS_MAX: the map's ±0.5 is ±half the scale) × q, breathing with the edge
 * light's push and pull (the same uneven time, ±20%). Reduced motion: a fixed gentle bend at half the strength, no breathing.
 */
export function lensScale(q: number, t: number, reduced: boolean): number {
  if (reduced) return LENS_MAX * q;
  return 2 * LENS_MAX * q * (1 + 0.2 * breath(warpTime(t)));
}

/** `navigator.userAgentData`, where there is one (Chromium only). */
type UAData = { brands?: ReadonlyArray<{ brand: string }> };

/**
 * Whether the lens can be shown: an SVG filter as a backdrop-filter bends only in Chromium. Chromium tells its engine in
 * `navigator.userAgentData.brands`; WebKit (Safari, and every iOS browser, Chrome included) and Firefox have no
 * userAgentData. Elsewhere there is no lens at all: the light and the ball without the bend.
 */
export function lensSupported(nav: Navigator): boolean {
  const ua = (nav as Navigator & { userAgentData?: UAData }).userAgentData;
  return !!ua?.brands?.some((b) => b.brand === "Chromium");
}

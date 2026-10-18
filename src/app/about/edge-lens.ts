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

/** The profile's steepest slope (d f / d t): with the 26 px pull over the 56 px band, the displacement's slope along the
 *  normal peaks at 26 × 1.5 / 56 ≈ 0.70, so the glass magnifies at most 1 / (1 − 0.70) ≈ 3.3× and never folds over
 *  (Liam, 2026-10-17: at most about 4×, d′ ≤ 0.75). */
export const LENS_SLOPE = 1.5;

/** The most the displacement may change per px along the normal (the map is scaled down to hold it on a narrow band). */
const MAX_DERIV = 0.7;

/** The share of the full pull the map keeps on a band `band` px deep (screen px): 1 on a band deep enough, less on a
 *  narrow one, so the displacement's slope never passes MAX_DERIV (lensMap's own scaling, shared with edge-bend.ts). */
export function lensAmp(band: number): number {
  return Math.min(1, (MAX_DERIV * band) / (LENS_MAX * LENS_SLOPE));
}

/** The band's width (px) for a screen: min(56 px, 6.5% of the shorter side). */
export function lensBand(w: number, h: number): number {
  return Math.min(56, Math.min(w, h) * 0.065);
}

/**
 * The pull's shape across the band, t 0 (the band's inner edge) → 1 (the rim), f 0 → 1. t²-like inside the band
 * (1.125 t² to t = 2/3), then straight at the slope LENS_SLOPE to the rim: the words magnify toward the rim, evenly over
 * its last third, where t² alone would magnify 14× at the very edge and stretch the first letters into horns.
 */
export function lensProfile(t: number): number {
  const c = LENS_SLOPE, a = (2 * (c - 1)) / c, k = c / a; // (a = 2/3, k = 2.25: f′ = min(k t, c), its area 1)
  const u = Math.min(1, Math.max(0, t));
  return u <= a ? 0.5 * k * u * u : 0.5 * k * a * a + c * (u - a);
}

/**
 * The displacement map, w × h RGBA (built at `k` × the screen's resolution, 0.5 by default; the filter stretches it over
 * the screen). Neutral (128) everywhere but a band at the screen's rounded edge (corner radius 1.4 × the band), where R/G
 * hold the edge's inward normal × lensProfile(t), t running from 1 at the rim to 0 at the band's inner edge: each point
 * there samples from further in, so the content stretches toward the rim like thick glass. `band` in the map's own pixels.
 * On a band too narrow for the full pull to keep its slope under MAX_DERIV, the whole map is scaled down.
 */
export function lensMap(w: number, h: number, band: number, k = 0.5): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  const rad = band * 1.4, hw = w / 2, hh = h / 2;
  const amp = lensAmp(band / k);
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
        const m = amp * lensProfile(1 - Math.max(inn, 0) / band); // strongest at the rim, easing to nothing at the band's inner edge
        const gx = sd(x + 1, y) - sd(x - 1, y), gy = sd(x, y + 1) - sd(x, y - 1), gl = Math.hypot(gx, gy) || 1;
        dx = (-gx / gl) * m; dy = (-gy / gl) * m; // inward
      }
      d[i] = 128 + dx * 127; d[i + 1] = 128 + dy * 127; d[i + 2] = 128; d[i + 3] = 255;
    }
  }
  return d;
}

/**
 * The strips' depth (px): the band, the furthest a point there samples from (the pull) and a margin, so no strip ever
 * samples outside itself; and past the corner's curve (1.4 × the band), so where two strips meet the bend is along the
 * seam only and the seam can't show.
 */
export function lensDepth(band: number): number {
  return Math.ceil(Math.max(band + LENS_MAX + 8, band * 1.4 + 4));
}

export type LensEdge = "top" | "right" | "bottom" | "left";
export type LensStrip = { edge: LensEdge; x: number; y: number; w: number; h: number };

/** Which strips the lens is drawn in: all four (stacked, on phones: the column scrolls through the top and bottom bands), or
 *  the left and right only (the desktop track: the words travel sideways through the side bands, while the top and bottom
 *  bands hold only the page's ground; Liam, 2026-10-17: two strips keep 120 Hz beside the pendant, four don't). */
export type LensLayout = "four" | "sides";

/**
 * The strips the lens is drawn in (a full-screen backdrop filter costs about 10 ms a frame; the edges alone, a fraction).
 * "four": top and bottom the screen's full width, left and right between them, so every corner is covered exactly once.
 * "sides": the right and the left strips only, each the screen's full height (nothing above or below them to meet), in
 * that order.
 */
export function lensStrips(W: number, H: number, D: number, layout: LensLayout = "four"): LensStrip[] {
  const d = Math.min(D, W / 2, H / 2), mid = Math.max(0, H - 2 * d);
  if (layout === "sides") {
    return [
      { edge: "right", x: W - d, y: 0, w: d, h: H },
      { edge: "left", x: 0, y: 0, w: d, h: H },
    ];
  }
  return [
    { edge: "top", x: 0, y: 0, w: W, h: d },
    { edge: "right", x: W - d, y: d, w: d, h: mid },
    { edge: "bottom", x: 0, y: H - d, w: W, h: d },
    { edge: "left", x: 0, y: d, w: d, h: mid },
  ];
}

/**
 * feDisplacementMap's scale: the full pull (2 × LENS_MAX: the map's ±0.5 is ±half the scale) × q, breathing with the edge
 * light's push and pull (the same uneven time) only below full strength: 0.8–1 of it, never above (Liam, 2026-10-17).
 * Reduced motion: a fixed gentle bend at half the strength, no breathing.
 */
export function lensScale(q: number, t: number, reduced: boolean): number {
  if (reduced) return LENS_MAX * q;
  return 2 * LENS_MAX * q * Math.min(1, 0.9 + 0.1 * breath(warpTime(t)));
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

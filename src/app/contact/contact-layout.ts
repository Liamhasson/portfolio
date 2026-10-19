// src/app/contact/contact-layout.ts
import { CONTACT_FRAME } from "@/three/sand/contact-view";

/** Upright screens (Liam, 2026-10-19: keep the ball as it was, only never under the words): the gap between the ball and
 *  the words (a share of the visible height, at least `gapMin` px), the room kept clear above (the site's header) and below,
 *  and where the words sit by default (their foot this share of the visible height off the screen's foot, as the CSS has it). */
export const PORTRAIT = { gap: 0.035, gapMin: 24, top: 96, bottom: 24, foot: 0.1 } as const;

export type ContactLayout = {
  /** The ball's diameter as a share of the canvas's height, and its centre's height from the top as a share of it
   *  (contact-view.ts contactView's frame). */
  share: number;
  at: number;
  /** The ball on screen (px): centre and radius. */
  cx: number;
  cy: number;
  r: number;
  /** Where the words' top sits (px from the top of the screen); null: their own place (10svh off the foot, by CSS). */
  wordsTop: number | null;
};

/**
 * Contact's layout: the approved framing everywhere (the ball 30% of the canvas's height, its centre 42% down, the words
 * 10% off the foot). Upright, where those would meet (a tall phone, its toolbars showing), the words move up to sit a gap
 * under the ball; and only if they would then run off the foot does the ball move up, just as far as it must, its size
 * kept (it shrinks only where even that can't fit them under the header). `w`, `h`: the visible screen (window.inner*,
 * which follows a phone's toolbars); `canvasH`: the canvas's height (the large viewport); `wordsH`: the words' height.
 */
export function contactLayout(w: number, h: number, canvasH: number, wordsH: number): ContactLayout {
  const H = canvasH > 0 ? canvasH : h;
  const share = CONTACT_FRAME.share;
  let r = (share * H) / 2, cy = CONTACT_FRAME.at * H;
  const base = { cx: w / 2 };
  if (w >= h) return { share, at: CONTACT_FRAME.at, ...base, cy, r, wordsTop: null };
  const gap = Math.max(PORTRAIT.gapMin, PORTRAIT.gap * h);
  const ownTop = h - PORTRAIT.foot * h - wordsH;
  if (ownTop >= cy + r + gap) return { share, at: CONTACT_FRAME.at, ...base, cy, r, wordsTop: null };
  // the words under the ball; the ball up only as far as the words need to stay on screen
  const lowest = h - PORTRAIT.bottom - wordsH - gap - r;
  if (cy > lowest) cy = lowest;
  if (cy - r < PORTRAIT.top) {
    // (no room even so: the ball shrinks to fit between the header and the words)
    r = Math.max((h - PORTRAIT.bottom - wordsH - gap - PORTRAIT.top) / 2, 0.1 * w);
    cy = PORTRAIT.top + r;
  }
  return { share: (2 * r) / H, at: cy / H, ...base, cy, r, wordsTop: cy + r + gap };
}

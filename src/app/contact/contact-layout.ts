// src/app/contact/contact-layout.ts
import { CONTACT_FRAME } from "@/three/sand/contact-view";

/** Upright screens (Liam, 2026-10-19: on a phone the ball ran into the words): the ball's widest share of the screen's
 *  width, the gap between the ball and the words (a share of the visible height, at least GAP_MIN px), and the room kept
 *  clear above (the site's header) and below. */
export const PORTRAIT = { ballW: 0.62, gap: 0.045, gapMin: 28, top: 96, bottom: 24 } as const;

export type ContactLayout = {
  /** The ball's diameter as a share of the canvas's height, and its centre's height from the top as a share of it
   *  (contact-view.ts contactView's frame). */
  share: number;
  at: number;
  /** The ball on screen (px): centre and radius. */
  cx: number;
  cy: number;
  r: number;
  /** Where the words' top sits (px from the top of the screen); null: the wide layout's own place (10svh off the foot). */
  wordsTop: number | null;
};

/**
 * Contact's layout. Wide screens keep the approved framing (the ball 30% of the height, its centre 42% down, the words
 * below by CSS). Upright ones lay the ball and the words out as one group, centred in what is visible: the ball sized from
 * the width (never more than the wide framing's share of the height), the words a gap below it, and on a short screen the
 * ball shrinks until the group fits between the header and the foot. `w`, `h`: the visible screen (window.inner*, which
 * follows a phone's toolbars); `canvasH`: the canvas's height (the large viewport: the toolbars never resize it); `wordsH`:
 * the words' height as laid out.
 */
export function contactLayout(w: number, h: number, canvasH: number, wordsH: number): ContactLayout {
  const H = canvasH > 0 ? canvasH : h;
  if (w >= h) {
    const r = (CONTACT_FRAME.share * H) / 2;
    return { share: CONTACT_FRAME.share, at: CONTACT_FRAME.at, cx: w / 2, cy: CONTACT_FRAME.at * H, r, wordsTop: null };
  }
  const gap = Math.max(PORTRAIT.gapMin, PORTRAIT.gap * h);
  const room = h - PORTRAIT.top - PORTRAIT.bottom - gap - wordsH;
  const d = Math.max(Math.min(CONTACT_FRAME.share * H, PORTRAIT.ballW * w, room), 0.2 * w);
  const group = d + gap + wordsH;
  const top = Math.max(PORTRAIT.top, (h - group) / 2);
  const cy = top + d / 2;
  return { share: d / H, at: cy / H, cx: w / 2, cy, r: d / 2, wordsTop: top + d + gap };
}

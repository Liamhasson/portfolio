// src/app/about/picture-motion.ts: how a picture along the track arrives and leaves (the v26 mockup, mode B "cut at the margin line").
// It rises out of its line between 94% and 70% of the screen, and is cut away from its left edge at the margin line (6%) as it leaves.

/** Clip insets in % (top: from the bottom-up rise; left: from the margin cut) and whether the picture is gone (no hairline left). */
export interface PicState { top: number; left: number; hidden: boolean }

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * `screenLeft`: the picture's left edge on screen, in px. `width`: the picture plus its caption (a caption can run wider
 * than its picture, and is cut with it). `vw`: the screen's width.
 */
export function pictureState(screenLeft: number, width: number, vw: number): PicState {
  const margin = vw * 0.06;
  const top = (1 - smooth(clamp((vw * 0.94 - screenLeft) / (vw * 0.24), 0, 1))) * 100;
  const left = screenLeft < margin && width > 0 ? clamp((margin - screenLeft) / width, 0, 1) * 100 : screenLeft < margin ? 100 : 0;
  return { top, left, hidden: left >= 100 || top >= 100 };
}

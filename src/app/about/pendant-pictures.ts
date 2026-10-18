// src/app/about/pendant-pictures.ts: how much of a picture along the track the pendant must keep clear of (its readability
// solve, about-pendant.tsx). A picture is content like the words, but only what of it is drawn counts: it rises out of its
// line as it arrives and is cut at the margin as it leaves (picture-motion.ts, the maths the track runs).
import { pictureState } from "./picture-motion";

/** A picture's place: `l` in track px, `t` in the pinned frame's px, `w` the picture plus its caption (cut together), `h`. */
export interface PicPlace { l: number; t: number; w: number; h: number }

/**
 * For a picture (its frame or its caption's lines, cut together) at travel `s`: the screen point left of and above which
 * none of it shows, or null when the pendant need not keep clear of it at all. Arriving and fully shown pictures count
 * wherever they have risen to. A picture stops counting the moment its exit cut at the margin starts (Liam, 2026-10-16: the
 * pendant may pass over a picture already leaving; it let the hero's storyboard framing play over the desk film's last
 * sliver, before that film left About on 2026-10-18). Its caption goes with it: it is part of the picture and cut with it (pictures spec §3), and a
 * caption half cut away at the margin is no longer a line anyone reads.
 */
export function pictureShown(p: PicPlace, vw: number): (s: number) => { x: number; y: number } | null {
  return (s) => {
    const sl = p.l - s;
    const st = pictureState(sl, p.w, vw);
    if (st.hidden || st.left > 0) return null;
    return { x: sl, y: p.t + (st.top / 100) * p.h };
  };
}

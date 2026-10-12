// src/app/contact/contact-timeline.ts
import { LOADER } from "@/app/lab/sand/loader-timeline";

/** Contact's beats after the brief is full (spec 2026-10-12-about-contact-design.md §4): the loader's own rounding and
 *  cascade, then the words; and when a load is given up for stalled. */
export const CONTACT_T = { round: LOADER.round, words: LOADER.copy, stall: 15 } as const;

const ease = (x: number) => { const t = Math.min(Math.max(x, 0), 1); return t * t * (3 - 2 * t); };

export function contactAt(t0: number) {
  const t = t0 - CONTACT_T.round;
  return {
    round: ease(t0 / CONTACT_T.round),
    cascade: t,
    words: ease((t - CONTACT_T.words[0]) / (CONTACT_T.words[1] - CONTACT_T.words[0])),
  };
}

export const contactStalled = (stalledFor: number, progress: number) => progress < 1 && stalledFor > CONTACT_T.stall;

// src/app/about/track.ts
/**
 * About's sideways track (spec 2026-10-12-about-contact-design.md §3): a pinned section whose height is a screen plus
 * the track's overflow, so one pixel of scroll moves the track one pixel; scrubbed, never on its own clock. Portrait
 * phones and reduced motion stack the slides instead (no sideways scroll at all).
 */
export type TrackMode = "track" | "stack";

/** Below this height the tallest slide (Build it, with the resume) doesn't fit the pinned screen: stack instead. */
export const TRACK_MIN_H = 560;

export const trackLayout = ({ w, h, reduced }: { w: number; h: number; reduced: boolean }): TrackMode =>
  reduced || w / h < 1 || h < TRACK_MIN_H ? "stack" : "track";

export const sectionHeight = (trackW: number, viewW: number, vh: number) => vh + Math.max(trackW - viewW, 0);

export function trackProgress(scrollY: number, top: number, height: number, vh: number): number {
  if (height <= vh) return 0;
  return Math.min(Math.max((scrollY - top) / (height - vh), 0), 1);
}

export const trackX = (p: number, trackW: number, viewW: number) => -p * Math.max(trackW - viewW, 0);

/** Where the page scrolls so a slide `slideLeft` along the track shows `inset` from the clip's left edge (keyboard focus,
 *  find-in-page): the section's top plus that much of the track's travel, never past its ends. */
export const scrollForSlide = (top: number, slideLeft: number, inset: number, overflow: number) =>
  top + Math.min(Math.max(slideLeft - inset, 0), overflow);

/** The build's pause (Liam, 2026-10-18): the track holds still while the scroll drives the pendant's build in its frame,
 *  then carries on. `at`: where along the track it holds (track px of travel); `length`: the scroll it takes there (px).
 *  The section is that much taller. */
export type Dwell = { at: number; length: number };

/** Scroll px into the pinned stretch → the track's travel (px) and how far through the pause (0 before it, 1 after).
 *  One px of scroll moves the track one px, except across the pause, where it holds at `at`. Continuous at both ends. */
export function dwellTravel(scrollPx: number, travel: number, dwell: Dwell | null): { s: number; k: number } {
  const move = Math.max(travel, 0);
  const s = Math.min(Math.max(scrollPx, 0), move + (dwell ? Math.max(dwell.length, 0) : 0));
  if (!dwell || dwell.length <= 0) return { s: Math.min(s, move), k: 0 };
  const at = Math.min(Math.max(dwell.at, 0), move);
  if (s <= at) return { s, k: 0 };
  if (s <= at + dwell.length) return { s: at, k: (s - at) / dwell.length };
  return { s: s - dwell.length, k: 1 };
}

/** The scroll px (into the pinned stretch) at which the track shows travel `s` (the start of the pause for `at` itself). */
export const scrollForTravel = (s: number, dwell: Dwell | null) => (dwell && s > dwell.at ? s + dwell.length : s);

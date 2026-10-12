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

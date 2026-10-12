// src/app/about/track.ts
/**
 * About's sideways track (spec 2026-10-12-about-contact-design.md §3): a pinned section whose height is a screen plus
 * the track's overflow, so one pixel of scroll moves the track one pixel; scrubbed, never on its own clock. Portrait
 * phones and reduced motion stack the slides instead (no sideways scroll at all).
 */
export type TrackMode = "track" | "stack";

export const trackLayout = ({ w, h, reduced }: { w: number; h: number; reduced: boolean }): TrackMode =>
  reduced || w / h < 1 ? "stack" : "track";

export const sectionHeight = (trackW: number, viewW: number, vh: number) => vh + Math.max(trackW - viewW, 0);

export function trackProgress(scrollY: number, top: number, height: number, vh: number): number {
  if (height <= vh) return 0;
  return Math.min(Math.max((scrollY - top) / (height - vh), 0), 1);
}

export const trackX = (p: number, trackW: number, viewW: number) => -p * Math.max(trackW - viewW, 0);

// src/lib/pull.ts
/**
 * The pull at the end of a page (spec 2026-10-12-about-contact-design.md §2): scrolling on past the end fills a line,
 * and the next page opens when it is full. A deliberate gesture, never an automatic redirect (Liam asked for one;
 * Claude pushed back: it fires while people read, momentum overshoots, Back loops; WCAG 3.2.5):
 * - a gesture that starts at the end counts (wheel events closer than `gap` seconds are one gesture); one that started
 *   above it counts at the end only while it keeps its pace (Liam, 2026-10-12: one long scroll down that reaches the
 *   bottom and keeps going must fill it): a flick's momentum only ever slows, so it never fills it;
 * - about `need` of a screen of scrolling fills it; stopping holds it; scrolling back empties it.
 */
export const PULL = { need: 0.6, gap: 0.14, sustain: 0.97 } as const;

export type PullState = { fill: number; lastT: number; gestureAtEnd: boolean; lastDy: number };

export const pullStart = (): PullState => ({ fill: 0, lastT: -Infinity, gestureAtEnd: false, lastDy: 0 });

export function pullStep(s: PullState, e: { dy: number; t: number; atEnd: boolean; vh: number }): PullState {
  const fresh = e.t - s.lastT > PULL.gap;
  const gestureAtEnd = (fresh ? true : s.gestureAtEnd) && e.atEnd;
  // keeping its pace (not slowing like momentum): a finger still scrolling
  const sustained = !fresh && e.dy > 0 && e.dy >= s.lastDy * PULL.sustain;
  const k = e.dy / (PULL.need * e.vh);
  let fill = s.fill;
  if (e.dy < 0) fill = Math.max(0, fill + k);
  else if (e.atEnd && (gestureAtEnd || sustained)) fill = Math.min(1, fill + k);
  return { fill, lastT: e.t, gestureAtEnd, lastDy: e.dy };
}

export const pullDone = (s: PullState) => s.fill >= 1;

type MediaMatcher = (query: string) => boolean;

/** Smooth scrolling only for fine pointers, and never under reduced motion. */
export function shouldUseSmoothScroll(matches: MediaMatcher): boolean {
  return matches("(pointer: fine)") && !matches("(prefers-reduced-motion: reduce)");
}

/** The page's smooth scroller (Lenis), when there is one: the provider registers it. */
interface Scroller {
  scrollTo(target: number, options: { duration?: number; lock?: boolean; onComplete?: () => void; easing?: (t: number) => number; immediate?: boolean; force?: boolean }): void;
  stop?(): void;
  start?(): void;
}
let scroller: Scroller | null = null;

/** Registers the smooth scroller; returns the unregister. */
export function registerScroller(s: Scroller): () => void {
  scroller = s;
  return () => { if (scroller === s) scroller = null; };
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Carries the page to `y` (px) over `seconds`, the user's input held off meanwhile; `done` once there. Without the smooth
 *  scroller, the browser's own smooth scroll (the caller watches for arrival), or an instant jump when `instant`. */
export function glideTo(y: number, seconds: number, done: () => void, instant = false): void {
  if (scroller && !instant) {
    scroller.scrollTo(y, { duration: seconds, lock: true, easing: easeInOut, onComplete: done });
    return;
  }
  window.scrollTo({ top: y, behavior: instant ? "instant" : "smooth" });
  if (instant) done();
}

/** At the top of the page at once (a page arriving from the story, which had the page far down). */
export function toTop(): void {
  if (scroller) scroller.scrollTo(0, { immediate: true, force: true });
  window.scrollTo({ top: 0, behavior: "instant" });
}

/** The loader's hold on scrolling: the smooth scroller stopped (keys and wheel), released at the unlock. */
export function holdScroll(on: boolean): void {
  if (on) scroller?.stop?.(); else scroller?.start?.();
}

/** A wall at `y` (px), for this frame: below it, the page is set back to it at once (the story's wait for the desk);
 *  above it, nothing, so scrolling back up stays free. */
export function wallAt(y: number): void {
  if (window.scrollY <= y + 1) return;
  if (scroller) scroller.scrollTo(y, { immediate: true, force: true });
  else window.scrollTo({ top: y, behavior: "instant" });
}

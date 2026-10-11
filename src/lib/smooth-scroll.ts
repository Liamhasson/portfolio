type MediaMatcher = (query: string) => boolean;

/** Smooth scrolling only for fine pointers, and never under reduced motion. */
export function shouldUseSmoothScroll(matches: MediaMatcher): boolean {
  return matches("(pointer: fine)") && !matches("(prefers-reduced-motion: reduce)");
}

/** The page's smooth scroller (Lenis), when there is one: the provider registers it. */
interface Scroller {
  scrollTo(target: number, options: { duration: number; lock: boolean; onComplete: () => void; easing?: (t: number) => number }): void;
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

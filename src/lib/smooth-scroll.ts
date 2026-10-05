type MediaMatcher = (query: string) => boolean;

/** Smooth scrolling only for fine pointers, and never under reduced motion. */
export function shouldUseSmoothScroll(matches: MediaMatcher): boolean {
  return matches("(pointer: fine)") && !matches("(prefers-reduced-motion: reduce)");
}

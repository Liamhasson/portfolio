/**
 * The name in the nav (Liam, 2026-10-12): top left on every page, "PRODUCT DESIGNER" until the hero's "Hi, I'm Liam."
 * leaves, then "LIAM HASSON", rolling over letter by letter with the scroll. One shared value, 0 (as it was) .. 1
 * (rolled): the story's hero sets it as its copy drifts out; the nav reads it. Elsewhere it is simply rolled.
 */
export const NAME = { from: "PRODUCT DESIGNER", to: "LIAM HASSON", stagger: 0.035 } as const;

/** Letter `i` of `n`'s roll at the overall `progress` (0..1): in turn, left to right, each eased. */
export function letterRoll(progress: number, i: number, n: number): number {
  const each = 1 - (n - 1) * NAME.stagger;
  const t = Math.min(Math.max((progress - i * NAME.stagger) / each, 0), 1);
  return t * t * (3 - 2 * t);
}

let value = 0;
const listeners = new Set<(k: number) => void>();
export const nameRoll = {
  get: () => value,
  set(k: number) { if (k === value) return; value = k; listeners.forEach((f) => f(k)); },
  subscribe(f: (k: number) => void) { listeners.add(f); return () => { listeners.delete(f); }; },
};

// Single source of truth for motion. Every animation on the site reads from here
// (or from the matching CSS custom properties in globals.css).

export const ease = {
  /** Entrances: fast start, long soft landing. */
  settle: [0.22, 1, 0.36, 1],
  /** Exits: quick departure. */
  exit: [0.55, 0, 1, 0.45],
} as const;

/** Seconds. */
export const dur = {
  micro: 0.18,
  ui: 0.32,
  reveal: 0.6,
  page: 0.9,
} as const;

/** Exits run at ~65% of the matching entrance so the UI feels responsive. */
export function exitDuration(enter: number): number {
  return Math.round(enter * 0.65 * 1000) / 1000;
}

/** Pixels travelled by reveals. */
export const distance = {
  text: 24,
  card: 48,
} as const;

/** Seconds between siblings in a staggered reveal. */
export const stagger = 0.06;

export const spring = {
  pop: { type: "spring", stiffness: 400, damping: 22 },
} as const;

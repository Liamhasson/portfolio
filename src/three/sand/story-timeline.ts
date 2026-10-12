/**
 * The hero page's story in screens scrolled (spec docs/superpowers/specs/2026-10-11-scene-order-design.md §3): the
 * hero; the ball forming in place (the camera easing in); a hold; one forward shot (tilt down, glide over the desk,
 * the laptop and the push into the screen); the index.
 */
export const BEATS = {
  hero: [0, 0.4],
  compact: [0.4, 1.6],
  copyOut: [0.45, 1.45],
  hold: [1.6, 1.8],
  tilt: [1.8, 2.4],
  glide: [2.4, 3.2],
  deskView: [2.65, 2.95],   // the desk in full view (held there under reduced motion)
  tail: [3.2, 4.2],
  takeover: [4.12, 4.2],
  indexIn: [4.2, 4.3],
} as const satisfies Record<string, readonly [number, number]>;

/** Where the story ends and the index's own scrolling begins (screens). */
export const STORY_SCREENS = 4.3;

/** The way back out of the screen is long (Liam, 2026-10-11): after the story, this many screens of scroll stay in the
 *  screen before the index's anchor, so scrolling up from the projects holds there a while before the camera pulls out. */
export const SCREEN_HOLD = 0.8;

/** Scrolled px -> the story's progress (screens), `end` the index's anchor (px): a screen of scroll is a screen of story,
 *  held in the screen for the last SCREEN_HOLD screens. */
export function storyProgress(scrollY: number, end: number): number {
  return Math.min((STORY_SCREENS + SCREEN_HOLD) * Math.min(Math.max(scrollY / end, 0), 1), STORY_SCREENS);
}

/** The desk not in yet (pre-launch audit; Liam, 2026-10-12: hold before the tilt): scrolling down, the story waits on the
 *  formed ball at the hold's end, the brief and its loading line showing, until the desk is in. Returns the wall (px) to
 *  hold the page at, or null. A jump isn't held (the nav's Projects, a link to the projects, more than a screen in one
 *  frame, an arrival below it): there the index shows on its own. */
export const DESK_WAIT = BEATS.hold[1];
export function deskWait({ ready, p, prevP, end, jumping }: { ready: boolean; p: number; prevP: number; end: number; jumping: boolean }): number | null {
  if (ready || jumping || p <= DESK_WAIT || prevP > DESK_WAIT + 0.02 || p - prevP > 1) return null;
  return (DESK_WAIT / (STORY_SCREENS + SCREEN_HOLD)) * end;
}

/** Very close to the screen, scrolling down, the page carries the user in (Liam, 2026-10-11: snap into the screen, so
 *  nobody tries to click the projects while they're still on the laptop's screen). Never on the way back out. */
export const SNAP_FROM = 3.8;
export function snapIn(p: number, prevP: number): boolean {
  return p >= SNAP_FROM && p > prevP && p < STORY_SCREENS;
}

export const span = (p: number, [a, b]: readonly [number, number]) => Math.min(Math.max((p - a) / (b - a), 0), 1);

/** smootherstep of t over [a, b] (Blender's ease in lookdev.py). */
export function ease(t: number, r: readonly [number, number]): number {
  const x = span(t, r);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export interface ShotBeats { ease: [number, number]; tilt: [number, number]; glide: [number, number]; tail: [number, number] }
/** public/lab/shot/camera.json's own fields (blender/lookdev/shot_path.py). */
export interface ShotMeta { frames: number; wake_frame: number; screen_from: number; beats: ShotBeats }

const segments = (b: ShotBeats): [readonly [number, number], [number, number]][] => [
  [BEATS.compact, b.ease], [BEATS.tilt, b.tilt], [BEATS.glide, b.glide], [BEATS.tail, b.tail],
];

/** Progress (screens) -> the shot's frame (0-based, fractional). Between beats it holds the last one's end. */
export function shotFrame(p: number, b: ShotBeats): number {
  let f = b.ease[0];
  for (const [[p0, p1], [f0, f1]] of segments(b)) {
    if (p <= p0) return f;
    if (p <= p1) return f0 + (f1 - f0) * ((p - p0) / (p1 - p0));
    f = f1;
  }
  return f;
}

/** The progress that shows frame f (calibration: ?shotframe=N). */
export function pAtFrame(f: number, b: ShotBeats): number {
  for (const [[p0, p1], [f0, f1]] of segments(b)) if (f <= f1) return p0 + (p1 - p0) * ((f - f0) / (f1 - f0));
  return BEATS.tail[1];
}

/** Reduced motion (spec §8): held states (the cloud, the ball, the desk, the index), each cut a
 *  short crossfade through black (veil 0..1..0 over 0.2 screens), the scene switching at the veil's peak. */
const HELD = [0, BEATS.hold[0], (BEATS.deskView[0] + BEATS.deskView[1]) / 2, STORY_SCREENS];
const CUTS = [0.9, 2.2, 3.5];
export function reducedStory(p: number): { p: number; veil: number } {
  let state = 0, veil = 0;
  CUTS.forEach((c, i) => {
    if (p >= c) state = i + 1;
    veil = Math.max(veil, 1 - Math.min(Math.abs(p - c) / 0.1, 1));
  });
  return { p: HELD[state], veil };
}

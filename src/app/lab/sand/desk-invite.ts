/**
 * The desk invites you on (Liam, 2026-10-18: some visitors stopped on the desk and took the scene for finished). Motion
 * first, then text: a visitor who stops on the desk for TEASE_AFTER seconds sees the next beat teased (the lid lifts a
 * few degrees and the camera leans a little toward the screen, eased in); still there after CUE_AFTER seconds, "Keep
 * scrolling" fades in where the hero's cue sat. Any scroll (wheel, touch, keys, the page moving) lets both go: the tease
 * eases back while the scroll takes over, the text fades. Reduced motion: the text only.
 *
 * Only on the desk: once the camera has settled over it (the tilt's end) and before the lid starts to open on its own.
 */
import { BEATS, pAtFrame, type ShotBeats } from "@/three/sand/story-timeline";

export const INVITE = {
  /** seconds without scrolling before the tease begins */
  teaseAfter: 1.5,
  /** seconds without scrolling before the text shows */
  cueAfter: 3,
  /** the lid's lift at the tease's peak (degrees on top of the scroll's own angle) */
  lidDeg: 6,
  /** the camera's lean at the peak: metres along the way the scroll goes on, toward the screen */
  leanM: 0.035,
  /** the tease's spring (critically damped, 1/s): in slowly (~1.2 s), back quickly (most of the way in ~0.5 s) once scrolling starts */
  rise: 4,
  fall: 9,
} as const;

/** The last frame of the shot with the lid still shut (the frame before it first moves). */
export function lidStartFrame(lidDeg: readonly number[]): number {
  const i = lidDeg.findIndex((d) => d > 0);
  return i <= 0 ? Math.max(i, 0) : i - 1;
}

/** The desk window (screens of story): from the tilt's end, the camera settled over the desk, until the lid starts to
 *  open with the scroll. */
export function deskWindow(lidDeg: readonly number[], beats: ShotBeats): [number, number] {
  return [BEATS.tilt[1], pAtFrame(lidStartFrame(lidDeg), beats)];
}

export const inWindow = (p: number, [a, b]: readonly [number, number]) => p >= a && p <= b;

/** A critically damped spring's state, stepped in place toward `to` (exact, so any frame time is stable). */
interface Spring { x: number; v: number }
function spring(s: Spring, to: number, w: number, dt: number): void {
  const d = s.x - to, e = Math.exp(-w * dt), c = s.v + w * d;
  s.x = to + (d + c * dt) * e;
  s.v = (s.v - w * c * dt) * e;
}

/** Steps a tease spring toward `want` (0 or 1): in at `rise`, back at `fall`; settled exactly at 0, kept within 0..1. */
function ease01(s: Spring, want: number, dt: number): void {
  spring(s, want, want > s.x ? INVITE.rise : INVITE.fall, dt);
  if (s.x < 1e-4 && want === 0) { s.x = 0; s.v = 0; }
  s.x = Math.min(Math.max(s.x, 0), 1);
}

/**
 * The idle clock, the lid's tease and the camera's lean (each 0..1 of its peak), and the cue. Once a frame: `step()`,
 * then `leanStep()` with how far the shot's path moved on. `poke()` on every scroll. Everything is written into the
 * object's own fields (no allocation per frame).
 */
export class DeskInvite {
  idle = 0;
  /** 0..1: the lid's lift */
  tease = 0;
  /** 0..1: the camera's lean */
  lean = 0;
  /** the "Keep scrolling" text is on */
  cue = false;
  private lid: Spring = { x: 0, v: 0 };
  /** the lean's own spring, running free; the lean itself can be held above it (below) */
  private cam: Spring = { x: 0, v: 0 };
  private want = 0;
  private reduced = false;
  /** scrolling down, the lean is held: it gives way only as fast as the path moves past it, never below the spring */
  private holding = false;
  /** a note was hovered this frame: a held lean eases back */
  private hovered = false;

  /** The visitor scrolled: the clock starts again, the tease eases back, the text goes. */
  poke(): void {
    this.idle = 0;
  }

  /**
   * `live`: on the desk (in its window) and nothing else in the way (a note's story, the snap, the loader). `hover`: a
   * note (or the drive) under the pointer: activity, so the note doesn't slide under it. `veil`: the reduced-motion
   * crossfade's black (0..1): the text stays off while it's up.
   */
  step(dt: number, live: boolean, reduced: boolean, hover = false, veil = 0): void {
    if (hover) this.idle = 0;
    this.hovered = hover;
    this.idle = live ? this.idle + dt : 0;
    this.reduced = reduced;
    this.want = live && !reduced && this.idle >= INVITE.teaseAfter ? 1 : 0;
    if (reduced) { this.lid.x = this.lid.v = 0; }
    else ease01(this.lid, this.want, dt);
    this.tease = this.lid.x;
    this.cue = live && this.idle >= INVITE.cueAfter && veil < 0.05;
  }

  /**
   * The lean, after `step()`. `forward`: how far the shot's path moved on this frame toward the screen, in shares of the
   * lean's peak (negative scrolling back). Scrolling down, the lean gives way only as fast as the path moves past it, so
   * the camera never steps back on a small forward scroll; it holds there until the tease returns, or a scroll back up
   * or a hovered note lets it ease back.
   */
  leanStep(dt: number, forward: number): void {
    if (this.reduced) { this.cam.x = this.cam.v = 0; this.lean = 0; this.holding = false; return; }
    // let go of a held lean: its spring takes over from there, at rest (eased, never cut)
    if (this.holding && (forward < 0 || this.hovered || this.want === 1)) {
      this.holding = false;
      this.cam.x = this.lean; this.cam.v = 0;
    }
    ease01(this.cam, this.want, dt);
    if (forward > 0 && this.want === 0) this.holding = true;
    if (this.holding) {
      this.lean = Math.max(this.lean - forward, this.cam.x);
      if (this.lean <= this.cam.x) this.holding = false;   // (used up: the spring has it)
    } else this.lean = this.cam.x;
  }
}

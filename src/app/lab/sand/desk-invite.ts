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

/** One step of a critically damped spring from (x, v) toward `to` (exact, so any frame time is stable). */
function spring(x: number, v: number, to: number, w: number, dt: number): [number, number] {
  const d = x - to, e = Math.exp(-w * dt), c = v + w * d;
  return [to + (d + c * dt) * e, (v - w * c * dt) * e];
}

export interface InviteFrame {
  /** 0..1: the lid's lift and the camera's lean, as a share of their peak */
  tease: number;
  /** the "Keep scrolling" text is on */
  cue: boolean;
}

/** The idle clock and the tease's spring. `poke()` on every scroll; `step()` once a frame. */
export class DeskInvite {
  idle = 0;
  tease = 0;
  private vel = 0;

  /** The visitor scrolled: the clock starts again, the tease eases back, the text goes. */
  poke(): void {
    this.idle = 0;
  }

  /** `live`: on the desk (in its window) and nothing else in the way (a note's story, the snap, the loader). */
  step(dt: number, { live, reduced }: { live: boolean; reduced: boolean }): InviteFrame {
    this.idle = live ? this.idle + dt : 0;
    const want = live && !reduced && this.idle >= INVITE.teaseAfter ? 1 : 0;
    if (reduced) { this.tease = 0; this.vel = 0; }
    else {
      [this.tease, this.vel] = spring(this.tease, this.vel, want, want > this.tease ? INVITE.rise : INVITE.fall, dt);
      if (this.tease < 1e-4 && want === 0) { this.tease = 0; this.vel = 0; }
      this.tease = Math.min(Math.max(this.tease, 0), 1);
    }
    return { tease: this.tease, cue: live && this.idle >= INVITE.cueAfter };
  }
}

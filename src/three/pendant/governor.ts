// src/three/pendant/governor.ts
/**
 * The pendant's sharpness follows the frame time, both ways (plan Task 10; the site's governor pattern, quality.ts): under
 * load the pixel ratio steps down in 0.25 steps to its floor (1.5: a laptop never goes soft or blocky), and steps back up
 * once frames have been good for a while. Measured on Liam's M1 Pro at 1440 x 900 the pendant costs about 8 ms of GPU a
 * frame at 2x and about 5.6 ms at 1.5x (scripts/about/pendant-perf.cjs), so 1.5x is where it fits the 6 ms budget.
 *
 * Why not quality.ts's thresholds alone: a display caps the frame rate (16.7 ms at 60 Hz), so a frame time can't show
 * headroom there; waiting for frames "faster than 12.5 ms" would leave a 60 Hz screen at its floor for good after one busy
 * moment. Here a step up only needs frames at the display's pace for UP_AFTER, and if that step makes frames slow again the
 * wait before the next try doubles (to BACKOFF_MAX): no pumping between two ratios, never stuck low.
 */
export interface PendantGovernorOptions {
  /** Frames are ignored for this long after the start (loading, shader compiles), ms. */
  warmupMs?: number;
  /** The measuring window, ms. */
  windowMs?: number;
  /** A window averaging above this is slow: one step down, ms. */
  slowMs?: number;
  /** A window averaging at or under this is good (the display's pace at 60 Hz and up), ms. */
  goodMs?: number;
  /** Good frames needed before a step up, ms (doubled after a step up that had to come back down). */
  upAfterMs?: number;
  /** The longest that wait grows to, ms. */
  backoffMaxMs?: number;
  /** A step up that comes back down within this long was a failed try, ms. */
  failWithinMs?: number;
  /** A frame longer than this is a stall (a tab switch, an upload), not a measure of the device, ms. */
  stallMs?: number;
  /** After a change, ignore frames for this long so it settles, ms. */
  cooldownMs?: number;
}

/** The lowest pixel ratio the governor steps down to (a screen sharper than this; a lower one is left as it is). */
export const PR_FLOOR = 1.5;
export const PR_STEP = 0.25;

export class PendantGovernor {
  private readonly o: Required<PendantGovernorOptions>;
  private max: number;
  private pr: number;
  private sinceStart = 0;
  private cooldown = 0;
  private samples = 0;
  private elapsed = 0;
  /** Good time since the last change (or the last slow window). */
  private good = 0;
  private upAfter: number;
  /** Time since the last step up (Infinity: none yet). */
  private sinceUp = Infinity;

  /** `maxPr`: the screen's own pixel ratio (clamped as the scene clamps it). */
  constructor(maxPr: number, opts: PendantGovernorOptions = {}) {
    this.o = {
      warmupMs: 2500, windowMs: 1000, slowMs: 19, goodMs: 17.5, upAfterMs: 3000, backoffMaxMs: 30_000, failWithinMs: 5000,
      stallMs: 250, cooldownMs: 700, ...opts,
    };
    this.max = maxPr;
    this.pr = maxPr;
    this.upAfter = this.o.upAfterMs;
  }

  /** The pixel ratio to draw at. */
  get pixelRatio(): number {
    return this.pr;
  }

  /** The lowest it goes on this screen. */
  get floor(): number {
    return Math.min(this.max, PR_FLOOR);
  }

  /** The screen's pixel ratio changed (a move to another screen, a zoom): start from it again. */
  setMax(maxPr: number): void {
    if (maxPr === this.max) return;
    this.max = maxPr;
    this.pr = maxPr;
    this.good = 0;
    this.cooldown = this.o.cooldownMs;
    this.upAfter = this.o.upAfterMs;
  }

  /** One frame's time (ms). Returns the new pixel ratio when it changes, else null. */
  sample(frameMs: number): number | null {
    if (!(frameMs >= 0) || frameMs > this.o.stallMs) return null;
    this.sinceStart += frameMs;
    this.sinceUp += frameMs;
    if (this.sinceStart < this.o.warmupMs) return null;
    if (this.cooldown > 0) {
      this.cooldown -= frameMs;
      return null;
    }
    this.samples += 1;
    this.elapsed += frameMs;
    if (this.elapsed < this.o.windowMs) return null;
    const average = this.elapsed / this.samples;
    const span = this.elapsed;
    this.samples = 0;
    this.elapsed = 0;
    const was = this.pr;
    if (average > this.o.slowMs) {
      this.good = 0;
      if (this.pr > this.floor) {
        this.pr = Math.max(this.floor, this.pr - PR_STEP);
        // a step up that had to come back down: wait longer before the next try
        // (a slow spell long after the last step up is new load, not a failed try: the wait starts over)
        this.upAfter = this.sinceUp < this.o.failWithinMs ? Math.min(this.o.backoffMaxMs, this.upAfter * 2) : this.o.upAfterMs;
      }
    } else if (average <= this.o.goodMs) {
      this.good += span;
      if (this.pr < this.max && this.good >= this.upAfter) {
        this.pr = Math.min(this.max, this.pr + PR_STEP);
        this.sinceUp = 0;
      }
    } else {
      this.good = 0; // (between good and slow: hold, and start the good count again)
    }
    if (this.pr === was) return null;
    this.good = 0;
    this.cooldown = this.o.cooldownMs;
    return this.pr;
  }
}

// src/three/pendant/governor.ts
/**
 * The pendant's quality follows the frame time, both ways (plan Task 10; the site's governor pattern, quality.ts). It walks a
 * ladder of levels: the pixel ratio in 0.25 steps from the screen's own down to 1.5 (a laptop never goes soft or blocky),
 * then, at 1.5, the depth of field drawn at half resolution (bokeh.ts). Under load one step down a window; once frames have
 * been good for a while, one step back up, in the opposite order (the bokeh back to full first, then the sharpness). A
 * screen at 1.5x or less has the bokeh step only. Measured on Liam's M1 Pro at 1440 x 900 the pendant costs about 7.6 ms of
 * GPU a frame at 2x and about 5.7 ms at 1.5x (scripts/about/pendant-perf.cjs).
 *
 * Load is read against one base frame interval, fixed once the warm-up ends: the display's pace as the mount probed it
 * while the scene loaded (setBase), else the warm-up's median, and never under 1000 / 60 ms, so a screen faster than 60 Hz
 * (Liam's 120 Hz ProMotion) never costs sharpness: 2x at 9 ms frames there is fine. Slow is above SLOW x base, good at or
 * under GOOD x base, and between them it holds (the hysteresis band).
 *
 * A step down has to earn its keep: the first full window after it is compared with the window that caused it, and if it
 * isn't meaningfully faster (NO_GAIN), the bottom level is tried once (on a vsync-capped screen one step may not get a frame
 * under the next vsync where two do: 2x and 1.75x both at 30 fps, 1.5x at 60). If the bottom helps it stays, and the usual
 * step up climbs back to the highest level that holds; if not, the slowness isn't the pendant's (a 30 fps cap, a throttled
 * tab, a busy page), so the step is undone and the next step down waits, a wait that doubles each time (to DOWN_WAIT_MAX). A step that helps stays,
 * and while frames are still slow it keeps stepping. A step up needs good frames for UP_AFTER, and a climb that brings slow
 * frames back within FAIL_WITHIN doubles that wait (to BACKOFF_MAX): no pumping, never stuck low. `resume()` after a pause
 * (a hidden tab, About scrolled away) starts its measuring afresh, and returns any step still being judged.
 */
export interface PendantGovernorOptions {
  /** Frames are ignored for this long after the start (loading, shader compiles), ms. */
  warmupMs?: number;
  /** How many of the warm-up's last intervals make the base when no base was given. */
  baseFrames?: number;
  /** The base is never under this, ms (60 Hz). */
  baseMinMs?: number;
  /** The measuring window, ms. */
  windowMs?: number;
  /** A window averaging above this times the base is slow: one step down. */
  slowRatio?: number;
  /** A window averaging at or under this times the base is good. */
  goodRatio?: number;
  /** After a step down, a window at or above this share of the one before it is no gain: the step is undone. */
  noGainRatio?: number;
  /** The wait before the next step down after an undone one, ms, and the most it doubles to. */
  downWaitMs?: number;
  downWaitMaxMs?: number;
  /** Good frames needed before a step up, ms (doubled after a climb that had to come back down), and the most it grows to. */
  upAfterMs?: number;
  backoffMaxMs?: number;
  /** A pause longer than this (ms) starts the step-down wait over on resume; a shorter one keeps it (a quick scroll past
   *  About and back is the same device in the same state). */
  pauseResetMs?: number;
  /** A climb that brings slow frames back within this long was a failed try, ms. */
  failWithinMs?: number;
  /** A frame longer than this is a stall (a tab switch, an upload), not a measure of the device, ms. */
  stallMs?: number;
  /** After a change, ignore frames for this long so it settles, ms. */
  cooldownMs?: number;
}

/** The lowest pixel ratio the governor steps down to (a screen sharper than this; a lower one keeps its own). */
export const PR_FLOOR = 1.5;
export const PR_STEP = 0.25;

export interface PendantLevel {
  pr: number;
  /** The depth of field at half resolution. */
  bokehHalf: boolean;
}

/** The levels for a screen whose own pixel ratio is `max`, sharpest first. */
export function ladder(max: number): PendantLevel[] {
  const floor = Math.min(max, PR_FLOOR);
  const out: PendantLevel[] = [{ pr: max, bokehHalf: false }];
  for (let pr = max; pr > floor;) {
    pr = Math.max(floor, pr - PR_STEP);
    out.push({ pr, bokehHalf: false });
  }
  out.push({ pr: floor, bokehHalf: true });
  return out;
}

const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export class PendantGovernor {
  private readonly o: Required<PendantGovernorOptions>;
  private levels: PendantLevel[];
  private at = 0;
  private sinceStart = 0;
  private cooldown = 0;
  private samples = 0;
  private elapsed = 0;
  /** Good time since the last change (or the last window that wasn't good). */
  private good = 0;
  private upAfter: number;
  /** Time since the last step up (Infinity: none yet). */
  private sinceUp = Infinity;
  /** The step down being judged: the window average that caused it, the level it left, and whether this is already the
   *  try at the bottom (null: none pending). */
  private pending: { before: number; from: number; bottom: boolean } | null = null;
  /** The next step down waits this long more, ms; and the wait after the next undone step. */
  private downBlocked = 0;
  private downWait: number;
  private probed: number | null = null;
  private baseMs: number | null = null;
  private readonly warm: number[] = [];

  /** `maxPr`: the screen's own pixel ratio (clamped as the scene clamps it). */
  constructor(maxPr: number, opts: PendantGovernorOptions = {}) {
    this.o = {
      warmupMs: 2500, baseFrames: 30, baseMinMs: 1000 / 60, windowMs: 1000, slowRatio: 1.15, goodRatio: 1.05, noGainRatio: 0.95,
      downWaitMs: 5000, downWaitMaxMs: 60_000, upAfterMs: 3000, backoffMaxMs: 60_000, pauseResetMs: 30_000, failWithinMs: 5000, stallMs: 250,
      cooldownMs: 700, ...opts,
    };
    this.levels = ladder(maxPr);
    this.upAfter = this.o.upAfterMs;
    this.downWait = this.o.downWaitMs;
  }

  /** The level to draw at. */
  get level(): PendantLevel {
    return this.levels[this.at];
  }

  get pixelRatio(): number {
    return this.level.pr;
  }

  get bokehHalf(): boolean {
    return this.level.bokehHalf;
  }

  /** The lowest pixel ratio it goes to on this screen. */
  get floor(): number {
    return this.levels[this.levels.length - 1].pr;
  }

  /** The frame interval load is read against (ms), or null until the warm-up has ended. */
  get base(): number | null {
    return this.baseMs;
  }

  /** The screen's frame interval, probed before the pendant drew (ms). Ignored once the base is fixed, or if not sane. */
  setBase(ms: number): void {
    if (this.baseMs !== null || !(ms > 0 && ms <= this.o.stallMs)) return;
    this.probed = ms;
  }

  /** The screen's pixel ratio changed (a move to another screen, a zoom): start from its own ladder again. */
  setMax(maxPr: number): void {
    if (maxPr === this.levels[0].pr) return;
    this.levels = ladder(maxPr);
    this.at = 0;
    this.pending = null; // (its levels were the old ladder's)
    this.resume();
    this.upAfter = this.o.upAfterMs;
    this.downWait = this.o.downWaitMs;
    this.downBlocked = 0;
  }

  /** After a pause (the loop stopped: a hidden tab, About off screen) of `pausedMs`: the partial window and the good run
   *  are dropped, a step still being judged is returned (untested, it goes back to the level it left), and it settles for a
   *  cooldown. The step-down wait starts over only after a pause longer than pauseResetMs (conditions may have changed);
   *  after a short one it is kept, as is what is left of it. The pause itself never counts (only sampled frames move its
   *  clocks). Without `pausedMs` the pause counts as long. Returns the new level if that changed it, else null. */
  resume(pausedMs = Infinity): PendantLevel | null {
    const was = this.at;
    if (this.pending) this.at = this.pending.from;
    this.pending = null;
    this.samples = 0;
    this.elapsed = 0;
    this.good = 0;
    if (pausedMs > this.o.pauseResetMs) {
      this.downWait = this.o.downWaitMs;
      this.downBlocked = Math.min(this.downBlocked, this.o.downWaitMs);
    }
    this.cooldown = this.o.cooldownMs;
    return this.at === was ? null : this.level;
  }

  /** One frame's time (ms). Returns the new level when it changes, else null. */
  sample(frameMs: number): PendantLevel | null {
    if (!(frameMs >= 0) || frameMs > this.o.stallMs) return null;
    this.sinceStart += frameMs;
    this.sinceUp += frameMs;
    this.downBlocked = Math.max(0, this.downBlocked - frameMs);
    if (this.sinceStart < this.o.warmupMs) {
      this.warm.push(frameMs);
      if (this.warm.length > this.o.baseFrames) this.warm.shift();
      return null;
    }
    if (this.baseMs === null) {
      const measured = this.probed ?? (this.warm.length ? median(this.warm) : this.o.baseMinMs);
      this.baseMs = Math.max(measured, this.o.baseMinMs);
    }
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
    const was = this.at;
    const slow = average > this.o.slowRatio * this.baseMs;

    if (this.pending) {
      const { before, from, bottom } = this.pending;
      this.pending = null;
      const last = this.levels.length - 1;
      if (average >= this.o.noGainRatio * before && !bottom && this.at < last) {
        // no gain from one step: maybe one step can't get a frame under the next vsync where more would. Try the bottom
        // once, judged against the same window.
        this.at = last;
        this.pending = { before, from, bottom: true };
        return this.changed(was);
      }
      if (average >= this.o.noGainRatio * before) {
        // the step down didn't help, nor the bottom: not the pendant's slowness. Undo it, and wait longer before the next
        // step down.
        this.at = from;
        this.downBlocked = this.downWait;
        this.downWait = Math.min(this.o.downWaitMaxMs, this.downWait * 2);
        return this.changed(was);
      }
      this.downWait = this.o.downWaitMs; // (it helped: the pendant's own load, read rightly)
    }

    if (slow) {
      this.good = 0;
      if (this.at < this.levels.length - 1 && this.downBlocked <= 0) {
        // a climb that brought slow frames straight back: wait longer before the next one
        this.upAfter = this.sinceUp < this.o.failWithinMs ? Math.min(this.o.backoffMaxMs, this.upAfter * 2) : this.o.upAfterMs;
        this.pending = { before: average, from: this.at, bottom: false };
        this.at += 1;
      }
    } else if (average <= this.o.goodRatio * this.baseMs) {
      this.good += span;
      if (this.at > 0 && this.good >= this.upAfter) {
        this.at -= 1;
        this.sinceUp = 0;
      }
    } else {
      this.good = 0; // (between good and slow: hold, and start the good count again)
    }
    return this.changed(was);
  }

  private changed(was: number): PendantLevel | null {
    if (this.at === was) return null;
    this.good = 0;
    this.cooldown = this.o.cooldownMs;
    return this.level;
  }
}

// src/three/pendant/governor.ts
/**
 * The pendant's quality follows the frame time, both ways (plan Task 10; the site's governor pattern, quality.ts). It walks a
 * ladder of levels: the pixel ratio in 0.25 steps from the screen's own down to 1.5 (a laptop never goes soft or blocky),
 * then, at 1.5, the depth of field drawn at half resolution (bokeh.ts: the in-focus pendant stays full resolution). Under
 * load one step down a window; once frames have been good for a while, one step back up, in the opposite order (the bokeh
 * back to full first, then the sharpness). A screen at 1.5x or less has the bokeh step only.
 * Measured on Liam's M1 Pro at 1440 x 900 the pendant costs about 8 ms of GPU a frame at 2x and about 5.7 ms at 1.5x
 * (scripts/about/pendant-perf.cjs).
 *
 * Load is read against the screen's own pace, not fixed thresholds: a 30 fps cap (Low Power Mode, an energy saver, a
 * headless browser) or a 50 Hz display isn't load. The base frame interval is measured before the pendant costs anything
 * (the mount probes the display while the scene loads: setBase), else as the median of the warm-up's last BASE_FRAMES
 * intervals; slow is above SLOW x base, good at or under GOOD x base, and between them it holds (the hysteresis band).
 * A step up only needs good frames for UP_AFTER, and if that step makes frames slow again the wait before the next try
 * doubles (to BACKOFF_MAX): no pumping between two levels, never stuck low.
 *
 * A slowdown the pendant doesn't cause isn't load it can shed: if it has stepped all the way down and frames are no faster
 * than when it started stepping (a 30 fps cap switched on mid-session, a busy page), that pace becomes the new base and it
 * climbs back, so a capped screen doesn't keep the pendant at its lowest for nothing. Frames clearly faster than the base
 * bring the base back down (the cap switched off).
 */
export interface PendantGovernorOptions {
  /** Frames are ignored for this long after the start (loading, shader compiles), ms. */
  warmupMs?: number;
  /** How many of the warm-up's last intervals make the base when no base was given. */
  baseFrames?: number;
  /** The measuring window, ms. */
  windowMs?: number;
  /** A window averaging above this times the base is slow: one step down. */
  slowRatio?: number;
  /** A window averaging at or under this times the base is good. */
  goodRatio?: number;
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
  private baseMs: number | null = null;
  private baseGiven = false;
  /** The slowest window of the current descent (null when not descending). */
  private descentFrom: number | null = null;
  /** The base before a re-base, until the climb back has shown the re-base right (null: none pending). */
  private baseBefore: number | null = null;
  /** No faster than this share of that window, at the bottom of the ladder, is "stepping down didn't help". */
  private static readonly NO_HELP = 0.9;
  private readonly warm: number[] = [];

  /** `maxPr`: the screen's own pixel ratio (clamped as the scene clamps it). */
  constructor(maxPr: number, opts: PendantGovernorOptions = {}) {
    this.o = {
      warmupMs: 2500, baseFrames: 30, windowMs: 1000, slowRatio: 1.15, goodRatio: 1.05, upAfterMs: 3000, backoffMaxMs: 30_000,
      failWithinMs: 5000, stallMs: 250, cooldownMs: 700, ...opts,
    };
    this.levels = ladder(maxPr);
    this.upAfter = this.o.upAfterMs;
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

  /** The screen's frame interval load is read against (ms), or null until it is known. */
  get base(): number | null {
    return this.baseMs;
  }

  /** The screen's frame interval, measured before the pendant drew (ms). Ignored if not a sane interval. */
  setBase(ms: number): void {
    if (!(ms > 0 && ms <= this.o.stallMs)) return;
    this.baseMs = ms;
    this.baseGiven = true;
  }

  /** The screen's pixel ratio changed (a move to another screen, a zoom): start from it again (the base stays: the same
   *  display pace until shown otherwise). */
  setMax(maxPr: number): void {
    if (maxPr === this.levels[0].pr) return;
    this.levels = ladder(maxPr);
    this.at = 0;
    this.good = 0;
    this.cooldown = this.o.cooldownMs;
    this.upAfter = this.o.upAfterMs;
  }

  /** One frame's time (ms). Returns the new level when it changes, else null. */
  sample(frameMs: number): PendantLevel | null {
    if (!(frameMs >= 0) || frameMs > this.o.stallMs) return null;
    this.sinceStart += frameMs;
    this.sinceUp += frameMs;
    if (this.sinceStart < this.o.warmupMs) {
      if (!this.baseGiven) {
        this.warm.push(frameMs);
        if (this.warm.length > this.o.baseFrames) this.warm.shift();
      }
      return null;
    }
    if (this.baseMs === null) {
      if (this.warm.length === 0) return null;
      this.baseMs = median(this.warm);
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
    if (average > this.o.slowRatio * this.baseMs) {
      this.good = 0;
      this.descentFrom = Math.max(this.descentFrom ?? 0, average); // (the slowest window of the descent)
      if (this.at === this.levels.length - 1 && average >= PendantGovernor.NO_HELP * this.descentFrom) {
        // stepped all the way down and frames are no faster: not the pendant's load. This is the screen's pace now.
        this.baseBefore = this.baseMs;
        this.baseMs = average;
        this.descentFrom = null;
        this.upAfter = this.o.upAfterMs;
      } else if (this.at < this.levels.length - 1) {
        // a failed climb right after a re-base: the re-base was wrong (the window it judged by was part good frames), so
        // the pendant's load is real after all; the old base comes back
        if (this.baseBefore !== null && this.sinceUp < this.o.failWithinMs) {
          this.baseMs = this.baseBefore;
          this.baseBefore = null;
        }
        this.at += 1;
        // a step up that had to come back down: wait longer before the next try (a slow spell long after the last step up
        // is new load, not a failed try: the wait starts over)
        this.upAfter = this.sinceUp < this.o.failWithinMs ? Math.min(this.o.backoffMaxMs, this.upAfter * 2) : this.o.upAfterMs;
      }
    } else if (average <= this.o.goodRatio * this.baseMs) {
      this.descentFrom = null;
      // clearly faster than the base: the screen's pace is back up (a cap switched off), so load is read against it again
      if (average * this.o.slowRatio < this.baseMs) this.baseMs = average;
      this.good += span;
      if (this.at > 0 && this.good >= this.upAfter) {
        this.at -= 1;
        this.sinceUp = 0;
      }
      if (this.at === 0 && this.sinceUp >= this.o.failWithinMs) this.baseBefore = null; // (back at the top on the new base, and it held)
    } else {
      this.good = 0; // (between good and slow: hold, and start the good count again)
    }
    if (this.at === was) return null;
    this.good = 0;
    this.cooldown = this.o.cooldownMs;
    return this.level;
  }
}

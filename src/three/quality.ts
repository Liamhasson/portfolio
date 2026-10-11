import type { QualityTier } from "./tier";

const ORDER: readonly QualityTier[] = ["high", "mid", "low"];

export interface GovernorOptions {
  /** Length of the measuring window, ms. */
  windowMs?: number;
  /** Average frame time above this over a window means the device is struggling, ms. */
  slowFrameMs?: number;
  /** After a drop, ignore frames for this long so the new tier can settle, ms. */
  cooldownMs?: number;
}

/**
 * Feeds on frame durations and steps quality down one tier at a time when the average over a window is slow.
 * It never steps back up (that would oscillate). Returns the new tier when it changes, otherwise null.
 */
export class QualityGovernor {
  private samples = 0;
  private elapsed = 0;
  private cooldown = 0;
  private readonly windowMs: number;
  private readonly slowFrameMs: number;
  private readonly cooldownMs: number;

  constructor(
    private tier: QualityTier,
    { windowMs = 2000, slowFrameMs = 24, cooldownMs = 3000 }: GovernorOptions = {},
  ) {
    this.windowMs = windowMs;
    this.slowFrameMs = slowFrameMs;
    this.cooldownMs = cooldownMs;
  }

  sample(frameMs: number): QualityTier | null {
    if (this.cooldown > 0) {
      this.cooldown -= frameMs;
      return null;
    }
    this.samples += 1;
    this.elapsed += frameMs;
    if (this.elapsed < this.windowMs) return null;

    const average = this.elapsed / this.samples;
    this.samples = 0;
    this.elapsed = 0;
    if (average <= this.slowFrameMs) return null;

    const i = ORDER.indexOf(this.tier);
    if (i >= ORDER.length - 1) return null;
    this.tier = ORDER[i + 1];
    this.cooldown = this.cooldownMs;
    return this.tier;
  }
}

export interface GrainGovernorOptions {
  /** Frames are ignored for this long after the start (loading, shader compiles), ms. */
  warmupMs?: number;
  /** The measuring window, ms. */
  windowMs?: number;
  /** Average frame above this: fewer grains; below `fastMs`: more (between them nothing changes), ms. */
  slowMs?: number;
  fastMs?: number;
  /** A frame longer than this is a stall (a tab switch, an upload), not a measure of the device, ms. */
  stallMs?: number;
  /** After a change, ignore frames for this long so the new count settles, ms. */
  cooldownMs?: number;
}

/**
 * The sand's grain count follows the frame time (Liam, 2026-10-11: "high resolution and reactive"): the count is what
 * costs (each grain's light is marched through the sand), the pixel ratio barely does, so the picture stays sharp and
 * the count moves, both ways, between `min` and `max` (the most the device loaded). The start and stalls never count.
 * `starved`: at the floor and still slow (the stage may then lower the resolution, the last resort).
 */
export class GrainGovernor {
  private samples = 0;
  private elapsed = 0;
  private sinceStart = 0;
  private cooldown = 0;
  starved = false;
  private readonly o: Required<GrainGovernorOptions>;

  constructor(private readonly min: number, private readonly max: number, private count: number, opts: GrainGovernorOptions = {}) {
    this.o = { warmupMs: 2500, windowMs: 1000, slowMs: 19, fastMs: 12.5, stallMs: 250, cooldownMs: 700, ...opts };
    this.count = Math.min(Math.max(count, min), max);
  }

  get grains(): number {
    return this.count;
  }

  sample(frameMs: number): number | null {
    if (frameMs > this.o.stallMs) return null;
    this.sinceStart += frameMs;
    if (this.sinceStart < this.o.warmupMs) return null;
    if (this.cooldown > 0) {
      this.cooldown -= frameMs;
      return null;
    }
    this.samples += 1;
    this.elapsed += frameMs;
    if (this.elapsed < this.o.windowMs) return null;
    const average = this.elapsed / this.samples;
    this.samples = 0;
    this.elapsed = 0;
    let next = this.count;
    if (average > this.o.slowMs) next = Math.max(this.min, Math.round(this.count * 0.82));
    else if (average < this.o.fastMs) next = Math.min(this.max, Math.round(this.count * 1.12));
    this.starved = average > this.o.slowMs && this.count === this.min;
    if (next === this.count) return null;
    this.count = next;
    this.cooldown = this.o.cooldownMs;
    return next;
  }
}

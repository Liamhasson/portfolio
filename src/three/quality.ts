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

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

export interface Lever { min: number; max: number; start: number }

/**
 * The picture follows the frame time (Liam, 2026-10-11: "high resolution and reactive"), on two levers, both ways:
 * the grain count first (the count is what costs: each grain's light is marched through the sand), then the sharpness
 * (the pixel ratio, in 0.25 steps, never below its floor: a laptop never goes pixelated). Back up in the other order:
 * sharpness, then grains. The start and stalls never count. `starved`: both at their floors and still slow.
 */
export class GrainGovernor {
  private samples = 0;
  private elapsed = 0;
  private sinceStart = 0;
  private cooldown = 0;
  starved = false;
  private count: number;
  private pr: number;
  private readonly o: Required<GrainGovernorOptions>;

  constructor(private readonly g: Lever, private readonly p: Lever, opts: GrainGovernorOptions = {}) {
    this.o = { warmupMs: 2500, windowMs: 1000, slowMs: 19, fastMs: 12.5, stallMs: 250, cooldownMs: 700, ...opts };
    this.count = Math.min(Math.max(g.start, g.min), g.max);
    this.pr = Math.min(Math.max(p.start, p.min), p.max);
  }

  get grains(): number {
    return this.count;
  }

  get pixelRatio(): number {
    return this.pr;
  }

  sample(frameMs: number): { grains: number; pixelRatio: number } | null {
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
    const [c0, p0] = [this.count, this.pr];
    if (average > this.o.slowMs) {
      if (this.count > this.g.min) this.count = Math.max(this.g.min, Math.round(this.count * 0.82));
      else if (this.pr > this.p.min) this.pr = Math.max(this.p.min, this.pr - 0.25);
    } else if (average < this.o.fastMs) {
      if (this.pr < this.p.max) this.pr = Math.min(this.p.max, this.pr + 0.25);
      else if (this.count < this.g.max) this.count = Math.min(this.g.max, Math.round(this.count * 1.12));
    }
    this.starved = average > this.o.slowMs && this.count === this.g.min && this.pr === this.p.min;
    if (this.count === c0 && this.pr === p0) return null;
    this.cooldown = this.o.cooldownMs;
    return { grains: this.count, pixelRatio: this.pr };
  }
}

// src/app/about/testimonials-q.ts
/**
 * The testimonials' scrub, pure. `q` (0..1) says how far the edge light is on: it rises as Yoav's quote's centre moves from
 * 105% to 65% of the screen, and falls as Andrada's centre moves from 35% to −5%, eased sine-in (the mockup's quoteFrame).
 * Centres and size are in one axis: widths on desktop, heights in the stack. The arrival pulse is one wave, started the
 * moment q first passes PULSE_Q on the way up and read back as a 0..1 phase over PULSE_MS.
 */
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const fit = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
const sineIn = (t: number) => 1 - Math.cos((t * Math.PI) / 2);

/** q passing this on the way up starts the arrival pulse. */
export const PULSE_Q = 0.02;
/** The arrival pulse runs this long, ms. */
export const PULSE_MS = 2000;

/** q from the two quotes' centres (Yoav c0, Andrada c1) along an axis of `size`. */
export function testimonialsQ(c0: number, c1: number, size: number): number {
  return sineIn(fit(size * 1.05 - c0, 0, size * 0.4) * (1 - fit(size * 0.35 - c1, 0, size * 0.4)));
}

/** `at`: when the wave started (performance.now ms), null for none yet; `on`: q was past PULSE_Q on the last step. */
export type Pulse = { at: number | null; on: boolean };

/** One step: a new wave starts only as q rises past PULSE_Q (not on the way down, not while on, never when reduced). */
export function stepPulse(p: Pulse, q: number, now: number, reduced: boolean): Pulse {
  const on = q > PULSE_Q;
  return { at: on && !p.on && !reduced ? now : p.at, on };
}

/** The wave's progress: −1 for none, else 0..1 over PULSE_MS, then held at 1. */
export function pulsePhase(p: Pulse, now: number): number {
  return p.at === null ? -1 : clamp01((now - p.at) / PULSE_MS);
}

/** `armed`: q last rested (at or under PULSE_Q) on the arrival side, before Yoav, not past Andrada. */
export type Arrival = Pulse & { armed: boolean };

/**
 * The mount's pulse rule (plan Review Focus 3: the wave plays as q first crosses PULSE_Q going up, not on every jump):
 * stepPulse, but only for an arrival, from before Yoav (a jump past Andrada and back in, or a scroll up into Andrada from
 * the far side, is no arrival), and never over a wave still running (jitter round PULSE_Q doesn't restart it). `c0`:
 * Yoav's centre along an axis of `size`, as testimonialsQ takes it. Start with `armed: true` (a load straight into the
 * testimonials plays one wave).
 */
export function stepArrival(p: Arrival, q: number, c0: number, size: number, now: number, reduced: boolean): Arrival {
  const phase = pulsePhase(p, now);
  const running = phase >= 0 && phase < 1;
  const next = stepPulse(p, q, now, reduced || !p.armed || running);
  // (at rest the side decides: Yoav not yet fully in means before the testimonials; fully in with q at rest means past them)
  const armed = q <= PULSE_Q ? fit(size * 1.05 - c0, 0, size * 0.4) < 1 : p.armed;
  return { ...next, armed };
}

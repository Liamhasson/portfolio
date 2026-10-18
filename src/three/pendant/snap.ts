// src/three/pendant/snap.ts
/**
 * The snap (plan 2026-10-18-about-round3, Task 3; Liam: "it snaps into place quickly, in about 0.25 s, with a tiny overshoot
 * that settles, like snapping to a guide"): a damped spring on one axis. It is stepped with the spring's exact solution over
 * `dt`, so the path is the same at any frame rate (30, 60, 144 Hz or an uneven mix), and a long frame can't make it blow up.
 * Pure maths: no DOM, no clock.
 */

/** Damping ratio: the overshoot is exp(-ζπ / √(1 - ζ²)), about 2.8% here (under Liam's 4%). */
export const SNAP_ZETA = 0.75;
/** Natural frequency (rad/s): within 2% of the target, for good, about 0.25 s after the start. */
export const SNAP_OMEGA = 23;

/** Moves `s` (position and velocity) `dt` seconds along the spring toward `target`, in place. */
export function stepSnap(s: { x: number; v: number }, target: number, dt: number): void {
  if (!(dt > 0)) return;
  const a = SNAP_ZETA * SNAP_OMEGA;
  const wd = SNAP_OMEGA * Math.sqrt(1 - SNAP_ZETA * SNAP_ZETA);
  const e0 = s.x - target;
  const v0 = s.v;
  const k = Math.exp(-a * dt);
  const c = Math.cos(wd * dt);
  const sn = Math.sin(wd * dt);
  const b = (v0 + a * e0) / wd;
  // e(t) = e^{-at} (e0 cos ωd t + b sin ωd t), and its derivative
  s.x = target + k * (e0 * c + b * sn);
  s.v = k * ((b * wd - a * e0) * c - (e0 * wd + a * b) * sn);
}

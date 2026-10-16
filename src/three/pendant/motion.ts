// src/three/pendant/motion.ts
/**
 * The pendant's motion (spec 2026-10-16-about-pendant-design.md §4): it is never still. One pure step per frame turns the
 * shot's spin and tumble, the scroll's push, a lean into the motion, a face locked toward the camera, and Liam's hand into
 * the angles the mount applies. No DOM, no three.js: the numbers are the working prototype's (pendant-film-v3) `frame()`.
 * Units: `spin` and `tumble` in turns per second, `lock` in degrees (as the shots store it) or null; angles in radians.
 */
export interface MotionState {
  /** About its own axis. */
  yaw: number;
  /** End over end. */
  pitch: number;
  /** The lean into the scroll's motion. */
  tilt: number;
  /** The hand's spin, left over after a drag, fading. */
  handVel: number;
  /** The hand's end-over-end nudge, fading. */
  handPitch: number;
}

export interface MotionInput {
  /** Seconds since the last step. */
  dt: number;
  spin: number;
  tumble: number;
  lock: number | null;
  /** Scroll speed in track px per second. */
  scrollVel: number;
  dragging: boolean;
  /** Pointer movement since the last step, in px (only read while dragging). */
  dragDX: number;
  dragDY: number;
  /** Reduced motion: no spin, tumble, lean or scroll push; only the hand turns it. */
  reduced: boolean;
}

export const REST: MotionState = { yaw: 0, pitch: 0, tilt: 0, handVel: 0, handPitch: 0 };

const TAU = Math.PI * 2;
const D = Math.PI / 180;
/** Radians of yaw per px/s of scroll. */
const SCROLL_SPIN = 0.0016;
/** Lean per px/s of scroll, and its limit in radians. */
const LEAN = 0.00025;
const LEAN_MAX = 0.35;
/** Radians of yaw, and of hand momentum, per px of drag; pitch per px of vertical drag. */
const DRAG_YAW = 0.012;
const DRAG_VEL = 0.6;
const DRAG_PITCH = 0.004;
/** Radians per second of yaw for each unit of hand momentum. */
const HAND_COAST = 0.01;
/** What is left of a quantity after one second (frame-rate independent decay: base^dt). */
const HAND_DECAY = 0.05;
const HAND_PITCH_DECAY = 0.08;
const LEAN_EASE = 0.02;
const LOCK_EASE = 0.02;
const UPRIGHT_EASE = 0.03;
/** Below this many turns per second the pendant counts as not tumbling and rights itself. */
const TUMBLE_OFF = 0.02;

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

/** One frame. Returns a new state; the given one is not touched. */
export function stepMotion(s: MotionState, i: MotionInput): MotionState {
  const { dt, reduced, dragging } = i;
  const spin = reduced ? 0 : i.spin;
  const tumble = reduced ? 0 : i.tumble;
  const push = reduced ? 0 : i.scrollVel;

  // spin: the shot's own turn + the scroll's push + the hand's leftover momentum (which only coasts once let go)
  let yaw = s.yaw + (spin * TAU + push * SCROLL_SPIN + (dragging || reduced ? 0 : s.handVel * HAND_COAST)) * dt;
  let handVel = s.handVel * HAND_DECAY ** dt;
  let handPitch = s.handPitch * HAND_PITCH_DECAY ** dt;

  // a lock pulls the nearest equivalent angle of that face to the camera, unless a hand is on it
  if (i.lock !== null && !dragging) {
    const target = i.lock * D;
    const k = Math.round((yaw - target) / TAU);
    yaw += (target + k * TAU - yaw) * (1 - LOCK_EASE ** dt);
  }

  // end over end, and righting itself to the nearest whole turn once it stops
  let pitch = s.pitch + tumble * TAU * dt;
  if (tumble < TUMBLE_OFF) {
    const k = Math.round(pitch / TAU);
    pitch += (k * TAU - pitch) * (1 - UPRIGHT_EASE ** dt);
  }

  // it leans into the motion
  const lean = reduced ? 0 : clamp(i.scrollVel * LEAN, -LEAN_MAX, LEAN_MAX);
  const tilt = s.tilt + (lean - s.tilt) * (1 - LEAN_EASE ** dt);

  // the hand: turns it at once, and leaves momentum behind
  if (dragging) {
    yaw += i.dragDX * DRAG_YAW;
    handVel = i.dragDX * DRAG_VEL;
    handPitch += i.dragDY * DRAG_PITCH;
  }

  return { yaw, pitch, tilt, handVel, handPitch };
}

/** A slow, never-repeating drift in -1..1: three sines at unrelated rates (amplitudes sum to 1); `seed` shifts each phase. */
export function breath(t: number, seed: number): number {
  return 0.6 * Math.sin(0.73 * t + seed) + 0.3 * Math.sin(1.31 * t + 2.1 * seed) + 0.1 * Math.sin(2.17 * t + 3.7 * seed);
}

// src/app/about/glass-pointer.ts
/**
 * The glass ball under the cursor (About round 3, Task 5; Liam 2026-10-18 item 6): water rings spread across the glass from
 * the cursor, the pendant seen through it wobbling with them, and the outline leans a little toward the cursor, settling
 * back like liquid when it leaves. On a touch screen a tap sends one ring. Off under reduced motion.
 *
 * Two parts:
 *   - pure state (newPointer, sampleHover, tapAt, stepLean, packRipple): the rings (at most RIPPLE_MAX, each an origin and
 *     a start time), the cursor over the ball, and the lean (a damped spring). A ring starts as the cursor comes onto the
 *     ball, then every RIPPLE_EVERY while it moves over it, and on a tap; each is gone RIPPLE_LIFE after it starts.
 *   - the slot's listener (glassPointer): the pointer over the slot element (`[data-pendant=glass]`: in the page, so it gets
 *     the hover itself; the canvases above it take no pointer), turned into the ball's disc units (offset from the slot's
 *     centre over the ball's radius, BALL_OF_SLOT x the slot's width, y up). One per slot, shared by both balls (the
 *     pendant's and the light's own: each reads it on its own frame), so they ripple alike.
 * The shaders take what packRipple writes (field.ts GlassRipple, RIPPLE_GLSL).
 */
import { NO_RIPPLE, RIPPLE_LIFE, RIPPLE_MAX, rippleStrength, type GlassRipple } from "@/three/edge-light/field";

/** The ball's radius as a share of the slot's width (about-pendant.tsx GLASS_SLOT_R; the light's 0.44). */
export const BALL_OF_SLOT = 0.44;
/** While the cursor moves over the ball, a new ring at most this often (s). */
export const RIPPLE_EVERY = 0.5;
/** A move smaller than this (disc units) isn't a move: a resting cursor sends no more rings. */
const MOVE_EPS = 0.004;
/** The lean's spring: its natural pace (rad/s) and damping ratio. Under-damped, so on leave it swings a touch past rest and
 *  settles, like liquid; it eases toward the cursor the same way. */
export const LEAN_OMEGA = 7.5;
export const LEAN_ZETA = 0.42;

export type Ring = { x: number; y: number; t0: number };

export type PointerState = {
  /** RIPPLE_MAX slots; t0 -Infinity: empty. */
  rings: Ring[];
  /** The cursor is on the ball (within its radius), and where (disc units). */
  over: boolean;
  x: number;
  y: number;
  /** When the last ring started (s). */
  lastSpawn: number;
  /** The lean (disc units) and its velocity, and the time it was stepped to (s; NaN before the first step). */
  lx: number;
  ly: number;
  vx: number;
  vy: number;
  t: number;
};

export function newPointer(): PointerState {
  return {
    rings: Array.from({ length: RIPPLE_MAX }, () => ({ x: 0, y: 0, t0: -Infinity })),
    over: false, x: 0, y: 0, lastSpawn: -Infinity, lx: 0, ly: 0, vx: 0, vy: 0, t: NaN,
  };
}

/** A ring starting at (x, y) at `now` (s): in an empty or finished slot, else in place of the oldest. */
export function spawnRing(s: PointerState, x: number, y: number, now: number): void {
  let k = 0;
  for (let i = 1; i < s.rings.length; i++) if (s.rings[i].t0 < s.rings[k].t0) k = i;
  const r = s.rings[k];
  r.x = x; r.y = y; r.t0 = now;
  s.lastSpawn = now;
}

/** The rings alive at `now`. */
export function liveRings(s: PointerState, now: number): number {
  let n = 0;
  for (const r of s.rings) if (now - r.t0 >= 0 && now - r.t0 < RIPPLE_LIFE) n++;
  return n;
}

/**
 * The cursor at disc point (x, y) at `now` (s), or null when it isn't over the slot. Coming onto the ball (within its
 * radius) starts a ring there; moving over it starts one every RIPPLE_EVERY; leaving it lets the lean go back.
 */
export function sampleHover(s: PointerState, at: { x: number; y: number } | null, now: number): void {
  const inside = at !== null && Math.hypot(at.x, at.y) <= 1;
  if (!inside) { s.over = false; return; }
  if (!s.over) {
    s.over = true;
    spawnRing(s, at.x, at.y, now);
  } else if (Math.hypot(at.x - s.x, at.y - s.y) > MOVE_EPS && now - s.lastSpawn >= RIPPLE_EVERY) {
    spawnRing(s, at.x, at.y, now);
  }
  s.x = at.x; s.y = at.y;
}

/** A tap at disc point (x, y) (a touch screen): one ring, if it landed on the ball. */
export function tapAt(s: PointerState, x: number, y: number, now: number): boolean {
  if (Math.hypot(x, y) > 1) return false;
  spawnRing(s, x, y, now);
  return true;
}

/** Steps the lean to `now` (s): a damped spring toward the cursor while it is on the ball, toward rest once it leaves. After
 *  a long gap (the loop was stopped) it is put where it was heading. */
export function stepLean(s: PointerState, now: number): void {
  const tx = s.over ? s.x : 0, ty = s.over ? s.y : 0;
  const gap = Number.isNaN(s.t) ? Infinity : now - s.t;
  s.t = now;
  if (gap > 0.5) {
    // (nothing seen for a while: no swing to show, it is where it was going; from rest at the start it eases in)
    if (!Number.isFinite(gap) && s.over) return;
    s.lx = tx; s.ly = ty; s.vx = 0; s.vy = 0;
    return;
  }
  if (!(gap > 0)) return;
  const n = Math.ceil(gap / (1 / 240)), h = gap / n, w2 = LEAN_OMEGA * LEAN_OMEGA, c = 2 * LEAN_ZETA * LEAN_OMEGA;
  for (let i = 0; i < n; i++) {
    s.vx += (w2 * (tx - s.lx) - c * s.vx) * h;
    s.vy += (w2 * (ty - s.ly) - c * s.vy) * h;
    s.lx += s.vx * h;
    s.ly += s.vy * h;
  }
  if (!s.over && Math.hypot(s.lx, s.ly) < 1e-4 && Math.hypot(s.vx, s.vy) < 1e-3) { s.lx = s.ly = s.vx = s.vy = 0; }
}

/** What the shaders take at `now` (s), into `out`: each ring's origin, age and strength (0 once gone), and the lean, at most
 *  1 long (its swing past the cursor is clamped: the outline never leans past RIPPLE_BULGE). */
export function packRipple(s: PointerState, now: number, out: GlassRipple): GlassRipple {
  for (let i = 0; i < RIPPLE_MAX; i++) {
    const r = s.rings[i], age = now - r.t0, k = rippleStrength(age);
    out.waves[i * 4] = r.x; out.waves[i * 4 + 1] = r.y;
    out.waves[i * 4 + 2] = k > 0 ? age : 0; out.waves[i * 4 + 3] = k;
  }
  const m = Math.hypot(s.lx, s.ly), c = m > 1 ? 1 / m : 1;
  out.lean[0] = s.lx * c; out.lean[1] = s.ly * c;
  return out;
}

/** What the page tells the e2e tests (window.__glassRipple), rewritten on each read: the rings alive, the lean's length, the
 *  cursor on the ball, and the rings started so far. */
export interface GlassRippleHook { rings: number; lean: number; over: boolean; spawned: number }

declare global {
  interface Window {
    __glassRipple?: Readonly<GlassRippleHook>;
  }
}

export interface GlassPointer {
  /** The water at `now` (performance.now() ms): rewritten in place on every read; NO_RIPPLE under reduced motion. */
  read(now: number): Readonly<GlassRipple>;
  /** Lets go (the last holder of a slot removes its listeners). */
  release(): void;
}

type Shared = { refs: number; read: (now: number) => Readonly<GlassRipple>; dispose: () => void };
const shared = new WeakMap<HTMLElement, Shared>();

/**
 * The pointer over `slot`, as the ball's water: one listener per slot, shared by every holder. Hover is a mouse's or a pen's
 * (pointerenter, move, leave on the slot; while over it the disc point is worked out afresh each read, so a ball carried
 * under a still cursor by the scroll sees it too); a tap is a touch that lifts without the page taking it for a scroll
 * (pointercancel). Nothing here stops the page's own handling: no preventDefault, passive listeners.
 */
export function glassPointer(slot: HTMLElement): GlassPointer {
  let sh = shared.get(slot);
  if (!sh) {
    const made = makeShared(slot);
    shared.set(slot, made);
    sh = made;
  }
  sh.refs++;
  const own = sh;
  let held = true;
  return {
    read: (now) => own.read(now),
    release: () => {
      if (!held) return;
      held = false;
      if (--own.refs > 0) return;
      own.dispose();
      if (shared.get(slot) === own) shared.delete(slot);
    },
  };
}

function makeShared(slot: HTMLElement): Shared {
  const s = newPointer();
  const out: GlassRipple = { waves: new Float32Array(RIPPLE_MAX * 4), lean: new Float32Array(2) };
  const reducedQ = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const hook: GlassRippleHook = { rings: 0, lean: 0, over: false, spawned: 0 };
  let spawned = 0;
  /** The mouse over the slot (client px), or null; a touch going down on it (its id), until it lifts or is cancelled. */
  let at: { x: number; y: number } | null = null;
  let touch: number | null = null;
  const disc = { x: 0, y: 0 };
  /** The disc point under client (cx, cy), from the slot's box now. */
  const toDisc = (cx: number, cy: number) => {
    const r = slot.getBoundingClientRect(), rad = BALL_OF_SLOT * r.width;
    if (!(rad > 0)) return null;
    disc.x = (cx - (r.left + r.width / 2)) / rad;
    disc.y = -(cy - (r.top + r.height / 2)) / rad;
    return disc;
  };
  const reduced = () => reducedQ?.matches === true;
  const secs = () => performance.now() / 1000;
  /** Runs `f`, counting a ring it starts (the hook's `spawned`). */
  const counted = (f: () => void) => { const before = s.lastSpawn; f(); if (s.lastSpawn !== before) spawned++; };

  const onOver = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    at = { x: e.clientX, y: e.clientY };
    if (reduced()) return;
    const now = secs();
    counted(() => sampleHover(s, toDisc(e.clientX, e.clientY), now));
  };
  const onLeave = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    at = null;
    sampleHover(s, null, secs());
  };
  const onDown = (e: PointerEvent) => { if (e.pointerType === "touch" && e.isPrimary) touch = e.pointerId; };
  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== "touch" || e.pointerId !== touch) return;
    touch = null;
    if (reduced()) return;
    const p = toDisc(e.clientX, e.clientY);
    const now = secs();
    if (p) counted(() => tapAt(s, p.x, p.y, now));
  };
  const onCancel = (e: PointerEvent) => { if (e.pointerId === touch) touch = null; };
  slot.addEventListener("pointerenter", onOver, { passive: true });
  slot.addEventListener("pointermove", onOver, { passive: true });
  slot.addEventListener("pointerleave", onLeave, { passive: true });
  slot.addEventListener("pointerdown", onDown, { passive: true });
  slot.addEventListener("pointerup", onUp, { passive: true });
  slot.addEventListener("pointercancel", onCancel, { passive: true });

  const publish = (now: number) => {
    hook.rings = liveRings(s, now); hook.lean = Math.hypot(out.lean[0], out.lean[1]); hook.over = s.over; hook.spawned = spawned;
    window.__glassRipple = hook;
  };
  const read = (nowMs: number): Readonly<GlassRipple> => {
    const now = nowMs / 1000;
    if (reduced()) {
      // (off: the rings dropped, the lean at rest, so turning motion back on starts clean)
      for (const r of s.rings) r.t0 = -Infinity;
      s.over = false; s.lx = s.ly = s.vx = s.vy = 0; s.t = NaN;
      packRipple(s, now, out);
      publish(now);
      return NO_RIPPLE;
    }
    // (the ball may have moved under a still cursor: the scroll carries the slot)
    if (at) counted(() => sampleHover(s, toDisc(at!.x, at!.y), now));
    stepLean(s, now);
    packRipple(s, now, out);
    publish(now);
    return out;
  };
  const dispose = () => {
    slot.removeEventListener("pointerenter", onOver);
    slot.removeEventListener("pointermove", onOver);
    slot.removeEventListener("pointerleave", onLeave);
    slot.removeEventListener("pointerdown", onDown);
    slot.removeEventListener("pointerup", onUp);
    slot.removeEventListener("pointercancel", onCancel);
    if (window.__glassRipple === hook) delete window.__glassRipple;
  };
  return { refs: 0, read, dispose };
}

/** glassPointer on the glass slot inside `root` (the track), or null where there is none. */
export function glassPointerIn(root: ParentNode | null): GlassPointer | null {
  const slot = root?.querySelector<HTMLElement>("[data-pendant='glass']") ?? null;
  return slot ? glassPointer(slot) : null;
}

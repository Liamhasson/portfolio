// src/three/pendant/shots.ts
/**
 * The pendant's shots (spec 2026-10-16-about-pendant-design.md §3): a camera filming the brass pendant through About's
 * sideways track. A shot is fully on when its anchor's centre reaches `fx` of the screen's width; between two shots every
 * value blends (smootherstep; size in log space; a locked face on the circle) so the camera is always moving. Pure data and
 * maths: no DOM, no three.js, so the camera, the motion and the mount can all lean on it and the numbers can be tuned on
 * Liam's screens in one place.
 * The values are the working prototype's (pendant-film-v3), with its "ball" renamed "glass" and its aims moved to mid-height.
 */
export type Layer = "front" | "back";
/** Pendant units: height 1, origin at mid-height (the prototype's origin was at the feet, so its y minus 0.5). */
export type Aim = readonly [number, number, number];
/** A screen x: a share of the width, or the first line's centre / the glass slot's centre, resolved live. */
export type ScreenX = number | "line1" | "glass";
/** A screen y: a share of the height, the glass slot's centre, or (stacked) the middle of the free band above the first
 *  line, resolved live (it rides up with the page). */
export type ScreenY = number | "glass" | "line1";
/** What the shot hangs on: the top or the end of the track, or an element tagged data-pendant (with what to use if the
 *  page doesn't have it: one other anchor, or the midpoint of two). */
export type Anchor = "start" | "end" | { pendant: string; fallback?: string | [string, string] };

export interface Shot {
  id: string;
  anchor: Anchor;
  /** Where on the screen (share of width) the anchor's centre sits when this shot is fully on. Stacked (SHOTS_STACK) it is
   *  read as fy: the anchor centre's height as a share of the screen's height. */
  fx: number;
  /** Where the camera stands, in degrees: az 0 faces face one, el 90 looks straight down. */
  az: number;
  el: number;
  roll: number;
  /** The lens, in degrees. */
  fov: number;
  /** The pendant's height as a share of the screen's height. */
  h: number;
  /** Where the aim point sits on screen. */
  ax: ScreenX;
  ay: ScreenY;
  /** The point on the pendant the camera looks at. */
  aim: Aim;
  /** Turns per second about its own axis. */
  spin: number;
  /** End-over-end turns per second. */
  tumble: number;
  /** Laid over on screen, in degrees (90 = lying down). */
  rz: number;
  /** Settle with this face (degrees) toward the camera instead of spinning; null = keep spinning. */
  lock: number | null;
  /** In front of the words or behind them. */
  layer: Layer;
  /** Brightness; behind the words it dims so they stay easy to read. */
  dim: number;
  /** Depth of field. */
  aperture: number;
  /** 1 = seen through the glass ball. */
  glass: number;
  /** 0..1: the build passes (wire, clay, brass). */
  wire: number;
  /** 0..1: how far the pendant rides with the page while the scroll follow trails it (1 = with the page, as its stage does;
   *  0 = where the eased travel puts it). At rest the two are the same place, so it changes nothing where the solve looks;
   *  during a scroll the words lead the eased travel by the follow's lag (about 0.25 s of scroll), and a shot framed on a
   *  stage among the words (the build) would otherwise trail onto the words beside it. The mount applies it (track only). */
  ride: number;
  /** 0..1: the share of the move into this shot over which the spin and the lock reach it (1: the whole move, as everything
   *  else). Under 1, the pendant slows to its new face early in the move and carries it the rest of the way, so a fast
   *  spin handing over to a held face has settled by the time the shot is on, whatever face it was showing when the move began. */
  settle: number;
  /** Full brightness (Liam, 2026-10-18: the pendant stays softly dimmed all through About; only the build and the pendant
   *  seen through the glass are lit). Every other shot is drawn at the dim. */
  bright: boolean;
  /** Other framings of this shot, tried in order by the readability solve (solve.ts) when the shot as written can't be
   *  cleared of the words on a screen; each is laid over the shot. Never filled forward to the next shot. */
  alt?: readonly ShotChange[];
}

/** What an alternate may change: any of a shot's framing fields (not its name, anchor or own alternates). */
export type ShotChange = Partial<Omit<Shot, "id" | "anchor" | "alt">>;

/** What the camera and the pendant do at one scroll position: the blend of the two shots around it. */
export interface Frame extends Omit<Shot, "id" | "anchor" | "fx" | "ax" | "ay" | "alt" | "layer" | "settle" | "bright"> {
  /** The earlier of the two shots (the last shot's own index once past the end). The shot currently showing is
   *  `t >= 0.5 ? index + 1 : index`. (No layer: the mount takes it from the readability solve's timeline plus its live
   *  guard, presence.ts; the solve reads the shots' own with `shotLayer`.) */
  index: number;
  /** 0..1 eased progress from that shot to the next. */
  t: number;
  /** How strongly `lock` holds, 0..1 (motion.ts scales its pull by it): 1 where both shots lock (the angle then blends on the
   *  shortest arc), easing with `t` from 0 to 1 into a locked shot and from 1 to 0 out of one, 0 where neither locks (`lock`
   *  null). So the face settles to the camera, or lets go into a spin, gradually: it never snaps. */
  lockMix: number;
  ax: number;
  ay: number;
}

/** Every field a shot leaves out inherits from the shot before it; the first inherits these. */
type ShotBody = Omit<Shot, "id" | "anchor" | "alt">;
const DEF: ShotBody = {
  fx: 0.5, az: 0, el: 0, roll: 0, fov: 30, h: 0.4, ax: 0.5, ay: 0.5, aim: [0, 0, 0],
  spin: 0.05, tumble: 0, rz: 0, lock: null, layer: "front", dim: 1, aperture: 0.001, glass: 0, wire: 1, ride: 0, settle: 1, bright: false,
};

/** A shot as written below: its name and anchor, plus only the fields that change. */
type ShotInput = Pick<Shot, "id" | "anchor" | "alt"> & Partial<ShotBody>;

const fill = (inputs: readonly ShotInput[]): readonly Shot[] => {
  const out: Shot[] = [];
  for (const input of inputs) {
    const { id: _id, anchor: _anchor, alt: _alt, ...before } = out.at(-1) ?? { id: "", anchor: "start" as Anchor, ...DEF };
    void _id; void _anchor; void _alt; // (a shot's own alternates are never inherited)
    out.push({ ...DEF, ...before, ...input });
  }
  return out;
};

/** The desktop track. The two "End" keys carry the glide's far end and the build passes' brass end.
 *  The spacing (each `fx`, with the room about.css gives the "Find" slide) is set for an even pace between shots (Liam,
 *  2026-10-18: "some motions between sections are a bit hectic and not smooth"; plan 2026-10-17-about-pendant-motion-pass,
 *  Task 2): at a steady 1500 px/s on 1440 x 900, no move's peak screen speed over 1.6x the median move's, that median at
 *  most 1.86 vw a frame, and no move's size changing more than 6% a frame (scripts/about/pendant-motion.cjs measures it;
 *  e2e "an even pace"). Every shot's framing at its key is as Liam approved it; only where along the scroll the keys fall
 *  changed: the glide's long sweep got about three times the scroll (and the move into it, from the glass that rides the
 *  page, a third more), taken from the long, slow climb from the whirl to the build and from a longer track (96vw more: its scroll about 15% longer). */
export const SHOTS: readonly Shot[] = fill([
  // 01 Small, centred above the first line, spinning in place
  { id: "opening", anchor: "start", az: 0, el: 8, roll: 0, fov: 30, h: 0.2, ax: "line1", ay: 0.21, spin: 0.22, layer: "front", dim: 1, aperture: 0.0006 },
  // 02 It lets go: drifts up and right, still turning
  { id: "letgo", anchor: { pendant: "band" }, fx: 1.04, az: -50, el: 14, roll: 7, fov: 38, h: 0.25, ax: 0.64, ay: 0.13, spin: 0.09, aperture: 0.0008 },
  // 03 Tumble: end over end, sinking behind "eight years managing two rock bands"
  { id: "tumble", anchor: { pendant: "band" }, fx: 0.438, az: -70, el: 0, roll: 0, fov: 32, h: 0.5, ax: 0.46, ay: 0.56, spin: 0.05, tumble: 0.32, layer: "back", dim: 0.4, aperture: 0.001 },
  // 04 Worm's eye, cropped by the bottom edge (ay 1.10, not the prototype's 1.08: its head then tops out at 0.83 of the
  // screen as in the storyboard, clear of the work strip's captions above it; at 1.08 it rose to 0.81: the pictures merge, 2026-10-16)
  { id: "worm", anchor: { pendant: "how" }, fx: 0.5, az: 30, el: -62, roll: -8, fov: 62, h: 1.15, ax: 0.92, ay: 1.1, aim: [0, -0.08, 0], spin: 0.1, tumble: 0, layer: "front", dim: 1, aperture: 0.0012 },
  // 05 From above: the four faces like a compass, turning like a record (the aim is the crown)
  { id: "above", anchor: { pendant: "strip", fallback: "e2e" }, fx: 0.49, az: 0, el: 89, roll: 0, fov: 30, h: 0.8, ax: 0.81, ay: 0.76, aim: [0, 0.28, 0], spin: 0.12, aperture: 0.0012 },
  // 06 Through the glass: magnified, bent, upside down
  { id: "glass", anchor: { pendant: "glass", fallback: ["quote1", "quote2"] }, fx: 0.5, az: 150, el: 8, roll: 0, fov: 30, h: 0.15, ax: "glass", ay: "glass", aim: [0, 0, 0], spin: 0.16, aperture: 0.0005, glass: 1, bright: true },
  // 06b Out of the glass (Liam, 2026-10-18: it vanished as the ball reached the screen's edge, still inside it, where the glass
  // edge pulls what passes under it off the screen): the pendant stays at the screen's middle and the ball slides on from
  // under it, so it leaves the ball in full view while the ball is still well clear of the edge; then it grows into the hold.
  { id: "glassOut", anchor: { pendant: "glass", fallback: ["quote1", "quote2"] }, fx: 0.22, h: 0.22, ax: 0.5, ay: 0.5, glass: 0, layer: "back", bright: false },
  // 07 The centre hold (Liam, 2026-10-18: "keep it centred"): at the screen's middle, dimmed behind the words, turning slowly
  // in place, while "Find the problem" and "Check I'm right" slide past over it. Nothing moves on screen between the two keys.
  { id: "hold", anchor: { pendant: "find" }, fx: 0.5, az: -20, el: 8, roll: 0, fov: 30, h: 0.42, ax: 0.5, ay: 0.5, aim: [0, 0, 0], spin: 0.06, tumble: 0, rz: 0, layer: "back", aperture: 0.0008, glass: 0, bright: false },
  { id: "holdEnd", anchor: { pendant: "check" }, fx: 0.5 },
  // 09 The build, in its frame (Liam, 2026-10-18): the pendant flies from the centre hold to the build stage (centred on the
  // screen when the track pauses there) whole, in brass; the moment it snaps to the frame's centre it is the wireframe (the
  // drawing opens), and it builds itself once, wire to clay to brass, while the page holds and the scroll runs on
  // (about-pendant.tsx: the pause; build-frame.tsx: the frame). Both keys sit where the stage is centred and are brass:
  // the build is the pause's alone. Big, in front, lit; still turning slowly in place.
  { id: "build", anchor: { pendant: "buildstage", fallback: "build" }, fx: 0.5, az: -35, el: 12, roll: 0, fov: 30, h: 0.64, ax: 0.5, ay: 0.45, aim: [0, 0, 0], spin: 0.06, lock: null, aperture: 0.0012, wire: 1, ride: 1, settle: 1, layer: "front", bright: true },
  { id: "buildEnd", anchor: { pendant: "buildstage", fallback: "build" }, fx: 0.5, wire: 1 },
  // 10 Hero: close and low, cut by the left edge, its face turned to the last line (the aim is the face)
  { id: "hero", anchor: "end", fx: 0, az: -62, el: -12, roll: 6, fov: 24, h: 0.97, ax: 0.03, ay: 0.7, aim: [0, 0.02, -0.1], spin: 0, lock: -62, aperture: 0.0016, ride: 0, bright: false,
    // while About's layout leaves words beside the left edge at the end: the same shot mirrored, close at the right, cut by
    // the right edge, its face turned to the closing line on its left (Liam's ruling, 2026-10-16). Its ay / h tuned from the
    // asked 0.3 / 1.0 (there it sits on the pill nav and the closing line on every screen) to the one free area big enough
    // for it on all four tested screens, the bottom right: it rises from the corner, cut by the right and bottom edges.
    alt: [{ az: 62, lock: 62, roll: -6, ax: 0.97, ay: 0.85, h: 0.8 }] },
]);

/**
 * The stacked About (portrait phones and reduced motion: spec §8, plan Task 11): the same film, six of its shots, framed for a
 * tall screen at 390 x 844. Travel is the page's vertical scroll through the section, so `fx` reads as fy (the anchor centre's
 * height as a share of the screen: the shot is fully on when the anchor's middle is there) and every front shot's `ay` sits
 * in a free band above or below the text column (the column takes the screen's whole width, so the bands are the gaps between
 * the stacked slides' words). The cursor's lean is off here (no cursor on a phone). The solve fits each one to the screen
 * as on the track.
 */
export const SHOTS_STACK: readonly Shot[] = fill([
  // 01 Small, centred above the text, spinning in place in the gap between Liam's photo and the first line (Liam, 2026-10-17:
  // as on the track). It rides up with the page in that gap (ay "line1") until the first line reaches fy, then lets go.
  { id: "opening", anchor: { pendant: "line1" }, fx: 0.67, az: 0, el: 8, roll: 0, fov: 30, h: 0.2, ax: 0.5, ay: "line1", spin: 0.22, layer: "front", dim: 1, aperture: 0.0006 },
  // 03 Tumble: end over end behind "eight years managing two rock bands", dimmed
  { id: "tumble", anchor: { pendant: "band" }, fx: 0.5, az: -70, el: 0, roll: 0, fov: 32, h: 0.38, ax: 0.6, ay: 0.52, spin: 0.05, tumble: 0.32, layer: "back", dim: 0.4, aperture: 0.001 },
  // 05 From above: the four faces like a compass, in the band between the work strip and the first quote
  { id: "above", anchor: { pendant: "strip", fallback: "e2e" }, fx: 0.3, az: 0, el: 89, roll: 0, fov: 30, h: 0.6, ax: 0.5, ay: 0.6, aim: [0, 0.28, 0], spin: 0.12, tumble: 0, layer: "front", dim: 1, aperture: 0.0012 },
  // 06 Through the glass: small, between the two quotes (the ball drawn round it once the stack shows the slot)
  { id: "glass", anchor: { pendant: "glass", fallback: ["quote1", "quote2"] }, fx: 0.5, az: 150, el: 8, roll: 0, fov: 30, h: 0.15, ax: "glass", ay: "glass", aim: [0, 0, 0], spin: 0.16, aperture: 0.0005, glass: 1, bright: true },
  // 08 Whirl: stands up spinning fast in the band above "Check I'm right", slows to a new face
  { id: "whirl", anchor: { pendant: "check" }, fx: 0.68, az: 20, el: 10, roll: 0, fov: 34, h: 0.21, ax: 0.5, ay: 0.3, aim: [0, 0, 0], spin: 1.3, aperture: 0.0008, glass: 0, bright: false },
  // 10 Hero: rising from the bottom left corner under the last line, cut by the left and bottom edges, a face turned toward the
  // line. (Smaller than the track's close-up: the fixed resume pill holds the bottom's middle, and the last line rises through
  // the band below it on the way in, so the corner left of the pill is the one free place; the solve fits it there.)
  { id: "hero", anchor: "end", az: -62, el: -12, roll: 6, fov: 24, h: 0.32, ax: 0.08, ay: 0.9, aim: [0, 0.02, -0.1], spin: 0, lock: -30, aperture: 0.0016 },
]);

/** The most of the follow's lag a riding shot (`ride`) is carried with the page, as a share of the width: more than a steady
 *  scroll's lag (about 0.26 of the width at 1500 px/s on a 1440 px screen), less than a jump's (a screen or more), so a jump
 *  never flings it off. */
export const RIDE_MAX = 0.35;
/** The share of a steady scroll's lag a riding shot is actually carried by: the mount eases its ride over RIDE_TAU (0.06 s)
 *  against the follow's 0.25 s, so about 0.06 / 0.25 of the lag still trails (the readability look ahead counts that). */
export const RIDE_STEADY = 0.75;
/** How far (px, along the track) a frame riding `ride` with the page is carried when the page leads the eased travel by
 *  `lag` px: the screen x moves back by this much. */
export function rideShift(ride: number, lag: number, vw: number): number {
  return ride * Math.min(Math.max(lag, -RIDE_MAX * vw), RIDE_MAX * vw);
}

/** A shot and its alternates, in the order the solve tries them: the shot as written, then each alternate laid over it. */
export function variants(shot: Shot): Shot[] {
  return [shot, ...(shot.alt ?? []).map((c) => ({ ...shot, ...c }))];
}

/** Reduced motion holds the shot nearest the page; it changes only once the page is this share of the gap between the two
 *  keys past their midpoint, so a page resting near the middle doesn't crossfade back and forth. */
export const HOLD_PAST = 0.12;

/** The shot reduced motion holds at travel `s`, given the one it holds now (-1 for none): the nearest key's, unless that is
 *  another shot and the page isn't yet HOLD_PAST of the gap past the midpoint between the two keys. */
export function heldIndex(held: number, s: number, keys: readonly number[], past = HOLD_PAST): number {
  let best = 0;
  for (let i = 1; i < keys.length; i++) if (Math.abs(keys[i] - s) < Math.abs(keys[best] - s)) best = i;
  if (held < 0 || held >= keys.length || best === held) return best;
  const a = keys[held], b = keys[best], d = b - a;
  if (d === 0) return best;
  return (s - (a + b) / 2) / d >= past ? best : held;
}

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
/** 6t^5 - 15t^4 + 10t^3: zero speed and zero acceleration at both keys, so a shot is left and reached without a kick (Liam,
 *  2026-10-18: "some motions between sections are a bit hectic and not smooth"). */
export const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
/** Exact at both ends, so a frame at a key is that shot to the last digit. */
const lerp = (a: number, b: number, t: number) => (t <= 0 ? a : t >= 1 ? b : a + (b - a) * t);
/** The shortest way round from angle `a` to `b` (degrees), in [-180, 180). */
const arc = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;
/** An angle (degrees) blended on the shortest arc, exact at both ends. */
const lerpAngle = (a: number, b: number, t: number) => (t <= 0 ? a : t >= 1 ? b : a + arc(a, b) * t);

/**
 * The scroll position (track px) at which each shot is fully on: key = anchor centre - fx x screen width, clamped to the
 * track. "start" is 0 and "end" is `travel`. `centreX` is asked for an element by name (`{ pendant: name }`) and returns its
 * centre in track px, or null when the page doesn't have it. An anchor the page lacks falls back to its `fallback` (one
 * anchor's centre, or the midpoint of a pair); with neither, the key sits one px after the previous one (Liam, 2026-10-16:
 * the camera keeps moving instead of the shot vanishing). Keys always stay strictly increasing, so a shot can never be
 * skipped or divide by zero. When anchors crowd the end of the track, a backward pass pulls the earlier keys left (each at
 * most one px before the next) rather than pushing the last ones past `travel`, so the last shot is always reachable.
 */
export function solveKeys(shots: readonly Shot[], centreX: (a: Anchor) => number | null, vw: number, travel: number): number[] {
  const named = (name: string) => centreX({ pendant: name });
  const centre = (a: Anchor): number | null => {
    if (a === "start" || a === "end") return null;
    const own = named(a.pendant);
    if (own !== null) return own;
    const fb = a.fallback;
    if (fb === undefined) return null;
    if (typeof fb === "string") return named(fb);
    const [p, q] = [named(fb[0]), named(fb[1])];
    if (p !== null && q !== null) return (p + q) / 2;
    return p ?? q;
  };
  const keys: number[] = [];
  shots.forEach((shot, i) => {
    const prev = keys[i - 1];
    let key: number;
    if (shot.anchor === "start") key = 0;
    else if (shot.anchor === "end") key = travel;
    else {
      const c = centre(shot.anchor);
      key = c === null ? (prev ?? 0) + 1 : clamp(c - shot.fx * vw, 0, travel);
    }
    keys.push(i === 0 ? key : Math.max(key, prev + 1));
  });
  // Forward strictness can push the tail past the track's end; pin the last key there and crowd the rest before it.
  if (keys.length > 0) keys[keys.length - 1] = Math.min(keys[keys.length - 1], travel);
  for (let i = keys.length - 2; i >= 0; i--) keys[i] = Math.min(keys[i], keys[i + 1] - 1);
  return keys;
}

/**
 * The frame at scroll `s`: the two shots around it, blended by smootherstep (size in log space, so a dolly from macro to wide
 * reads evenly). A face locked in both turns on the shortest arc; into or out of a lock, the lock's strength (`lockMix`)
 * eases with the blend, so the spin hands over to the held face (and back) without a snap. `at` supplies the live screen
 * spots for the "line1" and "glass" aims. Before the first key it is the first shot; past the last it is the last.
 */
export function shotAt(
  s: number, keys: readonly number[], shots: readonly Shot[], at: { line1: number; glass: { x: number; y: number }; line1Y?: number },
): Frame {
  const last = shots.length - 1;
  let i = 0;
  while (i < last && s > keys[i + 1]) i++;
  const A = shots[i];
  const B = shots[Math.min(i + 1, last)];
  const span = i >= last ? 0 : keys[i + 1] - keys[i];
  const u = i >= last ? 1 : span > 0 ? clamp((s - keys[i]) / span, 0, 1) : 1;
  const t = smootherstep(u);
  // (the spin and the lock: over the first `settle` of the move, the rest of it holding the next shot's)
  const ts = B.settle < 1 ? smootherstep(Math.min(u / Math.max(B.settle, 1e-6), 1)) : t;
  const x = (v: ScreenX) => (v === "line1" ? at.line1 : v === "glass" ? at.glass.x : v);
  const y = (v: ScreenY) => (v === "glass" ? at.glass.y : v === "line1" ? at.line1Y ?? 0.5 : v);
  const lock = A.lock !== null && B.lock !== null ? lerpAngle(A.lock, B.lock, ts) : B.lock ?? A.lock;
  const lockMix = A.lock !== null && B.lock !== null ? 1 : B.lock !== null ? ts : A.lock !== null ? 1 - ts : 0;
  return {
    index: i,
    t,
    lockMix,
    az: lerp(A.az, B.az, t),
    el: lerp(A.el, B.el, t),
    roll: lerp(A.roll, B.roll, t),
    fov: lerp(A.fov, B.fov, t),
    h: t <= 0 ? A.h : t >= 1 ? B.h : Math.exp(lerp(Math.log(A.h), Math.log(B.h), t)),
    ax: lerp(x(A.ax), x(B.ax), t),
    ay: lerp(y(A.ay), y(B.ay), t),
    aim: [lerp(A.aim[0], B.aim[0], t), lerp(A.aim[1], B.aim[1], t), lerp(A.aim[2], B.aim[2], t)],
    spin: lerp(A.spin, B.spin, ts),
    tumble: lerp(A.tumble, B.tumble, t),
    rz: lerp(A.rz, B.rz, t),
    lock,
    dim: lerp(A.dim, B.dim, t),
    aperture: lerp(A.aperture, B.aperture, t),
    glass: lerp(A.glass, B.glass, t),
    wire: lerp(A.wire, B.wire, t),
    ride: lerp(A.ride, B.ride, t),
  };
}

/** The layer the shots themselves want at a frame (what the readability solve starts from): the nearer shot's, switching at
 *  the blend's halfway point. Never the layer drawn: that is the solve's timeline plus the mount's live guard. */
/** Whether the shot showing at a frame is a lit one (`bright`): the earlier shot until halfway, then the later, as the layer. */
export function shotBright(f: Pick<Frame, "index" | "t">, shots: readonly Shot[]): boolean {
  const s = shots[f.t >= 0.5 ? Math.min(f.index + 1, shots.length - 1) : f.index];
  return s?.bright ?? false;
}

export function shotLayer(f: Pick<Frame, "index" | "t">, shots: readonly Shot[]): Layer {
  const i = Math.min(f.t < 0.5 ? f.index : f.index + 1, shots.length - 1);
  return shots[Math.max(i, 0)]?.layer ?? "back";
}

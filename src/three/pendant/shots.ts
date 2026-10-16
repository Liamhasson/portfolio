// src/three/pendant/shots.ts
/**
 * The pendant's shots (spec 2026-10-16-about-pendant-design.md §3): a camera filming the brass pendant through About's
 * sideways track. A shot is fully on when its anchor's centre reaches `fx` of the screen's width; between two shots every
 * value blends (smoothstep; size in log space) so the camera is always moving. Pure data and maths: no DOM, no three.js,
 * so the camera, the motion and the mount can all lean on it and the numbers can be tuned on Liam's screens in one place.
 * The values are the working prototype's (pendant-film-v3), with its "ball" renamed "glass" and its aims moved to mid-height.
 */
export type Layer = "front" | "back";
/** Pendant units: height 1, origin at mid-height (the prototype's origin was at the feet, so its y minus 0.5). */
export type Aim = readonly [number, number, number];
/** A screen x: a share of the width, or the first line's centre / the glass slot's centre, resolved live. */
export type ScreenX = number | "line1" | "glass";
export type ScreenY = number | "glass";
/** What the shot hangs on: the top or the end of the track, or an element tagged data-pendant (with what to use if the
 *  page doesn't have it: one other anchor, or the midpoint of two). */
export type Anchor = "start" | "end" | { pendant: string; fallback?: string | [string, string] };

export interface Shot {
  id: string;
  anchor: Anchor;
  /** Where on the screen (share of width) the anchor's centre sits when this shot is fully on. */
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
  /** Other framings of this shot, tried in order by the readability solve (solve.ts) when the shot as written can't be
   *  cleared of the words on a screen; each is laid over the shot. Never filled forward to the next shot. */
  alt?: readonly ShotChange[];
}

/** What an alternate may change: any of a shot's framing fields (not its name, anchor or own alternates). */
export type ShotChange = Partial<Omit<Shot, "id" | "anchor" | "alt">>;

/** What the camera and the pendant do at one scroll position: the blend of the two shots around it. */
export interface Frame extends Omit<Shot, "id" | "anchor" | "fx" | "ax" | "ay" | "alt"> {
  /** The earlier of the two shots (the last shot's own index once past the end). The shot currently showing is
   *  `t >= 0.5 ? index + 1 : index`, the same halfway point where `layer` and `lock` switch. */
  index: number;
  /** 0..1 eased progress from that shot to the next. */
  t: number;
  ax: number;
  ay: number;
}

/** Every field a shot leaves out inherits from the shot before it; the first inherits these. */
type ShotBody = Omit<Shot, "id" | "anchor" | "alt">;
const DEF: ShotBody = {
  fx: 0.5, az: 0, el: 0, roll: 0, fov: 30, h: 0.4, ax: 0.5, ay: 0.5, aim: [0, 0, 0],
  spin: 0.05, tumble: 0, rz: 0, lock: null, layer: "front", dim: 1, aperture: 0.001, glass: 0, wire: 1,
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

/** The desktop track. The two "End" keys carry the glide's far end and the build passes' brass end. */
export const SHOTS: readonly Shot[] = fill([
  // 01 Small, centred above the first line, spinning in place
  { id: "opening", anchor: "start", az: 0, el: 8, roll: 0, fov: 30, h: 0.2, ax: "line1", ay: 0.21, spin: 0.22, layer: "front", dim: 1, aperture: 0.0006 },
  // 02 It lets go: drifts up and right, still turning
  { id: "letgo", anchor: { pendant: "band" }, fx: 0.92, az: -50, el: 14, roll: 7, fov: 38, h: 0.25, ax: 0.64, ay: 0.13, spin: 0.09, aperture: 0.0008 },
  // 03 Tumble: end over end, sinking behind "eight years managing two rock bands"
  { id: "tumble", anchor: { pendant: "band" }, fx: 0.42, az: -70, el: 0, roll: 0, fov: 32, h: 0.5, ax: 0.46, ay: 0.56, spin: 0.05, tumble: 0.32, layer: "back", dim: 0.4, aperture: 0.001 },
  // 04 Worm's eye, cropped by the bottom edge
  { id: "worm", anchor: { pendant: "how" }, fx: 0.5, az: 30, el: -62, roll: -8, fov: 62, h: 1.15, ax: 0.84, ay: 1.08, aim: [0, -0.08, 0], spin: 0.1, tumble: 0, layer: "front", dim: 1, aperture: 0.0012 },
  // 05 From above: the four faces like a compass, turning like a record (the aim is the crown)
  { id: "above", anchor: { pendant: "strip", fallback: "e2e" }, fx: 0.5, az: 0, el: 89, roll: 0, fov: 30, h: 0.8, ax: 0.81, ay: 0.76, aim: [0, 0.28, 0], spin: 0.12, aperture: 0.0012 },
  // 06 Through the glass: magnified, bent, upside down
  { id: "glass", anchor: { pendant: "glass", fallback: ["quote1", "quote2"] }, fx: 0.5, az: 150, el: 8, roll: 0, fov: 30, h: 0.15, ax: "glass", ay: "glass", aim: [0, 0, 0], spin: 0.16, aperture: 0.0005, glass: 1 },
  // 07 Glide: lying down, rolling along the top of the screen, the full width of it (from 1.08 to -0.08)
  { id: "glide", anchor: { pendant: "find" }, fx: 0.68, az: 0, el: 6, roll: 0, fov: 28, h: 0.5, ax: 1.08, ay: 0.13, spin: 0.45, rz: 90, aperture: 0.0008, glass: 0 },
  { id: "glideEnd", anchor: { pendant: "find" }, fx: 0.28, ax: -0.08 },
  // 08 Whirl: stands up spinning fast, slows to a new face
  { id: "whirl", anchor: { pendant: "check" }, fx: 0.5, az: 20, el: 10, roll: 0, fov: 34, h: 0.3, ax: 0.13, ay: 0.17, spin: 1.3, rz: 0, aperture: 0.0008 },
  // 09 Build passes: wire, clay, brass, swept left to right over the desk film
  { id: "build", anchor: { pendant: "deskfilm", fallback: "build" }, fx: 0.62, az: -25, el: 12, roll: 0, fov: 32, h: 0.28, ax: 0.5, ay: 0.15, spin: 0.08, aperture: 0.0008, wire: 0 },
  { id: "buildEnd", anchor: { pendant: "deskfilm", fallback: "build" }, fx: 0.36, az: 10, wire: 1 },
  // 10 Hero: close and low, cut by the left edge, its face turned to the last line (the aim is the face)
  { id: "hero", anchor: "end", fx: 0, az: -62, el: -12, roll: 6, fov: 24, h: 1.35, ax: 0.03, ay: 0.5, aim: [0, 0.02, -0.1], spin: 0, lock: -62, aperture: 0.0016,
    // while About's layout leaves words beside the left edge at the end: the same shot mirrored, close at the right, cut by
    // the right edge, its face turned to the closing line on its left (Liam's ruling, 2026-10-16). Its ay / h tuned from the
    // asked 0.3 / 1.0 (there it sits on the pill nav and the closing line on every screen) to the one free area big enough
    // for it on all four tested screens, the bottom right: it rises from the corner, cut by the right and bottom edges.
    alt: [{ az: 62, lock: 62, roll: -6, ax: 0.97, ay: 0.85, h: 0.8 }] },
]);

/** A shot and its alternates, in the order the solve tries them: the shot as written, then each alternate laid over it. */
export function variants(shot: Shot): Shot[] {
  return [shot, ...(shot.alt ?? []).map((c) => ({ ...shot, ...c }))];
}

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const smoothstep = (t: number) => t * t * (3 - 2 * t);
/** Exact at both ends, so a frame at a key is that shot to the last digit. */
const lerp = (a: number, b: number, t: number) => (t <= 0 ? a : t >= 1 ? b : a + (b - a) * t);

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
 * The frame at scroll `s`: the two shots around it, blended by smoothstep (size in log space, so a dolly from macro to wide
 * reads evenly). `layer` and `lock` can't blend, so they switch at the halfway point. `at` supplies the live screen spots
 * for the "line1" and "glass" aims. Before the first key it is the first shot; past the last it is the last.
 */
export function shotAt(s: number, keys: readonly number[], shots: readonly Shot[], at: { line1: number; glass: { x: number; y: number } }): Frame {
  const last = shots.length - 1;
  let i = 0;
  while (i < last && s > keys[i + 1]) i++;
  const A = shots[i];
  const B = shots[Math.min(i + 1, last)];
  const span = i >= last ? 0 : keys[i + 1] - keys[i];
  const t = i >= last ? 1 : smoothstep(span > 0 ? clamp((s - keys[i]) / span, 0, 1) : 1);
  const x = (v: ScreenX) => (v === "line1" ? at.line1 : v === "glass" ? at.glass.x : v);
  const y = (v: ScreenY) => (v === "glass" ? at.glass.y : v);
  const pick = <T,>(a: T, b: T) => (t < 0.5 ? a : b);
  return {
    index: i,
    t,
    az: lerp(A.az, B.az, t),
    el: lerp(A.el, B.el, t),
    roll: lerp(A.roll, B.roll, t),
    fov: lerp(A.fov, B.fov, t),
    h: t <= 0 ? A.h : t >= 1 ? B.h : Math.exp(lerp(Math.log(A.h), Math.log(B.h), t)),
    ax: lerp(x(A.ax), x(B.ax), t),
    ay: lerp(y(A.ay), y(B.ay), t),
    aim: [lerp(A.aim[0], B.aim[0], t), lerp(A.aim[1], B.aim[1], t), lerp(A.aim[2], B.aim[2], t)],
    spin: lerp(A.spin, B.spin, t),
    tumble: lerp(A.tumble, B.tumble, t),
    rz: lerp(A.rz, B.rz, t),
    lock: pick(A.lock, B.lock),
    layer: pick(A.layer, B.layer),
    dim: lerp(A.dim, B.dim, t),
    aperture: lerp(A.aperture, B.aperture, t),
    glass: lerp(A.glass, B.glass, t),
    wire: lerp(A.wire, B.wire, t),
  };
}

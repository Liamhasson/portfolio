// src/three/pendant/shots.test.ts
import { describe, expect, it, test } from "vitest";
import { REST, stepMotion, type MotionState } from "./motion";
import { heldIndex, HOLD_PAST, RIDE_MAX, rideShift, SHOTS, SHOTS_STACK, shotAt, shotLayer, smootherstep, solveKeys, variants, type Anchor, type Shot } from "./shots";

const VW = 1440;
const TRAVEL = 9000;
const AT = { line1: 0.37, glass: { x: 0.61, y: 0.44 } };

/** Anchor centres in track px, by pendant anchor name; anything not listed is missing. */
const centres = (present: Record<string, number>) => (a: Anchor) => {
  if (a === "start" || a === "end") return null;
  return present[a.pendant] ?? null;
};

const ALL = { band: 1700, how: 2900, strip: 4300, e2e: 4000, glass: 5200, quote1: 5000, quote2: 5600, find: 6400, check: 7300, buildstage: 8000, build: 7800 };

/** ALL minus some anchors, as the page would be if it lacked them. */
const without = (...names: string[]) => Object.fromEntries(Object.entries(ALL).filter(([k]) => !names.includes(k)));

describe("the pendant's shots (spec 2026-10-16 §3)", () => {
  test("SHOTS, hand placed: the centre hold through Find and Check in place of the glide and the whirl, in order", () => {
    expect(SHOTS.map((s) => s.id)).toEqual(["opening", "letgo", "tumble", "worm", "above", "glass", "glassOut", "hold", "holdEnd", "build", "buildEnd", "hero"]);
  });

  test("an unspecified field inherits the previous shot's value; aims are relative to mid-height", () => {
    const by = (id: string) => SHOTS.find((s) => s.id === id)!;
    expect(by("worm").tumble).toBe(0);
    expect(by("above").tumble).toBe(0);
    expect(by("glass").glass).toBe(1);
    expect(by("hold").glass).toBe(0);
    expect(by("holdEnd").layer).toBe("back");
    expect([by("glass").bright, by("build").bright, by("buildEnd").bright, by("hold").bright, by("hero").bright, by("tumble").bright]).toEqual([true, true, true, false, false, false]);
    expect(by("build").wire).toBe(1);
    expect(by("buildEnd").wire).toBe(1);
    expect(by("hero").lock).toBe(-62);
    expect(by("hero").aim).toEqual([0, 0.02, -0.1]);
    expect(by("above").aim).toEqual([0, 0.28, 0]);
    expect(by("worm").aim[1]).toBeCloseTo(-0.08, 9); // the prototype's 0.42 from the feet
    expect(by("opening").aim).toEqual([0, 0, 0]);
    expect(by("opening").lock).toBeNull();
  });

  test("the build, in its frame: big, in front, lit, both keys where the stage is centred (the pause between them drives it; Liam, 2026-10-18)", () => {
    const by = (id: string) => SHOTS.find((s) => s.id === id)!;
    for (const id of ["build", "buildEnd"]) {
      expect(by(id).anchor).toEqual({ pendant: "buildstage", fallback: "build" });
      expect(by(id).fx).toBe(0.5);
      expect(by(id).layer).toBe("front");
      expect(by(id).bright).toBe(true);
      expect(by(id).h).toBeGreaterThanOrEqual(0.6);
      expect([by(id).ax, by(id).ay]).toEqual([0.5, 0.45]);
      expect(by(id).lock).toBeNull(); // (still turning in place while it builds)
    }
    expect([by("build").wire, by("buildEnd").wire]).toEqual([1, 1]); // (brass on the way in and out: the build is the pause's)
    expect(Math.abs(by("build").az)).toBeGreaterThanOrEqual(20); // (a three-quarter view)
  });

});

describe("the stacked shots (spec §8, plan Task 11)", () => {
  test("SHOTS_STACK keeps the six phone shots in order", () => {
    expect(SHOTS_STACK.map((s) => s.id)).toEqual(["opening", "tumble", "above", "glass", "whirl", "hero"]);
  });

  test("each phone shot keeps its desktop character: the tumble behind and dimmed, the glass through the ball, the hero's face locked", () => {
    const by = (id: string) => SHOTS_STACK.find((s) => s.id === id)!;
    expect(by("tumble").layer).toBe("back");
    expect(by("tumble").dim).toBe(0.4);
    expect(by("tumble").tumble).toBeGreaterThan(0);
    expect(by("above").tumble).toBe(0);
    expect(by("above").el).toBe(89);
    expect(by("glass").glass).toBe(1);
    expect([by("glass").ax, by("glass").ay]).toEqual(["glass", "glass"]);
    expect(by("whirl").glass).toBe(0);
    expect(by("whirl").spin).toBe(1.3);
    expect(by("hero").lock).not.toBeNull(); // (it settles a face to the camera instead of spinning)
    expect(by("hero").spin).toBe(0);
    expect(by("opening").ax).toBe(0.5); // (centred above the text, Liam 2026-10-17)
    expect(by("opening").ay).toBe("line1"); // (in the gap above the first line, riding with the page)
    expect(by("hero").anchor).toBe("end");
  });

  test("fx reads as fy: keys solve on the vertical scroll (key = anchor centre - fy x screen height)", () => {
    const VH = 844, H_TRAVEL = 6070;
    const ys = { line1: 1066, band: 1657, strip: 2872, quote1: 3429, quote2: 4020, check: 5201 };
    const keys = solveKeys(SHOTS_STACK, centres(ys), VH, H_TRAVEL);
    expect(keys[0]).toBeCloseTo(1066 - 0.67 * VH, 9);
    expect(keys[1]).toBeCloseTo(1657 - 0.5 * VH, 9);
    expect(keys[2]).toBeCloseTo(2872 - 0.3 * VH, 9);
    expect(keys[3]).toBeCloseTo((3429 + 4020) / 2 - 0.5 * VH, 9); // (no slot in the stack: the quotes' midpoint)
    expect(keys[4]).toBeCloseTo(5201 - 0.68 * VH, 9);
    expect(keys[5]).toBe(H_TRAVEL);
  });
});

test('the stacked opening\'s ay "line1" is the live gap above the first line (at.line1Y), before and at its key', () => {
  const keys = [500, 1200, 2600, 3300, 4600, 6070];
  expect(shotAt(0, keys, SHOTS_STACK, { line1: 0.5, glass: { x: 0.5, y: 0.5 }, line1Y: 0.97 }).ay).toBe(0.97);
  expect(shotAt(500, keys, SHOTS_STACK, { line1: 0.5, glass: { x: 0.5, y: 0.5 }, line1Y: 0.38 }).ay).toBe(0.38);
  expect(shotAt(500, keys, SHOTS_STACK, { line1: 0.5, glass: { x: 0.5, y: 0.5 } }).ay).toBe(0.5); // (no gap measured: mid-height)
});

describe("heldIndex (reduced motion's held shot)", () => {
  const keys = [0, 1000, 2000, 3000];
  test("with nothing held it is the nearest key's shot", () => {
    expect(heldIndex(-1, 0, keys)).toBe(0);
    expect(heldIndex(-1, 560, keys)).toBe(1);
    expect(heldIndex(-1, 2900, keys)).toBe(3);
  });
  test("it keeps the held shot until the page is HOLD_PAST of the gap past the midpoint", () => {
    expect(HOLD_PAST).toBeGreaterThanOrEqual(0.1);
    expect(HOLD_PAST).toBeLessThanOrEqual(0.15);
    expect(heldIndex(0, 501, keys)).toBe(0); // (just past the middle: still the opening)
    expect(heldIndex(0, 500 + HOLD_PAST * 1000 - 1, keys)).toBe(0);
    expect(heldIndex(0, 500 + HOLD_PAST * 1000, keys)).toBe(1);
    // and back: from the second, the first only once the page is as far past the middle the other way
    expect(heldIndex(1, 499, keys)).toBe(1);
    expect(heldIndex(1, 500 - HOLD_PAST * 1000, keys)).toBe(0);
  });
  test("a jump past several keys changes at once", () => {
    expect(heldIndex(0, 2990, keys)).toBe(3);
  });
});

describe("solveKeys", () => {
  test('puts "start" at 0 and "end" at travel, and keys are strictly increasing', () => {
    const keys = solveKeys(SHOTS, centres(ALL), VW, TRAVEL);
    expect(keys).toHaveLength(SHOTS.length);
    expect(keys[0]).toBe(0);
    expect(keys.at(-1)).toBe(TRAVEL);
    for (let i = 1; i < keys.length; i++) expect(keys[i]).toBeGreaterThan(keys[i - 1]);
  });

  test("a shot is fully on when its anchor's centre is at fx of the screen: key = centre - fx x vw", () => {
    const keys = solveKeys(SHOTS, centres(ALL), VW, TRAVEL);
    expect(keys[1]).toBeCloseTo(1700 - SHOTS[1].fx * VW, 9); // letgo
    expect(keys[2]).toBeCloseTo(1700 - SHOTS[2].fx * VW, 9); // tumble
  });

  test("anchors crowded at the end of the track keep every key inside 0..travel and the hero reachable", () => {
    const keys = solveKeys(SHOTS, centres({ ...ALL, buildstage: 99999 }), VW, TRAVEL);
    expect(keys.at(-1)).toBe(TRAVEL);
    for (const k of keys) {
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(TRAVEL);
    }
    for (let i = 1; i < keys.length; i++) expect(keys[i]).toBeGreaterThan(keys[i - 1]);
    expect(shotAt(TRAVEL, keys, SHOTS, AT).az).toBe(-62);
  });

  test("uses the fallback when an anchor is missing", () => {
    const k = solveKeys(SHOTS, centres(without("strip")), VW, TRAVEL);
    const above = SHOTS.findIndex((s) => s.id === "above");
    expect(k[above]).toBeCloseTo(ALL.e2e - SHOTS[above].fx * VW, 9);

    const k2 = solveKeys(SHOTS, centres(without("glass")), VW, TRAVEL);
    const glass = SHOTS.findIndex((s) => s.id === "glass");
    expect(k2[glass]).toBeCloseTo((ALL.quote1 + ALL.quote2) / 2 - 0.5 * VW, 9);
  });

  test("a pair fallback with only one member present uses that one's centre", () => {
    const k = solveKeys(SHOTS, centres(without("glass", "quote2")), VW, TRAVEL);
    const glass = SHOTS.findIndex((s) => s.id === "glass");
    expect(k[glass]).toBeCloseTo(ALL.quote1 - 0.5 * VW, 9);
  });

  test("a primary that exists wins over its fallback", () => {
    const k = solveKeys(SHOTS, centres(ALL), VW, TRAVEL);
    const above = SHOTS.findIndex((s) => s.id === "above");
    expect(k[above]).toBeCloseTo(ALL.strip - SHOTS[above].fx * VW, 9);
  });

  test("with neither the anchor nor its fallback, the key sits just after the previous one", () => {
    const k = solveKeys(SHOTS, centres(without("strip", "e2e")), VW, TRAVEL);
    const above = SHOTS.findIndex((s) => s.id === "above");
    expect(k[above]).toBe(k[above - 1] + 1);
    for (let i = 1; i < k.length; i++) expect(k[i]).toBeGreaterThan(k[i - 1]);
  });

  test("anchors out of order still give strictly increasing keys", () => {
    const k = solveKeys(SHOTS, centres({ ...ALL, how: 100, strip: 100 }), VW, TRAVEL);
    for (let i = 1; i < k.length; i++) expect(k[i]).toBeGreaterThan(k[i - 1]);
  });
});

describe("shotAt", () => {
  const keys = solveKeys(SHOTS, centres(ALL), VW, TRAVEL);

  test("at a key returns that shot exactly", () => {
    const f = shotAt(keys[3], keys, SHOTS, AT);
    expect(f.az).toBe(30);
    expect(f.el).toBe(-62);
    expect(f.h).toBe(1.15);
    expect("layer" in f).toBe(false); // (the layer is the solve's and the guard's, never the frame's)
    expect(shotLayer(f, SHOTS)).toBe("front");
    expect(f.index).toBe(2);
    expect(f.t).toBe(1);
  });

  test("before the first key returns the first shot; past the last returns the last", () => {
    const first = shotAt(-500, keys, SHOTS, AT);
    expect(first.az).toBe(0);
    expect(first.t).toBe(0);
    const last = shotAt(TRAVEL + 500, keys, SHOTS, AT);
    expect(last.az).toBe(-62);
    expect(last.t).toBe(1);
    expect(last.index).toBe(SHOTS.length - 1);
    expect(last.lock).toBe(-62);
  });

  test("blends size in log space", () => {
    const a = { ...SHOTS[0], h: 0.2 };
    const b = { ...SHOTS[1], h: 0.25 };
    const f = shotAt(50, [0, 100], [a, b], AT); // t = 0.5, smootherstep 0.5
    expect(f.t).toBeCloseTo(0.5, 9);
    expect(f.h).toBeCloseTo(Math.sqrt(0.2 * 0.25), 9);
  });

  test("eases with smootherstep: a quarter of the way is about a tenth of the blend", () => {
    const a: Shot = { ...SHOTS[0], az: 0 };
    const b: Shot = { ...SHOTS[1], az: 100 };
    const f = shotAt(25, [0, 100], [a, b], AT);
    expect(f.t).toBeCloseTo(0.103515625, 9);
    expect(f.az).toBeCloseTo(10.3515625, 9);
  });

  test("smootherstep blend has zero slope at both keys", () => {
    const a: Shot = { ...SHOTS[0], az: 0, h: 0.2 };
    const b: Shot = { ...SHOTS[1], az: 100, h: 0.8 };
    const keys = [0, 1000];
    const at = (s: number) => shotAt(s, keys, [a, b], AT);
    // the blend's speed (per px of travel) a hair from each key is nothing, and so is its acceleration: 10u^3 near 0
    const e = 1;
    expect(at(e).t / e).toBeLessThan(1e-7);
    expect((1 - at(1000 - e).t) / e).toBeLessThan(1e-7);
    expect(at(e).az).toBeLessThan(1e-6);
    expect(100 - at(1000 - e).az).toBeLessThan(1e-6);
    expect(Math.abs(Math.log(at(e).h / 0.2))).toBeLessThan(1e-7);
    // the slope builds smoothly from zero: no step at either key, and at most 15/8 of the even pace in the middle
    let prev = at(0).t, maxStep = 0, first = Infinity;
    for (let s = 1; s <= 1000; s++) {
      const t = at(s).t;
      maxStep = Math.max(maxStep, t - prev);
      if (s === 1) first = t - prev;
      prev = t;
    }
    expect(first).toBeLessThan(1e-8);
    expect(maxStep).toBeLessThanOrEqual((15 / 8) / 1000 + 1e-9);
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(1)).toBe(1);
    expect(smootherstep(0.5)).toBe(0.5);
  });

  test("blends the aim component by component", () => {
    const a: Shot = { ...SHOTS[0], aim: [0, 0, 0] };
    const b: Shot = { ...SHOTS[1], aim: [0.2, 0.4, -0.2] };
    const f = shotAt(50, [0, 100], [a, b], AT);
    expect(f.aim[0]).toBeCloseTo(0.1, 9);
    expect(f.aim[1]).toBeCloseTo(0.2, 9);
    expect(f.aim[2]).toBeCloseTo(-0.1, 9);
  });

  test("a zero-width segment (equal keys) does not divide by zero", () => {
    const f = shotAt(100, [0, 100, 100], [SHOTS[0], SHOTS[1], SHOTS[2]], AT);
    expect(Number.isFinite(f.az)).toBe(true);
    expect(Number.isFinite(f.h)).toBe(true);
  });

  test('resolves "line1" and "glass"', () => {
    const opening = shotAt(keys[0], keys, SHOTS, AT);
    expect(opening.ax).toBe(AT.line1);
    expect(opening.ay).toBe(0.21);
    const gi = SHOTS.findIndex((s) => s.id === "glass");
    const glass = shotAt(keys[gi], keys, SHOTS, AT);
    expect(glass.ax).toBe(AT.glass.x);
    expect(glass.ay).toBe(AT.glass.y);
    expect(glass.glass).toBe(1);
  });

  test('a "glass" aim blends toward a plain number as the shots change', () => {
    // (from the glass to glassOut, at the screen's middle: ax 0.5, ay 0.5)
    const gi = SHOTS.findIndex((s) => s.id === "glass");
    const mid = (keys[gi] + keys[gi + 1]) / 2;
    const f = shotAt(mid, keys, SHOTS, AT);
    expect(f.t).toBeCloseTo(0.5, 9);
    expect(f.ax).toBeCloseTo((AT.glass.x + 0.5) / 2, 9);
    expect(f.ay).toBeCloseTo((AT.glass.y + 0.5) / 2, 9);
  });

  test("the shots' own layer (shotLayer, what the solve starts from) switches at the halfway point; the lock eases in with t", () => {
    const a: Shot = { ...SHOTS[0], layer: "front", lock: null };
    const b: Shot = { ...SHOTS[1], layer: "back", lock: -62 };
    const before = shotAt(49, [0, 100], [a, b], AT);
    expect(shotLayer(before, [a, b])).toBe("front");
    expect(before.lock).toBe(-62);
    expect(before.lockMix).toBeCloseTo(before.t, 12);
    const after = shotAt(51, [0, 100], [a, b], AT);
    expect(shotLayer(after, [a, b])).toBe("back");
    expect(after.lock).toBe(-62);
    expect(after.lockMix).toBeCloseTo(after.t, 12);
    expect(shotAt(0, [0, 100], [a, b], AT).lockMix).toBe(0);
    expect(shotAt(100, [0, 100], [a, b], AT).lockMix).toBe(1);
    // neither locked: no lock at all
    expect(shotAt(50, [0, 100], [a, { ...b, lock: null }], AT)).toMatchObject({ lock: null, lockMix: 0 });
    // past the last key: the last shot's
    expect(shotLayer(shotAt(500, [0, 100], [a, b], AT), [a, b])).toBe("back");
    expect(shotAt(500, [0, 100], [a, b], AT)).toMatchObject({ lock: -62, lockMix: 1 });
  });

  /** Steps the motion through a blend from shot a to shot b over `seconds` of 1/60 s frames at an even pace, and returns the
   *  yaw (radians) of every frame. */
  const ride = (a: Shot, b: Shot, seconds: number, from: MotionState = REST, scrollVel = 0) => {
    const n = Math.round(seconds * 60), keys = [0, n];
    let m = from;
    const yaws: number[] = [m.yaw];
    for (let k = 0; k <= n + 60; k++) {
      const f = shotAt(k, keys, [a, b], AT);
      m = stepMotion(m, { dt: 1 / 60, spin: f.spin, tumble: f.tumble, lock: f.lock, lockMix: f.lockMix, scrollVel, dragging: false, dragDX: 0, dragDY: 0, reduced: false });
      yaws.push(m.yaw);
    }
    return yaws;
  };
  const maxJerk = (yaws: number[]) => {
    let worst = 0;
    for (let k = 2; k < yaws.length; k++) worst = Math.max(worst, Math.abs(yaws[k] - 2 * yaws[k - 1] + yaws[k - 2]));
    return worst;
  };

  test("lock blends on the shortest arc and never jumps between two frames", () => {
    const D = Math.PI / 180;
    const a: Shot = { ...SHOTS[0], lock: 170, spin: 0 };
    const b: Shot = { ...SHOTS[1], lock: -170, spin: 0 };
    // the frame's angle: through 180 (20 degrees round), never back through 0 (340 degrees), exact at both keys. (An angle:
    // compared on the circle, where 190 is -170.)
    const round = (d: number) => ((((d % 360) + 540) % 360) - 180);
    const keys = [0, 10_000];
    let prev = shotAt(0, keys, [a, b], AT).lock as number, maxStep = 0, far = 0;
    expect(prev).toBe(170);
    for (let s = 1; s <= 10_000; s++) {
      const f = shotAt(s, keys, [a, b], AT);
      expect(f.lockMix).toBe(1);
      const lock = f.lock as number;
      maxStep = Math.max(maxStep, Math.abs(round(lock - prev)));
      far = Math.max(far, Math.abs(round(lock - 170)));
      prev = lock;
    }
    expect(prev).toBe(-170);
    expect(far).toBeLessThanOrEqual(20 + 1e-9);
    expect(maxStep).toBeLessThanOrEqual((20 * 15) / 8 / 10_000 + 1e-9); // (smootherstep's steepest: 15/8 of the even pace)
    // the hero's own pair (its mirror): -62 to 62 the short way, through 0
    expect(shotAt(5000, keys, [{ ...a, lock: -62 }, { ...b, lock: 62 }], AT).lock).toBeCloseTo(0, 9);
    // the rendered yaw, settled on the first face and turned to the second over one second: it follows the arc, every frame
    // a small step from the last (no frame more than 0.5 degrees from where the last one's pace would put it)
    const yaws = ride(a, b, 1, { ...REST, yaw: 170 * D });
    let worstStep = 0;
    for (let k = 1; k < yaws.length; k++) worstStep = Math.max(worstStep, Math.abs(yaws[k] - yaws[k - 1]));
    expect(worstStep).toBeLessThan(1 * D);
    expect(maxJerk(yaws)).toBeLessThan(0.5 * D);
    const end = yaws[yaws.length - 1];
    expect(Math.abs(Math.atan2(Math.sin(end - -170 * D), Math.cos(end - -170 * D)))).toBeLessThan(3 * D);
    expect(Math.abs(end - 190 * D)).toBeLessThan(3 * D); // (it went the short way: on past 180, not back round through 0)
  });

  test("a shot with no lock eases out of a locked one", () => {
    const D = Math.PI / 180;
    const locked: Shot = { ...SHOTS[0], lock: -62, spin: 0 };
    const free: Shot = { ...SHOTS[1], lock: null, spin: 0.3 };
    // the lock's strength falls from 1 to 0 with the blend, smoothly, never at a step
    const keys = [0, 1000];
    let prev = 1;
    for (let s = 0; s <= 1000; s++) {
      const f = shotAt(s, keys, [locked, free], AT);
      expect(f.lock).toBe(-62);
      expect(f.lockMix).toBeCloseTo(1 - f.t, 12);
      expect(prev - f.lockMix).toBeLessThanOrEqual((15 / 8) / 1000 + 1e-9);
      prev = f.lockMix;
    }
    expect(shotAt(1000, keys, [locked, free], AT).lockMix).toBe(0);
    // ridden at a brisk scroll (its push turning it too), held at the face then let go into the spin: the yaw's pace changes
    // a little each frame, never kicked (the old switch at the halfway point dropped the hold in one frame)
    for (const scrollVel of [0, 1500]) {
      const yaws = ride(locked, free, 0.6, { ...REST, yaw: -62 * D }, scrollVel);
      expect(maxJerk(yaws)).toBeLessThan(0.5 * D);
      // and it ends turning at the free shot's own pace (plus the push)
      const pace = (yaws[yaws.length - 1] - yaws[yaws.length - 2]) * 60;
      expect(pace).toBeCloseTo(0.3 * 2 * Math.PI + scrollVel * 0.0016, 6);
    }
    // the way in, too: a spinning pendant settles to the face without a kick, even while a fast scroll still pushes it round
    for (const scrollVel of [0, 1500]) {
      const yaws = ride(free, locked, 0.6, REST, scrollVel);
      expect(maxJerk(yaws)).toBeLessThan(0.5 * D);
    }
  });
});

// Task 2, Part B: the whirl hands its fast spin to the build's held face early in the move (`settle`), and the build rides
// with the page (`ride`), so a brisk scroll finds it on its stage, face on.
describe("settle and ride (the build under a fast scroll)", () => {
  const by = (id: string) => SHOTS.find((s) => s.id === id)!;
  // (the shot before the build is the centre hold now; a fast-spinning stand-in keeps the settle's property under test)
  const whirl = { ...by("holdEnd"), spin: 1.3, ride: 0 }, build = by("build"), buildEnd = by("buildEnd");





  test("the build rides with the page; the whirl before it and the hero after it don't; rideShift carries at most RIDE_MAX of the width", () => {
    expect([whirl.ride, build.ride, buildEnd.ride, by("hero").ride]).toEqual([0, 1, 1, 0]);
    for (const sh of SHOTS) if (!["build", "buildEnd"].includes(sh.id)) expect(sh.ride, sh.id).toBe(0);
    const keys = [0, 1000];
    expect(shotAt(500, keys, [whirl, build], AT).ride).toBeCloseTo(0.5, 12);
    expect(rideShift(1, 200, 1440)).toBe(200);
    expect(rideShift(0.5, -200, 1440)).toBe(-100);
    expect(rideShift(1, 5000, 1440)).toBeCloseTo(RIDE_MAX * 1440, 9);
    expect(rideShift(0, 300, 1440)).toBe(0);
  });
});

// Task 8, fix round 1: a shot may carry alternates the readability solve tries in order when the shot as written can't be
// cleared on a screen (Liam's ruling: the hero's mirror, top right, until the layout frees the left).
describe("alternates", () => {
  it("the hero carries one alternate: the storyboard's framing mirrored to the top right", () => {
    const hero = SHOTS.find((s) => s.id === "hero")!;
    expect(hero.alt).toEqual([{ az: 62, lock: 62, roll: -6, ax: 0.97, ay: 0.85, h: 0.8 }]);
  });
  it("no other shot inherits it (alternates are a shot's own, never filled forward)", () => {
    for (const s of SHOTS) if (s.id !== "hero") expect(s.alt).toBeUndefined();
  });
  it("variants: the shot as written first, then each alternate laid over it", () => {
    const hero = SHOTS.find((s) => s.id === "hero")!;
    const v = variants(hero);
    expect(v).toHaveLength(2);
    expect(v[0]).toBe(hero);
    expect(v[1]).toMatchObject({ id: "hero", anchor: "end", az: 62, lock: 62, roll: -6, ax: 0.97, ay: 0.85, h: 0.8, el: -12, fov: 24 });
    expect(v[1].aim).toEqual(hero.aim);
    expect(variants(SHOTS[0])).toEqual([SHOTS[0]]);
  });
});

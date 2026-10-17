// src/three/pendant/shots.test.ts
import { describe, expect, it, test } from "vitest";
import { heldIndex, HOLD_PAST, SHOTS, SHOTS_STACK, shotAt, solveKeys, variants, type Anchor, type Shot } from "./shots";

const VW = 1440;
const TRAVEL = 9000;
const AT = { line1: 0.37, glass: { x: 0.61, y: 0.44 } };

/** Anchor centres in track px, by pendant anchor name; anything not listed is missing. */
const centres = (present: Record<string, number>) => (a: Anchor) => {
  if (a === "start" || a === "end") return null;
  return present[a.pendant] ?? null;
};

const ALL = { band: 1700, how: 2900, strip: 4300, e2e: 4000, glass: 5200, quote1: 5000, quote2: 5600, find: 6400, check: 7300, deskfilm: 8000, build: 7800 };

/** ALL minus some anchors, as the page would be if it lacked them. */
const without = (...names: string[]) => Object.fromEntries(Object.entries(ALL).filter(([k]) => !names.includes(k)));

describe("the pendant's shots (spec 2026-10-16 §3)", () => {
  test("SHOTS has the spec's ten shots plus the glide's and the build passes' end keys, in order", () => {
    expect(SHOTS.map((s) => s.id)).toEqual(["opening", "letgo", "tumble", "worm", "above", "glass", "glide", "glideEnd", "whirl", "build", "buildEnd", "hero"]);
  });

  test("an unspecified field inherits the previous shot's value; aims are relative to mid-height", () => {
    const by = (id: string) => SHOTS.find((s) => s.id === id)!;
    expect(by("worm").tumble).toBe(0);
    expect(by("above").tumble).toBe(0);
    expect(by("glass").glass).toBe(1);
    expect(by("glide").glass).toBe(0);
    expect(by("build").wire).toBe(0);
    expect(by("buildEnd").wire).toBe(1);
    expect(by("hero").lock).toBe(-62);
    expect(by("hero").aim).toEqual([0, 0.02, -0.1]);
    expect(by("above").aim).toEqual([0, 0.28, 0]);
    expect(by("worm").aim[1]).toBeCloseTo(-0.08, 9); // the prototype's 0.42 from the feet
    expect(by("opening").aim).toEqual([0, 0, 0]);
    expect(by("opening").lock).toBeNull();
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
    expect(keys[1]).toBeCloseTo(1700 - 0.92 * VW, 9); // letgo
    expect(keys[2]).toBeCloseTo(1700 - 0.42 * VW, 9); // tumble
  });

  test("anchors crowded at the end of the track keep every key inside 0..travel and the hero reachable", () => {
    const keys = solveKeys(SHOTS, centres({ ...ALL, deskfilm: 99999 }), VW, TRAVEL);
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
    expect(k[above]).toBeCloseTo(ALL.e2e - 0.5 * VW, 9);

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
    expect(k[above]).toBeCloseTo(ALL.strip - 0.5 * VW, 9);
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
    expect(f.layer).toBe("front");
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
    const f = shotAt(50, [0, 100], [a, b], AT); // t = 0.5, smoothstep 0.5
    expect(f.t).toBeCloseTo(0.5, 9);
    expect(f.h).toBeCloseTo(Math.sqrt(0.2 * 0.25), 9);
  });

  test("eases with smoothstep: a quarter of the way is less than a quarter of the blend", () => {
    const a: Shot = { ...SHOTS[0], az: 0 };
    const b: Shot = { ...SHOTS[1], az: 100 };
    const f = shotAt(25, [0, 100], [a, b], AT);
    expect(f.t).toBeCloseTo(0.15625, 9);
    expect(f.az).toBeCloseTo(15.625, 9);
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
    const gi = SHOTS.findIndex((s) => s.id === "glass");
    const mid = (keys[gi] + keys[gi + 1]) / 2; // the glide: ax 1.08, ay 0.13
    const f = shotAt(mid, keys, SHOTS, AT);
    expect(f.t).toBeCloseTo(0.5, 9);
    expect(f.ax).toBeCloseTo((AT.glass.x + 1.08) / 2, 9);
    expect(f.ay).toBeCloseTo((AT.glass.y + 0.13) / 2, 9);
  });

  test("layer and lock switch at the halfway point", () => {
    const a: Shot = { ...SHOTS[0], layer: "front", lock: null };
    const b: Shot = { ...SHOTS[1], layer: "back", lock: -62 };
    const before = shotAt(49, [0, 100], [a, b], AT);
    expect(before.layer).toBe("front");
    expect(before.lock).toBeNull();
    const after = shotAt(51, [0, 100], [a, b], AT);
    expect(after.layer).toBe("back");
    expect(after.lock).toBe(-62);
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

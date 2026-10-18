// src/three/pendant/presence.test.ts
import { describe, expect, test } from "vitest";
import { AHEAD_STEP, BACK_TAU, behindAhead, BRIGHT_TAU, HOLD, lagAhead, MIN_BACK, stepPresence, type Presence } from "./presence";
import type { Layer } from "./shots";

const DT = 1 / 60;

/** Steps `p` `n` times with the same want, returning every state after it (the first is after one step). */
function run(p: Presence, want: { layer: Layer; dim: number; overlapping: boolean }, n: number, dt = DT): Presence[] {
  const out: Presence[] = [];
  for (let i = 0; i < n; i++) { p = stepPresence(p, want, dt); out.push(p); }
  return out;
}

describe("stepPresence", () => {
  test("bright never changes by more than 1 − e^(−dt/0.6) of the gap per step", () => {
    expect(BRIGHT_TAU).toBe(0.6);
    // any dt (a 120 Hz frame, a 60 Hz one, a long one a tab coming back caps), any target, a target that jumps every step
    const targets = [0.4, 1, 0.1, 0.9, 0.4, 0.4, 1, 0, 0.6];
    for (const dt of [1 / 120, 1 / 60, 1 / 30, 0.05]) {
      let p: Presence = { layer: "front", bright: 1, fade: 1 };
      for (let i = 0; i < 200; i++) {
        const dim = targets[i % targets.length];
        const next = stepPresence(p, { layer: "front", dim, overlapping: false }, dt);
        const gap = Math.abs(dim - p.bright);
        expect(Math.abs(next.bright - p.bright)).toBeLessThanOrEqual(gap * (1 - Math.exp(-dt / 0.6)) + 1e-12);
        // (toward the target, never past it)
        expect(Math.abs(dim - next.bright)).toBeLessThanOrEqual(gap + 1e-12);
        p = next;
      }
    }
    // and it does move: an eased approach, not a hold (0.6 s takes it 1 − 1/e of the way)
    const after = run({ layer: "front", bright: 1, fade: 1 }, { layer: "front", dim: 0.4, overlapping: false }, 21)[20];
    expect(after.bright).toBeCloseTo(0.4 + 0.6 * Math.exp(-21 / 60 / 0.6), 9);
  });

  test("a swap while clear is instant", () => {
    // going behind: on the very step it is asked for, the opacity untouched
    const back = stepPresence({ layer: "front", bright: 1, fade: 1 }, { layer: "back", dim: 0.4, overlapping: false }, DT);
    expect(back.layer).toBe("back");
    expect(back.fade).toBe(1);
    // coming in front: once the request has held for HOLD (the hysteresis), at once, the opacity untouched
    const steps = run({ layer: "back", bright: 0.4, fade: 1 }, { layer: "front", dim: 1, overlapping: false }, 12);
    const at = steps.findIndex((p) => p.layer === "front");
    expect(at).toBeGreaterThan(0);
    expect((at + 1) * DT).toBeGreaterThanOrEqual(HOLD - 1e-9);
    expect((at + 1) * DT).toBeLessThan(HOLD + 1.5 * DT);
    for (const p of steps) expect(p.fade).toBe(1);
  });

  test("every swap is instant, over a line or not: the canvas never fades (Liam, 2026-10-18: a dip read as the pendant vanishing)", () => {
    for (const bright of [0.4, 1]) {
      const back = run({ layer: "front", bright, fade: 1 }, { layer: "back", dim: 0.4, overlapping: true }, 10);
      expect(back[0].layer).toBe("back");
      for (const p of back) expect(p.fade).toBe(1);
      const fwd = run({ layer: "back", bright: 0.4, fade: 1 }, { layer: "front", dim: bright, overlapping: true }, 20);
      expect(fwd.at(-1)!.layer).toBe("front");
      for (const p of fwd) expect(p.fade).toBe(1);
    }
  });

  test("a lit pendant sent behind dims quickly there (BACK_TAU), never stepping", () => {
    expect(BACK_TAU).toBeLessThan(BRIGHT_TAU);
    const steps = run({ layer: "front", bright: 1, fade: 1 }, { layer: "back", dim: 0.4, overlapping: true }, 60);
    // within 0.35 s it is within 0.05 of the behind level (0.6 x e^(-0.35 / 0.12) = 0.03)
    expect(steps[Math.ceil(0.35 / DT)].bright - 0.4).toBeLessThan(0.05);
    for (let i = 1; i < steps.length; i++) expect(steps[i].bright).toBeLessThanOrEqual(steps[i - 1].bright);
    // in front, the same brightening keeps the slow BRIGHT_TAU
    const up = run({ layer: "front", bright: 0.4, fade: 1 }, { layer: "front", dim: 1, overlapping: false }, 21);
    expect(up[20].bright).toBeLessThan(0.75);
  });

  test("back-and-forth requests within 0.1 s don't swap", () => {
    expect(HOLD).toBe(0.1);
    // behind, asked in front for less than the hold, then behind again, over and over: it never comes in front
    let p: Presence = { layer: "back", bright: 0.4, fade: 1 };
    for (let k = 0; k < 20; k++) {
      for (const q of run(p, { layer: "front", dim: 1, overlapping: false }, 5)) { p = q; expect(p.layer).toBe("back"); }
      for (const q of run(p, { layer: "back", dim: 0.4, overlapping: false }, 2)) { p = q; expect(p.layer).toBe("back"); }
    }
    expect(p.fade).toBe(1);
    // in front, sent behind (at once: readability never waits), then asked in front again within the hold, over and over:
    // one swap, and it stays behind (no flicker)
    p = { layer: "front", bright: 1, fade: 1 };
    const seen: Layer[] = [];
    for (let k = 0; k < 20; k++) {
      for (const q of run(p, { layer: "back", dim: 0.4, overlapping: false }, 2)) { p = q; seen.push(p.layer); }
      for (const q of run(p, { layer: "front", dim: 1, overlapping: false }, 5)) { p = q; seen.push(p.layer); }
    }
    expect(seen.every((l) => l === "back")).toBe(true);
    // overlapping, the same jiggle never starts a dip in the asked direction
    p = { layer: "back", bright: 0.4, fade: 1 };
    for (let k = 0; k < 20; k++) {
      for (const q of run(p, { layer: "front", dim: 1, overlapping: true }, 5)) { p = q; expect(p).toMatchObject({ layer: "back", fade: 1 }); }
      for (const q of run(p, { layer: "back", dim: 0.4, overlapping: true }, 2)) { p = q; expect(p).toMatchObject({ layer: "back", fade: 1 }); }
    }
  });

  test("going behind never waits for the hold (readability binds)", () => {
    const first = stepPresence({ layer: "front", bright: 1, fade: 1 }, { layer: "back", dim: 0.4, overlapping: true }, DT);
    expect(first).toMatchObject({ layer: "back", fade: 1 });
  });

  test("a zero step changes nothing but the layer asked behind", () => {
    const p: Presence = { layer: "back", bright: 0.7, fade: 1, goal: "back", pending: 0 };
    expect(stepPresence(p, { layer: "back", dim: 0.4, overlapping: true }, 0)).toMatchObject({ layer: "back", bright: 0.7, fade: 1 });
  });
});

describe("behindAhead", () => {
  /** Behind the words and over them on [a, b), not elsewhere. */
  const back = (...spans: [number, number][]) => (s: number) => spans.some(([a, b]) => s >= a && s < b);

  test("a sustained stretch behind within the lead, in the direction of travel, counts", () => {
    const at = back([1000, 2000]);
    expect(behindAhead(at, 500, 600, 1)).toBe(true);
    expect(behindAhead(at, 500, 400, 1)).toBe(false); // (beyond the lead)
    expect(behindAhead(at, 2500, 600, -1)).toBe(true); // (scrolling back into it)
    expect(behindAhead(at, 2500, 600, 1)).toBe(false); // (it is behind, moving away)
  });

  test("at rest it never looks ahead: a pendant that stays in front is never dimmed for what it doesn't reach", () => {
    const at = back([520, 2000]);
    expect(behindAhead(at, 500, 0, 1)).toBe(false);
    expect(behindAhead(at, 500, 600, 0)).toBe(false);
  });

  test("a brief blip behind (shorter than MIN_BACK) is passed over; a real stretch past it still counts", () => {
    const blip = back([600, 600 + MIN_BACK - AHEAD_STEP]);
    expect(behindAhead(blip, 500, 800, 1)).toBe(false);
    expect(behindAhead(back([600, 600 + MIN_BACK - AHEAD_STEP], [900, 1500]), 500, 800, 1)).toBe(true);
    // (a stretch that starts inside the lead and runs on past it counts)
    expect(behindAhead(back([590, 5000]), 500, 100, 1)).toBe(true);
  });
});

describe("lagAhead", () => {
  const TAU = 0.25;
  test("the page held: the lag shrinks as the pendant catches up, to nothing where the page is", () => {
    // after a Page Down: the page 900 px ahead and still
    expect(lagAhead(1000, 1000, 900, 0, TAU)).toBe(900);
    expect(lagAhead(1300, 1000, 900, 0, TAU)).toBe(600);
    expect(lagAhead(1900, 1000, 900, 0, TAU)).toBe(0);
    expect(lagAhead(2500, 1000, 900, 0, TAU)).toBe(0);
    // and going back up the same
    expect(lagAhead(800, 1000, -400, 0, TAU)).toBe(-200);
  });
  test("a page still scrolling the same way keeps its pace times the time constant, never more than today's lag", () => {
    // a steady 1500 px/s: about 375 px, kept all the way ahead
    expect(lagAhead(3000, 1000, 375, 1500, TAU)).toBe(375);
    // a page that slowed: the lag shrinks only to what its pace keeps
    expect(lagAhead(3000, 1000, 600, 800, TAU)).toBe(200);
    // speeding up: never more than today's
    expect(lagAhead(3000, 1000, 100, 4000, TAU)).toBe(100);
    // a page turned back the other way keeps nothing of today's
    expect(lagAhead(1500, 1000, 375, -1500, TAU)).toBe(0);
  });
  test("no lag, none ahead", () => {
    expect(lagAhead(1500, 1000, 0, 1500, TAU)).toBe(0);
  });
});

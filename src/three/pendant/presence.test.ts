// src/three/pendant/presence.test.ts
import { describe, expect, test } from "vitest";
import { AHEAD_STEP, ARRIVE, behindAhead, BRIGHT_TAU, FADE_IN, FADE_OUT, HOLD, MIN_BACK, stepPresence, type Presence } from "./presence";
import type { Layer } from "./shots";

const DT = 1 / 60;

/** Steps `p` `n` times with the same want, returning every state after it (the first is after one step). */
function run(p: Presence, want: { layer: Layer; dim: number; overlapping: boolean }, n: number, dt = DT): Presence[] {
  const out: Presence[] = [];
  for (let i = 0; i < n; i++) { p = stepPresence(p, want, dt); out.push(p); }
  return out;
}

describe("stepPresence", () => {
  test("bright never changes by more than 1 − e^(−dt/0.35) of the gap per step", () => {
    expect(BRIGHT_TAU).toBe(0.35);
    // any dt (a 120 Hz frame, a 60 Hz one, a long one a tab coming back caps), any target, a target that jumps every step
    const targets = [0.4, 1, 0.1, 0.9, 0.4, 0.4, 1, 0, 0.6];
    for (const dt of [1 / 120, 1 / 60, 1 / 30, 0.05]) {
      let p: Presence = { layer: "front", bright: 1, fade: 1 };
      for (let i = 0; i < 200; i++) {
        const dim = targets[i % targets.length];
        const next = stepPresence(p, { layer: "front", dim, overlapping: false }, dt);
        const gap = Math.abs(dim - p.bright);
        expect(Math.abs(next.bright - p.bright)).toBeLessThanOrEqual(gap * (1 - Math.exp(-dt / 0.35)) + 1e-12);
        // (toward the target, never past it)
        expect(Math.abs(dim - next.bright)).toBeLessThanOrEqual(gap + 1e-12);
        p = next;
      }
    }
    // and it does move: an eased approach, not a hold (0.35 s takes it 1 − 1/e of the way)
    const after = run({ layer: "front", bright: 1, fade: 1 }, { layer: "front", dim: 0.4, overlapping: false }, 21)[20];
    expect(after.bright).toBeCloseTo(0.4 + 0.6 * Math.exp(-21 / 60 / 0.35), 9);
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

  test("a swap while overlapping fades out, flips at 0, fades in", () => {
    // in front over a line, sent behind it (its own dim already the behind level, so the fade-in runs at its own pace)
    const steps = run({ layer: "front", bright: 0.4, fade: 1 }, { layer: "back", dim: 0.4, overlapping: true }, 40);
    const flip = steps.findIndex((p) => p.layer === "back");
    expect(flip).toBeGreaterThan(0);
    // out: the fade only falls while it is still in front, reaching 0 on the step it flips
    for (let i = 0; i < flip; i++) {
      expect(steps[i].layer).toBe("front");
      expect(steps[i].fade).toBeLessThan(i === 0 ? 1 : steps[i - 1].fade);
    }
    expect(steps[flip].fade).toBe(0);
    expect((flip + 1) * DT).toBeCloseTo(FADE_OUT, 1);
    // in: behind now, the fade only rises, back to 1 over FADE_IN
    const done = steps.findIndex((p, i) => i > flip && p.fade === 1);
    expect(done).toBeGreaterThan(flip);
    for (let i = flip + 1; i <= done; i++) {
      expect(steps[i].layer).toBe("back");
      expect(steps[i].fade).toBeGreaterThan(steps[i - 1].fade);
    }
    expect((done - flip) * DT).toBeCloseTo(FADE_IN, 1);
    for (const p of steps.slice(done)) { expect(p.layer).toBe("back"); expect(p.fade).toBe(1); }
    // and the other way (behind a line, asked in front of it): after the hold, the same dip
    const fwd = run({ layer: "back", bright: 1, fade: 1 }, { layer: "front", dim: 1, overlapping: true }, 40);
    const f2 = fwd.findIndex((p) => p.layer === "front");
    expect(fwd[f2].fade).toBe(0);
    for (let i = 0; i < f2; i++) expect(fwd[i].layer).toBe("back");
    expect(fwd.at(-1)).toMatchObject({ layer: "front", fade: 1 });
    // a dip whose line moves away mid-fade swaps there and then (nothing is crossed any more) and comes back in
    let p: Presence = { layer: "front", bright: 0.4, fade: 1 };
    for (const q of run(p, { layer: "back", dim: 0.4, overlapping: true }, 3)) p = q;
    expect(p.layer).toBe("front");
    expect(p.fade).toBeLessThan(1);
    p = stepPresence(p, { layer: "back", dim: 0.4, overlapping: false }, DT);
    expect(p.layer).toBe("back");
    expect(run(p, { layer: "back", dim: 0.4, overlapping: false }, 20).at(-1)!.fade).toBe(1);
  });

  test("going behind arrives dimmed", () => {
    // full bright in front over a line, sent behind it: the brightness has eased to the behind level before the fade-in ends
    const steps = run({ layer: "front", bright: 1, fade: 1 }, { layer: "back", dim: 0.4, overlapping: true }, 240);
    const flip = steps.findIndex((p) => p.layer === "back");
    const done = steps.findIndex((p) => p.layer === "back" && p.fade === 1);
    expect(flip).toBeGreaterThan(0);
    expect(done).toBeGreaterThan(flip);
    expect(steps[done].bright - 0.4).toBeLessThanOrEqual(ARRIVE + 1e-9);
    // and on the way it never shows brighter than the behind level by more than it is hidden: behind, the fade holds back
    // while the brightness is far from it (never full bright behind the words)
    for (const p of steps.slice(flip)) {
      if (p.bright - 0.4 > ARRIVE + 0.3) expect(p.fade).toBe(0);
      expect(p.fade * (p.bright - 0.4)).toBeLessThan(0.2);
    }
    // the fade-in never falls: it waits, then rises
    for (let i = flip + 1; i < steps.length; i++) expect(steps[i].fade).toBeGreaterThanOrEqual(steps[i - 1].fade);
    // while a dim already there (the tumble's own) comes back in at FADE_IN's pace
    const quick = run({ layer: "front", bright: 0.4, fade: 1 }, { layer: "back", dim: 0.4, overlapping: true }, 40);
    expect(quick.findIndex((p) => p.layer === "back" && p.fade === 1)).toBeLessThan(Math.ceil((FADE_OUT + FADE_IN) / DT) + 2);
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

  test("going behind never waits for the hold (readability binds); a dip asked back to the layer it is on rises again unswapped", () => {
    // sent behind while overlapping: the fade-out starts on that very step
    const first = stepPresence({ layer: "front", bright: 1, fade: 1 }, { layer: "back", dim: 0.4, overlapping: true }, DT);
    expect(first.fade).toBeLessThan(1);
    // mid-dip, asked in front again (the layer it is still on: no new layer, so no hold): the fade rises at once, no swap
    let p = first;
    for (const q of run(p, { layer: "back", dim: 0.4, overlapping: true }, 3)) p = q;
    const low = p.fade;
    const back = run(p, { layer: "front", dim: 1, overlapping: true }, 40);
    for (const q of back) expect(q.layer).toBe("front");
    expect(Math.min(...back.map((q) => q.fade))).toBeGreaterThan(0);
    expect(back.at(-1)!.fade).toBe(1);
    expect(low).toBeLessThan(1);
  });

  test("a zero step changes nothing", () => {
    const p: Presence = { layer: "front", bright: 0.7, fade: 0.5, goal: "back", pending: 0 };
    expect(stepPresence(p, { layer: "back", dim: 0.4, overlapping: true }, 0)).toMatchObject({ layer: "front", bright: 0.7, fade: 0.5 });
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

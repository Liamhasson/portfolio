import { describe, expect, test } from "vitest";
import { DeskInvite, INVITE, deskWindow, inWindow, lidStartFrame } from "./desk-invite";
import { BEATS, SNAP_FROM, pAtFrame, type ShotBeats } from "@/three/sand/story-timeline";
import camera from "../../../../public/lab/shot/camera.json";

const SHOT = camera.beats as ShotBeats;
const LID = (camera.path as { lid_open_deg: number }[]).map((f) => f.lid_open_deg);
const DT = 1 / 60;

/** Runs `seconds` of frames; returns every frame's result. */
function run(inv: DeskInvite, seconds: number, opts: { live?: boolean; reduced?: boolean } = {}) {
  const out = [];
  for (let i = 0, n = Math.round(seconds / DT); i < n; i++) out.push(inv.step(DT, { live: opts.live ?? true, reduced: opts.reduced ?? false }));
  return out;
}

describe("the desk window", () => {
  test("the lid's first move is found in the shot, and the window ends on the frame before it", () => {
    const f = lidStartFrame(LID);
    expect(LID[f]).toBe(0);
    expect(LID[f + 1]).toBeGreaterThan(0);
    expect(lidStartFrame([0, 0, 0, 5, 20])).toBe(2);
  });

  test("from the camera settled over the desk to the lid starting to open: never the hero, the screen or the index", () => {
    const [a, b] = deskWindow(LID, SHOT);
    expect(a).toBe(BEATS.tilt[1]);
    expect(b).toBeCloseTo(pAtFrame(lidStartFrame(LID), SHOT), 6);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThan(BEATS.tail[0]);           // before the push into the screen
    expect(b).toBeLessThan(SNAP_FROM);
    expect(inWindow(BEATS.hero[1], [a, b])).toBe(false);
    expect(inWindow(BEATS.hold[1], [a, b])).toBe(false);
    expect(inWindow(BEATS.takeover[0], [a, b])).toBe(false);
    expect(inWindow((BEATS.deskView[0] + BEATS.deskView[1]) / 2, [a, b])).toBe(true);   // reduced motion's held desk too
  });
});

describe("the idle tease and the cue", () => {
  test("nothing before 1.5 s; the tease from 1.5 s, eased in; the text at 3 s", () => {
    const inv = new DeskInvite();
    const early = run(inv, INVITE.teaseAfter - 0.05);
    expect(early.every((f) => f.tease === 0 && !f.cue)).toBe(true);
    const rising = run(inv, 0.3);
    expect(rising[0].tease).toBeLessThan(0.01);                      // eases in: never a jolt
    expect(rising.at(-1)!.tease).toBeGreaterThan(0);
    for (let i = 1; i < rising.length; i++) expect(rising[i].tease).toBeGreaterThanOrEqual(rising[i - 1].tease);
    expect(rising.every((f) => !f.cue)).toBe(true);
    const later = run(inv, INVITE.cueAfter - INVITE.teaseAfter - 0.3 - 0.05);
    expect(later.at(-1)!.cue).toBe(false);
    expect(later.at(-1)!.tease).toBeGreaterThan(0.9);               // at its peak by then
    expect(run(inv, 0.15).at(-1)!.cue).toBe(true);
    expect(run(inv, 5).at(-1)!.tease).toBeCloseTo(1, 3);             // and it holds, never past it
  });

  test("a scroll lets both go: the text at once, the tease eased back with no jump", () => {
    const inv = new DeskInvite();
    run(inv, 4);
    inv.poke();
    const back = run(inv, 1.5);
    expect(back[0].cue).toBe(false);
    let prev = 1;
    for (const f of back) {
      expect(f.tease).toBeLessThanOrEqual(prev + 1e-9);
      expect(prev - f.tease).toBeLessThan(0.15);                     // no step bigger than a small share per frame
      prev = f.tease;
    }
    expect(back.at(-1)!.tease).toBe(0);
  });

  test("scrolling resets the clock: the tease and text wait their full time again", () => {
    const inv = new DeskInvite();
    run(inv, 1.2);
    inv.poke();
    expect(run(inv, 1.2).every((f) => f.tease === 0)).toBe(true);
    inv.poke();
    const again = run(inv, INVITE.cueAfter - 0.05);
    expect(again.at(-1)!.cue).toBe(false);
    expect(again.at(-1)!.tease).toBeGreaterThan(0);
  });

  test("a scroll mid-rise turns it back smoothly", () => {
    const inv = new DeskInvite();
    run(inv, INVITE.teaseAfter + 0.4);
    const peak = inv.tease;
    expect(peak).toBeGreaterThan(0);
    inv.poke();
    const back = run(inv, 0.8);
    expect(Math.max(...back.map((f) => f.tease))).toBeLessThan(peak + 0.05);   // a gentle crest, not a lurch onward
    expect(back.at(-1)!.tease).toBeLessThan(0.01);
  });

  test("reduced motion: no lid or camera, only the text", () => {
    const inv = new DeskInvite();
    const frames = run(inv, 4, { reduced: true });
    expect(frames.every((f) => f.tease === 0)).toBe(true);
    expect(frames.at(-1)!.cue).toBe(true);
    inv.poke();
    expect(inv.step(DT, { live: true, reduced: true }).cue).toBe(false);
  });

  test("only inside the desk window: off it, nothing, however long the visitor waits", () => {
    const inv = new DeskInvite();
    expect(run(inv, 10, { live: false }).every((f) => f.tease === 0 && !f.cue)).toBe(true);
    // on the desk, then out of the window (scrolled into the lid's opening, a note's story): both go, the clock restarts
    run(inv, 4);
    const out = run(inv, 1.5, { live: false });
    expect(out[0].cue).toBe(false);
    expect(out.at(-1)!.tease).toBe(0);
    expect(run(inv, 1).every((f) => f.tease === 0)).toBe(true);
  });

  test("any frame time is stable (a long frame never overshoots)", () => {
    const inv = new DeskInvite();
    for (let i = 0; i < 40; i++) {
      const f = inv.step(0.1, { live: true, reduced: false });
      expect(f.tease).toBeGreaterThanOrEqual(0);
      expect(f.tease).toBeLessThanOrEqual(1);
    }
  });
});

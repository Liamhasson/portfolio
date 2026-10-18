import { describe, expect, test } from "vitest";
import { DeskInvite, INVITE, deskWindow, inWindow, lidStartFrame } from "./desk-invite";
import { BEATS, SNAP_FROM, pAtFrame, type ShotBeats } from "@/three/sand/story-timeline";
import camera from "../../../../public/lab/shot/camera.json";

const SHOT = camera.beats as ShotBeats;
const LID = (camera.path as { lid_open_deg: number }[]).map((f) => f.lid_open_deg);
const DT = 1 / 60;

/** Runs `seconds` of frames; returns every frame's result. */
interface Opts { live?: boolean; reduced?: boolean; hover?: boolean; veil?: number; forward?: number }
/** One frame: the clock and lid, then the lean (`forward`: the path's move this frame, in shares of the lean). */
function frame(inv: DeskInvite, o: Opts = {}, dt = DT) {
  if (o.forward) inv.poke();   // (the path moves only when the page scrolls)
  inv.step(dt, o.live ?? true, o.reduced ?? false, o.hover ?? false, o.veil ?? 0);
  inv.leanStep(dt, o.forward ?? 0);
  return { tease: inv.tease, lean: inv.lean, cue: inv.cue };
}
function run(inv: DeskInvite, seconds: number, opts: Opts = {}) {
  const out = [];
  for (let i = 0, n = Math.round(seconds / DT); i < n; i++) out.push(frame(inv, opts));
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
    expect(frames.every((f) => f.tease === 0 && f.lean === 0)).toBe(true);
    expect(frames.at(-1)!.cue).toBe(true);
    inv.poke();
    expect(frame(inv, { reduced: true }).cue).toBe(false);
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
      const f = frame(inv, {}, 0.1);
      expect(f.tease).toBeGreaterThanOrEqual(0);
      expect(f.tease).toBeLessThanOrEqual(1);
    }
  });

  test("the lid and the lean rise together while idle", () => {
    const inv = new DeskInvite();
    const f = run(inv, 3).at(-1)!;
    expect(f.lean).toBeCloseTo(f.tease, 6);
    expect(inv.step(DT, true, false)).toBeUndefined();   // (written into its fields: nothing new each frame)
  });

  test("a small scroll down: the lean gives way only as fast as the path moves past it, so the camera never steps back", () => {
    const inv = new DeskInvite();
    run(inv, 4);
    inv.poke();
    // a scroll worth 0.6 of the lean, over 12 frames, then still
    let camera = 0, prevCam = 0, path = 0;
    const cams: number[] = [];
    for (let i = 0; i < 80; i++) {   // (under the 1.5 s after which the tease returns)
      const forward = i < 12 ? 0.05 : 0;
      path += forward;
      const f = frame(inv, { forward });
      camera = path + f.lean;
      cams.push(camera);
      expect(camera).toBeGreaterThanOrEqual(prevCam - 1e-9);
      prevCam = camera;
    }
    // held where the scroll left it: the path moved 0.6 on, so at least 0.4 of the lean is left, and it stays
    expect(inv.lean).toBeGreaterThanOrEqual(0.4 - 1e-9);
    expect(inv.lean).toBeLessThan(0.6);
    expect(cams.at(-1)).toBeCloseTo(cams[20], 9);
    expect(inv.tease).toBe(0);                            // the lid still eases shut
    // the visitor stays: the tease returns from there, never below it
    inv.step(DT, true, false); inv.leanStep(DT, 0);
    expect(inv.lean).toBeGreaterThanOrEqual(0.4 - 1e-9);
  });

  test("a scroll down past the lean: it's used up and the camera rides the path", () => {
    const inv = new DeskInvite();
    run(inv, 4);
    inv.poke();
    let prevCam = 1, path = 0;
    for (let i = 0; i < 60; i++) {
      path += 0.05;
      const cam = path + frame(inv, { forward: 0.05 }).lean;
      expect(cam).toBeGreaterThanOrEqual(prevCam - 1e-9);
      prevCam = cam;
    }
    expect(inv.lean).toBeLessThan(0.01);
    run(inv, 1, { forward: 0.05 });
    expect(inv.lean).toBe(0);
  });

  test("scrolling up: the lean eases back as before", () => {
    const inv = new DeskInvite();
    run(inv, 4);
    inv.poke();
    const back = run(inv, 1.5, { forward: -0.02 });
    for (let i = 1; i < back.length; i++) expect(back[i].lean).toBeLessThanOrEqual(back[i - 1].lean + 1e-9);
    expect(back.at(-1)!.lean).toBe(0);
  });

  test("a hovered note is activity: the tease and text wait, and a held lean eases back", () => {
    const inv = new DeskInvite();
    const hovering = run(inv, 5, { hover: true });
    expect(hovering.every((f) => f.tease === 0 && f.lean === 0 && !f.cue)).toBe(true);
    run(inv, 4);
    inv.poke();
    run(inv, 0.2, { forward: 0.03 });
    run(inv, 0.5);
    const held = inv.lean;
    expect(held).toBeGreaterThan(0.5);                    // held after the small scroll
    const back = run(inv, 1.5, { hover: true });
    expect(back[0].lean).toBeGreaterThan(held - 0.05);   // eased, not cut
    expect(back.at(-1)!.lean).toBe(0);
  });

  test("reduced motion: the text stays off while the veil's crossfade is up", () => {
    const inv = new DeskInvite();
    run(inv, 4, { reduced: true });
    expect(frame(inv, { reduced: true, veil: 0.3 }).cue).toBe(false);
    expect(frame(inv, { reduced: true, veil: 0.04 }).cue).toBe(true);
  });

  test("a poke whose frame hasn't moved the page yet holds the lean (no step back on a wheel's lead frame)", () => {
    const inv = new DeskInvite();
    run(inv, 3, {});                       // idle on the desk: the tease and the lean at their peak
    const before = inv.lean;
    expect(before).toBeGreaterThan(0.9);
    inv.poke();
    inv.step(1 / 60, true, false, false, 0);
    inv.leanStep(1 / 60, 0);               // the wheel's lead frame: the page hasn't moved
    expect(inv.lean).toBe(before);
  });
});

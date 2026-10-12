// src/three/sand/story-timeline.test.ts
import { describe, expect, test } from "vitest";
import { BEATS, DESK_WAIT, SCREEN_HOLD, SNAP_FROM, STORY_SCREENS, deskWait, ease, pAtFrame, reducedStory, shotFrame, snapIn, span, storyProgress, type ShotBeats } from "./story-timeline";

const SHOT: ShotBeats = { ease: [0, 39], tilt: [39, 79], glide: [79, 149], tail: [149, 188] };   // public/lab/shot/camera.json

describe("story timeline", () => {
  test("the beats run in order, in screens, and end with the story", () => {
    expect(BEATS.hero[1]).toBeLessThanOrEqual(BEATS.compact[0]);
    expect(BEATS.compact[1]).toBeLessThanOrEqual(BEATS.hold[1]);
    expect(BEATS.hold[1]).toBeLessThanOrEqual(BEATS.tilt[0]);
    expect(BEATS.tilt[1]).toBeLessThanOrEqual(BEATS.glide[0]);
    expect(BEATS.glide[1]).toBeLessThanOrEqual(BEATS.tail[0]);
    expect(BEATS.indexIn[1]).toBe(STORY_SCREENS);
  });

  test("the hero copy is gone by the time the ball locks in", () => {
    expect(BEATS.copyOut[1]).toBeLessThanOrEqual(BEATS.compact[1]);
    expect(BEATS.copyOut[0]).toBeGreaterThanOrEqual(BEATS.compact[0]);
  });

  test("the desk in full view: after the tilt, before the laptop", () => {
    expect(BEATS.deskView[0]).toBeGreaterThanOrEqual(BEATS.tilt[1]);
    expect(BEATS.deskView[1]).toBeLessThanOrEqual(BEATS.tail[0]);
  });

  test("the way out of the screen is long (Liam, 2026-10-11): the last SCREEN_HOLD screens before the index hold in it", () => {
    const vh = 800, end = (STORY_SCREENS + SCREEN_HOLD) * vh;   // the index's anchor
    expect(SCREEN_HOLD).toBeGreaterThanOrEqual(0.6);
    expect(storyProgress(0, end)).toBe(0);
    expect(storyProgress(vh, end)).toBeCloseTo(1, 6);                      // a screen of scroll is a screen of story
    expect(storyProgress(end, end)).toBe(STORY_SCREENS);
    expect(storyProgress(end - SCREEN_HOLD * vh * 0.98, end)).toBe(STORY_SCREENS);   // scrolling back up: still in the screen
    expect(storyProgress(end - SCREEN_HOLD * vh * 1.2, end)).toBeLessThan(STORY_SCREENS);   // then out
    expect(storyProgress(end * 2, end)).toBe(STORY_SCREENS);
  });

  test("the snap into the screen: very close, scrolling down, not yet in; never on the way back out", () => {
    expect(SNAP_FROM).toBeGreaterThan(BEATS.tail[0] + 0.4);
    expect(SNAP_FROM).toBeLessThan(BEATS.tail[1]);
    expect(snapIn(SNAP_FROM + 0.01, SNAP_FROM - 0.01)).toBe(true);
    expect(snapIn(SNAP_FROM - 0.05, SNAP_FROM - 0.1)).toBe(false);           // not close enough
    expect(snapIn(SNAP_FROM + 0.1, SNAP_FROM + 0.15)).toBe(false);           // scrolling up, out of the screen
    expect(snapIn(STORY_SCREENS, SNAP_FROM)).toBe(false);                    // already in
  });

  test("span and ease clamp to 0..1", () => {
    expect(span(-1, [0, 1])).toBe(0);
    expect(span(2, [0, 1])).toBe(1);
    expect(ease(0.5, [0, 1])).toBeCloseTo(0.5);
    expect(ease(5, [0, 1])).toBe(1);
  });

  test("the shot's frame: the hero on frame 0, held between beats, the tail's last frame at the end", () => {
    expect(shotFrame(0, SHOT)).toBe(0);
    expect(shotFrame(BEATS.compact[1], SHOT)).toBe(39);
    expect(shotFrame((BEATS.hold[0] + BEATS.hold[1]) / 2, SHOT)).toBe(39);
    expect(shotFrame(BEATS.tilt[1], SHOT)).toBe(79);
    expect(shotFrame(BEATS.tail[1], SHOT)).toBe(188);
    expect(shotFrame(99, SHOT)).toBe(188);
  });

  test("the shot's frame never runs backwards", () => {
    let prev = -1;
    for (let p = 0; p <= STORY_SCREENS; p += 0.005) {
      const f = shotFrame(p, SHOT);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });

  test("pAtFrame inverts shotFrame", () => {
    for (const f of [0, 20, 39, 60, 79, 120, 149, 170, 188]) expect(shotFrame(pAtFrame(f, SHOT), SHOT)).toBeCloseTo(f, 5);
  });

  test("reduced motion: held states (cloud, ball, desk, index) joined by crossfades through black", () => {
    expect(reducedStory(0)).toEqual({ p: 0, veil: 0 });
    const ball = reducedStory(1.5), desk = reducedStory(2.9), index = reducedStory(STORY_SCREENS);
    expect(ball.p).toBe(BEATS.hold[0]);
    expect(desk.p).toBeGreaterThanOrEqual(BEATS.deskView[0]);
    expect(desk.p).toBeLessThanOrEqual(BEATS.deskView[1]);
    expect(index.p).toBe(STORY_SCREENS);
    expect(ball.veil + desk.veil + index.veil).toBe(0);
    for (const cut of [0.9, 2.2, 3.5]) expect(reducedStory(cut).veil).toBeCloseTo(1);
  });
});

describe("the wait for the desk (pre-launch audit; Liam, 2026-10-12: hold before the tilt)", () => {
  const end = 5100;   // the index's anchor (px)
  const wall = (DESK_WAIT / (STORY_SCREENS + SCREEN_HOLD)) * end;
  test("it waits on the formed ball, at the hold's end, just before the camera tilts", () => {
    expect(DESK_WAIT).toBe(BEATS.hold[1]);
    expect(DESK_WAIT).toBeLessThanOrEqual(BEATS.tilt[0]);
  });
  test("scrolling down onto the tilt with the desk not in: held at the wall", () => {
    expect(deskWait({ ready: false, p: 1.83, prevP: 1.79, end, jumping: false })).toBeCloseTo(wall, 6);
    expect(deskWait({ ready: false, p: 1.84, prevP: DESK_WAIT, end, jumping: false })).toBeCloseTo(wall, 6);   // (still pushing)
  });
  test("never once the desk is in, nor above the wall (scrolling back up stays free)", () => {
    expect(deskWait({ ready: true, p: 1.83, prevP: 1.79, end, jumping: false })).toBeNull();
    expect(deskWait({ ready: false, p: 1.6, prevP: 1.7, end, jumping: false })).toBeNull();
  });
  test("a jump past it isn't held, the index shows on its own: the nav's Projects, a link to the projects, an arrival below it", () => {
    expect(deskWait({ ready: false, p: 2.4, prevP: 1.7, end, jumping: true })).toBeNull();
    expect(deskWait({ ready: false, p: 4.3, prevP: 0, end, jumping: false })).toBeNull();   // (more than a screen in a frame)
    expect(deskWait({ ready: false, p: 3.1, prevP: 3.0, end, jumping: false })).toBeNull();   // (already past it)
  });
});

// src/three/sand/story-timeline.test.ts
import { describe, expect, test } from "vitest";
import { BEATS, STORY_SCREENS, ease, pAtFrame, reducedStory, shotFrame, span, type ShotBeats } from "./story-timeline";

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

  test("the desk headline arrives with the desk and leaves before the laptop", () => {
    expect(BEATS.headlineIn[0]).toBeGreaterThanOrEqual(BEATS.tilt[1] - 0.1);
    expect(BEATS.headlineOut[1]).toBeLessThanOrEqual(BEATS.tail[0]);
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
    expect(desk.p).toBeGreaterThanOrEqual(BEATS.headlineIn[1]);
    expect(desk.p).toBeLessThanOrEqual(BEATS.headlineOut[0]);
    expect(index.p).toBe(STORY_SCREENS);
    expect(ball.veil + desk.veil + index.veil).toBe(0);
    for (const cut of [0.9, 2.2, 3.5]) expect(reducedStory(cut).veil).toBeCloseTo(1);
  });
});

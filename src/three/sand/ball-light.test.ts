import { describe, expect, test } from "vitest";
import { BALL_KEY, ballKeyPos } from "./ball-light";

type V = [number, number, number];
const key: V = [-4, 4, 7], ball: V = [0, 0.1, 0], cam: V = [0, 0.6, 9.5];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V) => Math.hypot(...a);
const angle = (a: V, b: V) => Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (len(a) * len(b))) * 180 / Math.PI;

describe("the ball's key light swings to the side as it forms (Liam, 2026-10-11: too flat; the vortex's light stays)", () => {
  test("the vortex keeps its light: unmoved before the ball forms", () => {
    expect(ballKeyPos(key, ball, 0)).toEqual(key);
    expect(ballKeyPos(key, ball, BALL_KEY.from)).toEqual(key);
  });

  test("on the formed ball it rakes from the left, well off the camera's line", () => {
    const p = ballKeyPos(key, ball, 1);
    expect(p[0]).toBeLessThan(ball[0]);
    const a = angle(sub(p, ball), sub(cam, ball));
    expect(a).toBeGreaterThan(60);
    expect(a).toBeLessThan(80);
    expect(angle(sub(key, ball), sub(cam, ball))).toBeLessThan(40);   // where it was: near the camera, flat
  });

  test("its distance to the ball holds (its strength on the ball unchanged) and it moves smoothly", () => {
    let last = ballKeyPos(key, ball, 0);
    for (let c = 0.01; c <= 1.0001; c += 0.01) {
      const p = ballKeyPos(key, ball, c);
      expect(len(sub(p, ball))).toBeCloseTo(len(sub(key, ball)), 6);
      expect(len(sub(p, last))).toBeLessThan(0.3);
      last = p;
    }
  });
});

import { describe, expect, test } from "vitest";
import { vortexOnBall } from "./hero-layout";

// (Liam, 2026-10-12: "place the heart of the vortex in the center of the screen, where the ball will form, to make sure
// it will transform smoothly")
describe("the vortex's heart on the ball", () => {
  test("the cloud moves so its centre is the ball's: the ball forms where the vortex turns", () => {
    const chaosC: [number, number, number] = [-0.612, -0.441, 0.298], ballC: [number, number, number] = [0, 0.1, 0];
    const s = vortexOnBall(chaosC, ballC);
    expect(chaosC.map((v, i) => v + s[i])).toEqual(ballC.map((v) => expect.closeTo(v, 9)));
  });
  test("already there: no move", () => {
    expect(vortexOnBall([0, 0.1, 0], [0, 0.1, 0])).toEqual([0, 0, 0]);
  });
});

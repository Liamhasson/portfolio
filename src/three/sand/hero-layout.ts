/**
 * The vortex's heart on the ball (Liam, 2026-10-12: "place the heart of the vortex in the center of the screen, where
 * the ball will form, to make sure it will transform smoothly"; it had sat right of the copy since 2026-10-11). The
 * chaos cloud moves so its centre (and with it the vortex's) is the ball's: the ball then forms where the vortex turns,
 * at every viewport. Its shadows are looked up at the unmoved cloud (shaders.ts uChaosShift).
 */
type V3 = [number, number, number];

export function vortexOnBall(chaosC: V3, ballC: V3): V3 {
  return [ballC[0] - chaosC[0], ballC[1] - chaosC[1], ballC[2] - chaosC[2]];
}

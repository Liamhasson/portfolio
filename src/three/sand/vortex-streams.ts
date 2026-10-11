import type { StreamCurve } from "./drift-grains";

/**
 * Streams in and out of the frame (Liam, 2026-10-11, with the vortex: swirl.ts): thin streams of floating grains come
 * in from beyond the frame and curve into the vortex's rim, turning its way (counter-clockwise on screen), where it
 * swallows them; others are flung out of the rim, its way, and leave the frame. Each its own pace, width and spread.
 * Paths in the cloud's radii about its centre, in the view's frame (x right, y up, z toward the viewer), as
 * drift-grains.ts StreamCurve.
 */
/** The frame's half extents at the cloud, in cloud radii (the hero cloud fills the view; past these is out of frame). */
export const FRAME = { x: 1.1, y: 0.72 } as const;

const N = 40;

function bezier(p0: number[], p1: number[], p2: number[], t: number): [number, number, number] {
  const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
  return [0, 1, 2].map((i) => a * p0[i] + b * p1[i] + c * p2[i]) as [number, number, number];
}

function curve(name: string, p0: number[], p1: number[], p2: number[], width: number, fan: number, pace: number): StreamCurve & { name: string } {
  const points = Array.from({ length: N }, (_, i) => bezier(p0, p1, p2, i / (N - 1)));
  let length = 0;
  for (let i = 1; i < N; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2]);
  return { name, points, length, width, fan, pace };
}

/** Four in, four out, spread around the vortex (angles on screen), each at its own depth. */
export function vortexStreams(): (StreamCurve & { name: string })[] {
  const out: (StreamCurve & { name: string })[] = [];
  const angles = [0.35, 1.9, 3.4, 4.85];
  angles.forEach((th, k) => {
    const rim = 0.5 + 0.06 * k;                // where it meets the vortex (cloud radii)
    const z = (k % 2 ? 0.25 : -0.15) + 0.05 * k;
    // the rim point, the vortex's turning direction there (counter-clockwise), and outward
    const R = [Math.cos(th) * rim, Math.sin(th) * rim * 0.8, z];
    const T = [-Math.sin(th), Math.cos(th) * 0.8, 0];
    const O = [Math.cos(th), Math.sin(th) * 0.8, 0];
    const far = 1.75;                          // well past the frame's edge
    // in: from beyond the frame, behind the rim on the vortex's way, arriving along its turn
    const inStart = [O[0] * far - T[0] * 0.9, O[1] * far - T[1] * 0.9, z - 0.2];
    const inCtrl = [R[0] - T[0] * 0.75 + O[0] * 0.35, R[1] - T[1] * 0.75 + O[1] * 0.35, z];
    out.push(curve(`in ${k + 1}`, inStart, inCtrl, R, 4 + k, 0.06 + 0.02 * k, 10 + 1.7 * k));
    // out: flung off the rim a quarter-turn on, along its turn, then away out of the frame
    const th2 = th + 1.1, rim2 = rim + 0.05;
    const R2 = [Math.cos(th2) * rim2, Math.sin(th2) * rim2 * 0.8, -z];
    const T2 = [-Math.sin(th2), Math.cos(th2) * 0.8, 0];
    const O2 = [Math.cos(th2), Math.sin(th2) * 0.8, 0];
    const outCtrl = [R2[0] + T2[0] * 0.7 + O2[0] * 0.3, R2[1] + T2[1] * 0.7 + O2[1] * 0.3, -z];
    const outEnd = [O2[0] * far + T2[0] * 0.9, O2[1] * far + T2[1] * 0.9, -z + 0.2];
    out.push(curve(`out ${k + 1}`, R2, outCtrl, outEnd, 3 + k * 1.5, 0.1 + 0.025 * k, 8.5 + 1.9 * k));
  });
  return out;
}

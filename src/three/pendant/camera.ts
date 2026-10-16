// src/three/pendant/camera.ts
/**
 * The pendant's camera (spec 2026-10-16-about-pendant-design.md §3, §4): given a frame (what the shots blend to) and the
 * motion's angles, stand the camera, tilt the pendant and shift the lens so the aim point lands on the shot's screen spot.
 * Pure three maths (no renderer, no DOM): the numbers are the working prototype's (pendant-film-v3) `frame()`.
 * Rig: `outer` holds `inner`, which holds the model with its origin at mid-height. `outer` carries the screen-relative
 * lay / tumble / lean; `inner` carries the spin about the pendant's own axis.
 */
import { Euler, Quaternion, Vector3 } from "three";
import type { Box3, Object3D, PerspectiveCamera } from "three";
import { breath, type MotionState } from "./motion";
import type { Frame } from "./shots";

/** A box on screen, in px from the top-left. */
export interface Box { l: number; t: number; r: number; b: number }
/** The eased cursor lean, in radians (x leans the camera up/down, y left/right). */
export interface Look { x: number; y: number }
export interface PoseOptions {
  /** Switch the always-on drift off: no camera drift, no roll wander, no breathing in the pendant's angles. For tests and
   *  for a reduced-motion caller that wants a held frame. The cursor's lean (`look`) is its own input and stays. */
  still?: boolean;
}

const D = Math.PI / 180;
/** How far the cursor's lean turns the camera, as a share of `look` (the eased lean itself is already small). */
const LOOK_GAIN = 0.4;
/** Breathing amplitudes (radians): the pendant's slow rocking end over end and side to side. */
const BREATH_PITCH = 0.05;
const BREATH_ROLL = 0.04;
/** The camera's roll wander (radians) and its drift (a share of the distance). */
const ROLL_WANDER = 0.012;
const DRIFT = 0.006;

/** How far the camera stands for a pendant of unit height to fill `h` of the screen's height through this lens. */
export function distanceFor(h: number, fovDeg: number): number {
  return 1 / (2 * h * Math.tan((fovDeg * D) / 2));
}

const camQ = new Quaternion();
const tmpQ = new Quaternion();
const tmpE = new Euler();
const dir = new Vector3();
const aimW = new Vector3();
const corner = new Vector3();

/**
 * Pose the whole rig for one frame. `time` is seconds (for the breathing and drift). `look` is the cursor's lean.
 * The order matters: the camera is first oriented from az / el / roll alone, because the pendant's rotation is expressed in
 * the camera's frame, and the camera's position depends on where the pendant's aim point ends up.
 */
export function poseRig(
  f: Frame, m: MotionState, time: number, look: Look, vw: number, vh: number,
  camera: PerspectiveCamera, outer: Object3D, inner: Object3D, opts: PoseOptions = {},
): void {
  const live = !opts.still;
  const az = f.az * D;
  const el = f.el * D;

  // 1. the camera's orientation, independent of where it stands. dir points from the aim to the camera.
  dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  camera.position.set(0, 0, 0);
  camera.up.set(0, 1, 0);
  if (Math.abs(f.el) > 85) camera.up.set(Math.sin(az), 0, Math.cos(az)); // looking straight down: keep "up" defined
  camera.lookAt(-dir.x, -dir.y, -dir.z);
  camera.rotateZ(f.roll * D + (live ? breath(time * 0.6, 4) * ROLL_WANDER : 0));
  camQ.copy(camera.quaternion);

  // 2. the pendant: laid over / tumbled in screen terms (camera-relative), then spun about its own axis
  tmpE.set(
    m.pitch + m.handPitch + (live ? breath(time, 1) * BREATH_PITCH : 0),
    0,
    -f.rz * D + m.tilt + (live ? breath(time, 2) * BREATH_ROLL : 0),
  );
  tmpQ.setFromEuler(tmpE);
  outer.quaternion.copy(camQ).multiply(tmpQ).multiply(camQ.clone().invert());
  inner.rotation.set(0, m.yaw, 0);
  outer.position.set(0, 0, 0);
  outer.updateMatrixWorld(true);
  aimW.set(f.aim[0], f.aim[1], f.aim[2]);
  inner.localToWorld(aimW);

  // 3. where the camera stands: far enough for the asked size, through this lens
  camera.aspect = vw / vh;
  camera.fov = f.fov;
  camera.updateProjectionMatrix(); // before the lens shift below: it would overwrite it
  const dist = distanceFor(f.h, f.fov);
  camera.position.copy(aimW).addScaledVector(dir, dist);
  if (live) {
    camera.position.x += breath(time * 0.5, 7) * DRIFT * dist;
    camera.position.y += breath(time * 0.5, 9) * DRIFT * dist;
  }

  // 4. the cursor leans the camera a little
  camera.rotateX(look.x * LOOK_GAIN);
  camera.rotateY(look.y * LOOK_GAIN);
  camera.updateMatrixWorld(true);

  // 5. put the aim point where the shot wants it on screen: a lens shift, so the perspective stays true
  const P = camera.projectionMatrix.elements;
  P[8] = -(f.ax * 2 - 1);
  P[9] = -(1 - f.ay * 2);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

/** The pendant's bounds (in the model's own space) as a box on screen: all eight corners, projected. Call after `poseRig`. */
export function screenBox(bounds: Box3, inner: Object3D, camera: PerspectiveCamera, vw: number, vh: number): Box {
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        corner.set(x, y, z);
        inner.localToWorld(corner);
        corner.project(camera);
        const sx = ((corner.x + 1) / 2) * vw;
        const sy = ((1 - corner.y) / 2) * vh;
        if (sx < l) l = sx;
        if (sx > r) r = sx;
        if (sy < t) t = sy;
        if (sy > b) b = sy;
      }
    }
  }
  return { l, t, r, b };
}

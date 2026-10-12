// src/three/sand/contact-view.ts
import * as THREE from "three";

/** Contact's framing (spec 2026-10-12-about-contact-design.md §4): the ball about 30% of the view's height, its centre
 *  a little above the middle, so the words sit below it. */
export const CONTACT_FRAME = { share: 0.3, at: 0.42 } as const;

/** Where the camera stands, keeping its orientation `q`, so the ball (centre, radius) fills `share` of the view's height
 *  with its centre `at` from the top. */
export function contactView(q: THREE.Quaternion, ballC: THREE.Vector3, ballR: number, vfovRad: number, frame: { share: number; at: number } = CONTACT_FRAME): THREE.Vector3 {
  const tanV = Math.tan(vfovRad / 2);
  const d = ballR / (frame.share * tanV);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const yNdc = 1 - 2 * frame.at;   // (the ball's centre above the middle: the camera stands that much lower)
  return ballC.clone().addScaledVector(fwd, -d).addScaledVector(up, -yNdc * d * tanV);
}

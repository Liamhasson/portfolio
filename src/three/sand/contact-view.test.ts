// src/three/sand/contact-view.test.ts
import * as THREE from "three";
import { expect, test } from "vitest";
import { CONTACT_FRAME, contactView } from "./contact-view";

test("Contact's camera: the ball fills about 30% of the view's height, its centre 42% from the top, centred across", () => {
  const cam = new THREE.PerspectiveCamera(30, 16 / 10, 0.1, 100);
  cam.position.set(0, 0.4, 9); cam.lookAt(0, 0.1, 0);
  const ballC = new THREE.Vector3(0.2, 0.1, -0.3), ballR = 1.1;
  cam.position.copy(contactView(cam.quaternion, ballC, ballR, THREE.MathUtils.degToRad(cam.fov)));
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const c = ballC.clone().project(cam);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
  const top = ballC.clone().addScaledVector(up, ballR).project(cam);
  expect((1 - c.y) / 2).toBeCloseTo(CONTACT_FRAME.at, 2);
  expect(c.x).toBeCloseTo(0, 3);
  expect(Math.abs(top.y - c.y)).toBeCloseTo(CONTACT_FRAME.share, 1);   // (a diameter's share of the height, NDC spans 2)
});

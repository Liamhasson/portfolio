// src/three/pendant/camera.test.ts
import { describe, expect, it } from "vitest";
import { Box3, Object3D, PerspectiveCamera, Vector3 } from "three";
import { distanceFor, poseRig, screenBox } from "./camera";
import type { Frame } from "./shots";
import { REST, type MotionState } from "./motion";

const D = Math.PI / 180;
const VW = 1440;
const VH = 900;
const NO_LOOK = { x: 0, y: 0 };

const frame = (over: Partial<Frame> = {}): Frame => ({
  az: 0, el: 0, roll: 0, fov: 30, h: 0.4, aim: [0, 0, 0], spin: 0, tumble: 0, rz: 0, lock: null,
  layer: "front", dim: 1, aperture: 0.001, glass: 0, wire: 1, index: 0, t: 0, ax: 0.5, ay: 0.5,
  ...over,
});

const rig = () => {
  const camera = new PerspectiveCamera(30, VW / VH, 0.1, 100);
  const outer = new Object3D();
  const inner = new Object3D();
  outer.add(inner);
  return { camera, outer, inner };
};

/** A point in the model's local space, as screen px. */
const toScreen = (p: readonly [number, number, number], inner: Object3D, camera: PerspectiveCamera) => {
  const v = new Vector3(...p);
  inner.localToWorld(v);
  v.project(camera);
  return { x: ((v.x + 1) / 2) * VW, y: ((1 - v.y) / 2) * VH };
};

const pose = (f: Frame, m: MotionState = REST, look = NO_LOOK, time = 0, still = true) => {
  const r = rig();
  poseRig(f, m, time, look, VW, VH, r.camera, r.outer, r.inner, { still });
  return r;
};

describe("distanceFor", () => {
  it("is 1 / (2 h tan(fov/2))", () => {
    expect(distanceFor(0.5, 30)).toBeCloseTo(1 / (2 * 0.5 * Math.tan(15 * D)), 10);
    expect(distanceFor(0.2, 38)).toBeCloseTo(1 / (2 * 0.2 * Math.tan(19 * D)), 10);
  });
});

describe("poseRig", () => {
  it("places the aim point at (ax, ay) of the screen, whatever the angle", () => {
    const cases: Partial<Frame>[] = [
      { ax: 0.3, ay: 0.7 },
      { ax: 0.3, ay: 0.7, az: -70, el: 14, roll: 7, fov: 38, aim: [0, 0.28, 0], rz: 90 },
      { ax: 0.81, ay: 0.76, az: 0, el: 89, aim: [0, 0.28, 0] },
      { ax: 0.84, ay: 1.08, az: 30, el: -62, roll: -8, fov: 62, h: 1.15, aim: [0, -0.08, 0] },
      { ax: -0.08, ay: 0.13, az: 150, el: 8, h: 0.5, rz: 90 },
    ];
    for (const c of cases) {
      const f = frame(c);
      const { camera, inner } = pose(f, { ...REST, yaw: 1.1, pitch: 0.4, tilt: 0.1 });
      const p = toScreen(f.aim, inner, camera);
      expect(p.x / VW).toBeCloseTo(f.ax, 4);
      expect(p.y / VH).toBeCloseTo(f.ay, 4);
    }
  });

  it("keeps the aim near its spot even with the drift and the cursor's lean on", () => {
    const f = frame({ ax: 0.3, ay: 0.7, aim: [0, 0.1, 0] });
    const { camera, inner } = pose(f, REST, { x: 0.05, y: -0.05 }, 12.3, false);
    const p = toScreen(f.aim, inner, camera);
    expect(Math.abs(p.x / VW - 0.3)).toBeLessThan(0.05);
    expect(Math.abs(p.y / VH - 0.7)).toBeLessThan(0.05);
  });

  it("moves the view with the cursor (look.y leans the camera, so the pendant slides across)", () => {
    const f = frame();
    const a = pose(f, REST, NO_LOOK);
    const b = pose(f, REST, { x: 0, y: 0.1 });
    const pa = toScreen([0, 0, 0], a.inner, a.camera);
    const pb = toScreen([0, 0, 0], b.inner, b.camera);
    expect(Math.abs(pb.x - pa.x)).toBeGreaterThan(5);
  });

  it("gives the asked size: a unit-tall upright pendant is h of the screen's height", () => {
    for (const h of [0.2, 0.4, 1.15]) {
      const f = frame({ h, fov: 32 });
      const { camera, inner } = pose(f);
      const top = toScreen([0, 0.5, 0], inner, camera);
      const bottom = toScreen([0, -0.5, 0], inner, camera);
      const asked = h * VH;
      expect(Math.abs(bottom.y - top.y - asked) / asked).toBeLessThan(0.02);
    }
  });

  it("el 89 looks straight down", () => {
    const { camera } = pose(frame({ el: 89, az: 40 }));
    const fwd = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    expect(fwd.dot(new Vector3(0, -1, 0))).toBeGreaterThan(0.999);
  });

  it("rz 90 lays it over on screen: its up axis projects horizontal", () => {
    const { camera, inner } = pose(frame({ rz: 90, el: 8 }));
    const top = toScreen([0, 0.5, 0], inner, camera);
    const bottom = toScreen([0, -0.5, 0], inner, camera);
    const dx = Math.abs(top.x - bottom.x);
    expect(dx).toBeGreaterThan(100);
    expect(Math.abs(top.y - bottom.y)).toBeLessThan(1e-3 * dx);
  });

  it("turns the pendant about its own axis with yaw, and tumbles it in screen terms with pitch", () => {
    const { inner } = pose(frame(), { ...REST, yaw: 0.7 });
    expect(inner.rotation.y).toBeCloseTo(0.7, 10);
    const a = pose(frame(), { ...REST, pitch: Math.PI });
    const top = toScreen([0, 0.5, 0], a.inner, a.camera);
    const bottom = toScreen([0, -0.5, 0], a.inner, a.camera);
    expect(top.y).toBeGreaterThan(bottom.y); // upside down
  });

  it("breathes when not still, and holds when still", () => {
    const f = frame();
    const a = pose(f, REST, NO_LOOK, 3, true);
    const b = pose(f, REST, NO_LOOK, 9, true);
    expect(a.outer.quaternion.angleTo(b.outer.quaternion)).toBeLessThan(1e-9);
    const c = pose(f, REST, NO_LOOK, 3, false);
    const d = pose(f, REST, NO_LOOK, 9, false);
    expect(c.outer.quaternion.angleTo(d.outer.quaternion)).toBeGreaterThan(1e-3);
    expect(c.camera.position.distanceTo(d.camera.position)).toBeGreaterThan(1e-3);
  });
});

describe("screenBox", () => {
  it("contains every projected corner", () => {
    const f = frame({ az: -62, el: -12, roll: 6, fov: 24, h: 1.35, ax: 0.03, ay: 0.5, aim: [0, 0.02, -0.1] });
    const { camera, inner } = pose(f, { ...REST, yaw: 0.9, pitch: 0.2 });
    const bounds = new Box3(new Vector3(-0.3, -0.5, -0.1), new Vector3(0.3, 0.5, 0.1));
    const box = screenBox(bounds, inner, camera, VW, VH);
    expect(box.l).toBeLessThan(box.r);
    expect(box.t).toBeLessThan(box.b);
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const p = toScreen([x, y, z], inner, camera);
      expect(p.x).toBeGreaterThanOrEqual(box.l - 1e-6);
      expect(p.x).toBeLessThanOrEqual(box.r + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(box.t - 1e-6);
      expect(p.y).toBeLessThanOrEqual(box.b + 1e-6);
    }
  });
});

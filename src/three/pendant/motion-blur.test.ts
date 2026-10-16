import { describe, expect, test } from "vitest";
import { Matrix4, PerspectiveCamera } from "three";
import {
  GATE_CSS, GATHER_FRAGMENT, JUMP_SHARE, MAX_SMEAR, SHUTTER, VELOCITY_FRAGMENT, VELOCITY_VERTEX, blueNoise, blurNeeded, blurScale,
  isJump, longestMove, samplePoints, smearLength, tileTexels,
} from "./motion-blur";

const viewProj = (x = 0, z = 3) => {
  const cam = new PerspectiveCamera(30, 1440 / 900, 0.01, 60);
  cam.position.set(x, 0, z);
  cam.updateMatrixWorld(true);
  return new Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
};

describe("the smear's length (frame-rate independent, capped)", () => {
  test("a 1/60 s frame smears its own move; a 30 ms frame half again less per px of move", () => {
    expect(blurScale(SHUTTER)).toBeCloseTo(1, 10);
    expect(blurScale(0.03)).toBeCloseTo(SHUTTER / 0.03, 10);
  });

  test("the same speed smears the same at 16 ms and 30 ms frames", () => {
    const speed = 300; // px per second
    expect(smearLength(speed * 0.016, 0.016, 1e9)).toBeCloseTo(smearLength(speed * 0.03, 0.03, 1e9), 10);
    expect(smearLength(speed * 0.03, 0.03, 1e9)).toBeCloseTo(speed * SHUTTER, 10);
  });

  test("capped at the cap; never negative", () => {
    expect(smearLength(500, SHUTTER, MAX_SMEAR)).toBe(MAX_SMEAR);
    expect(smearLength(-3, SHUTTER, MAX_SMEAR)).toBe(0);
  });

  test("a near-zero, huge or broken dt can't blow it up", () => {
    expect(blurScale(0)).toBeCloseTo(SHUTTER * 240, 10);
    expect(blurScale(5)).toBeCloseTo(SHUTTER / 0.1, 10);
    expect(blurScale(Number.NaN)).toBe(1);
  });
});

describe("gating and jumps", () => {
  test("a smear under GATE_CSS is skipped", () => {
    expect(blurNeeded(0)).toBe(false);
    expect(blurNeeded(GATE_CSS * 0.99)).toBe(false);
    expect(blurNeeded(GATE_CSS)).toBe(true);
    expect(blurNeeded(MAX_SMEAR)).toBe(true);
  });

  test("a move past JUMP_SHARE of the screen in one frame is a jump (and a broken one too)", () => {
    expect(isJump(JUMP_SHARE * 900 - 1, 900)).toBe(false);
    expect(isJump(JUMP_SHARE * 900 + 1, 900)).toBe(true);
    expect(isJump(Infinity, 900)).toBe(true);
    expect(isJump(Number.NaN, 900)).toBe(true);
  });
});

describe("longestMove (the CPU estimate: camera and object motion)", () => {
  const pts = new Float32Array([0, 0, 0, 0.2, 0.5, 0, -0.2, -0.5, 0]);
  const W = 1440, H = 900;

  test("no change, no move", () => {
    const vp = viewProj();
    expect(longestMove(pts, vp, vp, W, H)).toBe(0);
  });

  test("the camera moving counts (the object still)", () => {
    const d = longestMove(pts, viewProj(0), viewProj(0.01), W, H);
    expect(d).toBeGreaterThan(1);
    // a sideways move of 0.01 at distance 3 with a 30 degree lens: 0.01 / (2 * 3 * tan 15deg) of the height
    expect(d).toBeCloseTo((0.01 / (2 * 3 * Math.tan((15 * Math.PI) / 180))) * H, 0);
  });

  test("the object moving counts (the camera still)", () => {
    const vp = viewProj();
    const spun = new Matrix4().multiplyMatrices(vp, new Matrix4().makeRotationZ(0.1));
    expect(longestMove(pts, vp, spun, W, H)).toBeGreaterThan(5);
  });

  test("a point behind the camera is skipped; broken matrices are a jump", () => {
    const vp = viewProj();
    expect(longestMove(new Float32Array([0, 0, 10]), vp, vp, W, H)).toBe(0);
    const nan = new Matrix4().set(Number.NaN, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    expect(isJump(longestMove(pts, vp, nan, W, H), H)).toBe(true);
  });
});

describe("the reset on a jump (the pass's own state)", () => {
  // the pass needs a WebGL renderer to draw, but its tracking is CPU only: test it without drawing
  test("a first frame, a reset and a jump smear nothing; then a small move does", async () => {
    const { MotionBlurPass } = await import("./motion-blur");
    const { Mesh, BoxGeometry, MeshBasicMaterial, Object3D, Scene } = await import("three");
    const scene = new Scene();
    const root = new Object3D();
    const mesh = new Mesh(new BoxGeometry(0.4, 1, 0.1), new MeshBasicMaterial());
    root.add(mesh);
    scene.add(root);
    const cam = new PerspectiveCamera(30, 1440 / 900, 0.01, 60);
    const probe = new Float32Array([0.2, 0.5, 0, -0.2, -0.5, 0, 0.2, -0.5, 0, -0.2, 0.5, 0]);
    const pass = new MotionBlurPass(scene, cam, root, [{ mesh, clippingPlanes: [] }], probe);
    pass.pixelRatio = 2;
    pass.setSize(2880, 1800);
    const model = new Matrix4();
    const turned = (a: number) => new Matrix4().makeRotationY(a);

    expect(pass.track(viewProj(), model, SHUTTER)).toBe(false); // (first frame: previous = current)
    expect(pass.lastSmear).toBe(0);
    pass.setPrevious(viewProj(), model);
    expect(pass.track(viewProj(), turned(0.08), SHUTTER)).toBe(true); // (a fast turn)
    expect(pass.lastSmear).toBeGreaterThan(GATE_CSS);
    expect(pass.lastSmear).toBeLessThanOrEqual(MAX_SMEAR);
    expect(pass.track(viewProj(), turned(0.08), SHUTTER, true)).toBe(false); // (a reset: nothing to smear)
    pass.setPrevious(viewProj(), model);
    expect(pass.track(viewProj(1.5), model, SHUTTER)).toBe(false); // (the camera leapt: a jump)
    expect(pass.lastJump).toBe(true);
    // and after the jump the previous pose is this one
    expect(pass.track(viewProj(1.5), model, SHUTTER)).toBe(false);
    expect(pass.lastJump).toBe(false);
    // a resize resets too
    pass.setPrevious(viewProj(), model);
    pass.setSize(1440, 900);
    expect(pass.track(viewProj(), turned(0.08), SHUTTER)).toBe(false);
    pass.dispose();
  });

  test("the same speed smears the same length at 30 ms and 16 ms frames (through the pass)", async () => {
    const { MotionBlurPass } = await import("./motion-blur");
    const { Mesh, BoxGeometry, MeshBasicMaterial, Object3D, Scene } = await import("three");
    const root = new Object3D();
    const mesh = new Mesh(new BoxGeometry(0.4, 1, 0.1), new MeshBasicMaterial());
    root.add(mesh);
    const pass = new MotionBlurPass(new Scene(), new PerspectiveCamera(), root, [{ mesh, clippingPlanes: [] }], new Float32Array([0.2, 0.5, 0.05]));
    pass.setSize(1440, 900);
    const speed = 0.5; // rad/s
    const at = (dt: number) => {
      pass.setPrevious(viewProj(), new Matrix4());
      pass.track(viewProj(), new Matrix4().makeRotationY(speed * dt), dt);
      return pass.lastSmear;
    };
    expect(at(0.016)).toBeCloseTo(at(0.03), 1);
    pass.dispose();
  });
});

describe("the shaders and tables", () => {
  test("the velocity material writes (curr/w - prev/w) x 0.5 and honours clipping planes", () => {
    expect(VELOCITY_VERTEX).toContain("uPrevMVP");
    expect(VELOCITY_VERTEX).toContain("uMVP");
    expect(VELOCITY_VERTEX).toContain("#include <clipping_planes_vertex>");
    expect(VELOCITY_FRAGMENT).toContain("( vCurr.xy / vCurr.w - vPrev.xy / vPrev.w ) * 0.5");
    expect(VELOCITY_FRAGMENT).toContain("#include <clipping_planes_fragment>");
  });

  test("the gather averages colour and alpha together (premultiplied: no dark fringe)", () => {
    expect(GATHER_FRAGMENT).toContain("sum += c * w;");
    expect(GATHER_FRAGMENT).toContain("gl_FragColor = sum / wsum;");
    expect(GATHER_FRAGMENT).toContain("#define TAPS 8");
  });

  test("tiles reach as far as the smear (half its cap, in half-res texels)", () => {
    for (const pr of [1, 1.5, 2]) expect(tileTexels(pr) * 2).toBeGreaterThanOrEqual((MAX_SMEAR * pr) / 2);
  });

  test("blue noise: 32 x 32, every level used about equally", () => {
    const n = blueNoise();
    expect(n.length).toBe(1024);
    const hist = new Array(4).fill(0);
    for (const v of n) hist[v >> 6]++;
    for (const h of hist) expect(h).toBe(256);
  });

  test("samplePoints spreads evenly and never more than asked", () => {
    const pts = new Float32Array(3000).map((_, i) => i);
    expect(samplePoints(pts, 10).length).toBe(30);
    expect(samplePoints(new Float32Array(6), 10).length).toBe(6);
  });
});

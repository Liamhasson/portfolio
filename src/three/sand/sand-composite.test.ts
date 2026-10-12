import { expect, test } from "vitest";
import * as THREE from "three";
import { SandComposite } from "./sand-composite";

test("every pass compiles ahead, those first drawn at the tilt (the desk's dim and lens) included: none compiles mid-shot (Liam, 2026-10-13: hitches)", async () => {
  const c = new SandComposite();
  const compiled: THREE.Material[] = [];
  let target: unknown = null;
  const intoTarget: boolean[] = [];
  const renderer = {
    getRenderTarget: () => target, setRenderTarget: (t: unknown) => { target = t; },
    compileAsync: async (o: THREE.Object3D) => { intoTarget.push(target !== null); o.traverse((m) => { const mat = (m as THREE.Mesh).material; if (mat) compiled.push(mat as THREE.Material); }); },
  };
  await c.precompile(renderer as never);
  const passes = Object.values(c as unknown as Record<string, unknown>).filter((v): v is THREE.Scene => v instanceof THREE.Scene);
  expect(passes.length).toBeGreaterThanOrEqual(9);
  // (three builds one program for the screen and another for drawing into a target: both)
  expect(intoTarget).toContain(true); expect(intoTarget).toContain(false);
  expect(target).toBeNull();
  for (const sc of passes) sc.traverse((m) => { const mat = (m as THREE.Mesh).material as THREE.Material | undefined; if (mat) expect(compiled, mat.type).toContain(mat); });
});

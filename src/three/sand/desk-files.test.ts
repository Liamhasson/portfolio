// src/three/sand/desk-files.test.ts
// @vitest-environment node
import { readFileSync, statSync, existsSync } from "node:fs";
import { describe, expect, test } from "vitest";
import * as THREE from "three";
import { deskFiles, deskGltfLoader, type BakedDeskMeta } from "./baked-desk";

const DIR = "public/lab/desk3d";
const meta = JSON.parse(readFileSync(`${DIR}/desk.json`, "utf8")) as BakedDeskMeta;

describe("the desk's files (pre-launch audit, 2026-10-12)", () => {
  test("every file it downloads is listed once (its progress counts them all), and each is published", () => {
    const files = deskFiles(meta);
    expect(new Set(files).size).toBe(files.length);
    for (const f of ["desk.glb", meta.probe, meta.lut, meta.screen!]) expect(files).toContain(f);
    expect(files).toContain("bake_desk_top.diff.lit.jpg");
    expect(files).toContain("bake_desk_top.normal.jpg");
    expect(files).toContain("bake_bezel.diff.open.jpg");
    for (const f of files) expect(existsSync(`${DIR}/${f}`), f).toBe(true);
  });

  test("the model ships compressed (meshopt): under 1.5 MB, down from 9.8", () => {
    expect(statSync(`${DIR}/desk.glb`).size).toBeLessThan(1.5e6);
  });

  test("it loads with every part named and its UVs and tangents kept (gltfpack drops what no material uses: -kv)", async () => {
    const buf = readFileSync(`${DIR}/desk.glb`);
    const gltf = await deskGltfLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "");
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    expect(meshes).toHaveLength(19);
    for (const m of meshes) {
      expect(m.name, "named as its part (no wrapper nodes)").toMatch(/^bake_/);
      expect(m.geometry.getAttribute("uv"), m.name).toBeDefined();
      const uv = m.geometry.getAttribute("uv");
      expect(uv.array, `${m.name}: float UVs (quantized ones need a texture transform the site doesn't apply)`).toBeInstanceOf(Float32Array);
    }
    expect(gltf.scene.getObjectByName("bake_desk_top")!.type).toBe("Mesh");
    expect((gltf.scene.getObjectByName("bake_lid") as THREE.Mesh).geometry.getAttribute("position")).toBeDefined();
    expect((gltf.scene.getObjectByName("bake_desk_top") as THREE.Mesh).geometry.getAttribute("tangent")).toBeDefined();
    expect(gltf.scene.getObjectByName("lid_pivot")).toBeDefined();
  });
});

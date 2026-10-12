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
    expect(files).toContain("bake_desk_top.diff.lit.ktx2");
    expect(files).toContain("bake_desk_top.normal.jpg");
    expect(files).toContain("bake_bezel.diff.open.ktx2");
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

  /** The KTX2 header (KTX 2.0 spec §3): the format, size, mip levels and supercompression. */
  const ktx2 = (f: string) => {
    const b = readFileSync(`${DIR}/${f}`);
    expect(b.subarray(0, 12).toString("latin1"), f).toBe("\u00abKTX 20\u00bb\r\n\u001a\n");
    return { vkFormat: b.readUInt32LE(12), w: b.readUInt32LE(20), h: b.readUInt32LE(24), levels: b.readUInt32LE(40), scheme: b.readUInt32LE(44) };
  };

  test("its lighting bakes ship as GPU-compressed KTX2 (ETC1S, about 8x less GPU memory than the JPEGs' 683 MB), with their mips and sizes in whole blocks", () => {
    const diffs = Object.values(meta.materials).flatMap((m) => (m.screen ? [] : typeof m.diff === "string" ? [m.diff] : Object.values(m.diff)));
    expect(diffs.length).toBeGreaterThan(40);
    for (const f of new Set(diffs)) {
      expect(f, "a lighting bake").toMatch(/\.ktx2$/);
      const k = ktx2(f!);
      expect(k.scheme, `${f}: BasisLZ (ETC1S)`).toBe(1);
      expect(k.w % 4 + k.h % 4, `${f}: ${k.w}x${k.h} in 4x4 blocks`).toBe(0);
      expect(k.levels, `${f}: mipmapped`).toBe(Math.floor(Math.log2(Math.max(k.w, k.h))) + 1);
    }
  });

  test("the data maps (normals, roughness) and the screen's design stay JPEG: ETC1S can't hold them", () => {
    for (const m of Object.values(meta.materials)) for (const f of [m.normal, m.rough]) if (f) expect(f).toMatch(/\.jpg$/);
    expect(meta.screen).toBe("screen.jpg");
  });

  test("identical bakes are one file (the lid's three states, the base's and the mark's): one download, one upload", () => {
    const lid = meta.materials["bake_lid"].diff as Record<string, string>;
    expect(new Set(Object.values(lid)).size).toBe(1);
    const files = deskFiles(meta).filter((f) => f.endsWith(".ktx2"));
    const sums = files.map((f) => readFileSync(`${DIR}/${f}`).toString("base64"));
    expect(new Set(sums).size).toBe(files.length);
  });

  test("the transcoder three needs for KTX2 is published with the site", () => {
    for (const f of ["basis_transcoder.js", "basis_transcoder.wasm"]) expect(existsSync(`public/lab/basis/${f}`), f).toBe(true);
  });

  test("a download never built (the page left first) gives its files back: every object URL revoked, once (final review #6)", async () => {
    const { releaseDesk } = await import("./baked-desk");
    const revoked: string[] = [];
    const orig = URL.revokeObjectURL;
    URL.revokeObjectURL = (u: string) => { revoked.push(u); };
    const dl = { base: "", meta, glb: new ArrayBuffer(0), lut: new ArrayBuffer(0), urls: new Map([["a.ktx2", "blob:a"], ["b.jpg", "blob:b"]]) };
    releaseDesk(dl);
    releaseDesk(dl);
    URL.revokeObjectURL = orig;
    expect(revoked).toEqual(["blob:a", "blob:b"]);
  });
});

import * as THREE from "three";
import { fetchTracked, type LoadProgress } from "./load-progress";

/** The live sand's data, exported by `blender/lookdev/lookdev.py --scene export` (see build_export there). */
export interface SandMeta {
  version: number;
  count: number;
  /** The grains split by tier: a device fetches only the parts it draws. */
  parts: { file: string; start: number; count: number }[];
  chaos_box: [[number, number, number], [number, number, number]];
  ball_pos_max: number;
  bounds: [[number, number, number], [number, number, number]];
  radius_max: number;
  ball: { center: [number, number, number]; radius: number };
  volume: { res: [number, number, number]; sigma_max: number; encoding: "sqrt" };
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    lens_mm: number;
    sensor_mm: number;
    fit: "horizontal";
    focus_m: number;
    fstop: number;
    render: [number, number];
  };
  lights: { name: string; pos: [number, number, number]; size: number; watts: number; color: [number, number, number] }[];
  ramp: [number, [number, number, number]][];
  material: { roughness: number; specular: number };
  compaction: { delay_span: number; ramp: number };
}

export interface SandData {
  meta: SandMeta;
  /** How many grains were loaded (the parts covering the tier's count). */
  count: number;
  /** Per grain: packed chaos position, packed ball position (see the shader's decode). */
  words: Uint32Array;
  /** Per grain: chaos hue, ball hue, radius (of radius_max), compaction delay; uint8 normalised. */
  attributes: Uint8Array;
  volumes: { chaos: THREE.Data3DTexture; mid: THREE.Data3DTexture; ball: THREE.Data3DTexture };
}

export const SAND_BASE = "/lab/sand";

async function bytes(url: string, progress: LoadProgress | null = null): Promise<ArrayBuffer> {
  return (await fetchTracked(url, url, progress)).arrayBuffer();
}

function volumeTexture(data: Uint8Array, [w, h, d]: [number, number, number]): THREE.Data3DTexture {
  const tex = new THREE.Data3DTexture(data, w, h, d);
  tex.format = THREE.RedFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}
/** The sand's description (small): fetched first, so the stage and the brief can be placed at once. */
export async function loadSandMeta(base = SAND_BASE, progress: LoadProgress | null = null): Promise<SandMeta> {
  return (await (await fetchTracked(`${base}/sand.json`, `${base}/sand.json`, progress)).json()) as SandMeta;
}

/** The grains (only the parts needed to draw `grains`, the tier's count) and the density volumes, counted. */
export async function loadSandParts(meta: SandMeta, grains: number, base = SAND_BASE, progress: LoadProgress | null = null): Promise<SandData> {
  const parts = meta.parts.filter((p) => p.start < grains);
  const n = parts.reduce((s, p) => s + p.count, 0);
  // (declared up front at their real sizes, so the progress knows the whole before the first byte)
  const declared = sandFiles(meta, grains);
  declared.forEach(([f, size]) => progress?.expect(`${base}/${f}`, size));
  const files = declared.map(([f]) => f);
  const [chaos, mid, ball, ...partBufs] = await Promise.all(files.map((f) => bytes(`${base}/${f}`, progress)));
  const words = new Uint32Array(n * 2);
  const attributes = new Uint8Array(n * 4);
  parts.forEach((p, i) => {
    words.set(new Uint32Array(partBufs[i], 0, p.count * 2), p.start * 2);
    attributes.set(new Uint8Array(partBufs[i], p.count * 8, p.count * 4), p.start * 4);
  });
  return {
    meta, count: n, words, attributes,
    volumes: {
      chaos: volumeTexture(new Uint8Array(chaos), meta.volume.res),
      mid: volumeTexture(new Uint8Array(mid), meta.volume.res),
      ball: volumeTexture(new Uint8Array(ball), meta.volume.res),
    },
  };
}

/** The sand's files for `grains` and their sizes in bytes: the three volumes (a byte a voxel), then each part (12 bytes
 *  a grain: two packed words, four attribute bytes). */
export function sandFiles(meta: Pick<SandMeta, "parts" | "volume">, grains: number): [string, number][] {
  const [w, h, d] = meta.volume.res, vol = w * h * d;
  return [
    ["vol_chaos.bin", vol], ["vol_mid.bin", vol], ["vol_ball.bin", vol],
    ...meta.parts.filter((p) => p.start < grains).map((p) => [p.file, p.count * 12] as [string, number]),
  ];
}

/** Loads the sand: only the parts needed to draw `grains` (the tier's count), and the density volumes. */
export async function loadSand(grains: number, base = SAND_BASE): Promise<SandData> {
  return loadSandParts(await loadSandMeta(base), grains, base);
}

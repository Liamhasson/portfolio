import * as THREE from "three";

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

async function bytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`sand: ${url} ${res.status}`);
  return res.arrayBuffer();
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

/** Loads the sand: only the parts needed to draw `grains` (the tier's count), and the density volumes. */
export async function loadSand(grains: number, base = SAND_BASE): Promise<SandData> {
  const meta = (await (await fetch(`${base}/sand.json`)).json()) as SandMeta;
  const parts = meta.parts.filter((p) => p.start < grains);
  const n = parts.reduce((s, p) => s + p.count, 0);
  const [chaos, mid, ball, ...partBufs] = await Promise.all(
    ["vol_chaos.bin", "vol_mid.bin", "vol_ball.bin", ...parts.map((p) => p.file)].map((f) => bytes(`${base}/${f}`)),
  );
  const words = new Uint32Array(n * 2);
  const attributes = new Uint8Array(n * 4);
  parts.forEach((p, i) => {
    words.set(new Uint32Array(partBufs[i], 0, p.count * 2), p.start * 2);
    attributes.set(new Uint8Array(partBufs[i], p.count * 8, p.count * 4), p.start * 4);
  });
  return {
    meta,
    count: n,
    words,
    attributes,
    volumes: {
      chaos: volumeTexture(new Uint8Array(chaos), meta.volume.res),
      mid: volumeTexture(new Uint8Array(mid), meta.volume.res),
      ball: volumeTexture(new Uint8Array(ball), meta.volume.res),
    },
  };
}

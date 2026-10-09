import * as THREE from "three";

/** The live sand's data, exported by `blender/lookdev/lookdev.py --scene export` (see build_export there). */
export interface SandMeta {
  version: number;
  count: number;
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
  /** Per grain: chaos xyz, ball xyz, uint16 normalised in `meta.bounds`. */
  positions: Uint16Array;
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

export async function loadSand(base = SAND_BASE): Promise<SandData> {
  const meta = (await (await fetch(`${base}/sand.json`)).json()) as SandMeta;
  const [sand, chaos, mid, ball] = await Promise.all(
    ["sand.bin", "vol_chaos.bin", "vol_mid.bin", "vol_ball.bin"].map((f) => bytes(`${base}/${f}`)),
  );
  const n = meta.count;
  return {
    meta,
    positions: new Uint16Array(sand, 0, n * 6),
    attributes: new Uint8Array(sand, n * 12, n * 4),
    volumes: {
      chaos: volumeTexture(new Uint8Array(chaos), meta.volume.res),
      mid: volumeTexture(new Uint8Array(mid), meta.volume.res),
      ball: volumeTexture(new Uint8Array(ball), meta.volume.res),
    },
  };
}

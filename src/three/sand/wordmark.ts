import * as THREE from "three";
import type { SandMeta } from "./data";

/**
 * LIAM HASSON behind the sand: heavy Geist letters as dark outlines in the void, light travelling through their strokes
 * (reference: the outlined titles on lusion.co/about). Approved by Liam 2026-10-09: heavy weight, dark fill, light on the
 * stroke paths, the sand's own colours (not Lusion's RGB), and both kinds of light:
 *   - an ambient light that spreads through the strokes like water from a different spot each time, fills the letters
 *     it reaches and slowly ebbs, its edge bent by flowing noise (Liam 2026-10-09: "spreading and taking over the
 *     characters slowly and gradually, like a wave, not a scan"); alive on every device, phones included,
 *   - the cursor's drift field lighting the strokes along its trail (Lusion's model), fading in about half a second.
 * One deliberate exception to the type rules (no weights above 500): this is a lit object in the scene, not text.
 *
 * The letters are a signed distance field drawn in the browser from the font, so the stroke stays ~1.2px crisp at any
 * size and pixel density. The plane sits where the approved hero render placed the wordmark: 4.5 units behind the sand.
 */

export const WORDMARK = {
  text: "LIAM HASSON",
  fontUrl: "/lab/fonts/Geist-Black.ttf",
  /** Blender: font size 1.35 at (0, 4.5, 0.85) in the hero scene (z up). */
  size: 1.35,
  position: [0, 0.85, -4.5] as [number, number, number],
  strokePx: 0.6, // half-width of the outline, in screen pixels
  base: 0.14, // how visible the dark outline is at rest (Lusion: faint, never gone)
  waveCycle: 15, // seconds from one wave's start to the next
  waveSpread: 10, // seconds for a wave to spread across the name (fast at first, slowing as it reaches further)
  waveHold: 1.5, // seconds fully spread before it ebbs
  waveEbb: 5, // seconds to fade back to the dark outline
  waveGain: 1.1,
  cursorGain: 1.6,
};

const SDF_RANGE = 24; // texels encoded either side of the edge

/** Felzenszwalb's 1D squared distance transform, in place. */
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** Squared distance to the nearest "on" texel, for every texel (2D, separable). */
function edt2d(on: Uint8Array, w: number, h: number): Float64Array {
  const INF = 1e20;
  const grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = on[i] ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), z = new Float64Array(n + 1);
  const v = new Int32Array(n);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
  return grid;
}

async function sdfTexture(fontUrl: string, text: string) {
  const face = new FontFace("WordmarkHeavy", `url(${fontUrl})`);
  await face.load();
  document.fonts.add(face);
  const W = 2048, H = 512, fontPx = 300;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.font = `${fontPx}px WordmarkHeavy`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  // fit the name with room for the field around it
  const width = g.measureText(text).width;
  const px = Math.min(fontPx, (fontPx * (W - 4 * SDF_RANGE)) / width);
  g.font = `${px}px WordmarkHeavy`;
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#fff"; g.fillText(text, W / 2, H / 2);
  const img = g.getImageData(0, 0, W, H).data;
  const inside = new Uint8Array(W * H), outside = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { const a = img[i * 4] > 127; inside[i] = a ? 1 : 0; outside[i] = a ? 0 : 1; }
  const dOut = edt2d(inside, W, H);   // distance from outside texels to the glyphs
  const dIn = edt2d(outside, W, H);   // distance from inside texels to the background
  const data = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const sd = Math.sqrt(dOut[i]) - Math.sqrt(dIn[i]);   // > 0 outside the letters
    data[i] = Math.round(Math.min(Math.max(sd / SDF_RANGE * 0.5 + 0.5, 0), 1) * 255);
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RedFormat, THREE.UnsignedByteType);
  tex.flipY = true;   // canvas rows run top-down
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return { tex, aspect: W / H, worldPerTexel: WORDMARK.size / px, W, H };
}

const VERTEX = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
in vec2 vUv;
uniform sampler2D uSdf;
uniform float uRange;        // texels encoded either side of the edge
uniform vec2 uTexSize;
uniform float uStrokePx;
uniform float uBase;
uniform vec2 uWaveO;         // where this wave starts (uv)
uniform float uWaveR;        // how far it has spread (name heights)
uniform float uWaveFade;     // 1 while spreading, ebbing to 0
uniform float uWaveGain;
uniform float uTime;
uniform float uAspect;       // plane width / height
uniform sampler2D uPaint;    // the cursor's drift field (CSS px / s)
uniform vec2 uViewport;      // device px of the canvas
uniform float uCursorGain;
uniform vec3 uRamp[4];
uniform float uDpr;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  return vnoise(p) * 0.55 + vnoise(p * 2.03 + 7.1) * 0.3 + vnoise(p * 4.1 + 3.7) * 0.15;
}

// the sand's colours as a glow: plum tail, dusty rose, rose-gold, a gold core
vec3 glow(float i) {
  vec3 c = mix(uRamp[0], uRamp[1], smoothstep(0.0, 0.3, i));
  c = mix(c, uRamp[2], smoothstep(0.25, 0.6, i));
  c = mix(c, uRamp[3] * 1.35, smoothstep(0.55, 1.0, i));
  return c;
}

void main() {
  float sd = (texture(uSdf, vUv).r - 0.5) * 2.0 * uRange;     // texels, > 0 outside
  float pxPerTexel = 1.0 / max(fwidth(sd), 1e-4);             // screen px per texel
  float dist = abs(sd) * pxPerTexel;                          // screen px from the outline
  float stroke = 1.0 - smoothstep(uStrokePx, uStrokePx + 1.0, dist);
  if (stroke <= 0.0) discard;

  // the ambient wave: light spreading from a point like water, its edge bent by slowly flowing noise
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  vec2 o = vec2(uWaveO.x * uAspect, uWaveO.y);
  float warp = (fbm(p * 0.9 + vec2(uTime * 0.05, -uTime * 0.03)) - 0.5) * 1.6;
  float d = length(p - o) + warp;                              // name heights, uneven
  float inside = 1.0 - smoothstep(uWaveR - 0.9, uWaveR + 0.15, d);   // a wide, soft edge
  float front = exp(-pow((d - uWaveR + 0.25) / 0.45, 2.0)) * 0.5;    // a little brighter where it is arriving
  // the light inside flows and breathes along the strokes
  float flow = 0.12 + 0.88 * smoothstep(0.3, 0.72, fbm(p * 2.8 + vec2(-uTime * 0.16, uTime * 0.1)));
  float wave = (inside * flow + front) * uWaveFade * uWaveGain;

  // the cursor: where its drift field moves, the strokes catch light
  vec2 suv = gl_FragCoord.xy / uViewport;
  float stir = length(texture(uPaint, suv).xy);
  float cursor = clamp(stir / 900.0, 0.0, 1.0) * uCursorGain;

  float light = clamp(wave + cursor, 0.0, 1.6);
  vec3 col = glow(min(light, 1.0)) * light * 2.2 + vec3(0.18, 0.1, 0.12) * uBase;
  gl_FragColor = vec4(col * stroke, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class Wordmark {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private time = 0;
  private waveStart = 0.6;   // the first wave starts just after the hero appears

  private constructor(mesh: THREE.Mesh, material: THREE.ShaderMaterial) {
    this.mesh = mesh;
    this.material = material;
  }

  static async create(meta: SandMeta, fontUrl = WORDMARK.fontUrl): Promise<Wordmark> {
    const sdf = await sdfTexture(fontUrl, WORDMARK.text);
    const w = sdf.W * sdf.worldPerTexel, h = sdf.H * sdf.worldPerTexel;
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: true,
      uniforms: {
        uSdf: { value: sdf.tex },
        uRange: { value: SDF_RANGE },
        uTexSize: { value: new THREE.Vector2(sdf.W, sdf.H) },
        uStrokePx: { value: WORDMARK.strokePx },
        uBase: { value: WORDMARK.base },
        uWaveO: { value: new THREE.Vector2(0.52, 0.45) },   // the first wave spreads from the middle, both ways
        uWaveR: { value: 0 },
        uWaveFade: { value: 0 },
        uTime: { value: 0 },
        uAspect: { value: w / h },
        uWaveGain: { value: WORDMARK.waveGain },
        uPaint: { value: null },
        uViewport: { value: new THREE.Vector2(1, 1) },
        uCursorGain: { value: WORDMARK.cursorGain },
        uRamp: { value: meta.ramp.map(([, c]) => new THREE.Vector3(...c)) },
        uDpr: { value: 1 },
      },
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(...WORDMARK.position);
    mesh.renderOrder = -1;   // before the sand, which then covers it where it passes in front
    return new Wordmark(mesh, material);
  }

  /** The cursor's drift field (shared with the sand) and the canvas size in device px. */
  setPaint(texture: THREE.Texture | null, deviceWidth: number, deviceHeight: number): void {
    this.material.uniforms.uPaint.value = texture;
    (this.material.uniforms.uViewport.value as THREE.Vector2).set(deviceWidth, deviceHeight);
  }

  /** Advance the ambient wave. `still` freezes it (compare captures). */
  update(dt: number, still = false): void {
    if (still) return;
    const u = this.material.uniforms;
    this.time += dt;
    u.uTime.value = this.time;
    let t = this.time - this.waveStart;
    if (t >= WORDMARK.waveCycle) {
      // a new wave from a new spot: somewhere along the name, never the same end twice in a row
      const prev = (u.uWaveO.value as THREE.Vector2).x;
      const x = prev < 0.5 ? 0.45 + Math.random() * 0.5 : 0.05 + Math.random() * 0.5;
      (u.uWaveO.value as THREE.Vector2).set(x, 0.35 + Math.random() * 0.3);
      this.waveStart = this.time;
      t = 0;
    }
    const aspect = u.uAspect.value as number;
    const reach = aspect * 0.95 + 1.0;   // far enough to cover the whole name from any start, plus the warp
    const x = Math.min(t / WORDMARK.waveSpread, 1);
    u.uWaveR.value = t < 0 ? -1 : reach * (1 - Math.pow(1 - x, 1.6));   // fast at first, slowing as it reaches further
    const ebbAt = WORDMARK.waveSpread + WORDMARK.waveHold;
    const e = Math.min(Math.max((t - ebbAt) / WORDMARK.waveEbb, 0), 1);
    const rise = Math.min(Math.max(t, 0) / 1.2, 1);
    u.uWaveFade.value = rise * rise * (3 - 2 * rise) * (1 - e * e * (3 - 2 * e));
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    (this.material.uniforms.uSdf.value as THREE.Texture).dispose();
  }
}

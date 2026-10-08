import * as THREE from "three";

/**
 * The cursor's soft drift: a low-resolution screen-space velocity field the pointer stirs, which then decays (the model
 * of Lusion's ScreenPaint, read from lusion.co/about: push strength 25, velocity dissipation 0.975 per frame, curl noise
 * scale 0.02 / strength 3, brush radius 0 to 100px growing with pointer speed). Grains are pushed by it in screen space,
 * never their targets, so the scroll-driven compaction always wins and a stir fades in about half a second.
 *
 * Texel = velocity in CSS px per second (RG), stored half float.
 */
export const PAINT = {
  pushStrength: 25,
  dissipation: 0.975, // per 60 Hz frame
  curlScale: 0.02, // per CSS px
  curlStrength: 3,
  maxRadiusPx: 100,
  radiusDistanceRangePx: 100,
  downscale: 4,
};

const QUAD_VERTEX = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const PAINT_FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uPrev;
uniform vec2 uSize;          // field size in CSS px
uniform float uDt;
uniform float uDecay;
uniform vec2 uFrom;          // pointer segment this frame, CSS px (origin bottom-left)
uniform vec2 uTo;
uniform float uRadius;       // px
uniform vec2 uPush;          // px / s added at the brush centre
uniform float uCurlScale;
uniform float uCurlStrength;
uniform float uTime;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
vec2 curl(vec2 p) {
  float e = 0.5;
  float n1 = vnoise(p + vec2(0.0, e)), n2 = vnoise(p - vec2(0.0, e));
  float n3 = vnoise(p + vec2(e, 0.0)), n4 = vnoise(p - vec2(e, 0.0));
  return vec2(n1 - n2, -(n3 - n4)) / (2.0 * e);
}

void main() {
  vec2 px = vUv * uSize;
  vec2 v0 = texture(uPrev, vUv).xy;
  // carried along by itself (semi-Lagrangian), a little
  vec2 back = (px - v0 * uDt * 0.5) / uSize;
  vec2 v = texture(uPrev, back).xy * uDecay;
  // the brush: a capsule along this frame's pointer segment
  vec2 ab = uTo - uFrom;
  float h = clamp(dot(px - uFrom, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
  float d = length(px - uFrom - ab * h);
  float w = uRadius > 0.0 ? smoothstep(uRadius, 0.0, d) : 0.0;
  v += uPush * w;
  // curl noise turns the trail into soft eddies, in proportion to how much is moving
  v += curl(px * uCurlScale + uTime * 0.3) * uCurlStrength * length(v) * uDt;
  outColor = vec4(v, 0.0, 1.0);
}
`;

export class PaintField {
  private a: THREE.WebGLRenderTarget;
  private b: THREE.WebGLRenderTarget;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: THREE.ShaderMaterial;
  private readonly cssSize = new THREE.Vector2(1, 1);
  private from = new THREE.Vector2();
  private to = new THREE.Vector2();
  private pending = new THREE.Vector2();
  private hasPointer = false;
  private time = 0;

  constructor() {
    const opts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.a = new THREE.WebGLRenderTarget(1, 1, opts);
    this.b = new THREE.WebGLRenderTarget(1, 1, opts);
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERTEX,
      fragmentShader: PAINT_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uPrev: { value: null },
        uSize: { value: this.cssSize },
        uDt: { value: 0 },
        uDecay: { value: 1 },
        uFrom: { value: this.from },
        uTo: { value: this.to },
        uRadius: { value: 0 },
        uPush: { value: new THREE.Vector2() },
        uCurlScale: { value: PAINT.curlScale },
        uCurlStrength: { value: PAINT.curlStrength },
        uTime: { value: 0 },
      },
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }

  get texture(): THREE.Texture {
    return this.a.texture;
  }

  get size(): THREE.Vector2 {
    return this.cssSize;
  }

  setSize(cssWidth: number, cssHeight: number): void {
    this.cssSize.set(cssWidth, cssHeight);
    const w = Math.max(32, Math.round(cssWidth / PAINT.downscale));
    const h = Math.max(32, Math.round(cssHeight / PAINT.downscale));
    this.a.setSize(w, h);
    this.b.setSize(w, h);
  }

  /** Pointer position in CSS px from the top-left of the canvas. */
  move(x: number, y: number): void {
    this.pending.set(x, this.cssSize.y - y);
    if (!this.hasPointer) {
      this.to.copy(this.pending);
      this.hasPointer = true;
    }
  }

  /** The pointer left (or a finger lifted): no more stirring; the field decays on its own. */
  release(): void {
    this.hasPointer = false;
  }

  update(renderer: THREE.WebGLRenderer, dt: number): void {
    if (dt <= 0) return;
    this.time += dt;
    const u = this.material.uniforms;
    this.from.copy(this.to);
    if (this.hasPointer) this.to.copy(this.pending);
    const moved = this.from.distanceTo(this.to);
    const radius = this.hasPointer ? PAINT.maxRadiusPx * Math.min(moved / PAINT.radiusDistanceRangePx, 1) : 0;
    u.uRadius.value = radius;
    // push along the pointer's motion: px per second, scaled like Lusion's strength
    (u.uPush.value as THREE.Vector2)
      .subVectors(this.to, this.from)
      .multiplyScalar(this.hasPointer ? (PAINT.pushStrength / 25) * (1 / Math.max(dt, 1 / 240)) * 0.35 : 0);
    u.uDt.value = dt;
    u.uDecay.value = Math.pow(PAINT.dissipation, dt * 60);
    u.uTime.value = this.time;
    u.uPrev.value = this.a.texture;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.b);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(prev);
    [this.a, this.b] = [this.b, this.a];
  }

  dispose(): void {
    this.a.dispose();
    this.b.dispose();
    this.material.dispose();
  }
}

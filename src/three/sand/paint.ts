import * as THREE from "three";

/**
 * The cursor's ripples (Liam, 2026-10-10: "a wave of repel that spreads across the object and weakens as it gets
 * further away, like water"): a low-resolution screen-space water surface. The moving cursor presses into it (the
 * faster it moves, the deeper); the dent spreads out as rings at WAVE.speed, losing energy as it travels (damping, and
 * the spreading of a ring itself), so a ripple is strong at the cursor, weaker across the object and gone at its far
 * side. A grain is moved by the surface's slope where it sits: pushed away from the cursor as a ring's front passes,
 * drawn back behind it, then still. The wave only moves grains, never their targets, so the scroll always wins.
 * (Replaces the Lusion-style drag field, which only moved what was under the cursor.)
 *
 * Texel: R height (CSS px), G its rate (px / s), BA the slope, scaled to the push in CSS px (what the sand reads).
 */
export const WAVE = {
  speed: 520,       // CSS px / s: how fast a ring travels
  damping: 0.75,    // per second: how fast a ring loses energy as it goes (about a third left by the object's middle)
  settle: 0.45,     // per second: the surface relaxing back to flat (no dent lingers)
  press: 0.55,      // how deep the cursor presses, per CSS px it moves (depth in px)
  maxPress: 9,      // the deepest a single frame's press can be (px)
  brushPx: 26,      // the cursor's footprint
  push: 24,         // a slope of 1 moves a grain this many CSS px
  edgePx: 140,      // a soft border that absorbs, so rings leave the screen instead of bouncing back
  downscale: 4,
};

const QUAD_VERTEX = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const WAVE_FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uPrev;
uniform vec2 uSize;          // field size in CSS px
uniform vec2 uTexel;         // one texel in uv
uniform float uDx;           // one texel in CSS px
uniform float uDt;           // this step, s
uniform float uC2;           // speed squared
uniform float uDamp;         // this step's damping factor
uniform float uSettle;       // this step's relaxing factor
uniform vec2 uFrom;          // this step's share of the pointer's path, CSS px (origin bottom-left)
uniform vec2 uTo;
uniform float uPress;        // depth pressed along it (px)
uniform float uBrush;        // px
uniform float uPush;
uniform float uEdge;

void main() {
  vec2 px = vUv * uSize;
  vec2 s = texture(uPrev, vUv).xy;
  float hL = texture(uPrev, vUv - vec2(uTexel.x, 0.0)).x, hR = texture(uPrev, vUv + vec2(uTexel.x, 0.0)).x;
  float hD = texture(uPrev, vUv - vec2(0.0, uTexel.y)).x, hU = texture(uPrev, vUv + vec2(0.0, uTexel.y)).x;
  // the wave equation, damped
  float lap = (hL + hR + hD + hU - 4.0 * s.x) / (uDx * uDx);
  float v = (s.y + uC2 * lap * uDt) * uDamp;
  float h = (s.x + v * uDt) * uSettle;
  // the cursor presses in along its path (a capsule)
  vec2 ab = uTo - uFrom;
  float t = clamp(dot(px - uFrom, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
  float d = length(px - uFrom - ab * t);
  h -= uPress * exp(-(d * d) / (uBrush * uBrush));
  // the edges absorb
  vec2 e = min(px, uSize - px);
  float edge = smoothstep(0.0, uEdge, min(e.x, e.y));
  float sponge = mix(0.86, 1.0, edge * edge);
  h *= sponge; v *= sponge;
  // the slope, as the push a grain gets (outward on a ring's front)
  vec2 slope = vec2(hR - hL, hU - hD) / (2.0 * uDx);
  outColor = vec4(h, v, slope * uPush);
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

  constructor() {
    const opts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.a = new THREE.WebGLRenderTarget(1, 1, opts);
    this.b = new THREE.WebGLRenderTarget(1, 1, opts);
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERTEX,
      fragmentShader: WAVE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uPrev: { value: null },
        uSize: { value: this.cssSize },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uDx: { value: WAVE.downscale },
        uDt: { value: 0 },
        uC2: { value: WAVE.speed * WAVE.speed },
        uDamp: { value: 1 },
        uSettle: { value: 1 },
        uFrom: { value: new THREE.Vector2() },
        uTo: { value: new THREE.Vector2() },
        uPress: { value: 0 },
        uBrush: { value: WAVE.brushPx },
        uPush: { value: WAVE.push },
        uEdge: { value: WAVE.edgePx },
      },
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }

  /** RG the surface, BA the push in CSS px (what the sand reads). */
  get texture(): THREE.Texture {
    return this.a.texture;
  }

  get size(): THREE.Vector2 {
    return this.cssSize;
  }

  setSize(cssWidth: number, cssHeight: number): void {
    this.cssSize.set(cssWidth, cssHeight);
    const w = Math.max(32, Math.round(cssWidth / WAVE.downscale));
    const h = Math.max(32, Math.round(cssHeight / WAVE.downscale));
    this.a.setSize(w, h);
    this.b.setSize(w, h);
    (this.material.uniforms.uTexel.value as THREE.Vector2).set(1 / w, 1 / h);
    this.material.uniforms.uDx.value = cssWidth / w;
  }

  /** Pointer position in CSS px from the top-left of the canvas. */
  move(x: number, y: number): void {
    this.pending.set(x, this.cssSize.y - y);
    if (!this.hasPointer) {
      this.to.copy(this.pending);
      this.hasPointer = true;
    }
  }

  /** The pointer left (or a finger lifted): no more pressing; the ripples run out on their own. */
  release(): void {
    this.hasPointer = false;
  }

  update(renderer: THREE.WebGLRenderer, dt: number): void {
    if (dt <= 0) return;
    dt = Math.min(dt, 1 / 20);
    const u = this.material.uniforms;
    this.from.copy(this.to);
    if (this.hasPointer) this.to.copy(this.pending);
    const moved = this.hasPointer ? this.from.distanceTo(this.to) : 0;
    // steps small enough to be stable (a ring crosses at most half a texel per step)
    const dx = u.uDx.value as number;
    const n = Math.max(1, Math.ceil((WAVE.speed * dt) / (0.5 * dx)));
    const step = dt / n;
    u.uDt.value = step;
    u.uDamp.value = Math.exp(-WAVE.damping * step);
    u.uSettle.value = Math.exp(-WAVE.settle * step);
    const press = Math.min(WAVE.press * moved, WAVE.maxPress) / n;
    const prev = renderer.getRenderTarget();
    for (let i = 0; i < n; i++) {
      // each step presses along its share of the pointer's path
      (u.uFrom.value as THREE.Vector2).lerpVectors(this.from, this.to, i / n);
      (u.uTo.value as THREE.Vector2).lerpVectors(this.from, this.to, (i + 1) / n);
      u.uPress.value = press;
      u.uPrev.value = this.a.texture;
      renderer.setRenderTarget(this.b);
      renderer.render(this.scene, this.camera);
      [this.a, this.b] = [this.b, this.a];
    }
    renderer.setRenderTarget(prev);
  }

  dispose(): void {
    this.a.dispose();
    this.b.dispose();
    this.material.dispose();
  }
}

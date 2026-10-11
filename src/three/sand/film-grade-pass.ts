import * as THREE from "three";

/**
 * The film grade (film-grade.tsx's look, Liam 2026-10-11: vignette, a warm near-black lift, a moving grain), drawn on
 * the finished frame in WebGL instead of as CSS layers. CSS blend modes over a WebGL canvas made the browser re-blend
 * the whole screen every frame (~14 ms at Retina: the frame budget, so the quality governor stepped the sand down to
 * its lowest tier). Here it is four blended full-screen draws, each exact to the CSS:
 *
 * - the vignette: a multiply by 1 - alpha(d), the CSS radial gradient's stops over the half-diagonal
 * - the lift: a screen blend, out = lift + in (1 - lift)
 * - the grain (the CSS overlay at 9%): below mid-grey overlay is 2 in g, so 9% of it scales the pixel by
 *   1 + 0.09 (2g - 1): a darkening multiply where g < 0.5, a brightening add of the pixel where g > 0.5 (exact in the
 *   dark tones, which is nearly the whole picture; a hair off in the brightest highlights)
 *
 * Drawn after everything else, onto the screen; the page's text and the index sit above the canvas, ungraded, as before.
 */
export const GRADE = {
  /** The CSS vignette's stops: (position over the half-diagonal, black alpha). */
  vignette: [[0, 0], [0.25, 0.035], [0.5, 0.13], [0.75, 0.28], [1, 0.44]] as [number, number][],
  lift: [11 / 255, 9 / 255, 8 / 255] as [number, number, number],
  grain: 0.09,
  /** The grain tile (public/lab/grain.png) in CSS px, and its steps: 8 positions per 0.66 s. */
  tile: 192,
  period: 0.66,
  steps: 8,
} as const;

export function vignetteAlpha(d: number): number {
  const s = GRADE.vignette;
  if (d <= 0) return 0;
  for (let i = 1; i < s.length; i++) {
    if (d <= s[i][0]) return s[i - 1][1] + (s[i][1] - s[i - 1][1]) * ((d - s[i - 1][0]) / (s[i][0] - s[i - 1][0]));
  }
  return s[s.length - 1][1];
}

/** The grain tile's offset (CSS px) at time t (s), stepping as the CSS keyframes did. */
export function grainOffset(t: number): [number, number] {
  const i = Math.floor(((t % GRADE.period) / GRADE.period) * GRADE.steps) % GRADE.steps;
  return [(i * 53) % GRADE.tile, (i * 97) % GRADE.tile];
}

const VERTEX = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const s = GRADE.vignette;
const VIGNETTE_GLSL = /* glsl */ `
float vignetteAlpha(float d) {
  ${s.slice(1).map(([p, a], i) => `if (d <= ${p.toFixed(3)}) return mix(${s[i][1].toFixed(3)}, ${a.toFixed(3)}, (d - ${s[i][0].toFixed(3)}) / ${(p - s[i][0]).toFixed(3)});`).join("\n  ")}
  return ${s[s.length - 1][1].toFixed(3)};
}
`;
const head = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
in vec2 vUv;
uniform sampler2D uGrain;
uniform vec2 uGrainOff;     // CSS px
uniform float uDpr;
uniform float uGrainK;
float grain() { return texture(uGrain, (gl_FragCoord.xy / uDpr + uGrainOff) / ${GRADE.tile.toFixed(1)}).r; }
`;
/** Pass 1, multiply: the vignette and the grain's dark half. */
const MULTIPLY = head + VIGNETTE_GLSL + /* glsl */ `
void main() {
  float d = length((vUv - 0.5) * 2.0) / 1.41421356;
  float g = grain();
  pc_fragColor = vec4(vec3((1.0 - vignetteAlpha(d)) * (1.0 - uGrainK * max(1.0 - 2.0 * g, 0.0))), 1.0);
}
`;
/** Pass 2, screen: the lift. */
const LIFT = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
uniform vec3 uLift;
void main() { pc_fragColor = vec4(uLift, 1.0); }
`;
/** Pass 3, add of the pixel times this: the grain's bright half. */
const BRIGHTEN = head + /* glsl */ `
void main() { pc_fragColor = vec4(vec3(uGrainK * max(2.0 * grain() - 1.0, 0.0)), 1.0); }
`;

export class FilmGradePass {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly mats: THREE.ShaderMaterial[];
  private readonly uniforms = {
    uGrain: { value: null as THREE.Texture | null },
    uGrainOff: { value: new THREE.Vector2() },
    uDpr: { value: 1 },
    uGrainK: { value: GRADE.grain },
    uLift: { value: new THREE.Vector3(...GRADE.lift) },
  };
  private readonly quads: THREE.Mesh[];

  constructor(grain: THREE.Texture) {
    grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
    grain.colorSpace = THREE.NoColorSpace;
    this.uniforms.uGrain.value = grain;
    const mat = (frag: string, src: THREE.BlendingSrcFactor, dst: THREE.BlendingDstFactor) => new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: VERTEX, fragmentShader: frag, uniforms: this.uniforms,
      depthTest: false, depthWrite: false, toneMapped: false, transparent: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: src, blendDst: dst,
    });
    this.mats = [
      mat(MULTIPLY, THREE.ZeroFactor, THREE.SrcColorFactor),               // out = dst x src
      mat(LIFT, THREE.OneFactor, THREE.OneMinusSrcColorFactor),           // out = src + dst (1 - src): screen
      mat(BRIGHTEN, THREE.DstColorFactor, THREE.OneFactor),               // out = dst + dst x src
    ];
    this.quads = this.mats.map((m, i) => {
      const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m);
      q.frustumCulled = false;
      q.renderOrder = i;
      this.scene.add(q);
      return q;
    });
  }

  /** Onto whatever target is bound (the screen). `time` s (the grain's steps), `dpr` the canvas's pixel ratio,
   *  `still` holds the grain (reduced motion). */
  render(renderer: THREE.WebGLRenderer, time: number, dpr: number, still: boolean): void {
    const [x, y] = still ? [0, 0] : grainOffset(time);
    this.uniforms.uGrainOff.value.set(x, y);
    this.uniforms.uDpr.value = dpr;
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(this.scene, this.camera);
    renderer.autoClear = ac;
  }

  dispose(): void {
    this.mats.forEach((m) => m.dispose());
    this.quads.forEach((q) => q.geometry.dispose());
  }
}

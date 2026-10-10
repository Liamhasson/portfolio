import * as THREE from "three";
import { GLASS_LAYER, type GlassBall } from "./glass-ball";

/**
 * The sand as Cycles sees it: drawn into its own multisampled layer in linear light (no tone mapping yet), softened by
 * a pixel filter like Cycles' (Blackman-Harris, 1.5 px at the render's 1600 px width, approximated by a Gaussian),
 * then tone mapped (AgX) and laid over the rest of the scene (the desk plate, the wordmark).
 *
 * Why: a far grain is ~1.5 px. Cycles spreads it over ~3x3 px, so a distant cloud reads as soft, even dust; drawn as a
 * hard dot it reads as sparse speckles with harsh highlights (measured 2026-10-09: the live cloud covered under half the
 * render's pixels at the pull-back's end).
 */

export const SAND_LAYER = 1;
/** The sand is written into its layer at 1/SAND_ENCODE of its value (the layer is 8-bit, values above 1 would clip). */
export const SAND_ENCODE = 4;

const VERTEX = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAGMENT = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
in vec2 vUv;
uniform sampler2D uSand;
uniform vec2 uTexel;
uniform float uSigma;   // device px
void main() {
  // a small Gaussian of width uSigma in five reads: the centre, and four bilinear reads at (+-d, +-d) (each averaging
  // 2x2 texels). Per axis the four reads spread with variance ~d^2 + 1/4; mixing in the centre scales that down.
  float s2 = uSigma * uSigma;
  float d = s2 > 0.5 ? sqrt(s2 - 0.25) : 0.5;
  float w = s2 > 0.5 ? 1.0 : s2 / 0.5;
  vec4 ring = 0.25 * (texture(uSand, vUv + vec2(-d, -d) * uTexel) + texture(uSand, vUv + vec2(d, -d) * uTexel)
                    + texture(uSand, vUv + vec2(-d, d) * uTexel) + texture(uSand, vUv + vec2(d, d) * uTexel));
  vec4 acc = mix(texture(uSand, vUv), ring, w);
  // alpha-to-coverage writes the fragment's alpha into the samples it covers, so the resolved alpha is ~alpha x coverage
  // (~coverage^2) while the colour is ~colour x coverage (premultiplied): the coverage is the root of the alpha
  float a = clamp(sqrt(acc.a), 0.0, 1.0);
  gl_FragColor = vec4(a > 1e-4 ? acc.rgb / a * ${SAND_ENCODE.toFixed(1)} : vec3(0.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * a, a);   // premultiplied, over the scene
}
`;

const COPY_FRAGMENT = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
in vec2 vUv;
uniform sampler2D uTex;
void main() { gl_FragColor = vec4(texture(uTex, vUv).rgb, 1.0); }
`;

export class SandComposite {
  private readonly rt: THREE.WebGLRenderTarget;
  /** 2.3: the glass, drawn between the desk and the sand; it looks through the desk as drawn into `bg`. */
  glass: GlassBall | null = null;
  private bg: THREE.WebGLRenderTarget | null = null;
  private readonly copyScene = new THREE.Scene();
  private readonly copy = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: VERTEX, fragmentShader: COPY_FRAGMENT,
    depthTest: false, depthWrite: false, toneMapped: false, uniforms: { uTex: { value: null } },
  });
  private readonly quad: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly scene = new THREE.Scene();
  private readonly ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  /** The filter's width at the render's resolution (1600 px wide), in its pixels. Fitted against the renders. */
  sigma = 0.55;

  constructor() {
    // 8-bit sRGB-encoded (half the bandwidth of half float; the hardware encodes and blends in linear), with the sand
    // written at 1/ENCODE so its highlights (scene values up to ~4) don't clip
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, samples: 4, depthBuffer: true, colorSpace: THREE.SRGBColorSpace });
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      depthTest: false,
      depthWrite: false,
      toneMapped: true,
      uniforms: { uSand: { value: this.rt.texture }, uTexel: { value: new THREE.Vector2() }, uSigma: { value: 1 } },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    const copyQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.copy);
    copyQuad.frustumCulled = false;
    this.copyScene.add(copyQuad);
  }

  /** The desk drawn into a target with its depth (display values, as drawn), for the glass to look through. */
  private background(size: THREE.Vector2): THREE.WebGLRenderTarget {
    if (!this.bg || this.bg.width !== size.x || this.bg.height !== size.y) {
      this.bg?.dispose();
      const depth = new THREE.DepthTexture(size.x, size.y);
      depth.type = THREE.FloatType;
      this.bg = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.UnsignedByteType, samples: 4, depthBuffer: true, depthTexture: depth });
      this.bg.texture.colorSpace = THREE.NoColorSpace;   // the desk writes display values already: stored as they are
      this.bg.texture.generateMipmaps = true;              // frosted glass reads it blurred, by mip level
      this.bg.texture.minFilter = THREE.LinearMipmapLinearFilter;
    }
    return this.bg;
  }

  /** Renders the frame: the sand layer into its target, the rest to the screen, then the filtered sand over it. */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (this.rt.width !== size.x || this.rt.height !== size.y) this.rt.setSize(size.x, size.y);
    (this.material.uniforms.uTexel.value as THREE.Vector2).set(1 / size.x, 1 / size.y);
    this.material.uniforms.uSigma.value = this.sigma * (size.x / 1600);
    const mask = camera.layers.mask;
    const clear = renderer.getClearColor(new THREE.Color());
    const clearA = renderer.getClearAlpha();
    renderer.setRenderTarget(this.rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    camera.layers.set(SAND_LAYER);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.setClearColor(clear, clearA);
    camera.layers.mask = mask;
    camera.layers.disable(SAND_LAYER);
    camera.layers.disable(GLASS_LAYER);
    const autoClear = renderer.autoClear;
    if (this.glass?.visible) {
      // the desk into its target (with depth), onto the screen as is, then the glass looking through it
      const bg = this.background(size);
      renderer.setRenderTarget(bg);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      this.copy.uniforms.uTex.value = bg.texture;
      renderer.render(this.copyScene, this.ortho);
      this.glass.setBackground(bg.texture, bg.depthTexture!, size.x, size.y, camera as THREE.PerspectiveCamera);
      camera.layers.set(GLASS_LAYER);
      renderer.autoClear = false;
      renderer.render(scene, camera);
    } else {
      renderer.render(scene, camera);
    }
    camera.layers.mask = mask;
    renderer.autoClear = false;
    renderer.render(this.scene, this.ortho);
    renderer.autoClear = autoClear;
  }

  dispose(): void {
    this.rt.dispose();
    this.bg?.dispose();
    this.copy.dispose();
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}

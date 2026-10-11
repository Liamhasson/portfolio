import * as THREE from "three";

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
uniform sampler2D uDofTex;   // the sand through the lens (half size; DOF_FRAGMENT), and its depth
uniform sampler2D uDepth;
uniform vec4 uDofP;          // the lens: blur scale (device px), focus distance, near, far (0 scale = no lens)
uniform float uDofMax;
float cocAt(vec2 uv) {
  // (where there's no grain the depth is the desk's occluding depth, or nothing: read as far, as an empty pixel always was)
  float d = texture(uSand, uv).a > 0.0 ? texture(uDepth, uv).r : 1.0;
  float z = uDofP.z * uDofP.w / (uDofP.w - d * (uDofP.w - uDofP.z));
  return min(uDofP.x * abs(z - uDofP.y) / z, uDofMax);
}
void main() {
  // a small Gaussian of width uSigma in five reads: the centre, and four bilinear reads at (+-d, +-d) (each averaging
  // 2x2 texels). Per axis the four reads spread with variance ~d^2 + 1/4; mixing in the centre scales that down.
  float s2 = uSigma * uSigma;
  float d = s2 > 0.5 ? sqrt(s2 - 0.25) : 0.5;
  float w = s2 > 0.5 ? 1.0 : s2 / 0.5;
  vec4 ring = 0.25 * (texture(uSand, vUv + vec2(-d, -d) * uTexel) + texture(uSand, vUv + vec2(d, -d) * uTexel)
                    + texture(uSand, vUv + vec2(-d, d) * uTexel) + texture(uSand, vUv + vec2(d, d) * uTexel));
  vec4 acc = mix(texture(uSand, vUv), ring, w);
  // where the lens blurs, the sand through it (in focus, the full-size filtered sand stays)
  if (uDofP.x > 0.0) acc = mix(acc, texture(uDofTex, vUv), smoothstep(0.8, 2.5, cocAt(vUv)));
  // alpha-to-coverage writes the fragment's alpha into the samples it covers, so the resolved alpha is ~alpha x coverage
  // (~coverage^2) while the colour is ~colour x coverage (premultiplied): the coverage is the root of the alpha
  float a = clamp(sqrt(acc.a), 0.0, 1.0);
  gl_FragColor = vec4(a > 1e-4 ? acc.rgb / a * ${SAND_ENCODE.toFixed(1)} : vec3(0.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * a, a);   // premultiplied, over the scene
}
`;

/**
 * The lens (the cinematic look's depth of field; Liam, 2026-10-11: f/0.35 in the hero, focus as clarity): every grain is
 * drawn sharp with its depth, then each pixel gathers the sand around it by each sample's own blur (a sample counts
 * where its disc reaches this pixel, weighted by its disc's area, so its light is spread, not added). Out-of-focus sand
 * overlaps into a soft mass as Cycles' does, which a per-grain disc can't (a see-through grain hides those behind it).
 * Half size, 48 taps on a golden-angle spiral turned per pixel; the filter pass keeps the full-size sand in focus.
 */
const DOF_FRAGMENT = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
in vec2 vUv;
uniform sampler2D uSand;
uniform sampler2D uDepth;
uniform vec2 uTexel;     // one full-size pixel
uniform vec4 uDofP;
uniform float uDofMax;
float cocAt(vec2 uv) {
  // (where there's no grain the depth is the desk's occluding depth, or nothing: read as far, as an empty pixel always was)
  float d = texture(uSand, uv).a > 0.0 ? texture(uDepth, uv).r : 1.0;
  float z = uDofP.z * uDofP.w / (uDofP.w - d * (uDofP.w - uDofP.z));
  return min(uDofP.x * abs(z - uDofP.y) / z, uDofMax);
}
void main() {
  vec4 sum = vec4(0.0);
  float wsum = 0.0;
  float turn = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
  for (int i = 0; i < 48; i++) {
    float r = sqrt((float(i) + 0.5) / 48.0) * uDofMax * 0.5;   // radius, full-size px
    float a = float(i) * 2.39996 + turn;
    vec2 uv = vUv + vec2(cos(a), sin(a)) * r * uTexel;
    float c = max(cocAt(uv) * 0.5, 0.5);                       // that sample's disc radius
    float w = clamp(c - r + 1.0, 0.0, 1.0) / (c * c);          // it reaches here; its light spread over its disc
    sum += texture(uSand, uv) * w;
    wsum += w;
  }
  gl_FragColor = wsum > 0.0 ? sum / wsum : vec4(0.0);
}
`;

/** The desk through the lens: sharp where it's in focus, the gathered blur where it isn't, and in shadow by uDim. */
const DESK_LENS_FRAGMENT = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
in vec2 vUv;
uniform sampler2D uTex;
uniform sampler2D uBlur;
uniform sampler2D uDepth;
uniform vec4 uDofP;
uniform float uDofMax;
uniform float uDim;
float cocAt(vec2 uv) {
  float d = texture(uDepth, uv).r;
  float z = uDofP.z * uDofP.w / (uDofP.w - d * (uDofP.w - uDofP.z));
  return min(uDofP.x * abs(z - uDofP.y) / z, uDofMax);
}
void main() {
  vec4 c = mix(texture(uTex, vUv), texture(uBlur, vUv), smoothstep(0.8, 2.5, cocAt(vUv)));
  gl_FragColor = vec4(c.rgb * (1.0 - uDim), 1.0);
}
`;

const DISC_FRAGMENT = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
in vec2 vUv;
uniform sampler2D uTex;       // the desk, full size
uniform sampler2D uSmall;     // and at a quarter of it
uniform vec2 uTexel;          // one full-size pixel
uniform float uRadius;        // the blur's radius, device px
uniform float uDim;           // how far the desk falls into shadow behind the lit grains (0..1)
void main() {
  // a disc of 16 reads (golden-angle spiral) from the quarter-size desk, mixed in by how wide the blur is
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 16; i++) {
    float r = sqrt((float(i) + 0.5) / 16.0) * uRadius, an = float(i) * 2.39996;
    sum += texture(uSmall, vUv + vec2(cos(an), sin(an)) * r * uTexel);
  }
  gl_FragColor = vec4(mix(texture(uTex, vUv).rgb, sum.rgb / 16.0, smoothstep(0.5, 3.0, uRadius)) * (1.0 - uDim), 1.0);
}
`;

const OVER_FRAGMENT = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
in vec2 vUv;
uniform sampler2D uTex;
void main() { gl_FragColor = texture(uTex, vUv); }
`;

/** The haze: the air lit by the key, rendered alone in Blender (blender/lookdev/cinematic_variants.py CINE_PLATE=1),
 *  screened over the frame like light scattered in front of and behind the grains. Display values, stored boosted
 *  (x 1/uScale) and dithered against banding. */
const HAZE_FRAGMENT = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
in vec2 vUv;
uniform sampler2D uTex;
uniform float uScale;
uniform float uAmount;
void main() {
  vec3 h = texture(uTex, vUv).rgb * uScale * uAmount;
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  gl_FragColor = vec4(max(h + n / 255.0 * step(1e-4, h.r + h.g + h.b), 0.0), 1.0);
}
`;

export class SandComposite {
  private readonly rt: THREE.WebGLRenderTarget;
  private readonly blurRt: THREE.WebGLRenderTarget;
  private bg: THREE.WebGLRenderTarget | null = null;

  /** The desk out of focus onto the screen. */
  private readonly discScene = new THREE.Scene();
  private readonly disc = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: VERTEX, fragmentShader: DISC_FRAGMENT,
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { uTex: { value: null }, uSmall: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 0 }, uDim: { value: 0 } },
  });
  /** A straight copy (rgba as it is), for the defocus's reduced desk. */
  private readonly rawScene = new THREE.Scene();
  private readonly raw = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: VERTEX, fragmentShader: OVER_FRAGMENT,
    depthTest: false, depthWrite: false, toneMapped: false, blending: THREE.NoBlending, uniforms: { uTex: { value: null } },
  });
  private readonly quad: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly scene = new THREE.Scene();
  private readonly ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  /** 2.3: the desk out of focus behind the sand as the camera passes through the cloud (device px; 0 = sharp). The sand
   *  stays sharp and solid (Liam, 2026-10-10: the focus is on the grains). */
  defocus = 0;
  /** And how far it falls into shadow, so the light is on the grains (0..1). */
  deskDim = 0;
  /** The lens: focus distance (world units), f-number, focal length (mm, the hero camera's 45), how much of it (0 =
   *  sharp throughout). Set each frame. */
  lens = { amount: 0, focus: 8.4, fstop: 0.35, lensMm: 45, desk: 0 };
  private readonly dofBgRt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  private readonly deskLensScene = new THREE.Scene();
  private readonly deskLensMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: VERTEX, fragmentShader: DESK_LENS_FRAGMENT,
    depthTest: false, depthWrite: false, toneMapped: false, blending: THREE.NoBlending,
    uniforms: { uTex: { value: null }, uBlur: { value: null }, uDepth: { value: null }, uDofP: { value: new THREE.Vector4() }, uDofMax: { value: 48 }, uDim: { value: 0 } },
  });
  private readonly dofRt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  private readonly dofScene = new THREE.Scene();
  private readonly dofMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: VERTEX, fragmentShader: DOF_FRAGMENT,
    depthTest: false, depthWrite: false, toneMapped: false, blending: THREE.NoBlending,
    uniforms: { uSand: { value: null }, uDepth: { value: null }, uTexel: { value: new THREE.Vector2() }, uDofP: { value: new THREE.Vector4() }, uDofMax: { value: 48 } },
  });
  /** The hero's haze (texture, decode scale) and how much of it shows (0..1; it belongs to the hero's light). */
  haze: { texture: THREE.Texture; scale: number } | null = null;
  /** What hides the sand (the 3D desk): its depth is drawn into the sand's target first, so a grain under or behind it
   *  (the rising sand passes under the laptop and behind its lid) is hidden. Null: the sand is drawn over everything. */
  occluder: THREE.Object3D | null = null;
  private readonly occScene = new THREE.Scene();
  private readonly occPairs: [THREE.Mesh, THREE.Object3D][] = [];
  private occFrom: THREE.Object3D | null = null;
  private readonly depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
  hazeAmount = 0;
  private readonly hazeScene = new THREE.Scene();
  /** The desk in shadow without its blur (the lamp still off: the cloud keeps the hero's light). */
  private readonly dimScene = new THREE.Scene();
  private readonly dimMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
  private readonly hazeMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: VERTEX, fragmentShader: HAZE_FRAGMENT,
    depthTest: false, depthWrite: false, toneMapped: false, transparent: true,
    // screen: dst + src (1 - dst), on display values
    blending: THREE.CustomBlending, blendSrc: THREE.OneMinusDstColorFactor, blendDst: THREE.OneFactor,
    uniforms: { uTex: { value: null }, uScale: { value: 1 }, uAmount: { value: 0 } },
  });
  /** The filter's width at the render's resolution (1600 px wide), in its pixels. Fitted against the renders. */
  sigma = 0.55;

  constructor() {
    // 8-bit sRGB-encoded (half the bandwidth of half float; the hardware encodes and blends in linear), with the sand
    // written at 1/ENCODE so its highlights (scene values up to ~4) don't clip
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, samples: 4, depthBuffer: true, colorSpace: THREE.SRGBColorSpace });
    // its depth, resolved, for the lens
    this.rt.depthTexture = new THREE.DepthTexture(1, 1);
    // the desk's defocus reads a quarter-size copy of it (made only while it's on)
    this.blurRt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, depthBuffer: false });
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
      uniforms: {
        uSand: { value: this.rt.texture }, uTexel: { value: new THREE.Vector2() }, uSigma: { value: 1 },
        uDofTex: { value: this.dofRt.texture }, uDepth: { value: this.rt.depthTexture }, uDofP: { value: new THREE.Vector4() }, uDofMax: { value: 48 },
      },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    const discQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.disc);
    discQuad.frustumCulled = false;
    this.discScene.add(discQuad);
    const rawQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.raw);
    rawQuad.frustumCulled = false;
    this.rawScene.add(rawQuad);
    const dofQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.dofMat);
    dofQuad.frustumCulled = false;
    this.dofScene.add(dofQuad);
    const deskLensQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.deskLensMat);
    deskLensQuad.frustumCulled = false;
    this.deskLensScene.add(deskLensQuad);
    const dimQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.dimMat);
    dimQuad.frustumCulled = false;
    this.dimScene.add(dimQuad);
    const hazeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.hazeMat);
    hazeQuad.frustumCulled = false;
    this.hazeScene.add(hazeQuad);
  }

  /** The desk drawn into a target (display values, as drawn), for the passage's defocus. */
  private background(size: THREE.Vector2): THREE.WebGLRenderTarget {
    if (!this.bg || this.bg.width !== size.x || this.bg.height !== size.y) {
      this.bg?.dispose();
      this.bg = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.UnsignedByteType, samples: 4, depthBuffer: true });
      this.bg.depthTexture = new THREE.DepthTexture(size.x, size.y);   // for the lens on the desk
      this.bg.texture.colorSpace = THREE.NoColorSpace;   // the desk writes display values already: stored as they are
      this.bg.texture.generateMipmaps = false;
      this.bg.texture.minFilter = THREE.LinearFilter;
    }
    return this.bg;
  }

  /** Compiles its own passes' shaders and makes its targets now, not on the frame each is first needed (stalls of up
   *  to 200 ms mid-scroll). */
  async warm(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Promise<void> {
    await Promise.all([this.scene, this.rawScene, this.discScene, this.hazeScene, this.dimScene, this.dofScene, this.deskLensScene].map((sc) => renderer.compileAsync(sc, this.ortho)));
    // and drawn once each way (the GPU builds its pipelines on a shader's first draw into each kind of target)
    const d = this.defocus;
    for (const v of [0, 4]) {
      this.defocus = v;
      this.render(renderer, scene, camera);
    }
    this.defocus = d;
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
    if (this.occluder) this.drawOccluders(renderer, camera);
    camera.layers.set(SAND_LAYER);
    {
      const ac = renderer.autoClear;
      renderer.autoClear = false;   // (cleared above: the occluders' depth must survive into the sand's pass)
      renderer.render(scene, camera);
      renderer.autoClear = ac;
    }
    // the lens, from the sand's colour and depth (half size)
    const lens = this.lens;
    const dofP = this.material.uniforms.uDofP.value as THREE.Vector4;
    if (lens.amount > 0.001 && (camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const cam = camera as THREE.PerspectiveCamera;
      const f = lens.lensMm / 1000, pointScale = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
      dofP.set(pointScale * ((f / lens.fstop) / Math.max(lens.focus - f, 1e-3)) * lens.amount, lens.focus, cam.near, cam.far);
      const hw = Math.max(1, Math.round(size.x / 2)), hh = Math.max(1, Math.round(size.y / 2));
      if (this.dofRt.width !== hw || this.dofRt.height !== hh) this.dofRt.setSize(hw, hh);
      const du = this.dofMat.uniforms;
      du.uSand.value = this.rt.texture; du.uDepth.value = this.rt.depthTexture;
      (du.uTexel.value as THREE.Vector2).set(1 / size.x, 1 / size.y);
      (du.uDofP.value as THREE.Vector4).copy(dofP);
      renderer.setRenderTarget(this.dofRt);
      renderer.render(this.dofScene, this.ortho);
    } else dofP.set(0, 0, 0, 0);
    renderer.setRenderTarget(null);
    renderer.setClearColor(clear, clearA);
    camera.layers.mask = mask;
    camera.layers.disable(SAND_LAYER);
    const autoClear = renderer.autoClear;
    if (this.defocus > 0.5) {
      // the desk into its target, a quarter-size copy, then onto the screen through the disc
      const bg = this.background(size);
      renderer.setRenderTarget(bg);
      renderer.render(scene, camera);
      const bw = Math.max(1, Math.round(size.x / 4)), bh = Math.max(1, Math.round(size.y / 4));
      if (this.blurRt.width !== bw || this.blurRt.height !== bh) this.blurRt.setSize(bw, bh);
      this.raw.uniforms.uTex.value = bg.texture;
      renderer.setRenderTarget(this.blurRt);
      renderer.render(this.rawScene, this.ortho);
      renderer.setRenderTarget(null);
      const du = this.disc.uniforms;
      du.uTex.value = bg.texture; du.uSmall.value = this.blurRt.texture; du.uRadius.value = this.defocus;
      du.uDim.value = this.deskDim;
      (du.uTexel.value as THREE.Vector2).set(1 / size.x, 1 / size.y);
      renderer.render(this.discScene, this.ortho);
    } else if (lens.desk > 0.002 && dofP.x > 0) {
      // the desk through the same lens: into its target with its depth, the gather at half size, then to the screen
      const bg = this.background(size);
      renderer.setRenderTarget(bg);
      renderer.render(scene, camera);
      const hw = Math.max(1, Math.round(size.x / 2)), hh = Math.max(1, Math.round(size.y / 2));
      if (this.dofBgRt.width !== hw || this.dofBgRt.height !== hh) this.dofBgRt.setSize(hw, hh);
      const du = this.dofMat.uniforms;
      du.uSand.value = bg.texture; du.uDepth.value = bg.depthTexture;
      (du.uTexel.value as THREE.Vector2).set(1 / size.x, 1 / size.y);
      const deskP = (du.uDofP.value as THREE.Vector4).copy(dofP);
      deskP.x *= lens.desk / Math.max(lens.amount, 1e-3);   // (dofP carries the sand's amount)
      renderer.setRenderTarget(this.dofBgRt);
      renderer.render(this.dofScene, this.ortho);
      renderer.setRenderTarget(null);
      const lu = this.deskLensMat.uniforms;
      lu.uTex.value = bg.texture; lu.uBlur.value = this.dofBgRt.texture; lu.uDepth.value = bg.depthTexture;
      (lu.uDofP.value as THREE.Vector4).copy(deskP); lu.uDim.value = this.deskDim;
      renderer.render(this.deskLensScene, this.ortho);
    } else {
      renderer.render(scene, camera);
      if (this.deskDim > 0.002) {
        this.dimMat.opacity = this.deskDim;
        const ac = renderer.autoClear;
        renderer.autoClear = false;
        renderer.render(this.dimScene, this.ortho);
        renderer.autoClear = ac;
      }
    }
    camera.layers.mask = mask;
    renderer.autoClear = false;
    renderer.render(this.scene, this.ortho);
    if (this.haze && this.hazeAmount > 0.002) {
      const hu = this.hazeMat.uniforms;
      hu.uTex.value = this.haze.texture; hu.uScale.value = this.haze.scale; hu.uAmount.value = this.hazeAmount;
      renderer.render(this.hazeScene, this.ortho);
    }
    renderer.autoClear = autoClear;
  }

  /** The occluder's meshes, depth only (proxies sharing their geometry, following their world matrices: the lid turns). */
  private drawOccluders(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    if (this.occFrom !== this.occluder) {
      for (const [m] of this.occPairs) this.occScene.remove(m);
      this.occPairs.length = 0;
      this.occluder!.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const proxy = new THREE.Mesh(mesh.geometry, this.depthOnly);
        proxy.matrixAutoUpdate = false;
        proxy.frustumCulled = false;
        this.occScene.add(proxy);
        this.occPairs.push([proxy, mesh]);
      });
      this.occFrom = this.occluder;
    }
    for (const [proxy, src] of this.occPairs) {
      proxy.visible = src.visible;
      proxy.matrix.copy(src.matrixWorld);
    }
    const mask = camera.layers.mask;
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    camera.layers.enableAll();
    renderer.render(this.occScene, camera);
    camera.layers.mask = mask;
    renderer.autoClear = ac;
  }

  dispose(): void {
    this.depthOnly.dispose();
    this.rt.dispose();
    this.bg?.dispose();
    this.blurRt.dispose();
    this.raw.dispose();
    this.disc.dispose();
    this.material.dispose();
    this.hazeMat.dispose();
    this.dimMat.dispose();
    this.dofMat.dispose();
    this.dofRt.dispose();
    this.dofBgRt.dispose();
    this.deskLensMat.dispose();
    this.quad.geometry.dispose();
  }
}

// src/three/pendant/motion-blur.ts
/**
 * True motion blur on the pendant's fast moves (plan Task 10): the whirl, the tumble, the fly between shots. Every pixel is
 * smeared along the way the pendant moved under it in the last 1/60 s, camera and pendant together, so a fast turn reads as
 * motion and a slow one stays sharp.
 *
 * How (McGuire et al. 2012, "A Reconstruction Filter for Plausible Motion Blur", without the depth terms: one object):
 *   1. velocity: the pendant drawn again at half resolution, each vertex projected with this frame's and last frame's
 *      model-view-projection; the fragment writes (curr.xy / curr.w - prev.xy / prev.w) x 0.5, the move in UV per frame. The
 *      build shot's clipping planes are honoured (the hidden layers don't blur), and the wire is drawn as wire;
 *   2. tile max, then neighbour max: the longest move in each tile as long as the reach, then in its 3 x 3 neighbourhood, so
 *      a pixel just off the pendant knows the pendant is about to smear over it (the smear runs past the silhouette);
 *   3. the gather: 8 taps along the move, stratified with blue-noise jitter. On the pendant a pixel averages its own path;
 *      off it, a pixel takes in only the pendant pixels whose own smear reaches it. Colour and alpha are averaged together
 *      (the frame is premultiplied), so a smeared edge fades over the page with no dark fringe and no halo.
 * The move is scaled to a 1/60 s shutter by the frame's dt, so a 30 ms frame smears as a 16 ms one does for the same speed,
 * and capped at MAX_SMEAR CSS px. The scene switches the pass off while the longest smear (a CPU estimate from the change in
 * pose) is under GATE_CSS, so a slow shot costs nothing.
 */
import {
  DataTexture, HalfFloatType, LinearFilter, Matrix4, NearestFilter, RedFormat, RepeatWrapping, ShaderMaterial, UnsignedByteType,
  Vector2, Vector3, Vector4, WebGLRenderTarget, Color,
} from "three";
import type { Camera, Material, Mesh, Object3D, Plane, Scene, Texture, WebGLRenderer } from "three";
import { FullScreenQuad, Pass } from "three/addons/postprocessing/Pass.js";

/** The longest smear, in CSS px (times the pixel ratio on the GPU): CSS px, so the look is the same on every screen and at
 *  every pixel ratio the scene is drawn at. */
export const MAX_SMEAR = 24;
/** Below this longest smear (CSS px) the pass is skipped: a smear under a pixel can't be seen. */
export const GATE_CSS = 1;
/** The shutter the smear is scaled to (s). */
export const SHUTTER = 1 / 60;
/** A pose that moves more than this share of the screen's height in one frame has jumped (a scroll jump, a new solve, a
 *  restore): there is nothing to smear between the two, so the previous pose is reset to this one. */
export const JUMP_SHARE = 0.25;
/** The gather's taps. */
export const TAPS = 8;

/** How much one frame's move is scaled by to be the move over SHUTTER (dt clamped: a near-zero dt would blow it up). */
export function blurScale(dt: number): number {
  const d = Math.min(0.1, Math.max(1 / 240, Number.isFinite(dt) ? dt : SHUTTER));
  return SHUTTER / d;
}

/** One frame's move (any px) as the smear it makes: scaled to the shutter, capped at `capPx` (the same px). */
export function smearLength(framePx: number, dt: number, capPx: number): number {
  return Math.min(Math.max(0, framePx) * blurScale(dt), capPx);
}

/** Is a smear this long (CSS px) worth drawing? */
export function blurNeeded(smearCss: number, gateCss = GATE_CSS): boolean {
  return smearCss >= gateCss;
}

/** Did the pose jump? `framePx`: the longest move in one frame, `heightPx`: the screen's height, in the same px. */
export function isJump(framePx: number, heightPx: number, share = JUMP_SHARE): boolean {
  return !Number.isFinite(framePx) || framePx > share * heightPx;
}

const _a = new Vector4();
const _b = new Vector4();

/**
 * The longest move on screen (px of a `w` x `h` screen) of any of the points (xyz triples) between two model-view-projections.
 * A point behind the camera in either pose is skipped. Returns Infinity if the matrices aren't finite.
 */
export function longestMove(points: ArrayLike<number>, prevMVP: Matrix4, currMVP: Matrix4, w: number, h: number): number {
  let best = 0;
  for (let i = 0; i + 2 < points.length; i += 3) {
    _a.set(points[i], points[i + 1], points[i + 2], 1).applyMatrix4(prevMVP);
    _b.set(points[i], points[i + 1], points[i + 2], 1).applyMatrix4(currMVP);
    if (!(_a.w > 1e-4 && _b.w > 1e-4)) {
      if (!Number.isFinite(_a.w) || !Number.isFinite(_b.w)) return Infinity;
      continue;
    }
    const dx = (_b.x / _b.w - _a.x / _a.w) * 0.5 * w;
    const dy = (_b.y / _b.w - _a.y / _a.w) * 0.5 * h;
    const d = Math.hypot(dx, dy);
    if (!Number.isFinite(d)) return Infinity;
    if (d > best) best = d;
  }
  return best;
}

/** Up to `n` points (xyz triples) spread evenly through `points`. */
export function samplePoints(points: ArrayLike<number>, n: number): Float32Array {
  const count = Math.floor(points.length / 3);
  const k = Math.min(n, count);
  const out = new Float32Array(k * 3);
  for (let j = 0; j < k; j++) {
    const i = Math.floor(((j + 0.5) * count) / k) * 3;
    out[j * 3] = points[i]; out[j * 3 + 1] = points[i + 1]; out[j * 3 + 2] = points[i + 2];
  }
  return out;
}

/** The tile size (half-resolution texels) for a pixel ratio: at least the smear's reach (half its cap) in full-res px. */
export function tileTexels(pixelRatio: number): number {
  return Math.max(2, Math.ceil((MAX_SMEAR * pixelRatio) / 4));
}

/** 32 x 32 blue noise (void and cluster, Ulichney 1993; sigma 1.5), one byte a texel, ranks spread over 0..255. */
const BLUE_NOISE =
  "gsYYicpMorxh0K/ghfFS4jK2eac/g6HW7Rxbheox0x83X+mqKmraJep6CmY6GHWhZu8Ayiq7DU+MntImtHZj/6MFbz/ygQBTjjGZ9riQx0Ec01KL4V/5dT0Da/ZTlwy8e9iTvhufxP60SMseT9sG+62VOnAWljDQpuO6QxbM5UVX8CxS02A5cBffYqt/LG1WgCi986lItxpcLHuSrDSGIcgRsn4O4owpooIEPuybtugT31kI033uicL9ENlf9Gqqjz1k+pZHsOlRvfh0zhA3k0rGnWglO2QHTZxoPSO+Ad106KI1zCFtCtE3kSVTwGbWeC2G+7OQ3a0zzn/loYNIK1EcwQR2t/ddmRVp5KeHIu4BsEQRyVQWePIfswtXxfyctode402KONt8xKxHB/48pVTN4nI156TFWJFF7zBwGNcI9iae0BWpJkvzLth6WbtvlCddn4EiQmwC3nOn0o5AZTjHfj5p8Vi/AYpbHZjLEdwZ+LcG7r+L/ji5JGEOu+6uc1DpsguWeuSd0HK16jGLS342a0fVUhCe1IGY+E59IpoPkxvaNMUhQGcz+Q5DaavxwaPOji53s2ArSxPDOuZc2f3AYqN2U/yqFr5RpoDhAypcF+sMqPIcxupx36uLBqIzTCWIROcFjM1925EoxFbSmXdAhFTeaUWPBJxbHmrUvYLPsfIUz7BfLUoKZe0TjTy0/8qgILs2gPqvPsky+UcaYwBuNlqXI3L0neWuQXn1HmgIMm3XjQjLWSh55oeydZ3wh6jgfMFC2LUahTDVXryV3lWu7UVh56QY3bkSUAnaKj9PzCgR+4kJOVhsxQChKUjChBuXD7Ivb5JJZpv0qF3A5Axhm7ZNZ6Ttv5n9UIbZDW73O9J3+1HD8zTUIHEzgRmUsek1dNEk4HoPRCLfcrDoLpFguimbHYUCqnzERti4/mzWGYj2A5VJL86PtTgSXEOjzQNJ4WXUP+NXEu+UBVctQnlYuUBeyLFv9Vp+y/SKwRR966yIDaW+bpC4LmSv642mB+8ppOSEFdsfpQpOoCFr/VUncDv1WTEZ90qE3BRzIMk+ktF1DTaeVDzC7HY046s3mty5GpTagM2fIMg6nMJN4bdnHk/xZLr/jmommNUHUMoXhmLJTqkGQ2Prd1r5LGODMvyow4/XJ3sFz65GYryNc+hGBPAkcf+ziBe9AYmx7BCVTAJ/QRKpSuZaFfCCHfcrrcOfezzeXivRPabiTBugz3S62TDsYMiYL7V4OdynQl0TaC/Wr4wUmudVcSfVfDlb8yRsmrR4Hd1u+pPHAm3Xksz8llYLx0u/fwn6l2XA5gmtROBVC/g7ig5GI1agLbgMg0kf5Wv1I2c1rMZBD6VOkA==";

export function blueNoise(): Uint8Array {
  const bin = atob(BLUE_NOISE);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const QUAD_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }`;

/** Step 1: the move per pixel, in UV per frame (this frame against the last), behind the build's clipping planes. */
export const VELOCITY_VERTEX = /* glsl */ `
  #include <common>
  #include <clipping_planes_pars_vertex>
  uniform mat4 uMVP;
  uniform mat4 uPrevMVP;
  varying vec4 vCurr;
  varying vec4 vPrev;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
    gl_Position = projectionMatrix * mvPosition;
    vCurr = uMVP * vec4( position, 1.0 );
    vPrev = uPrevMVP * vec4( position, 1.0 );
    #include <clipping_planes_vertex>
  }`;

export const VELOCITY_FRAGMENT = /* glsl */ `
  #include <clipping_planes_pars_fragment>
  varying vec4 vCurr;
  varying vec4 vPrev;
  void main() {
    #include <clipping_planes_fragment>
    vec2 v = vPrev.w > 1e-4 && vCurr.w > 1e-4 ? ( vCurr.xy / vCurr.w - vPrev.xy / vPrev.w ) * 0.5 : vec2( 0.0 );
    gl_FragColor = vec4( v, 0.0, 1.0 );
  }`;

/** Step 2a: each tile's longest move, as a scaled, capped vector in full-res px. */
const TILE_FRAGMENT = /* glsl */ `
  uniform sampler2D tVel;
  uniform vec2 velSize;   // the velocity target's size (texels)
  uniform float tile;     // texels per tile side
  uniform vec2 resolution;
  uniform float scale;
  uniform float maxPx;
  varying vec2 vUv;
  void main() {
    vec2 origin = floor( gl_FragCoord.xy ) * tile;
    vec2 best = vec2( 0.0 );
    float bestL = 0.0;
    for ( int y = 0; y < 64; y ++ ) {
      if ( float( y ) >= tile ) break;
      for ( int x = 0; x < 64; x ++ ) {
        if ( float( x ) >= tile ) break;
        vec2 t = origin + vec2( float( x ), float( y ) ) + 0.5;
        if ( t.x > velSize.x || t.y > velSize.y ) continue;
        vec2 v = texture2D( tVel, t / velSize ).rg * resolution * scale;
        float l = dot( v, v );
        if ( l > bestL ) { bestL = l; best = v; }
      }
    }
    float l = sqrt( bestL );
    if ( l > maxPx ) best *= maxPx / l;
    gl_FragColor = vec4( best, 0.0, 1.0 );
  }`;

/** Step 2b: the longest move among a tile and its eight neighbours. */
const NEIGHBOUR_FRAGMENT = /* glsl */ `
  uniform sampler2D tTile;
  uniform vec2 tileSize;
  varying vec2 vUv;
  void main() {
    vec2 best = vec2( 0.0 );
    float bestL = 0.0;
    for ( int y = -1; y <= 1; y ++ ) for ( int x = -1; x <= 1; x ++ ) {
      vec2 t = floor( gl_FragCoord.xy ) + vec2( float( x ), float( y ) ) + 0.5;
      if ( t.x < 0.0 || t.y < 0.0 || t.x > tileSize.x || t.y > tileSize.y ) continue;
      vec2 v = texture2D( tTile, t / tileSize ).rg;
      float l = dot( v, v );
      if ( l > bestL ) { bestL = l; best = v; }
    }
    gl_FragColor = vec4( best, 0.0, 1.0 );
  }`;

/** Step 3: the gather, on premultiplied colour and alpha together. */
export const GATHER_FRAGMENT = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform sampler2D tVel;
  uniform sampler2D tMax;
  uniform sampler2D tNoise;
  uniform vec2 resolution;
  uniform float scale;
  uniform float maxPx;
  varying vec2 vUv;
  #define TAPS ${TAPS}
  #define DRAWN 0.02
  // a pixel's own move over the shutter, full-res px, capped
  vec2 velPx( vec2 uv ) {
    vec2 v = texture2D( tVel, uv ).rg * resolution * scale;
    float l = length( v );
    return l > maxPx ? v * ( maxPx / l ) : v;
  }
  // does a smear this long (px) reach this far (px)? (soft over one px)
  float reach( float d, float len ) { return clamp( 0.5 * len - d + 0.5, 0.0, 1.0 ); }
  void main() {
    vec4 c0 = texture2D( tDiffuse, vUv );
    vec2 vN = texture2D( tMax, vUv ).rg;
    float lN = length( vN );
    if ( lN < 0.5 ) { gl_FragColor = c0; return; }
    vec2 vX = velPx( vUv );
    float lX = length( vX );
    bool drawnX = c0.a > DRAWN;
    // along its own path where the pendant moves under it; along the neighbourhood's longest move elsewhere
    vec2 dir = drawnX && lX >= 0.5 ? vX : vN;
    float len = length( dir );
    float jitter = texture2D( tNoise, gl_FragCoord.xy / 32.0 ).r;
    vec4 sum = c0;
    float wsum = 1.0;
    for ( int i = 0; i < TAPS; i ++ ) {
      float t = ( float( i ) + jitter ) / float( TAPS ) - 0.5;
      vec2 off = dir * t;
      vec2 uv = vUv + off / resolution;
      if ( uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 ) continue;
      float d = abs( t ) * len;
      vec4 c = texture2D( tDiffuse, uv );
      float w;
      if ( c.a > DRAWN ) {
        // the pendant there: counts if its own smear reaches here, or this pixel's reaches there
        w = max( reach( d, length( velPx( uv ) ) ), reach( d, lX ) );
      } else {
        // the page there: seen from the page here always; from the pendant here only within its own smear
        w = drawnX ? reach( d, lX ) : 1.0;
      }
      sum += c * w;
      wsum += w;
    }
    gl_FragColor = sum / wsum;
  }`;

interface Part {
  mesh: Mesh;
  material: ShaderMaterial;
  /** The mesh's matrix in the root's space (fixed: the rig moves the root, never what hangs under it). */
  local: Matrix4;
}

export interface BlurPart {
  mesh: Mesh;
  /** Its clipping planes (the same Plane objects as its own material's, so they follow the build). */
  clippingPlanes: Plane[];
  wireframe?: boolean;
}

/**
 * The motion blur pass. Draws nothing of its own outside the pendant's smear. The scene calls `setPrevious` after each frame
 * (and on a reset with this frame's pose, so the next frame has no move), and `track` before it, which sets the per-mesh
 * matrices, the shutter scale, and returns whether there is anything to smear.
 */
export class MotionBlurPass extends Pass {
  /** The pixel ratio the composer draws at (the cap and the tiles are in CSS px). Set before the composer's setSize. */
  pixelRatio = 1;
  /** The last `track`'s longest smear (CSS px) and whether that frame was a jump (diagnostics). */
  lastSmear = 0;
  lastJump = false;

  private readonly scene: Scene;
  private readonly camera: Camera;
  private readonly root: Object3D;
  private readonly parts: Part[];
  private readonly probe: Float32Array;
  private readonly velTarget: WebGLRenderTarget;
  private readonly tileTarget: WebGLRenderTarget;
  private readonly maxTarget: WebGLRenderTarget;
  private readonly noise: DataTexture;
  private readonly tileMat: ShaderMaterial;
  private readonly neighbourMat: ShaderMaterial;
  private readonly gatherMat: ShaderMaterial;
  private readonly quad: FullScreenQuad;
  private readonly prevViewProj = new Matrix4();
  private readonly prevModel = new Matrix4();
  private hasPrev = false;
  private readonly size = new Vector2(1, 1);
  private readonly mvp = new Matrix4();
  private readonly prevMvp = new Matrix4();
  private readonly oldClear = new Color();
  private readonly swapped: Material[] = [];

  /** `root`: what the rig moves (the pendant's spin node); `probe`: points in its space for the CPU estimate. */
  constructor(scene: Scene, camera: Camera, root: Object3D, parts: BlurPart[], probe: ArrayLike<number>) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.root = root;
    this.probe = samplePoints(probe, 96);
    root.updateMatrixWorld(true);
    const rootInv = new Matrix4().copy(root.matrixWorld).invert();
    this.parts = parts.map(({ mesh, clippingPlanes, wireframe }) => {
      const material = new ShaderMaterial({
        uniforms: { uMVP: { value: new Matrix4() }, uPrevMVP: { value: new Matrix4() } },
        vertexShader: VELOCITY_VERTEX,
        fragmentShader: VELOCITY_FRAGMENT,
        side: (mesh.material as Material).side,
        wireframe: wireframe ?? false,
        clipping: true,
        clippingPlanes,
      });
      return { mesh, material, local: new Matrix4().multiplyMatrices(rootInv, mesh.matrixWorld) };
    });
    const half = { type: HalfFloatType, depthBuffer: false, magFilter: NearestFilter, minFilter: NearestFilter };
    this.velTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType, magFilter: LinearFilter, minFilter: LinearFilter });
    this.velTarget.texture.name = "MotionBlurPass.velocity";
    this.tileTarget = new WebGLRenderTarget(1, 1, half);
    this.maxTarget = new WebGLRenderTarget(1, 1, half);
    this.noise = new DataTexture(blueNoise(), 32, 32, RedFormat, UnsignedByteType);
    this.noise.wrapS = this.noise.wrapT = RepeatWrapping;
    this.noise.magFilter = this.noise.minFilter = NearestFilter;
    this.noise.needsUpdate = true;
    const common = { resolution: { value: new Vector2(1, 1) }, scale: { value: 1 }, maxPx: { value: MAX_SMEAR } };
    this.tileMat = new ShaderMaterial({
      uniforms: { tVel: { value: this.velTarget.texture }, velSize: { value: new Vector2(1, 1) }, tile: { value: 4 }, ...structuredCloneUniforms(common) },
      vertexShader: QUAD_VERTEX, fragmentShader: TILE_FRAGMENT, depthTest: false, depthWrite: false,
    });
    this.neighbourMat = new ShaderMaterial({
      uniforms: { tTile: { value: this.tileTarget.texture }, tileSize: { value: new Vector2(1, 1) } },
      vertexShader: QUAD_VERTEX, fragmentShader: NEIGHBOUR_FRAGMENT, depthTest: false, depthWrite: false,
    });
    this.gatherMat = new ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null as Texture | null }, tVel: { value: this.velTarget.texture }, tMax: { value: this.maxTarget.texture },
        tNoise: { value: this.noise }, ...structuredCloneUniforms(common),
      },
      vertexShader: QUAD_VERTEX, fragmentShader: GATHER_FRAGMENT, depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.gatherMat);
  }

  /** The pose the next frame's move is measured from: the camera's view-projection and the root's world matrix. */
  setPrevious(viewProj: Matrix4, model: Matrix4): void {
    this.prevViewProj.copy(viewProj);
    this.prevModel.copy(model);
    this.hasPrev = true;
  }

  /**
   * This frame's pose (matrices fresh), `dt` its step (s), `reset` true after a jump the caller knows of. Sets the uniforms
   * and returns whether the smear is worth drawing (the caller sets `enabled` from it). A first frame, a reset, or a move
   * too large to be motion (isJump) resets the previous pose to this one: nothing to smear.
   */
  track(viewProj: Matrix4, model: Matrix4, dt: number, reset = false): boolean {
    const w = this.size.x, h = this.size.y, pr = this.pixelRatio;
    this.lastJump = false;
    if (reset || !this.hasPrev) this.setPrevious(viewProj, model);
    this.mvp.multiplyMatrices(viewProj, model);
    this.prevMvp.multiplyMatrices(this.prevViewProj, this.prevModel);
    const frame = longestMove(this.probe, this.prevMvp, this.mvp, w, h);
    if (isJump(frame, h)) {
      this.lastJump = true;
      this.setPrevious(viewProj, model);
      this.lastSmear = 0;
      return false;
    }
    const capPx = MAX_SMEAR * pr;
    this.lastSmear = smearLength(frame, dt, capPx) / pr;
    const scale = blurScale(dt);
    for (const u of [this.tileMat.uniforms, this.gatherMat.uniforms]) {
      u.scale.value = scale;
      u.maxPx.value = capPx;
    }
    for (const p of this.parts) {
      p.material.uniforms.uMVP.value.multiplyMatrices(this.mvp, p.local);
      p.material.uniforms.uPrevMVP.value.multiplyMatrices(this.prevMvp, p.local);
    }
    return blurNeeded(this.lastSmear);
  }

  setSize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height));
    this.size.set(w, h);
    const vw = Math.max(1, Math.ceil(w / 2)), vh = Math.max(1, Math.ceil(h / 2));
    this.velTarget.setSize(vw, vh);
    const tile = tileTexels(this.pixelRatio);
    const tw = Math.max(1, Math.ceil(vw / tile)), th = Math.max(1, Math.ceil(vh / tile));
    this.tileTarget.setSize(tw, th);
    this.maxTarget.setSize(tw, th);
    this.tileMat.uniforms.velSize.value.set(vw, vh);
    this.tileMat.uniforms.tile.value = tile;
    this.neighbourMat.uniforms.tileSize.value.set(tw, th);
    this.tileMat.uniforms.resolution.value.set(w, h);
    this.gatherMat.uniforms.resolution.value.set(w, h);
    this.hasPrev = false; // (a new aspect is a new projection: nothing to smear across it)
  }

  render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void {
    // 1. velocity: the pendant's meshes drawn with their velocity materials (each keeps its own clipping planes)
    const oldAutoClear = renderer.autoClear;
    renderer.getClearColor(this.oldClear);
    const oldAlpha = renderer.getClearAlpha();
    const bg = this.scene.background;
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0);
    this.swapped.length = 0;
    for (const p of this.parts) { this.swapped.push(p.mesh.material as Material); p.mesh.material = p.material; }
    this.scene.background = null;
    try {
      renderer.setRenderTarget(this.velTarget);
      renderer.clear();
      renderer.render(this.scene, this.camera);
    } finally {
      this.parts.forEach((p, i) => { p.mesh.material = this.swapped[i]; });
      this.scene.background = bg;
    }
    // 2. tile max, neighbour max
    this.quad.material = this.tileMat;
    renderer.setRenderTarget(this.tileTarget);
    this.quad.render(renderer);
    this.quad.material = this.neighbourMat;
    renderer.setRenderTarget(this.maxTarget);
    this.quad.render(renderer);
    // 3. the gather
    this.gatherMat.uniforms.tDiffuse.value = readBuffer.texture;
    this.quad.material = this.gatherMat;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear || !this.renderToScreen) renderer.clear();
    this.quad.render(renderer);
    renderer.setClearColor(this.oldClear, oldAlpha);
    renderer.autoClear = oldAutoClear;
  }

  dispose(): void {
    for (const p of this.parts) p.material.dispose();
    this.velTarget.dispose();
    this.tileTarget.dispose();
    this.maxTarget.dispose();
    this.noise.dispose();
    this.tileMat.dispose();
    this.neighbourMat.dispose();
    this.gatherMat.dispose();
    this.quad.dispose();
  }
}

/** Fresh uniform objects with copies of the values (two materials must not share one uniform's value object). */
function structuredCloneUniforms<T extends Record<string, { value: unknown }>>(u: T): T {
  const out = {} as Record<string, { value: unknown }>;
  for (const [k, { value }] of Object.entries(u)) {
    out[k] = { value: value instanceof Vector2 || value instanceof Vector3 ? value.clone() : value };
  }
  return out as T;
}

// src/three/pendant/bokeh.ts
/**
 * The depth of field, with a half-resolution step for the governor (governor.ts, the rung below the 1.5x floor). three's
 * BokehPass (patched in passes.ts: alpha kept, no blur where nothing is drawn, a pixel with no blur skips the taps) is drawn
 * as it always is at scale 1. At scale 0.5 its 41-tap gather runs into a half-size target of its own (its depth pass stays
 * full size: see setSize), and a full-size pass puts it back together: where a pixel's blur is under a pixel and a half
 * (most of the gently focused pendant) it draws that sub-pixel softening itself at full resolution with 9 taps instead of
 * 41; where the blur is wider it takes the half-resolution bokeh, upsampled (a blur that wide hides the lower resolution);
 * where nothing is drawn it returns the frame. The canvas and the composer keep their
 * size. Colour and alpha stay premultiplied throughout (bilinear upsampling and the mix are linear), so no dark fringe.
 */
import { HalfFloatType, LinearFilter, ShaderMaterial, Vector2, WebGLRenderTarget } from "three";
import type { Camera, Scene, WebGLRenderer } from "three";
import { BokehPass, type BokehPassParameters } from "three/addons/postprocessing/BokehPass.js";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";

/** Where the half-resolution bokeh takes over: its blur radius in full-resolution px (soft from the first to the second). */
export const HALF_FROM_PX = 0.75;
export const HALF_FULL_PX = 1.5;
/** The farthest the bokeh's taps reach, as a share of its `dofblur` (BokehShader's outer ring: 0.4). */
export const BOKEH_REACH = 0.4;
/** The small blur's ring, as a share of that reach: BokehShader's 41 taps (1 at the centre, 16 at the reach, 8 each at 0.9,
 *  0.7 and 0.4 of it) spread a mean square radius of 0.675 reach^2; a centre and 8 taps at r spread 8 r^2 / 9, the same at
 *  r = sqrt(0.675 x 9 / 8) = 0.871 of the reach. */
export const SMALL_RING = Math.sqrt((0.675 * 9) / 8);

/** Puts the half-resolution bokeh back together with the full-resolution frame (see the file's comment). */
export const COMBINE_FRAGMENT = /* glsl */ `
  #include <common>
  #include <packing>
  uniform sampler2D tColor;   // the frame, full resolution, premultiplied
  uniform sampler2D tHalf;    // the bokeh at half resolution, premultiplied
  uniform sampler2D tDepth;   // the bokeh's depth pass (full resolution, RGBA-packed)
  uniform float focus;
  uniform float aperture;
  uniform float maxblur;
  uniform float nearClip;
  uniform float farClip;
  uniform float width;        // full-resolution px across
  uniform float aspect;       // width / height
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D( tColor, vUv );
    if ( c.a <= 0.0 ) { gl_FragColor = c; return; } // (nothing drawn: no blur, as in the patched bokeh)
    // this pixel's blur radius exactly as the patched BokehShader works it out (passes.ts), from the full-resolution depth
    float viewZ = perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( tDepth, vUv ) ), nearClip, farClip );
    float blur = abs( clamp( ( focus + viewZ ) * aperture, -maxblur, maxblur ) ) * smoothstep( 0.0, 0.5, c.a );
    float px = blur * ${BOKEH_REACH} * width;
    float k = smoothstep( ${HALF_FROM_PX}, ${HALF_FULL_PX}, px );
    // under HALF_FULL_PX the bokeh is a sub-pixel softening (most of the gently focused pendant: it is what smooths its
    // edges at 1.5x, where there is no multisampling), too fine for half resolution: drawn here at full resolution with 9
    // taps, the centre and a ring at the radius that gives the same spread as BokehShader's 41 (its rings' mean square)
    vec4 small = c;
    if ( k < 1.0 && blur > 0.0 ) {
      vec2 r = vec2( 1.0, aspect ) * blur * ${(BOKEH_REACH * SMALL_RING).toFixed(4)};
      vec4 sum = c;
      for ( int n = 0; n < 8; n ++ ) {
        float a = float( n ) * 0.7853982;
        sum += texture2D( tColor, vUv + vec2( cos( a ), sin( a ) ) * r );
      }
      small = sum / 9.0;
    }
    gl_FragColor = k > 0.0 ? mix( small, texture2D( tHalf, vUv ), k ) : small;
  }`;

const QUAD_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }`;

/** BokehPass's own fields this needs (three names them with an underscore; its types still list old names). */
interface BokehInternals {
  _renderTargetDepth: WebGLRenderTarget;
}

export class ScaledBokehPass extends BokehPass {
  private scale = 1;
  private readonly full = new Vector2(1, 1);
  private readonly half: WebGLRenderTarget;
  private readonly combine: ShaderMaterial;
  private readonly quad: FullScreenQuad;

  constructor(scene: Scene, camera: Camera, params: BokehPassParameters) {
    super(scene, camera, params);
    this.half = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
    this.half.texture.name = "ScaledBokehPass.half";
    this.combine = new ShaderMaterial({
      uniforms: {
        tColor: { value: null }, tHalf: { value: this.half.texture },
        tDepth: { value: (this as unknown as BokehInternals)._renderTargetDepth.texture },
        focus: { value: 1 }, aperture: { value: 0 }, maxblur: { value: 0 }, nearClip: { value: 0.1 }, farClip: { value: 100 },
        width: { value: 1 }, aspect: { value: 1 },
      },
      vertexShader: QUAD_VERTEX,
      fragmentShader: COMBINE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.combine);
  }

  /** The share of the frame's resolution the bokeh runs at: 1 or 0.5. Never resizes the canvas or the composer. */
  get bokehScale(): number {
    return this.scale;
  }

  setScale(scale: number): void {
    const s = scale < 1 ? 0.5 : 1;
    if (s === this.scale) return;
    this.scale = s;
    this.setSize(this.full.x, this.full.y);
  }

  /** The composer's size (full-resolution px). The depth pass stays at full resolution at either scale (it costs little:
   *  the pendant's vertices, not its pixels), so the combine knows each pixel's own blur exactly; at half resolution a thin
   *  near edge (the lotus's rim in the hero) is missed, and its pixels came out sharp and stair-stepped. Only the 41-tap
   *  gather follows the scale. */
  setSize(width: number, height: number): void {
    this.full.set(Math.max(1, width), Math.max(1, height));
    const w = Math.max(1, Math.round(this.full.x * this.scale)), h = Math.max(1, Math.round(this.full.y * this.scale));
    super.setSize(this.full.x, this.full.y);
    if (this.scale < 1) this.half.setSize(w, h);
    else this.half.setSize(1, 1); // (unused at full scale)
    this.combine.uniforms.width.value = this.full.x;
  }

  render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, deltaTime: number, maskActive: boolean): void {
    if (this.scale === 1) {
      super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
      return;
    }
    // the depth pass and the gather into the half target (never to the screen)
    const toScreen = this.renderToScreen;
    this.renderToScreen = false;
    try {
      super.render(renderer, this.half, readBuffer, deltaTime, maskActive);
    } finally {
      this.renderToScreen = toScreen;
    }
    const u = this.combine.uniforms, b = this.materialBokeh.uniforms;
    u.tColor.value = readBuffer.texture;
    u.focus.value = b.focus.value;
    u.aperture.value = b.aperture.value;
    u.maxblur.value = b.maxblur.value;
    u.nearClip.value = b.nearClip.value;
    u.farClip.value = b.farClip.value;
    u.aspect.value = b.aspect.value;
    renderer.setRenderTarget(toScreen ? null : writeBuffer);
    this.quad.render(renderer); // (every pixel written, no blending: nothing to clear)
  }

  dispose(): void {
    super.dispose();
    this.half.dispose();
    this.combine.dispose();
    this.quad.dispose();
  }
}

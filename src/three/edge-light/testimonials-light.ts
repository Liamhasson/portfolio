// src/three/edge-light/testimonials-light.ts
/**
 * The testimonials' light (plan 2026-10-17-about-testimonials-light, Task 2; the v26 mockup's water canvas, ported): one
 * full-screen WebGL1 pass drawing the warm band of light that hugs the screen's edges, its colours travelling around the
 * frame, the arrival wave, and (only while nobody else draws it) the glass ball between the quotes, ray-traced.
 * It composites without a CSS blend (a blend over a canvas costs about 14 ms a frame: perf lesson 2026-10-11): each pixel
 * is premultiplied colour with alpha max(r, g, b), close to a screen blend over the near-black page.
 */
import { ballCone, EDGE_COLOURS, EDGE_GLSL } from "./field";

/** The canvas's pixel ratio never goes above this (cost). */
export const MAX_DPR = 1.5;

/** The ball, in CSS px from the screen's top-left: centre and radius; `a` its opacity (1 when left out: the handoff to the
 *  pendant fades it out while the pendant's fades in). */
export type LightBall = { x: number; y: number; r: number; a?: number };

export type LightFrame = {
  /** The light's strength, 0..1 (the testimonials' scrub). */
  q: number;
  /** Seconds (0 holds the colours still: reduced motion). */
  t: number;
  /** The arrival wave's phase: −1 for none, else 0..1. */
  pulse: number;
  /** Where the wave starts: the right edge's middle (the track) or the bottom edge's middle (the stack). */
  pulseFrom: "right" | "bottom";
  /** Only when the light draws the ball itself. */
  ball: LightBall | null;
};

export type LightUniforms = {
  R: [number, number];
  T: number;
  A: number;
  P: number;
  PAD: number;
  PO: [number, number];
  /** The ball as seen: its centre on screen (canvas px, y up), for the rim glints' edge colours. */
  BC: [number, number];
  /** The sphere itself (canvas px, the screen at z 0, the eye in front of it): centre and radius (0: no ball). */
  BP: [number, number, number];
  BR: number;
  /** The ball's opacity, 0..1. */
  BA: number;
};

/** The shader's eye: centred over the screen, 2.2 screen heights in front of it (the mockup's camera). */
export const eyeOf = (w: number, h: number): [number, number, number] => [w / 2, h / 2, h * 2.2];

/**
 * The sphere behind the screen that shows as the slot's ball, radius `r` centred on `(x, y)` (canvas px, y up), from the eye:
 * placed on the cone field.ts ballCone gives (the pendant's ball takes its outline from the same cone, so the two match where
 * they cross-fade), sitting 1.2 of its radii behind the screen along that cone's axis (the mockup's depth). Off the screen's
 * middle a sphere shows as an ellipse: ballCone centres it on the point and makes its half-axes multiply to r², each within a
 * few percent of r. (The mockup placed a sphere of radius r at the point itself, which shows about 6% smaller.)
 */
export function sphereFor(x: number, y: number, r: number, w: number, h: number): { c: [number, number, number]; rho: number } {
  const e = eyeOf(w, h), E = e[2];
  const dx = x - e[0], dy = y - e[1], off = Math.hypot(dx, dy);
  const { phi, alpha } = ballCone(off / E, r / E);
  const ux = off > 1e-9 ? dx / off : 1, uy = off > 1e-9 ? dy / off : 0;
  const d = [ux * Math.sin(phi), uy * Math.sin(phi), -Math.cos(phi)];
  const s = Math.sin(alpha);
  const D = E / Math.cos(phi) / (1 - 1.2 * s); // (the axis meets the screen at E / cos phi; the centre 1.2 radii past it)
  return { c: [e[0] + d[0] * D, e[1] + d[1] * D, e[2] + d[2] * D], rho: D * s };
}

/** The pulse's origin in uv (GL: y up, so the bottom edge is y 0); just outside the screen so the wave enters it. */
export const PULSE_ORIGIN = { right: [1.001, 0.5], bottom: [0.5, -0.001] } as const;

/**
 * A frame's uniforms on a canvas of `w` x `h` device px showing a `cssW` x `cssH` screen. Everything the shader reads is in
 * canvas px with y up (gl_FragCoord), so the ball's centre is flipped and scaled here.
 */
export function lightUniforms(f: LightFrame, w: number, h: number, cssW: number, cssH: number): LightUniforms {
  const k = cssW > 0 ? w / cssW : 1;
  const ky = cssH > 0 ? h / cssH : 1;
  const po = PULSE_ORIGIN[f.pulseFrom];
  const bc: [number, number] = f.ball ? [f.ball.x * k, h - f.ball.y * ky] : [0, 0];
  const sphere = f.ball && f.ball.r > 0 ? sphereFor(bc[0], bc[1], f.ball.r * k, w, h) : null;
  return {
    R: [w, h],
    T: f.t,
    A: Math.min(1, Math.max(0, f.q)),
    P: f.pulse < 0 ? -1 : Math.min(1, f.pulse),
    PAD: Math.min(50, Math.min(cssW, cssH) * 0.1) * k,
    PO: [po[0], po[1]],
    BC: bc,
    BP: sphere ? sphere.c : [0, 0, 0],
    BR: sphere ? sphere.rho : 0,
    BA: f.ball ? Math.min(1, Math.max(0, f.ball.a ?? 1)) : 0,
  };
}

/** The drawing buffer for a screen: the CSS size times the pixel ratio, capped at MAX_DPR, at least 1 px. */
export function bufferSize(cssW: number, cssH: number, dpr: number): { w: number; h: number } {
  const r = Math.min(Math.max(dpr || 1, 0.5), MAX_DPR);
  return { w: Math.max(1, Math.round(cssW * r)), h: Math.max(1, Math.round(cssH * r)) };
}

const VS = "attribute vec2 p; void main() { gl_Position = vec4(p, 0., 1.); }";

/** The mockup's main(), with the shared core included and the pulse's origin a uniform (PO). */
export const LIGHT_FS = /* glsl */ `precision highp float;
uniform vec2 R; uniform float T, A, P, PAD; uniform vec3 C0, C1, C2, C3;
uniform vec2 PO;                      // the arrival wave's origin (uv)
uniform vec2 BC;                      // the glass ball's centre as seen (canvas px)
uniform vec3 BP; uniform float BR;    // the sphere: centre and radius (BR 0: none)
uniform float BA;                     // the ball's opacity (its handoff to the pendant)
${EDGE_GLSL}
void main() {
  vec2 uv = gl_FragCoord.xy / R, aspect = vec2(R.x / R.y, 1.);
  // the arrival wave: from the origin's edge across the screen, pushing the frame outward as it passes
  vec2 wp = (uv - PO) * aspect; float wl = length(aspect), wpl = wl - length(wp);
  float wt = P * (wl * 2.) - wl + wpl, wave = smoothstep(0., .5 * wl, wt) * smoothstep(wl, .5 * wl, wt) * A;
  if (P < 0.) wave = 0.;
  vec2 px = gl_FragCoord.xy + normalize(wp) * wave * .01 * R.x;
  float e = edgeLight(px);
  vec3 fu = field(uv);
  vec3 c = A * fu * e + wave * (e * .05 + fu * .05);
  // the glass ball, ray-traced: a real sphere behind the screen, reflecting and refracting (index 1.5) what it sees
  if (BR > 0. && BA > 0.) {
    vec3 eye = vec3(R * .5, R.y * 2.2), C = BP;   // (placed so it shows centred on BC at the slot's 0.44: sphereFor)
    vec3 ro = vec3(gl_FragCoord.xy, 0.), rd = normalize(ro - eye);
    vec3 oc = ro - C; float bq = dot(oc, rd), dp = sqrt(max(dot(oc, oc) - bq * bq, 0.));
    float aa = clamp(BR - dp + .5, 0., 1.);
    if (aa > 0.) {
      float hh = sqrt(max(BR * BR - dp * dp, 0.));
      vec3 hp = ro + rd * (-bq - hh), n = normalize(hp - C);
      float F = .04 + .96 * pow(1. - max(dot(-rd, n), 0.), 5.);
      vec3 refl = env(reflect(rd, n), 0.);
      vec3 r1 = refract(rd, n, 1. / 1.5);
      vec3 o2 = hp - C; float b2 = dot(o2, r1), t2 = -b2 + sqrt(max(b2 * b2 - (dot(o2, o2) - BR * BR), 0.));
      vec3 ep = hp + r1 * t2, n2 = normalize(ep - C);
      vec3 r2 = refract(r1, -n2, 1.5); if (dot(r2, r2) < 1e-4) r2 = reflect(r1, -n2);
      vec3 refr = env(r2, 0.) * vec3(.96, .94, .91);
      vec3 glass = mix(refr, refl, F);
      // the bounce: the edge's colour only in the highlights (rim glints in uneven arcs; the lamp's glints take a little)
      vec2 fd = normalize(n.xy + 1e-5);
      c += (glass * lampTint(glass, fd, BC) + rimGlint(n, rd, fd, BC)) * aa * BA;
    }
  }
  // premultiplied, alpha = the brightest channel: over the near-black page this composites as about a screen blend
  c = clamp(c, 0., 1.);
  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
}`;

const hex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];

type Loc = WebGLUniformLocation | null;

export class TestimonialsLight {
  private cssW = 1;
  private cssH = 1;
  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGLRenderingContext,
    private readonly prog: WebGLProgram,
    private readonly buf: WebGLBuffer,
    private readonly u: Record<"R" | "T" | "A" | "P" | "PAD" | "PO" | "BC" | "BP" | "BR" | "BA", Loc>,
  ) {}

  /** null: no WebGL, or the shader doesn't build here (the page then reads as before; nothing in the console). */
  static create(canvas: HTMLCanvasElement): TestimonialsLight | null {
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false }) as WebGLRenderingContext | null;
    } catch {
      gl = null;
    }
    if (!gl) return null;
    const ctx = gl;
    const shaders: WebGLShader[] = [];
    const prog = ctx.createProgram();
    const buf = ctx.createBuffer();
    const fail = () => {
      shaders.forEach((s) => ctx.deleteShader(s));
      if (prog) ctx.deleteProgram(prog);
      if (buf) ctx.deleteBuffer(buf);
      return null;
    };
    if (!prog || !buf) return fail();
    for (const [type, src] of [[ctx.VERTEX_SHADER, VS], [ctx.FRAGMENT_SHADER, LIGHT_FS]] as const) {
      const s = ctx.createShader(type);
      if (!s) return fail();
      shaders.push(s);
      ctx.shaderSource(s, src);
      ctx.compileShader(s);
      if (!ctx.getShaderParameter(s, ctx.COMPILE_STATUS)) return fail();
      ctx.attachShader(prog, s);
    }
    ctx.linkProgram(prog);
    if (!ctx.getProgramParameter(prog, ctx.LINK_STATUS)) return fail();
    shaders.forEach((s) => ctx.deleteShader(s)); // (the linked program keeps them)
    ctx.useProgram(prog);
    // one triangle over the whole screen
    ctx.bindBuffer(ctx.ARRAY_BUFFER, buf);
    ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), ctx.STATIC_DRAW);
    const loc = ctx.getAttribLocation(prog, "p");
    ctx.enableVertexAttribArray(loc);
    ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);
    const U = (n: string) => ctx.getUniformLocation(prog, n);
    EDGE_COLOURS.forEach((h, i) => ctx.uniform3fv(U(`C${i}`), hex(h)));
    ctx.disable(ctx.BLEND); // (the triangle writes every pixel: no clear, no blend)
    return new TestimonialsLight(canvas, ctx, prog, buf, {
      R: U("R"), T: U("T"), A: U("A"), P: U("P"), PAD: U("PAD"), PO: U("PO"), BC: U("BC"), BP: U("BP"), BR: U("BR"), BA: U("BA"),
    });
  }

  /** The screen's CSS size and pixel ratio (capped at MAX_DPR inside); resizes the drawing buffer only when it changed. */
  resize(cssW: number, cssH: number, dpr: number): void {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    const { w, h } = bufferSize(this.cssW, this.cssH, dpr);
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
  }

  draw(f: LightFrame): void {
    const { gl, u } = this;
    if (gl.isContextLost()) return;
    const v = lightUniforms(f, this.canvas.width, this.canvas.height, this.cssW, this.cssH);
    gl.uniform2f(u.R, v.R[0], v.R[1]);
    gl.uniform1f(u.T, v.T);
    gl.uniform1f(u.A, v.A);
    gl.uniform1f(u.P, v.P);
    gl.uniform1f(u.PAD, v.PAD);
    gl.uniform2f(u.PO, v.PO[0], v.PO[1]);
    gl.uniform2f(u.BC, v.BC[0], v.BC[1]);
    gl.uniform3f(u.BP, v.BP[0], v.BP[1], v.BP[2]);
    gl.uniform1f(u.BR, v.BR);
    gl.uniform1f(u.BA, v.BA);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Frees the GPU objects and the context at once (a page holds only so many). Its forced loss fires a context-lost event:
   *  the owner stops listening first. */
  dispose(): void {
    const { gl } = this;
    if (gl.isContextLost()) return;
    gl.deleteProgram(this.prog);
    gl.deleteBuffer(this.buf);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

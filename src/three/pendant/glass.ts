// src/three/pendant/glass.ts
/**
 * The testimonials' glass ball as the pendant draws it (pendant spec §3 shot 06, §6 "The glass"; its look is the pictures
 * spec's §4.2): mostly clear glass, a dark room with a faint sheen from above, the lamp up to the left (a crisp spark on the
 * front, a soft oval one seen through the glass off the back), no colour and no milk inside, and the pendant behind it seen
 * magnified, bent and upside down. Its rim glints in the colour of the screen edge it faces, as the testimonials' light
 * draws that edge (edge-light/field.ts: the one colour field both shaders share), and the lamp's glints take a little of it.
 *
 * How: a full-screen pass after the depth of field, ray-tracing a true sphere per pixel (reflection with Schlick's Fresnel,
 * refraction in and out at index 1.5, one internal bounce). The ray leaving the back of the ball is followed to the plane
 * through the pendant, square to the camera, and that point is looked up in the lens view: the pendant drawn again from the
 * same camera, zoomed onto the ball at a few pixels per screen pixel (the frame itself where the lens view doesn't reach).
 * So the image inside is the pendant's own pixels through an exact ball lens, sharp where it is magnified (no transmission
 * blur, no depth-of-field pass over it), and where the ball sees nothing of the pendant it is see-through, so the page
 * shows (premultiplied: alpha near 0 there, darkening toward the rim as the surfaces reflect more), never black or grey.
 *
 * Why not three's transmission (MeshPhysicalMaterial): it samples a blurred, screen-space copy of what is behind, offset by
 * a thickness guess, so a ball comes out milky with a smeared pendant (the placeholder did), and its alpha is either opaque
 * (black where nothing is behind: the canvas is see-through) or the page's. A true sphere is cheap to trace exactly, and
 * the exact trace is what turns the pendant over and magnifies it.
 *
 * The edge light's colour comes in two places, as in the mockup's ball (about-pictures-v26): the lamp's glints take a little of
 * it here, on the glass's own reflections (not the pendant seen through it); the rim glints are added by the finish pass
 * (GLASS_FINISH_FRAGMENT), after the tone mapping, on the colours the screen shows, because they are the light's colours as the
 * light's canvas draws them (display values, added): through the tone mapping they would come out pale and washed.
 *
 * Pure: the shaders as text and the placement maths. The scene owns the passes.
 */
import { Matrix4, ShaderMaterial, Vector2, Vector3 } from "three";
import type { Texture } from "three";
import { EDGE_COLOURS, EDGE_GLSL } from "@/three/edge-light/field";

/** Glass. */
export const GLASS_IOR = 1.5;
/** How large the middle of the pendant looks through the ball against how large it would look without it (upside down, the
 *  paraxial magnification). The ball's rim bends harder, so its ends come out smaller than this: at 2.2 the pendant's ends
 *  land about 0.7 of the way out to the rim, filling the ball as the storyboard's frame 06 has it, never past it. */
export const GLASS_MAG = 2.2;
/** The lens view: a sharper render of the pendant behind the ball, this share of the ball's radius round its centre on
 *  screen (the pendant itself, unmagnified, reaches about 0.63 of the radius from there), at this many pixels per screen
 *  pixel, so the magnified middle stays crisp. Points the lens view doesn't cover are looked up in the frame itself. */
export const LENS_SPAN = 1.25;
export const LENS_DENSITY = 2.5;

const D = Math.PI / 180;

/**
 * Where the ball sits, as a share of the camera's distance to the pendant, so the pendant seen through it is `mag` times its
 * size without it. `r`: the ball's radius as a share of the screen's height; `fovDeg`: the lens.
 *
 * A glass sphere is a thick lens whose principal planes meet at its centre, with focal length n R / (2 (n - 1)) from there
 * (1.5 R at n = 1.5). With the camera at 0, the pendant at D and the ball at g D (its radius R = 2 r tan(fov/2) g D, so its
 * screen size stays r), the pendant's real, upside-down image forms between the ball and the camera, and its size on screen
 * against the pendant's own is k / ((1 - g)(1 - k) - k g), with k = f / (g D) = 3 r tan(fov / 2) at n = 1.5. Solved for g:
 * g = 1 - k (1 + 1 / mag). (Paraxial: the ball's rim bends harder, which is the "bent" in the storyboard.)
 */
export function glassAt(r: number, fovDeg: number, mag = GLASS_MAG): number {
  const k = (GLASS_IOR / (2 * (GLASS_IOR - 1))) * 2 * r * Math.tan((fovDeg * D) / 2);
  return Math.min(0.95, Math.max(0.05, 1 - k * (1 + 1 / mag)));
}

/** The lamp, up to the left and in front of the ball (camera space, toward it): the key light's side. Within about 23 degrees
 *  of the camera, the most a glass sphere can turn a ray back through one bounce inside (n = 1.5), so the back of the ball
 *  shows it too, as the soft oval. */
const LAMP = new Vector3(-0.26, 0.26, 0.93).normalize();

export interface GlassUniforms {
  [name: string]: { value: unknown };
  tDiffuse: { value: Texture | null };
  tLens: { value: Texture | null };
  lensViewProj: { value: Matrix4 };
  camWorld: { value: Matrix4 };
  projInv: { value: Matrix4 };
  viewProj: { value: Matrix4 };
  view: { value: Matrix4 };
  camPos: { value: Vector3 };
  centre: { value: Vector3 };
  radius: { value: number };
  planePoint: { value: Vector3 };
  planeNormal: { value: Vector3 };
  lamp: { value: Vector3 };
  /** How much of the pendant shows through the ball, 0..1: the shot's `glass` (0: the clear, empty room). */
  see: { value: number };
  /** The edge light (field.ts EDGE_GLSL), as the testimonials' canvas has it: the canvas's size (px), the light's clock and
   *  strength (0: no light, the ball as Task 9 drew it), the band's padding (px), the four colours (sRGB 0..1, as the light's
   *  shader takes them), and the ball's centre on the canvas (px, y up, as gl_FragCoord). */
  R: { value: Vector2 };
  T: { value: number };
  A: { value: number };
  PAD: { value: number };
  C0: { value: Vector3 };
  C1: { value: Vector3 };
  C2: { value: Vector3 };
  C3: { value: Vector3 };
  BC: { value: Vector2 };
}

/** The edge light's inputs (field.ts EDGE_GLSL reads them; it declares none itself): one per line. */
const EDGE_UNIFORMS = /* glsl */ `uniform vec2 R;
  uniform float T;
  uniform float A;
  uniform float PAD;
  uniform vec3 C0;
  uniform vec3 C1;
  uniform vec3 C2;
  uniform vec3 C3;
  uniform vec2 BC;`;

export const GLASS_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }`;

export const GLASS_FRAGMENT = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform sampler2D tLens;   // the lens view: the pendant again, sharper, round the ball (see LENS_SPAN)
  uniform mat4 lensViewProj;
  uniform mat4 camWorld;     // the camera's world matrix
  uniform mat4 projInv;      // its projection's inverse (with the shot's lens shift)
  uniform mat4 viewProj;     // projection x view: a world point to the frame's clip space
  uniform mat4 view;         // world to camera space (the lights ride with the camera)
  uniform vec3 camPos;
  uniform vec3 centre;       // the ball, world space
  uniform float radius;
  uniform vec3 planePoint;   // the plane through the pendant, square to the camera
  uniform vec3 planeNormal;
  uniform vec3 lamp;         // camera space, toward the lamp
  uniform float see;         // how much of the pendant shows through (the shot's glass; 0: the empty room)
  ${EDGE_UNIFORMS}
  varying vec2 vUv;
  ${EDGE_GLSL}

  const float IOR = ${GLASS_IOR.toFixed(2)};
  const float F0 = 0.04;     // ((n - 1) / (n + 1))^2 at n = 1.5

  float schlick( float c ) { float m = 1.0 - clamp( c, 0.0, 1.0 ); float m2 = m * m; return F0 + ( 1.0 - F0 ) * m2 * m2 * m; }

  // The dark room, as the ball sees it (camera-space direction): black, a faint sheen from above, and the lamp. "soft"
  // widens the lamp into the oval the back of the ball shows.
  vec3 room( vec3 d, float soft ) {
    vec3 c = vec3( 0.7, 0.68, 0.65 ) * smoothstep( 0.55, 0.98, d.y );
    float cosA = dot( d, lamp );
    float crisp = smoothstep( 0.9975, 0.9988, cosA );                 // about 3 degrees across, a hard edge
    float wide = smoothstep( 0.9925, 0.9992, cosA );                  // about 7 degrees, soft
    c += vec3( 1.0, 0.96, 0.9 ) * mix( 60.0 * crisp, 4.0 * wide, soft );
    return c;
  }

  vec3 toCam( vec3 w ) { return normalize( mat3( view ) * w ); }

  // The pendant's frame where a ray leaving the ball meets the plane through it: premultiplied, 0 when it misses.
  vec4 behind( vec3 p, vec3 d ) {
    float dn = dot( d, planeNormal );
    if ( dn <= 1e-4 ) return vec4( 0.0 );
    vec3 x = p + d * ( dot( planePoint - p, planeNormal ) / dn );
    vec4 l = lensViewProj * vec4( x, 1.0 );
    vec2 lv = l.xy / l.w * 0.5 + 0.5;
    if ( l.w > 0.0 && all( greaterThan( lv, vec2( 0.002 ) ) ) && all( lessThan( lv, vec2( 0.998 ) ) ) ) return texture2D( tLens, lv );
    vec4 c = viewProj * vec4( x, 1.0 );
    vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if ( c.w <= 0.0 || any( lessThan( uv, vec2( 0.0 ) ) ) || any( greaterThan( uv, vec2( 1.0 ) ) ) ) return vec4( 0.0 );
    return texture2D( tDiffuse, uv );
  }

  void main() {
    vec4 frame = texture2D( tDiffuse, vUv );
    // this pixel's ray (the projection carries the shot's lens shift, so it is inverted whole)
    vec4 v = projInv * vec4( vUv * 2.0 - 1.0, 1.0, 1.0 );
    vec3 d = normalize( mat3( camWorld ) * ( v.xyz / v.w ) );
    vec3 oc = camPos - centre;
    float b = dot( oc, d );
    float miss2 = dot( oc, oc ) - b * b;                               // the ray's closest approach to the centre, squared
    float near = sqrt( max( miss2, 0.0 ) );
    float cover = clamp( ( radius - near ) / max( fwidth( near ), 1e-6 ) + 0.5, 0.0, 1.0 );   // the silhouette, antialiased
    if ( cover <= 0.0 ) { gl_FragColor = frame; return; }

    // in at the front (clamped at the silhouette, where the antialiased edge pixels sit just outside)
    float h = sqrt( max( radius * radius - miss2, 0.0 ) );
    vec3 p1 = camPos + d * ( -b - h );
    vec3 n1 = normalize( p1 - centre );
    float c1 = max( dot( -d, n1 ), 0.0 );
    float f1 = schlick( c1 );
    vec3 r1 = reflect( d, n1 );
    vec3 t1 = refract( d, n1, 1.0 / IOR );
    // across, and out at the back (a sphere never totally reflects a ray that came in through it)
    vec3 p2 = p1 + t1 * ( -2.0 * dot( p1 - centre, t1 ) );
    vec3 n2 = normalize( p2 - centre );
    float f2 = f1;                                                     // (a sphere: it leaves at the angle it came in)
    vec3 t2 = refract( t1, -n2, IOR );
    // one bounce off the inside of the back, and out through the front: the lamp's soft oval
    vec3 i2 = reflect( t1, -n2 );
    vec3 p3 = p2 + i2 * ( -2.0 * dot( p2 - centre, i2 ) );
    vec3 t3 = refract( i2, -normalize( p3 - centre ), IOR );

    float through = ( 1.0 - f1 ) * ( 1.0 - f2 );
    // the pendant, upside down (premultiplied), as much as the shot is through the glass: else the empty room
    vec4 seen = see > 0.0 ? behind( p2, t2 ) * through * see : vec4( 0.0 );
    vec3 glints = f1 * room( toCam( r1 ), 0.0 );
    glints += ( 1.0 - f1 ) * f2 * ( 1.0 - f2 ) * room( toCam( t3 ), 1.0 ) * step( 1e-4, dot( t3, t3 ) );
    // the lamp's glints take a little of the edge's colour (field.ts lampTint; 1 with no light)
    glints *= lampTint( glints, normalize( toCam( n1 ).xy + 1e-5 ), BC );
    // The page behind shows through what the pendant leaves, dimmed by what the two surfaces reflect away (most of it at the
    // rim: the dark ring of a glass ball). The canvas is premultiplied over the page, so that is an alpha of 1 - through x
    // (1 - the pendant's). A glint is light over the page: as opaque as it is bright (the output pass un-premultiplies).
    float a = 1.0 - through + seen.a;
    float ga = clamp( max( glints.r, max( glints.g, glints.b ) ), 0.0, 1.0 );
    vec4 ball = vec4( seen.rgb + glints, a + ( 1.0 - a ) * ga );
    gl_FragColor = mix( frame, ball, cover );
  }`;

/**
 * The finish, after the tone mapping (the scene's last pass before FXAA): the testimonials' rim glints added on the ball, in
 * the colour of the screen edge each point of the rim faces (field.ts rimGlint, display values, as the light's canvas adds
 * them), and the dim (behind the words) on everything but the ball: the ball is glass in the page, not the pendant, so it
 * keeps its look whatever the pendant's shot. Premultiplied: a glint is light over the page, as opaque as it is bright (the
 * light's canvas composites the same way). It traces the same sphere as the glass pass, from the same uniforms.
 */
export const GLASS_FINISH_FRAGMENT = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float dim;         // 0..1 brightness, the ball left out
  uniform float ball;        // 1 while the ball is drawn
  uniform mat4 camWorld;
  uniform mat4 projInv;
  uniform mat4 view;
  uniform vec3 camPos;
  uniform vec3 centre;
  uniform float radius;
  ${EDGE_UNIFORMS}
  varying vec2 vUv;
  ${EDGE_GLSL}

  void main() {
    vec4 c = texture2D( tDiffuse, vUv );
    float cover = 0.0;
    vec3 rim = vec3( 0.0 );
    if ( ball > 0.5 ) {
      vec4 v = projInv * vec4( vUv * 2.0 - 1.0, 1.0, 1.0 );
      vec3 d = normalize( mat3( camWorld ) * ( v.xyz / v.w ) );
      vec3 oc = camPos - centre;
      float b = dot( oc, d );
      float miss2 = dot( oc, oc ) - b * b;
      float near = sqrt( max( miss2, 0.0 ) );
      cover = clamp( ( radius - near ) / max( fwidth( near ), 1e-6 ) + 0.5, 0.0, 1.0 );   // (the glass pass's silhouette)
      if ( cover > 0.0 && A > 0.0 ) {
        float h = sqrt( max( radius * radius - miss2, 0.0 ) );
        // camera space (x right, y up, toward the eye), as the light's ray-traced ball has its normal and ray
        vec3 n = normalize( mat3( view ) * normalize( camPos + d * ( -b - h ) - centre ) );
        vec3 rd = normalize( mat3( view ) * d );
        rim = clamp( rimGlint( n, rd, normalize( n.xy + 1e-5 ), BC ), 0.0, 1.0 ) * cover;
      }
    }
    c.rgb *= mix( dim, 1.0, cover );
    float ra = max( rim.r, max( rim.g, rim.b ) );
    gl_FragColor = vec4( c.rgb + rim, c.a + ( 1.0 - c.a ) * ra );
  }`;

/** The finish pass's uniforms: its own frame and dim, and (shared, the same objects) the glass pass's sphere and light. */
export type GlassFinishUniforms = Pick<GlassUniforms, "camWorld" | "projInv" | "view" | "camPos" | "centre" | "radius" | "R" | "T" | "A" | "PAD" | "C0" | "C1" | "C2" | "C3" | "BC"> & {
  [name: string]: { value: unknown };
  tDiffuse: { value: Texture | null };
  dim: { value: number };
  ball: { value: number };
};

/** The finish pass's material, sharing the glass pass's uniform objects (so placing the ball places it for both). */
export function glassFinishMaterial(glass: GlassUniforms): ShaderMaterial & { uniforms: GlassFinishUniforms } {
  const { camWorld, projInv, view, camPos, centre, radius, R, T, A, PAD, C0, C1, C2, C3, BC } = glass;
  const uniforms: GlassFinishUniforms = {
    tDiffuse: { value: null }, dim: { value: 1 }, ball: { value: 0 },
    camWorld, projInv, view, camPos, centre, radius, R, T, A, PAD, C0, C1, C2, C3, BC,
  };
  return new ShaderMaterial({
    name: "PendantGlassFinish", uniforms, vertexShader: GLASS_VERTEX, fragmentShader: GLASS_FINISH_FRAGMENT, depthTest: false, depthWrite: false,
  }) as ShaderMaterial & { uniforms: GlassFinishUniforms };
}

/** sRGB 0..1 from "#rrggbb", as the light's shader takes its colours (no colour management: the field cubes them itself). */
const rgb = (h: string) => new Vector3(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));

/** The glass pass's material: a full-screen quad over the frame the depth of field left. */
export function glassMaterial(): ShaderMaterial & { uniforms: GlassUniforms } {
  const uniforms: GlassUniforms = {
    tDiffuse: { value: null },
    tLens: { value: null },
    lensViewProj: { value: new Matrix4() },
    camWorld: { value: new Matrix4() },
    projInv: { value: new Matrix4() },
    viewProj: { value: new Matrix4() },
    view: { value: new Matrix4() },
    camPos: { value: new Vector3() },
    centre: { value: new Vector3() },
    radius: { value: 1 },
    planePoint: { value: new Vector3() },
    planeNormal: { value: new Vector3(0, 0, -1) },
    lamp: { value: LAMP.clone() },
    see: { value: 0 },
    R: { value: new Vector2(1, 1) },
    T: { value: 0 },
    A: { value: 0 },
    PAD: { value: 0 },
    C0: { value: rgb(EDGE_COLOURS[0]) },
    C1: { value: rgb(EDGE_COLOURS[1]) },
    C2: { value: rgb(EDGE_COLOURS[2]) },
    C3: { value: rgb(EDGE_COLOURS[3]) },
    BC: { value: new Vector2() },
  };
  return new ShaderMaterial({
    name: "PendantGlass", uniforms, vertexShader: GLASS_VERTEX, fragmentShader: GLASS_FRAGMENT, depthTest: false, depthWrite: false,
  }) as ShaderMaterial & { uniforms: GlassUniforms };
}

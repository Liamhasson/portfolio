// src/three/edge-light/field.ts
/**
 * The testimonials' edge light, shared (plan Task 1; ported from the mockup about-pictures-v26, itself a port of Oryzo's
 * AppleEfx studied 10-16). One colour field serves both the light at the screen's edges and the glass ball's rim glints, so
 * the ball shows the colour of the edge it faces. The GLSL is a chunk for the includer's shader: it declares no uniforms
 * and reads R (canvas px), T (seconds), A (0..1 strength), PAD (px) and the colours C0..C3, all declared by the includer.
 * The JS mirrors (warpTime, breath) let the lens breathe with the light's push and pull without reading the GPU.
 */

/** C0..C3: the four corner colours, warm (Liam), in the order the includer's uniforms take them. */
export const EDGE_COLOURS = ["#ff86e0", "#ff9a3c", "#ffe46a", "#ff5f78"] as const;

/** Uneven time: the light never settles into a loop (mirrors tw() in EDGE_GLSL). */
export function warpTime(t: number): number {
  return t + 0.8 * Math.sin(t * 0.31) + 0.4 * Math.sin(t * 0.77 + 1.3);
}

/** The shared push and pull of the inner edge, -1..1, of warped time (mirrors g in edgeLight()). */
export function breath(tw: number): number {
  return 0.55 * Math.sin(tw * 0.6) + 0.3 * Math.sin(tw * 1.37 + 2) + 0.15 * Math.sin(tw * 2.9 + 0.5);
}

/**
 * Needs the includer's `uniform vec2 R; uniform float T, A, PAD; uniform vec3 C0, C1, C2, C3;`. rimGlint and lampTint take
 * the ball's centre BC (canvas px) as an argument, so a shader without a ball never declares it.
 */
export const EDGE_GLSL = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.), f.x), f.y); }
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
float lstep(float a, float b, float x) { return clamp((x - a) / (b - a), 0., 1.); }
// uneven time: the light never settles into a loop
float tw() { return T + .8 * sin(T * .31) + .4 * sin(T * .77 + 1.3); }
// the colour field: four colours at the corners, turning (the hues travel around the frame)
vec3 field(vec2 uv) {
  vec2 g = (uv - .5) * vec2(max(R.x / R.y, 1.), max(R.y / R.x, 1.)) * 2.;
  float an = T * -3.2; g = mat2(cos(an), -sin(an), sin(an), cos(an)) * g; g = clamp(g * .5 + .5, 0., 1.);
  vec3 c = mix(mix(C3, C2, g.x), mix(C0, C1, g.x), g.y);
  return c * c * c * 2.;
}
// the edge light at a point (canvas px): Oryzo's two falloffs, its inner edge pushed back and forth: in random places
// (noise along the frame) and all together (a breath), at an uneven pace
float edgeLight(vec2 px) {
  float m = min(R.x, R.y), t = tw();
  float o = (noise(px / m * 2.2 + vec2(t * .21, -t * .16)) + .5 * noise(px / m * 5.1 - vec2(t * .33, t * .27))) / 1.5 * 2. - 1.;
  float g = .55 * sin(t * .6) + .3 * sin(t * 1.37 + 2.) + .15 * sin(t * 2.9 + .5);
  float sh = PAD * (.5 * o + .22 * g);
  vec2 b = px - R * .5;
  float d = pow(lstep(0., PAD * 2.5, sdBox(b, R * .5 - PAD * 2. - sh) - PAD), 3.);
  float d2 = pow(lstep(0., PAD * 5.5, sdBox(b, R * .5 - PAD * 3. - sh) - PAD * 1.5), 5.);
  return (d + d2 * .5) * 5.;
}
// where a ray from c (px) along dir meets the screen's edge, as uv
vec2 edgeHit(vec2 c, vec2 dir) {
  float tx = dir.x > 0. ? (R.x - c.x) / dir.x : -c.x / min(dir.x, -1e-4);
  float ty = dir.y > 0. ? (R.y - c.y) / dir.y : -c.y / min(dir.y, -1e-4);
  return clamp((c + dir * min(tx, ty)) / R, 0., 1.);
}
// what the ball sees, k = how much of the edge's colour reaches it: mostly a dark room with a faint sheen from above
// (so it reads as glass), the lamp up to the left (a crisp spark in front, a soft one behind: the oval the glass renders
// show), and the frame's coloured light only at grazing angles, so it shows as glints along the rim, never a fill
vec3 env(vec3 dir, float k) {
  vec3 c = vec3(.05, .046, .042) * smoothstep(-.3, .9, dir.y) + vec3(.03, .022, .018) * smoothstep(-.1, -.9, dir.y);
  c += vec3(1., .93, .84) * pow(max(dot(dir, normalize(vec3(-.55, .62, .56))), 0.), 260.) * 3.;
  c += vec3(1., .9, .78) * pow(max(dot(dir, normalize(vec3(-.42, .5, -.76))), 0.), 22.) * .75;
  vec2 a = normalize(dir.xy + 1e-5);
  float wob = .7 + .3 * noise(a * 1.6 + vec2(tw() * .35, -tw() * .27)) + .15 * sin(tw() * .6);   // (by direction: no seam)
  c += k * A * field(.5 + a * .5) * exp(-pow(dir.z / .16, 2.)) * 1.3 * wob;
  return c;
}
// the bounce: the screen's edge colour only in the highlights. A glint along the rim in the colour of the edge it faces
// (n: the surface normal, rd: the view ray, fd: n.xy's direction, BC: the ball's centre in canvas px), in uneven arcs
// that come and go with the edges' push and pull. Returns the additive colour.
vec3 rimGlint(vec3 n, vec3 rd, vec2 fd, vec2 BC) {
  vec3 ec = field(edgeHit(BC, fd));
  float rim = pow(1. - max(dot(n, -rd), 0.), 4.);
  float arcs = smoothstep(.3, .8, noise(fd * 2.2 + vec2(tw() * .4, -tw() * .3)));
  return A * ec * rim * (.25 + .75 * arcs) * .9;
}
// the lamp's glints take a little of the edge's colour: the multiplier for the glass colour
vec3 lampTint(vec3 glass, vec2 fd, vec2 BC) {
  vec3 ec = field(edgeHit(BC, fd));
  float lamp = max(max(glass.r, glass.g), glass.b);
  return mix(vec3(1.), ec * .6 + .4, .35 * A * smoothstep(.15, .6, lamp));
}
`;

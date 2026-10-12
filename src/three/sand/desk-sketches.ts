import * as THREE from "three";
import { SKETCHES, buildSketch, type Sketch } from "./sketch-data";
import type { Layer } from "./sketch-hand";
import { strokeStrip } from "./sketch-strokes";
import { rubTone } from "./sketch-tone";

/**
 * The sketches behind the desk (Liam, 2026-10-12): drawings of the real work (Pulse, Cyvore, Eventread) in the space
 * beyond the desk's far edge, seen through the tilt. Each draws itself on as the tilt brings it in, staggered left to
 * right, its notes written after its strokes; while drawing it turns a few degrees, a light tilt and spin, easing to rest
 * once drawn (Liam: "some 3D movement while the sketches are being drawn, light tilt/spin, not extreme"); they fade early
 * in the glide. Scroll-driven, so they reverse. Warm hairlines in the brief's colour, faint, no glow. Reduced motion: drawn
 * and still. In the scene (they sit behind the desk, which hides what is behind it), placed from the tilt's last frame.
 * Drawn by hand (sketch-hand.ts; Liam: "too perfect", take Oryzo's style): guides first, loose doubled lines, open
 * circles, hatching, rubbed tone. And they float, like Oryzo's (Liam: "light movement, as if they are flowing in
 * space"): each drifts slowly and turns a degree or two, out of step with the others.
 */
export const SKETCH_TIMES = {
  from: 1.95,      // story screens: the first sketch starts drawing
  stagger: 0.07,   // each next one later by this
  draw: 0.3,       // screens each takes to draw
  drawnBy: 2.4,    // all drawn by the tilt's end
  fadeFrom: 2.5,
  gone: 2.8,
} as const;

export const SKETCH_LOOK = {
  color: "rgb(230, 191, 174)",   // the brief's line colour
  opacity: 0.3,                  // (Liam, 2026-10-12: 30%)
  widthPx: 1.1,                  // the hairline's width at the tilt's end (screen px)
  layerWidth: { guide: 0.7, line: 1, hatch: 0.75 } as Record<Layer, number>,
  turn: 0.11,                    // radians of turn at the start of drawing (~6 degrees), easing to none
} as const;

const ease = (x: number) => { const t = Math.min(Math.max(x, 0), 1); return t * t * (3 - 2 * t); };
const span = (p: number, a: number, b: number) => Math.min(Math.max((p - a) / (b - a), 0), 1);

/** A sketch's state at story progress `p` (screens): its strokes' reveal, its notes', its opacity, its turn. */
export function sketchState(p: number, i: number, reduced: boolean) {
  const t0 = SKETCH_TIMES.from + i * SKETCH_TIMES.stagger;
  const reveal = reduced ? 1 : span(p, t0, t0 + SKETCH_TIMES.draw);
  const shown = reduced ? (p >= SKETCH_TIMES.from ? 1 : 0) : ease(span(p, t0 - 0.03, t0 + 0.05));
  const opacity = shown * (1 - ease(span(p, SKETCH_TIMES.fadeFrom, SKETCH_TIMES.gone)));
  const notes = reduced ? 1 : ease(span(reveal, 0.55, 1));
  // the turn: strongest as it starts drawing, none once drawn (a sheet settling as it is drawn on)
  const k = reduced ? 0 : 1 - ease(reveal);
  const dir = i % 2 ? -1 : 1;
  return { reveal, notes, opacity, spin: k ? dir * SKETCH_LOOK.turn * k : 0, tilt: k ? -0.6 * SKETCH_LOOK.turn * k : 0 };
}

/** The float: in the sketch's units and radians; each axis its own slow period; each sketch out of step. */
export const SKETCH_FLOAT = {
  move: 9,                              // units each way, on each axis (Liam, 2026-10-12: "a bit more visible", was 5)
  periods: [14, 11, 16],                // seconds: x, y, z
  turn: [0.045, 0.06, 0.02],            // radians: about x, y, z (up to ~3.5 degrees)
  turnPeriods: [9.7, 12.3, 15.1],
} as const;

/** A sketch's float at `time` (seconds, its own clock): a slow drift and a turn. Still under reduced motion. */
export function sketchFloat(time: number, i: number, reduced: boolean) {
  if (reduced) return { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
  const F = SKETCH_FLOAT, ph = (k: number) => i * 2.399 + k * 1.618;   // (golden-angle phases: never in step)
  const w = (P: number, k: number) => Math.sin((2 * Math.PI * time) / P + ph(k));
  return {
    x: F.move * w(F.periods[0], 0), y: F.move * w(F.periods[1], 1), z: F.move * w(F.periods[2], 2),
    rx: F.turn[0] * w(F.turnPeriods[0], 3), ry: F.turn[1] * w(F.turnPeriods[1], 4), rz: F.turn[2] * w(F.turnPeriods[2], 5),
  };
}

const VERT = /* glsl */ `
in vec2 aNormal;
in float aSide;
in float aTime;
in float aAlpha;   // the stroke's strength there (lighter where the pencil lands and lifts)
in float aWidth;   // its layer's width (guides and hatching finer)
uniform float uWidth;   // in the sketch's units
out float vTime;
out float vAlpha;
void main() {
  vTime = aTime;
  vAlpha = aAlpha;
  vec3 p = vec3(position.xy + aNormal * aSide * uWidth * aWidth * 0.5, 0.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
const FRAG = /* glsl */ `
precision highp float;
in float vTime;
in float vAlpha;
uniform float uReveal;
uniform float uOpacity;
uniform vec3 uColor;
out vec4 outColor;
void main() {
  if (vTime > uReveal) discard;
  outColor = vec4(uColor, uOpacity * vAlpha);
  #include <colorspace_fragment>
}
`.replace("#include <colorspace_fragment>", "outColor = linearToOutputTexel(outColor);");
const NOTE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D uMap;
uniform float uReveal;
uniform float uOpacity;
uniform vec3 uColor;
out vec4 outColor;
void main() {
  float a = texture(uMap, vUv).a * smoothstep(uReveal * 1.15, uReveal * 1.15 - 0.15, vUv.x);   // written left to right
  if (a <= 0.001) discard;
  outColor = linearToOutputTexel(vec4(uColor, a * uOpacity));
}
`;
const TONE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D uMap;
uniform float uOpacity;
uniform vec3 uColor;
out vec4 outColor;
void main() {
  float a = texture(uMap, vUv).a;
  if (a <= 0.001) discard;
  outColor = linearToOutputTexel(vec4(uColor, a * uOpacity));
}
`;
const NOTE_VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

type Built = {
  sketch: Sketch; box: [number, number, number, number]; place: THREE.Group; pivot: THREE.Group;
  lines: THREE.ShaderMaterial; tone: THREE.ShaderMaterial; notes: THREE.ShaderMaterial;
};

/** Pixels a unit in the tone's and notes' textures. */
const PPU = 4;

export class DeskSketches {
  readonly group = new THREE.Group();
  private readonly built: Built[] = [];

  constructor(fontFamily: string) {
    const color = new THREE.Color(SKETCH_LOOK.color);
    const common = { glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, depthTest: true, toneMapped: false, side: THREE.DoubleSide };
    SKETCHES.forEach((sk, si) => {
      const { marks, tones, times, box } = buildSketch(sk);
      // the strokes: one strip each, merged; each vertex its reveal time, strength and width
      const pos: number[] = [], nor: number[] = [], side: number[] = [], time: number[] = [], alpha: number[] = [], width: number[] = [], index: number[] = [];
      marks.forEach((m, k) => {
        const st = strokeStrip(m.pts, times[k], si * 1000 + k, m.alpha), base = pos.length / 3;
        for (let v = 0; v < st.times.length; v++) { pos.push(st.positions[v * 2], st.positions[v * 2 + 1], 0); width.push(SKETCH_LOOK.layerWidth[m.layer]); }
        nor.push(...st.normals); side.push(...st.sides); time.push(...st.times); alpha.push(...st.alphas);
        for (let v = 0; v + 3 < st.times.length; v += 2) index.push(base + v, base + v + 1, base + v + 2, base + v + 1, base + v + 3, base + v + 2);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("aNormal", new THREE.Float32BufferAttribute(nor, 2));
      geo.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
      geo.setAttribute("aTime", new THREE.Float32BufferAttribute(time, 1));
      geo.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alpha, 1));
      geo.setAttribute("aWidth", new THREE.Float32BufferAttribute(width, 1));
      geo.setIndex(index);
      const lines = new THREE.ShaderMaterial({ ...common, vertexShader: VERT, fragmentShader: FRAG,
        uniforms: { uReveal: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: color }, uWidth: { value: 1 } } });
      // the tone and the notes: each drawn into a texture over the sketch's box
      const [bx, by, bw, bh] = box;
      const canvas = () => { const cv = document.createElement("canvas"); cv.width = Math.ceil(bw * PPU); cv.height = Math.ceil(bh * PPU); return cv; };
      const toneCv = canvas(), tg = toneCv.getContext("2d")!;
      tones.forEach((t, k) => rubTone(tg, t.pts, t.alpha, PPU, bx, by, si * 100 + k + 1));
      const notesCv = canvas(), g = notesCv.getContext("2d")!;
      g.fillStyle = "#fff"; g.textBaseline = "alphabetic";
      for (const n of sk.notes) {
        g.save();
        g.translate((n.x - bx) * PPU, (n.y - by) * PPU);
        g.rotate(n.rot ?? 0);
        g.font = `500 ${(n.size ?? 17) * PPU}px ${fontFamily}, cursive`;
        g.fillText(n.text, 0, 0);
        g.restore();
      }
      const texture = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; return t; };
      const tone = new THREE.ShaderMaterial({ ...common, vertexShader: NOTE_VERT, fragmentShader: TONE_FRAG,
        uniforms: { uMap: { value: texture(toneCv) }, uOpacity: { value: 0 }, uColor: { value: color } } });
      const notes = new THREE.ShaderMaterial({ ...common, vertexShader: NOTE_VERT, fragmentShader: NOTE_FRAG,
        uniforms: { uMap: { value: texture(notesCv) }, uReveal: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: color } } });
      const plane = (m: THREE.ShaderMaterial) => {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), m);
        mesh.position.set(bx + bw / 2, by + bh / 2, 0);
        mesh.scale.y = -1;   // (the sketch's units run y down; the plane's texture, up)
        return mesh;
      };
      // the sketch's own frame: centred on its box, y down (flipped), turned in its plane; the pivot carries the turn
      // while drawing and the float
      const content = new THREE.Group();
      content.add(plane(tone), new THREE.Mesh(geo, lines), plane(notes));
      content.position.set(-(bx + bw / 2), -(by + bh / 2), 0);
      const pivot = new THREE.Group(); pivot.add(content);
      const place = new THREE.Group(); place.add(pivot);
      place.visible = false;
      this.group.add(place);
      this.built.push({ sketch: sk, box, place, pivot, lines, tone, notes });
    });
  }

  /** Placed from the tilt's last frame: each at its spot on screen, `distance` along its line of sight, facing the camera. */
  place(camera: THREE.PerspectiveCamera, distance: number, bufferHeight: number): void {
    camera.updateMatrixWorld();
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    for (const b of this.built) {
      const [ax, ay] = b.sketch.at;
      const dir = new THREE.Vector3(ax * tanV * camera.aspect, ay * tanV, -1).applyQuaternion(camera.quaternion).normalize();
      const along = distance / dir.dot(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
      b.place.position.copy(camera.position).addScaledVector(dir, along);
      b.place.quaternion.copy(camera.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -b.sketch.roll));
      const s = (b.sketch.per100 / 100) * 2 * distance * tanV;   // (world units a sketch unit)
      b.place.scale.set(s, -s, s);   // (y down)
      // the hairline: its width in the sketch's units, for SKETCH_LOOK.widthPx at this distance
      const pxPerUnit = (bufferHeight / (2 * distance * tanV)) * s;
      b.lines.uniforms.uWidth.value = SKETCH_LOOK.widthPx * (window.devicePixelRatio || 1) / pxPerUnit;
    }
  }

  /** Each frame: story progress `p` (screens), and the float's clock `time` (seconds). */
  update(p: number, reduced: boolean, time = 0): void {
    this.built.forEach((b, i) => {
      const s = sketchState(p, i, reduced);
      b.place.visible = s.opacity > 0.001;
      if (!b.place.visible) return;
      const o = s.opacity * SKETCH_LOOK.opacity;
      b.lines.uniforms.uReveal.value = s.reveal;
      b.lines.uniforms.uOpacity.value = o;
      b.tone.uniforms.uOpacity.value = o * ease(span(s.reveal, 0.7, 1));   // (rubbed in as the hatching lands)
      b.notes.uniforms.uReveal.value = s.notes;
      b.notes.uniforms.uOpacity.value = o * 1.2;
      const f = sketchFloat(time, i, reduced);
      b.pivot.position.set(f.x, f.y, f.z);
      b.pivot.rotation.set(s.tilt + f.rx, s.spin + f.ry, f.rz);
    });
  }

  /** Any sketch on screen (its float's clock runs only then). */
  get showing(): boolean { return this.built.some((b) => b.place.visible); }
}

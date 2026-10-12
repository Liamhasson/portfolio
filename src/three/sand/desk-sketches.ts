import * as THREE from "three";
import { SKETCHES, type Sketch } from "./sketch-data";
import { strokeStrip, strokeTimes } from "./sketch-strokes";

/**
 * The sketches behind the desk (Liam, 2026-10-12): drawings of the real work (Pulse, Cyvore, Eventread) in the space
 * beyond the desk's far edge, seen through the tilt. Each draws itself on as the tilt brings it in, staggered left to
 * right, its notes written after its strokes; while drawing it turns a few degrees, a light tilt and spin, easing to rest
 * once drawn (Liam: "some 3D movement while the sketches are being drawn, light tilt/spin, not extreme"); they fade early
 * in the glide. Scroll-driven, so they reverse. Warm hairlines in the brief's colour, faint, no glow. Reduced motion: drawn
 * and still. In the scene (they sit behind the desk, which hides what is behind it), placed from the tilt's last frame.
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
  opacity: 0.2,
  widthPx: 1.1,                  // the hairline's width at the tilt's end (screen px)
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

const VERT = /* glsl */ `
in vec2 aNormal;
in float aSide;
in float aTime;
uniform float uWidth;   // in the sketch's units
out float vTime;
void main() {
  vTime = aTime;
  vec3 p = vec3(position.xy + aNormal * aSide * uWidth * 0.5, 0.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
const FRAG = /* glsl */ `
precision highp float;
in float vTime;
uniform float uReveal;
uniform float uOpacity;
uniform vec3 uColor;
out vec4 outColor;
void main() {
  if (vTime > uReveal) discard;
  outColor = vec4(uColor, uOpacity);
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
const NOTE_VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

type Built = { sketch: Sketch; place: THREE.Group; pivot: THREE.Group; lines: THREE.ShaderMaterial; notes: THREE.ShaderMaterial };

export class DeskSketches {
  readonly group = new THREE.Group();
  private readonly built: Built[] = [];

  constructor(fontFamily: string) {
    const color = new THREE.Color(SKETCH_LOOK.color);
    SKETCHES.forEach((sk, si) => {
      // the strokes: one strip each, merged; each vertex its reveal time
      const times = strokeTimes(sk.strokes);
      const pos: number[] = [], nor: number[] = [], side: number[] = [], time: number[] = [], index: number[] = [];
      sk.strokes.forEach((s, k) => {
        const st = strokeStrip(s, times[k], si * 100 + k), base = pos.length / 3;
        for (let v = 0; v < st.times.length; v++) pos.push(st.positions[v * 2], st.positions[v * 2 + 1], 0);
        nor.push(...st.normals); side.push(...st.sides); time.push(...st.times);
        for (let v = 0; v + 3 < st.times.length; v += 2) index.push(base + v, base + v + 1, base + v + 2, base + v + 1, base + v + 3, base + v + 2);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("aNormal", new THREE.Float32BufferAttribute(nor, 2));
      geo.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
      geo.setAttribute("aTime", new THREE.Float32BufferAttribute(time, 1));
      geo.setIndex(index);
      const common = { glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, depthTest: true, toneMapped: false, side: THREE.DoubleSide };
      const lines = new THREE.ShaderMaterial({ ...common, vertexShader: VERT, fragmentShader: FRAG,
        uniforms: { uReveal: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: color }, uWidth: { value: 1 } } });
      // the notes: written into a texture over the sketch's box, then revealed left to right
      const [bx, by, bw, bh] = sk.box, ppu = 4;
      const cv = document.createElement("canvas");
      cv.width = Math.ceil(bw * ppu); cv.height = Math.ceil(bh * ppu);
      const g = cv.getContext("2d")!;
      g.fillStyle = "#fff"; g.textBaseline = "alphabetic";
      for (const n of sk.notes) {
        g.save();
        g.translate((n.x - bx) * ppu, (n.y - by) * ppu);
        g.rotate(n.rot ?? 0);
        g.font = `500 ${(n.size ?? 17) * ppu}px ${fontFamily}, cursive`;
        g.fillText(n.text, 0, 0);
        g.restore();
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.NoColorSpace;
      const notes = new THREE.ShaderMaterial({ ...common, vertexShader: NOTE_VERT, fragmentShader: NOTE_FRAG,
        uniforms: { uMap: { value: tex }, uReveal: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: color } } });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), notes);
      plane.position.set(bx + bw / 2, by + bh / 2, 0);
      plane.scale.y = -1;   // (the sketch's units run y down; the plane's texture, up)
      // the sketch's own frame: centred on its box, y down (flipped), turned in its plane; the pivot carries the turn
      const content = new THREE.Group();
      content.add(new THREE.Mesh(geo, lines), plane);
      content.position.set(-(bx + bw / 2), -(by + bh / 2), 0);
      const pivot = new THREE.Group(); pivot.add(content);
      const place = new THREE.Group(); place.add(pivot);
      place.visible = false;
      this.group.add(place);
      this.built.push({ sketch: sk, place, pivot, lines, notes });
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
      const worldH = b.sketch.height * 2 * distance * tanV, s = worldH / b.sketch.box[3];
      b.place.scale.set(s, -s, s);   // (y down)
      // the hairline: its width in the sketch's units, for SKETCH_LOOK.widthPx at this distance
      const pxPerUnit = (bufferHeight / (2 * distance * tanV)) * s;
      b.lines.uniforms.uWidth.value = SKETCH_LOOK.widthPx * (window.devicePixelRatio || 1) / pxPerUnit;
    }
  }

  /** Each frame: story progress `p` (screens). */
  update(p: number, reduced: boolean): void {
    this.built.forEach((b, i) => {
      const s = sketchState(p, i, reduced);
      b.place.visible = s.opacity > 0.001;
      if (!b.place.visible) return;
      b.lines.uniforms.uReveal.value = s.reveal;
      b.lines.uniforms.uOpacity.value = s.opacity * SKETCH_LOOK.opacity;
      b.notes.uniforms.uReveal.value = s.notes;
      b.notes.uniforms.uOpacity.value = s.opacity * SKETCH_LOOK.opacity * 1.2;
      b.pivot.rotation.set(s.tilt, s.spin, 0);
    });
  }
}

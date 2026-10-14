import * as THREE from "three";

/**
 * The notes on the desk as things to touch (Liam, 2026-10-13/14): the one under the cursor bends a little, as paper
 * would (a sticky's glued top stays down and its lower part curls up; the card, pinned under the pen, lifts only on its
 * free side), and the lens racks focus onto it; a click hands it to the story. Each note's mesh is baked in the desk's
 * own space (no node transform). The desk is baked without the notes' shadows, so each note casts its own, live: soft,
 * and gone with the note when it leaves.
 */
export interface NotePose {
  /** world: centre, the paper's right and up (unit), its normal (toward the camera), width and height */
  centre: THREE.Vector3; right: THREE.Vector3; up: THREE.Vector3; normal: THREE.Vector3; w: number; h: number;
}

/** How each note lies (blender/lookdev/lookdev.py build_desk: sheet(name, size, loc, rot_z)): its size in metres and
 *  its turn about the vertical. The bakes' uv can't tell which way the handwriting faces (the card's runs a quarter
 *  turn round, the stickies' mirrored), so the paper's frame comes from here. */
export interface NoteSpec { name: string; size: [number, number]; rotZ: number }

interface Bend { uBend: THREE.IUniform<number>; uHinge: THREE.IUniform<THREE.Vector3>; uAxis: THREE.IUniform<THREE.Vector3>; uSpan: THREE.IUniform<number> }
interface Note extends NoteSpec { mesh: THREE.Mesh; centre: THREE.Vector3; lift: number; bend: Bend; peak: number; shadow: THREE.Mesh | null; shadowA: number }

/** How far a hovered note bends at its free edge (a share of its height), and how quickly it comes and goes; how much
 *  of a sticky is glued (from its top). */
const LIFT = { share: 0.1, rate: 9, glued: 0.22 };
/** The live shadow: its darkness, how much larger than the paper, and its offset away from the lamp (m). */
const SHADOW = { alpha: 0.42, grow: 1.12, offset: new THREE.Vector3(0.0016, 0, 0.001) };
/** How far either side of the pen a sheet under it stays flat (m): the pen, its contact shadow and the strip the bake
 *  never lit beneath it all stay put, measured from the pen's own points (Liam, 2026-10-14: a band round an average
 *  line let that blank strip show). */
const PINNED = 0.012;

/** The bend, in the note's own vertex shader: past the hinge, the paper rises with the square of the distance. */
function installBend(material: THREE.Material, bend: Bend): void {
  const tags: string[] = (material.userData.shaderTags ??= []);
  tags.push("notebend");
  material.customProgramCacheKey = () => tags.join("|");
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    Object.assign(shader.uniforms, bend);
    shader.vertexShader = "uniform float uBend; uniform vec3 uHinge; uniform vec3 uAxis; uniform float uSpan;\n" + shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n  { float dd = max(dot(transformed - uHinge, uAxis), 0.0) / uSpan; transformed.y += uBend * dd * dd; }",
    );
  };
  material.needsUpdate = true;
}

/** A soft dark rounded rectangle, for the live shadows. */
function shadowTexture(): THREE.Texture {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d")!;
  x.filter = "blur(10px)"; x.fillStyle = "#000";
  x.beginPath(); x.roundRect(22, 22, 84, 84, 6); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace;
  return t;
}

export class DeskNotes {
  private readonly notes: Note[] = [];
  private readonly ray = new THREE.Raycaster();
  private readonly v = new THREE.Vector3();

  /** Call before the desk's shaders compile (the bend is part of the notes' own). `shadows`: the desk's bake leaves the
   *  notes' shadows out (bake_notes_free.py), so they cast live ones. */
  constructor(group: THREE.Object3D, specs: NoteSpec[], o: { shadows?: boolean; pinnedBy?: string } = {}) {
    group.updateMatrixWorld(true);
    // (the loader sanitizes names: Blender's "Cylinder.001" arrives as "Cylinder001")
    const pin = o.pinnedBy ? ((group.getObjectByName(o.pinnedBy) ?? group.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(o.pinnedBy))) as THREE.Mesh | undefined) : undefined;
    const tex = o.shadows ? shadowTexture() : null;
    // (the desk's model is compressed: each part keeps its own scale and offset, so everything here is worked out in the
    // desk's space, metres, then carried into each note's own for its shader)
    const toDesk = (o: THREE.Object3D) => new THREE.Matrix4().copy(group.matrixWorld).invert().multiply(o.matrixWorld);
    const penPts: THREE.Vector3[] = [];
    if (pin?.isMesh) {
      const m = toDesk(pin), pos = pin.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) penPts.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m));
    }
    for (const spec of specs) {
      const mesh = (group.getObjectByName(`bake_${spec.name}`) ?? group.getObjectByName(spec.name)) as THREE.Mesh | undefined;
      if (!mesh?.isMesh) continue;
      const centreGeo = DeskNotes.topCentre(mesh.geometry);
      const M = toDesk(mesh), Minv = M.clone().invert(), k = M.getMaxScaleOnAxis();   // (desk metres per geometry unit)
      const centre = centreGeo.clone().applyMatrix4(M);
      const c = Math.cos(spec.rotZ), sn = Math.sin(spec.rotZ), [w, h] = spec.size;
      const right = new THREE.Vector3(c, 0, -sn), up = new THREE.Vector3(-sn, 0, -c);
      // where it's held: a sticky by its glue along the top; a sheet under the pen along the pen
      let hinge = centre.clone().addScaledVector(up, h / 2 - LIFT.glued * h), axis = up.clone().negate(), span = (1 - LIFT.glued) * h;
      if (penPts.length && spec.name.startsWith("card")) {
        // the free side: away from the pen, the written half. The bend starts past the farthest point of the
        // pen itself over this sheet (its real footprint: it lies at an angle), plus a margin, so nothing within reach
        // of it moves and the strip the bake never lit beneath it stays hidden
        const line = DeskNotes.penLine(penPts);
        const corners = [-1, 1].flatMap((a) => [-1, 1].map((b) => centre.clone().addScaledVector(right, (a * w) / 2).addScaledVector(up, (b * h) / 2)));
        const perp = new THREE.Vector3(-line.dir.z, 0, line.dir.x);
        // (the free side is the one the handwriting faces up toward: the pen runs near this card's middle, so neither
        // its corners nor its area say which half is loose; the written half is)
        axis = perp.multiplyScalar(Math.sign(perp.dot(up)) || 1);
        const reach = Math.hypot(w, h) / 2 + PINNED, v = new THREE.Vector3();
        let edge = -Infinity;
        for (const q of penPts) { v.subVectors(q, centre); v.y = 0; if (v.length() <= reach) edge = Math.max(edge, v.dot(axis)); }
        const farCorner = Math.max(...corners.map((q) => q.clone().sub(centre).dot(axis)));
        const start = (Number.isFinite(edge) ? edge : 0) + PINNED;
        hinge = centre.clone().addScaledVector(axis, start);
        span = Math.max(farCorner - start, 0.01);
      }
      // (a short free side curls less: never steeper than paper would)
      const peak = Math.min((spec.name.startsWith("card") ? 0.7 : 1) * LIFT.share * h, 0.3 * span);
      // into the note's own space for its shader
      const bend: Bend = {
        uBend: { value: 0 },
        uHinge: { value: hinge.clone().applyMatrix4(Minv) },
        uAxis: { value: axis.clone().transformDirection(Minv) },
        uSpan: { value: span / k },
      };
      installBend(mesh.material as THREE.Material, bend);
      let shadow: THREE.Mesh | null = null;
      if (tex) {
        shadow = new THREE.Mesh(new THREE.PlaneGeometry(w * SHADOW.grow, h * SHADOW.grow), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: SHADOW.alpha, depthWrite: false, toneMapped: false, alphaMap: tex }));
        shadow.rotation.set(-Math.PI / 2, 0, spec.rotZ);   // (flat on the desk, turned as the note is)
        shadow.position.copy(centre).add(SHADOW.offset); shadow.position.y = centre.y - 0.0004;
        shadow.renderOrder = -1;
        group.add(shadow);
      }
      this.notes.push({ ...spec, mesh, centre: centreGeo, lift: 0, bend, peak: peak / k, shadow, shadowA: 1 });
    }
  }

  /** The pen's axis on the desk: its middle and its direction (the long axis of its points, seen from above). */
  private static penLine(pts: THREE.Vector3[]): { at: THREE.Vector3; dir: THREE.Vector3 } {
    const at = new THREE.Vector3();
    for (const q of pts) at.add(q);
    at.divideScalar(pts.length);
    let xx = 0, zz = 0, xz = 0;
    for (const q of pts) { const dx = q.x - at.x, dz = q.z - at.z; xx += dx * dx; zz += dz * dz; xz += dx * dz; }
    const a = 0.5 * Math.atan2(2 * xz, xx - zz);
    return { at, dir: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)) };
  }

  /** The middle of the sheet's upper face (its edges left out), in the mesh's own space. */
  private static topCentre(g: THREE.BufferGeometry): THREE.Vector3 {
    const pos = g.getAttribute("position"), nrm = g.getAttribute("normal"), c = new THREE.Vector3();
    let n = 0;
    for (let i = 0; i < pos.count; i++) { if (nrm && nrm.getY(i) < 0.5) continue; c.x += pos.getX(i); c.y += pos.getY(i); c.z += pos.getZ(i); n++; }
    return n ? c.divideScalar(n) : (g.computeBoundingBox(), g.boundingBox!.getCenter(c));
  }

  get names(): string[] { return this.notes.map((n) => n.name); }

  /** The note under a point of the screen (NDC), or null. */
  pick(ndc: THREE.Vector2, camera: THREE.Camera): string | null {
    if (!this.notes.length) return null;
    this.ray.setFromCamera(ndc, camera);
    const hit = this.ray.intersectObjects(this.notes.filter((n) => n.mesh.visible).map((n) => n.mesh), false)[0];
    return hit ? (this.notes.find((n) => n.mesh === hit.object)?.name ?? null) : null;
  }

  /** The hovered one bends, the others settle; a note away from the desk takes its shadow with it (frame-rate
   *  independent). */
  update(hovered: string | null, dt: number): void {
    for (const n of this.notes) {
      const want = n.name === hovered ? 1 : 0;
      n.lift += (want - n.lift) * (1 - Math.exp(-LIFT.rate * dt));
      n.bend.uBend.value = n.lift * n.peak;
      if (n.shadow) {
        n.shadowA += ((n.mesh.visible ? 1 : 0) - n.shadowA) * (1 - Math.exp(-(n.mesh.visible ? 6 : 14) * dt));
        (n.shadow.material as THREE.MeshBasicMaterial).opacity = SHADOW.alpha * n.shadowA * (1 - 0.25 * n.lift);
      }
    }
  }

  /** The note's frame in the world, as it is now (lifted, if hovered). */
  pose(name: string): NotePose | null {
    const n = this.notes.find((x) => x.name === name);
    if (!n) return null;
    n.mesh.updateMatrixWorld(true);
    const m = n.mesh.matrixWorld, k = m.getMaxScaleOnAxis(), c = Math.cos(n.rotZ), sn = Math.sin(n.rotZ);
    const right = new THREE.Vector3(c, 0, -sn).transformDirection(m), up = new THREE.Vector3(-sn, 0, -c).transformDirection(m);
    const normal = new THREE.Vector3().crossVectors(right, up).normalize();
    return { centre: n.centre.clone().applyMatrix4(m), right, up, normal, w: n.size[0] * k, h: n.size[1] * k };
  }

  /** How far the note is along the camera's view (the lens's focus distance). */
  depth(name: string, camera: THREE.Camera): number | null {
    const p = this.pose(name);
    if (!p) return null;
    const fwd = this.v.set(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
    return p.centre.clone().sub(camera.getWorldPosition(new THREE.Vector3())).dot(fwd);
  }

  setVisible(name: string, on: boolean): void {
    const n = this.notes.find((x) => x.name === name);
    if (n) n.mesh.visible = on;
  }
}

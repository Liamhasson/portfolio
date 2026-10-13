import * as THREE from "three";

/**
 * The notes on the desk as things to touch (Liam, 2026-10-13/14): the one under the cursor lifts a little, as paper
 * would, and the lens racks focus onto it; a click hands it to the story. Each note's mesh is baked in the desk's own
 * space (no node transform), so its frame comes from its geometry: the corners of its texture (glTF's uv, origin top
 * left) give the paper's right, its up, its size and its centre.
 */
export interface NotePose {
  /** world: centre, the paper's right and up (unit), its normal (toward the camera), width and height */
  centre: THREE.Vector3; right: THREE.Vector3; up: THREE.Vector3; normal: THREE.Vector3; w: number; h: number;
}

/** How each note lies (blender/lookdev/lookdev.py build_desk: sheet(name, size, loc, rot_z)): its size in metres and
 *  its turn about the vertical. The bakes' uv can't tell which way the handwriting faces (the card's runs a quarter
 *  turn round, the stickies' mirrored), so the paper's frame comes from here. */
export interface NoteSpec { name: string; size: [number, number]; rotZ: number }

interface Note extends NoteSpec { mesh: THREE.Mesh; base: THREE.Vector3; centre: THREE.Vector3; lift: number }

/** How far a hovered note lifts, as a share of its height, and how quickly it comes and goes. */
const LIFT = { share: 0.06, rate: 9 };
const UP = new THREE.Vector3(0, 1, 0);

export class DeskNotes {
  private readonly notes: Note[] = [];
  private readonly ray = new THREE.Raycaster();
  private readonly v = new THREE.Vector3();

  constructor(group: THREE.Object3D, specs: NoteSpec[]) {
    group.updateMatrixWorld(true);
    for (const spec of specs) {
      const mesh = (group.getObjectByName(`bake_${spec.name}`) ?? group.getObjectByName(spec.name)) as THREE.Mesh | undefined;
      if (!mesh?.isMesh) continue;
      this.notes.push({ ...spec, mesh, base: mesh.position.clone(), centre: DeskNotes.topCentre(mesh.geometry), lift: 0 });
    }
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

  /** The hovered one lifts, the others settle (frame-rate independent). */
  update(hovered: string | null, dt: number): void {
    for (const n of this.notes) {
      const want = n.name === hovered ? 1 : 0;
      n.lift += (want - n.lift) * (1 - Math.exp(-LIFT.rate * dt));
      n.mesh.position.copy(n.base).addScaledVector(UP, n.lift * LIFT.share * n.size[1]);
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

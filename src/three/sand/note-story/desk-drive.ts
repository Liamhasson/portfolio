import * as THREE from "three";

/**
 * The playground drive on the desk (Liam, 2026-10-14/15, approved from renders; blender/lookdev/drive.py): its parts
 * (bake_drive_*, the tape bake_card_tape) are one thing to touch. Under the cursor the lens racks onto it and its light
 * wakes (a small warm dot over the baked one, never a glow); a click mounts it: the light holds, the laptop's screen
 * opens the drive (the screen's alternate image, baked-desk.ts setScreenAlt) and the story glides on into it.
 */
export class DeskDrive {
  readonly parts: THREE.Mesh[] = [];
  private readonly ray = new THREE.Raycaster();
  private readonly centre = new THREE.Vector3();
  private readonly dot: THREE.Mesh | null = null;
  private light = 0;

  constructor(group: THREE.Object3D) {
    group.updateMatrixWorld(true);
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (/^bake_drive_/.test(m.name) || m.name === "bake_card_tape")) this.parts.push(m);
    });
    const box = new THREE.Box3();
    for (const p of this.parts) box.expandByObject(p);
    box.getCenter(this.centre);
    // the light: a dot laid just over the baked one, lit as the drive wakes
    const led = this.parts.find((p) => p.name === "bake_drive_led");
    if (led) {
      const b = new THREE.Box3().setFromObject(led), c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3());
      const r = Math.max(size.x, size.z) * 0.5;
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(r * 0.92, 24),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.86, 0.7), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
      );
      dot.rotation.x = -Math.PI / 2;
      // (into the group's frame: the group carries the desk's scale)
      group.worldToLocal(c.set(c.x, b.max.y + size.y * 0.02, c.z));
      dot.position.copy(c);
      dot.scale.setScalar(1 / group.getWorldScale(new THREE.Vector3()).x);
      dot.renderOrder = 2;
      group.add(dot);
      this.dot = dot;
    }
  }

  get ready(): boolean { return this.parts.length > 0; }

  /** Is the drive under this point of the screen (NDC), in front of anything else in `blockers`? */
  hit(ndc: THREE.Vector2, camera: THREE.Camera): number | null {
    if (!this.parts.length) return null;
    this.ray.setFromCamera(ndc, camera);
    const h = this.ray.intersectObjects(this.parts, false)[0];
    return h ? h.distance : null;
  }

  /** How far the drive is along the camera's view (the lens's focus distance). */
  depth(camera: THREE.Camera): number {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
    return this.centre.clone().sub(camera.getWorldPosition(new THREE.Vector3())).dot(fwd);
  }

  /** Its light: 0 asleep, 1 awake (frame-rate independent toward `want`). */
  update(want: number, dt: number): void {
    this.light += (want - this.light) * (1 - Math.exp(-(want > this.light ? 10 : 4) * dt));
    if (this.dot) (this.dot.material as THREE.MeshBasicMaterial).opacity = Math.min(this.light, 1);
  }
}

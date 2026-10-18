import * as THREE from "three";
import { BEATS } from "@/three/sand/story-timeline";

/**
 * The laptop on the desk goes to the work (Liam, 2026-10-18: "as if the viewer is clicking on 'projects' in the nav
 * bar"). While the desk is in view the pointer turns into a hand over it, and a click runs what the nav's Projects runs.
 *
 * On the story the nav's Projects is a plain anchor to #projects (pill-nav.tsx: "Lenis owns the smooth scroll"). There is
 * no one function behind it: its click is caught by Lenis (`anchors`: a 1.5 s glide to the anchor, smooth-scroll.tsx), by
 * the story's own listener (the jump isn't held by the desk's wait: sand-lab.tsx `jumpingSince`) and by the browser
 * (the hash). So the laptop clicks that same anchor, and all three run exactly as they do for the nav; the snap into the
 * screen then follows from the story's scroll, as it does after the nav.
 *
 * A pointer convenience only: the nav stays the keyboard's way there, so the laptop takes no focus.
 */

/** Where the desk is in view (screens of story): the notes' window too. It ends before the snap into the screen. */
export const DESK_IN_VIEW = [BEATS.tilt[0] + 0.3, BEATS.tail[0] + 0.5] as const;

/** The laptop's parts in the desk's glTF (blender/lookdev): its base, keys and trackpad, and all that hangs on the lid's
 *  hinge (the lid, the bezel, the screen, the mark). */
const BASE = /^bake_(base|keys|trackpad)$/;
/** Never in front of the laptop from any of the story's views (it stands on them): left out of the occlusion test. */
const UNDER = /^bake_desk(_top)?$/;

/** The laptop under the pointer: its parts, and the desk's other things that can stand in front of it. */
export class DeskLaptop {
  readonly parts: THREE.Mesh[] = [];
  readonly blockers: THREE.Mesh[] = [];
  private readonly ray = new THREE.Raycaster();
  private readonly hits: THREE.Intersection[] = [];

  constructor(group: THREE.Object3D, pivot = "lid_pivot") {
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !/^bake_/.test(m.name)) return;
      let onLid = false;
      for (let p: THREE.Object3D | null = m.parent; p; p = p.parent) if (p.name === pivot) onLid = true;
      if (onLid || BASE.test(m.name)) this.parts.push(m);
      else if (!UNDER.test(m.name)) this.blockers.push(m);
    });
  }

  get ready(): boolean { return this.parts.length > 0; }

  /** Is the laptop under this point of the screen (NDC), with nothing of the desk's in front of it (a note's card, the
   *  drive, the mug)? */
  hit(ndc: THREE.Vector2, camera: THREE.Camera): boolean {
    if (!this.parts.length) return false;
    this.ray.setFromCamera(ndc, camera);
    this.hits.length = 0;
    const first = this.ray.intersectObjects(this.parts, false, this.hits)[0];
    if (!first) return false;
    // (only then the rest, and only up to the laptop: in front of it or not)
    const at = first.distance;
    this.ray.far = at;
    this.hits.length = 0;
    for (const b of this.blockers) {
      if (b.visible) this.ray.intersectObject(b, false, this.hits);
      if (this.hits.length) break;
    }
    this.ray.far = Infinity;
    return this.hits.length === 0;
  }
}

/** What the scene knows this frame, for the laptop. */
export interface LaptopGate {
  /** the story (the home page), not the lab */
  hero: boolean;
  /** the desk is in and the laptop found in it */
  ready: boolean;
  /** the story's progress (screens) */
  p: number;
  /** the loader running (or the brief still growing before it) */
  loader: boolean;
  /** the brief showing: its return over the formed ball, or the wait for the desk */
  brief: boolean;
  /** a note's story is up */
  storyOpen: boolean;
  /** the drive was clicked: its glide into the laptop is under way */
  driveMounted: boolean;
  /** the snap into the screen is carrying the page */
  snapping: boolean;
  /** the nav's (or the laptop's) own glide to the projects is under way */
  gliding: boolean;
  /** the black of a fade (an arrival, the reduced-motion crossfade) is over the scene */
  veiled: boolean;
}

/** The laptop answers the pointer: the desk in view, nothing else going on. */
export function laptopLive(g: LaptopGate): boolean {
  return g.hero && g.ready && g.p >= DESK_IN_VIEW[0] && g.p <= DESK_IN_VIEW[1]
    && !g.loader && !g.brief && !g.storyOpen && !g.driveMounted && !g.snapping && !g.gliding && !g.veiled;
}

/** The nav's Projects on the story (pill-nav.tsx; the phones' menu has the same href while it's open). */
export const PROJECTS_LINK = 'nav a[href$="#projects"]';

/** Runs what the nav's Projects runs: a click on that very anchor. Without the nav (a page without it), a link of its own
 *  to the same anchor, clicked the same way. */
export function goToWork(doc: Document = document): void {
  const nav = doc.querySelector<HTMLAnchorElement>(PROJECTS_LINK);
  if (nav) { nav.click(); return; }
  const a = doc.createElement("a");
  a.href = "#projects";
  a.hidden = true;
  doc.body.appendChild(a);
  a.click();
  a.remove();
}

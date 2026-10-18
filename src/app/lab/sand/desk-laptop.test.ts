import { afterEach, describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { DESK_IN_VIEW, DeskLaptop, PROJECTS_LINK, goToWork, laptopLive, type LaptopGate } from "./desk-laptop";
import { BEATS, SNAP_FROM } from "@/three/sand/story-timeline";
import { briefReturn } from "./brief-geometry";

/** A box mesh named `name`, `size` (x, y, z) at `at`. */
function box(name: string, size: [number, number, number], at: [number, number, number]): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
  m.name = name;
  m.position.set(...at);
  return m;
}

/** A small desk: the top, the laptop (base, keys, the lid on its hinge), and a drive standing in front of the base. */
function desk() {
  const g = new THREE.Group();
  g.add(box("bake_desk_top", [4, 0.1, 4], [0, -0.05, 0]));
  g.add(box("bake_base", [1, 0.05, 0.7], [0, 0.025, 0]));
  g.add(box("bake_keys", [0.8, 0.01, 0.3], [0, 0.055, -0.1]));
  const pivot = new THREE.Group();
  pivot.name = "lid_pivot";
  pivot.position.set(0, 0.05, -0.35);
  pivot.add(box("bake_lid", [1, 0.7, 0.02], [0, 0.35, 0]));
  pivot.add(box("bake_display", [0.9, 0.6, 0.005], [0, 0.35, 0.012]));
  g.add(pivot);
  g.add(box("bake_drive_body", [0.1, 0.3, 0.1], [0.3, 0.15, 0.2]));
  g.add(box("bake_card_a", [0.2, 0.002, 0.3], [-1.2, 0.001, 0.5]));
  g.updateMatrixWorld(true);
  // looking down at the desk from the front, above it
  const cam = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
  cam.position.set(0, 1.6, 1.6);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  return { g, cam };
}

/** The NDC where a world point shows. */
function ndcOf(p: [number, number, number], cam: THREE.Camera): THREE.Vector2 {
  const v = new THREE.Vector3(...p).project(cam);
  return new THREE.Vector2(v.x, v.y);
}

describe("the laptop's parts", () => {
  test("its base, keys, trackpad and all that hangs on the lid's hinge; the desk's other things only block it", () => {
    const { g } = desk();
    const l = new DeskLaptop(g);
    expect(l.ready).toBe(true);
    expect(l.parts.map((m) => m.name).sort()).toEqual(["bake_base", "bake_display", "bake_keys", "bake_lid"]);
    expect(l.blockers.map((m) => m.name).sort()).toEqual(["bake_card_a", "bake_drive_body"]);   // (never the desk it stands on)
  });

  test("in the real desk (desk.glb): exactly the laptop", () => {
    // the glb's node tree, as names (its meshes don't matter here)
    const glb = readFileSync("public/lab/desk3d/desk.glb");
    const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString()) as { nodes: { name: string; mesh?: number; children?: number[] }[] };
    const objs = json.nodes.map((n) => {
      const o = n.mesh !== undefined ? new THREE.Mesh() : new THREE.Object3D();
      o.name = n.name;
      return o;
    });
    const root = new THREE.Group();
    const child = new Set(json.nodes.flatMap((n) => n.children ?? []));
    json.nodes.forEach((n, i) => { for (const c of n.children ?? []) objs[i].add(objs[c]); if (!child.has(i)) root.add(objs[i]); });
    const l = new DeskLaptop(root);
    expect(l.parts.map((m) => m.name).sort()).toEqual(["bake_base", "bake_bezel", "bake_display", "bake_keys", "bake_lid", "bake_mark", "bake_trackpad"]);
    expect(l.blockers.some((m) => /^bake_(drive_|card_|sticky_|pick_|Cylinder)/.test(m.name))).toBe(true);
    expect(l.blockers.some((m) => /^bake_desk/.test(m.name))).toBe(false);
  });
});

describe("the laptop under the pointer", () => {
  test("its screen, its lid and its keys are hits", () => {
    const { g, cam } = desk();
    const l = new DeskLaptop(g);
    expect(l.hit(ndcOf([0, 0.45, -0.33], cam), cam)).toBe(true);    // the screen
    expect(l.hit(ndcOf([0.4, 0.7, -0.35], cam), cam)).toBe(true);   // the lid near its corner
    expect(l.hit(ndcOf([-0.2, 0.06, -0.1], cam), cam)).toBe(true);  // the keys
  });

  test("the bare desk, a card off to the side and the drive in front of it aren't", () => {
    const { g, cam } = desk();
    const l = new DeskLaptop(g);
    expect(l.hit(ndcOf([1.5, 0, 1], cam), cam)).toBe(false);          // bare desk
    expect(l.hit(ndcOf([-1.2, 0.002, 0.5], cam), cam)).toBe(false);   // the card
    const drive = ndcOf([0.3, 0.3, 0.2], cam);                         // the drive's top, the base behind it
    expect(l.hit(drive, cam)).toBe(false);
    // hidden (a note lifted into its story), it no longer stands in the way
    g.getObjectByName("bake_drive_body")!.visible = false;
    expect(l.hit(drive, cam)).toBe(true);
  });

  test("the lid follows its hinge: shut, the screen's spot is no longer the laptop", () => {
    const { g, cam } = desk();
    const l = new DeskLaptop(g);
    const screenTop = ndcOf([0, 0.68, -0.34], cam);
    expect(l.hit(screenTop, cam)).toBe(true);
    const pivot = g.getObjectByName("lid_pivot")!;
    pivot.rotation.x = Math.PI / 2;   // shut over the base
    g.updateMatrixWorld(true);
    expect(l.hit(screenTop, cam)).toBe(false);
  });

  test("no laptop in the desk: never a hit", () => {
    const g = new THREE.Group();
    g.add(box("bake_desk_top", [4, 0.1, 4], [0, -0.05, 0]));
    g.updateMatrixWorld(true);
    const l = new DeskLaptop(g);
    expect(l.ready).toBe(false);
    expect(l.hit(new THREE.Vector2(0, 0), new THREE.PerspectiveCamera())).toBe(false);
  });
});

describe("when the laptop answers", () => {
  const mid = (DESK_IN_VIEW[0] + DESK_IN_VIEW[1]) / 2;
  const base: LaptopGate = {
    hero: true, ready: true, p: mid, loader: false, brief: false, storyOpen: false,
    driveMounted: false, snapping: false, gliding: false, veiled: false,
  };

  test("on the desk with nothing else going on", () => {
    expect(laptopLive(base)).toBe(true);
  });

  test.each([
    ["the lab, not the story", { hero: false }],
    ["the desk not in yet", { ready: false }],
    ["the loader", { loader: true }],
    ["the brief", { brief: true }],
    ["a note's story", { storyOpen: true }],
    ["the drive's glide", { driveMounted: true }],
    ["the snap into the screen", { snapping: true }],
    ["the nav's (or its own) glide", { gliding: true }],
    ["a fade's black", { veiled: true }],
  ] as [string, Partial<LaptopGate>][])("never during %s", (_, o) => {
    expect(laptopLive({ ...base, ...o })).toBe(false);
  });

  test("only while the desk is in view: the notes' window, after the brief has gone, ending before the snap", () => {
    expect(laptopLive({ ...base, p: DESK_IN_VIEW[0] })).toBe(true);
    expect(laptopLive({ ...base, p: DESK_IN_VIEW[1] })).toBe(true);
    expect(laptopLive({ ...base, p: DESK_IN_VIEW[0] - 0.01 })).toBe(false);
    expect(laptopLive({ ...base, p: DESK_IN_VIEW[1] + 0.01 })).toBe(false);
    expect(laptopLive({ ...base, p: BEATS.hero[1] })).toBe(false);
    expect(DESK_IN_VIEW[1]).toBeLessThan(SNAP_FROM);
    expect(briefReturn(1, DESK_IN_VIEW[0])).toBe(0);   // (the brief over the formed ball is gone by then)
  });
});

describe("going to the work", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  test("clicks the nav's own Projects: what it runs, the laptop runs", () => {
    document.body.innerHTML = `<nav aria-label="Primary"><a class="sh-pill" href="#projects">Projects</a><a href="/about">About</a></nav>`;
    const link = document.querySelector<HTMLAnchorElement>(PROJECTS_LINK)!;
    const got: EventTarget[] = [];
    window.addEventListener("click", (e) => { got.push(e.target!); e.preventDefault(); }, { once: true });
    goToWork();
    expect(got).toEqual([link]);   // (it reaches the window from that anchor: Lenis's and the story's listeners see it)
  });

  test("without the nav: a link of its own to the same anchor, clicked the same way and gone after", () => {
    const got: string[] = [];
    window.addEventListener("click", (e) => { got.push((e.target as HTMLAnchorElement).getAttribute("href")!); e.preventDefault(); }, { once: true });
    goToWork();
    expect(got).toEqual(["#projects"]);
    expect(document.querySelectorAll("a").length).toBe(0);
  });
});

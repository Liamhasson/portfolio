# About Pendant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Liam's brass Brahma pendant, filmed by a live 3D camera through the whole About track, never still, always readable, yours to grab.

**Architecture:** A pure core (shot data and blending, motion physics, camera and projection maths, readability layout) drives a three.js scene drawn on one transparent canvas inside About's pinned frame. The canvas sits in front of the track or behind it. The layer and the free spots are solved per screen from the measured text boxes, before any frame is drawn. The model comes from the Blender sources in `blender/amulet/`, published to `public/about/pendant/` by one script.

**Tech Stack:** Next.js 16.3.8, React 19.2.8, three 0.186.1 (GLTFLoader + MeshoptDecoder, KTX2Loader, EffectComposer, BokehPass), Vitest + Testing Library (jsdom), Playwright (e2e on a production build, port 3100), Blender 5.1 (Cycles), gltfpack (npx), KTX-Software `ktx`.

**Spec:** `docs/superpowers/specs/2026-10-16-about-pendant-design.md` (approved by Liam 2026-10-16). Storyboard: `docs/storyboard/about-pendant-storyboard-v1.jpg`, opening `docs/storyboard/about-pendant-opening-v2.jpg`. Working prototype with every value in it: `.superpowers/brainstorm/78029-1792148196/content/pendant-film-v3.html` (in the main checkout; read it, never import it).

## Global Constraints

**Read first:**
- `node_modules/next/dist/docs/` before writing any Next code (AGENTS.md: this Next has breaking changes).
- The [[quality-no-shortcuts-3d-motion]] bar: the highest-quality option at every choice.

**Versions:** three `0.186.1`, `@types/three` `0.186.0`, next `16.3.8`. No new runtime dependencies.

**Rendering:**
- No glow, bloom, halo or light auras anywhere.
- AgX tone mapping. Lights ride with the camera:
  - key `0xffd9b0` 3.2 at (−1.2, 1.4, 1.0)
  - rim `0xff9f86` 2.6 at (1.4, 0.6, −1.6)
  - fill `0x9fb2ff` 0.35 at (0.4, −1, 0.8)
  - room-environment probe at intensity 0.55

**Text:** stays real HTML. No italic. Geist and Geist Mono only.

**Budgets:**
- Pendant assets in `public/about/pendant/`: ≤ 2.5 MB total.
- Pixel ratio ≤ 2.
- GPU frame < 6 ms on Liam's M1 Pro at 1440×900.

**Motion constants** (spec §4, from the prototype):
- Scroll follow `1 − 0.0008^dt`.
- Scroll-to-spin coupling `0.0016` rad per px/s.
- Lean `clamp(vel × 0.00025, ±0.35)`, eased `1 − 0.02^dt`.
- Lock spring `1 − 0.02^dt`. Tumble upright spring `1 − 0.03^dt` (when tumble < 0.02).
- Hand decay `0.05^dt`.
- Cursor look 0.035 rad, eased 0.1 a frame.

**Layering:** track `z-index: 1`. Pendant back `0` and front `2`. Resume pill and progress bar `3`. The testimonials lens (`3`) and light canvas (`4`) sit above the pendant.

**`about-track.tsx`:** only `data-pendant` attributes and the `<AboutPendant />` mount are added. The About pictures/testimonials work changes the same file in another session, so keep the diff tiny.

**Fallbacks:**
- Reduced motion: still pose per part, no spin, drift or flights, 0.6 s crossfades.
- No WebGL, a failed load or a lost context: About exactly as today, no console errors.

**Commits:** `type(scope): what changed, in Liam's terms (Liam, 2026-10-16)`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit only this plan's files.

## Review Focus

1. **Resize or rotate mid-scroll** (track ↔ stack): the pendant re-solves its layout and follows the new mode, with no stale position and no crash. Pinned in Task 8.
2. **A jump instead of a scroll** (End key, find-in-page focus jump, scrollbar drag): the smoothed follow catches up, and the pendant is never in front of a line while it settles. Pinned in Task 8.
3. **The GLB or a texture fails or is slow:** About renders as today, no `pageerror`, no canvas. Pinned in Task 7.
4. **WebGL context lost** (GPU reset, iOS background): no exception; the canvas hides, then returns on restore. Pinned in Task 7.
5. **A press over a link** (the verbs' proof links ↗):
   - On the pendant: it drags, and the link doesn't navigate.
   - Anywhere else: the link works.

   Pinned in Task 8.

---

### Task 1: The model, published for the web

**Files:**
- Create (moved from `.claude/worktrees/note-stories/blender/amulet/`, untracked there):
  - `blender/amulet/amulet.py`
  - `blender/amulet/head.py`
  - `blender/amulet/mpfb/` (README.txt, 3dobjs/base.obj, targets/…)
  - the 5 reference photos `blender/amulet/*-image.jpg`
- Modify: `blender/amulet/amulet.py` (web export path, head texel density, hood edge)
- Create: `scripts/about/pendant-publish.sh`
- Create: `public/about/pendant/{pendant.glb, pendant-wire.glb, color.ktx2, normal.jpg, rough.jpg}`
- Modify: `.gitignore` (`blender/amulet/out/`, `blender/amulet/renders/`)

**Interfaces:**
- Produces:
  - `public/about/pendant/pendant.glb`: one mesh, no materials, positions + normals + UV0, Y-up, 1 unit tall, feet at y 0, axis through x = z = 0.
  - `pendant-wire.glb`: about 5k triangles, same frame.
  - `color.ktx2`: sRGB ETC1S with mips.
  - `normal.jpg`: tangent space, OpenGL convention as Blender bakes it.
  - `rough.jpg`: roughness in G (glTF convention).
  - Task 6 loads exactly these names, cache-busted by `PENDANT_VERSION`.

- [ ] **Step 1: Move the sources.** Copy `amulet.py`, `head.py`, `mpfb/` and the 5 photos from the note-stories worktree into `blender/amulet/`, and add the two ignore lines. Run `Blender --background --python blender/amulet/head.py`.
  - Expected: `HEAD … chin 5.232 eyes 6.345` printed, and `blender/amulet/head.npz` written (`head.npz` is generated: ignore it too).
- [ ] **Step 2: Head texel density.** In `amulet.py` after `smart_project`, scale each head's UV islands ×2 about their own centres, then `bpy.ops.uv.pack_islands(margin=0.004)`. The heads get four times the area, which gives effectively 4K detail on the faces in a 2048 map (spec §7 "4K detail map", within the 2.5 MB budget).
  - Mark head faces by a face map set where the four `head_k` meshes are created, before the join.
- [ ] **Step 3: Hood edge.** In `crown_profile`, raise the `hood` blur passes from 10 to 16, and replace the step `z0 = z_band − 70 × smooth(0.56, 0.8, s)` with the same drop over `smooth(0.5, 0.86, s)`.
  - Verify: run `amulet.py --preview`, then render `amulet_face.png`. Expected: no sawtooth along the hood's lower edge beside each face.
- [ ] **Step 4: Web export.** Add `--web DIR` to `amulet.py`:
  - Decimate every face except the heads (ratio 0.35).
  - Export `pendant.glb` with `export_materials="NONE"`, normals and UV0 kept.
  - Save the three baked maps at 2048 as `color.png`, `normal.png` and `rough.png` (roughness copied into G).
  - Decimate a copy to ratio 0.012 and export it as `pendant-wire.glb` with normals and UVs off.
- [ ] **Step 5: `scripts/about/pendant-publish.sh`.** It runs, in order:
  1. Blender `--web` into a temp dir.
  2. `npx gltfpack -i pendant.glb -o public/about/pendant/pendant.glb -cc -kv` (no `-si`: the simplification already happened in Blender; `-kv` keeps UVs on an unmaterialed mesh, like `desk3d-publish.py`).
  3. `ktx create --format R8G8B8_SRGB --assign-tf srgb --encode basis-lz --clevel 2 --qlevel 255 --generate-mipmap color.png color.ktx2`.
  4. ffmpeg to `normal.jpg` (q 2) and `rough.jpg` (q 3).
  5. Print the total size.
- [ ] **Step 6: Run it and check the budget.** `bash scripts/about/pendant-publish.sh`.
  - Expected: five files, total ≤ 2.5 MB. If over, lower the non-head decimation ratio first (never the heads).
- [ ] **Step 7: Commit** the sources, script, `.gitignore` and the published files: `feat(about): the pendant's sources and its web build (…)`.

### Task 2: Shots: the data and the blend

**Files:**
- Create: `src/three/pendant/shots.ts`
- Test: `src/three/pendant/shots.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Layer = "front" | "back";
  export type Aim = readonly [number, number, number];          // pendant units: height 1, origin at mid-height
  export type ScreenX = number | "line1" | "glass";
  export type ScreenY = number | "glass";
  export type Anchor = "start" | "end" | { pendant: string; fallback?: string | [string, string] };
  export interface Shot { id: string; anchor: Anchor; fx: number; az: number; el: number; roll: number; fov: number; h: number;
    ax: ScreenX; ay: ScreenY; aim: Aim; spin: number; tumble: number; rz: number; lock: number | null; layer: Layer;
    dim: number; aperture: number; glass: number; wire: number }
  export interface Frame extends Omit<Shot, "id" | "anchor" | "fx" | "ax" | "ay"> { index: number; t: number; ax: number; ay: number }
  export const SHOTS: readonly Shot[];                           // desktop track
  export function solveKeys(shots: readonly Shot[], centreX: (a: Anchor) => number | null, vw: number, travel: number): number[];
  export function shotAt(s: number, keys: readonly number[], shots: readonly Shot[], at: { line1: number; glass: { x: number; y: number } }): Frame;
  ```
  - `centreX` returns an anchor's centre in track px, or null when missing.
  - `glass.x` is the glass slot's screen x at this `s`, as a share of the width.

- [ ] **Step 1: Write the failing tests** in `shots.test.ts`:
  - `SHOTS has the spec's ten shots plus the glide's and the build passes' end keys, in order`: ids `opening, letgo, tumble, worm, above, glass, glide, glideEnd, whirl, build, buildEnd, hero`.
  - `solveKeys puts "start" at 0 and "end" at travel, and keys are strictly increasing`: anchors at 900, 1600 and so on, `vw = 1440`, `travel = 9000`. Expect `keys[0] === 0`, `keys.at(-1) === 9000`, and every `keys[i] > keys[i-1]`.
  - `solveKeys uses the fallback when an anchor is missing`:
    - `{ pendant: "strip", fallback: "e2e" }` with only `e2e` present → that key equals `e2eCentre − 0.5 × vw`.
    - A pair fallback `["quote1", "quote2"]` → the midpoint of the two centres.
  - `shotAt at a key returns that shot exactly`: `shotAt(keys[3], …)` has `az === 30`, `el === -62`, `h === 1.15`, `layer === "front"`.
  - `shotAt blends size in log space`: halfway between h 0.2 and h 0.25 (smoothstep 0.5) → `h ≈ Math.sqrt(0.2 × 0.25)`.
  - `shotAt resolves "line1" and "glass"`: opening `ax === at.line1`; glass shot `ax === at.glass.x`, `ay === at.glass.y`.
  - `layer and lock switch at the halfway point`.
- [ ] **Step 2: Run** `npx vitest run src/three/pendant/shots.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `shots.ts`.**
  - `SHOTS` carries the spec §3 table exactly, plus the prototype's in-between values:
    - glide end: ax −0.08
    - build end: az 10, wire 1
    - build start: wire 0
    - hero: lock −62, aim [0, 0.02, −0.1]. The aim is relative to mid-height: the prototype's [0, 0.52, −0.1] minus 0.5.
    - every other aim: [0, 0, 0]
    - above: aim [0, 0.28, 0]
  - Defaults as the prototype's `DEF`: spin 0.05, tumble 0, rz 0, lock null, dim 1, aperture 0.001, glass 0, wire 1. Each unspecified field inherits the previous shot's value.
  - Anchors and fallbacks:
    - opening `"start"`, hero `"end"`
    - letgo, tumble: `{pendant:"band"}`
    - worm: `{pendant:"how"}`
    - above: `{pendant:"strip", fallback:"e2e"}`
    - glass: `{pendant:"glass", fallback:["quote1","quote2"]}`
    - glide, glideEnd: `{pendant:"find"}`
    - whirl: `{pendant:"check"}`
    - build, buildEnd: `{pendant:"deskfilm", fallback:"build"}`
  - Blend: smoothstep on `t`. `h` blends in log space. `layer` and `lock` take shot A's value while `t < 0.5`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(about): the pendant's ten shots as data, blended by scroll (…)`.

### Task 3: Motion: never still

**Files:**
- Create: `src/three/pendant/motion.ts`
- Test: `src/three/pendant/motion.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface MotionState { yaw: number; pitch: number; tilt: number; handVel: number; handPitch: number }
  export interface MotionInput { dt: number; spin: number; tumble: number; lock: number | null; scrollVel: number; dragging: boolean; dragDX: number; dragDY: number; reduced: boolean }
  export const REST: MotionState;
  export function stepMotion(s: MotionState, i: MotionInput): MotionState;   // pure
  export function breath(t: number, seed: number): number;                   // layered sines, |value| ≤ 1
  ```

- [ ] **Step 1: Write the failing tests:**
  - `spin turns yaw by spin × 2π × dt`: spin 0.22, dt 1/60, no scroll → `yaw ≈ 0.22 × 2π / 60`.
  - `scroll speed adds spin`: scrollVel 1000 px/s, dt 0.1 → yaw grows by `0.0016 × 1000 × 0.1` more than without it.
  - `lean follows scroll, clamped to 0.35`: scrollVel 1e6 over 2 s of 1/60 steps → `tilt ≈ 0.35`.
  - `lock pulls the nearest equivalent angle`: yaw 6.0, lock −62° → after 3 s, `yaw ≈ −62° + 2π·k` with |error| < 1e-3, and k the nearest turn.
  - `tumble stops upright`: pitch 1.0, tumble 0 → after 3 s, pitch ≈ 0 (nearest 2π multiple).
  - `dragging turns it by the hand, letting go keeps momentum then decays`: dragDX 100 px → yaw += 1.2. After release, handVel decays to under 1% within 2 s.
  - `reduced motion: spin, tumble, lean and scroll coupling do nothing`.
  - `breath stays within ±1 and is not periodic over 60 s` (sampled values differ at t and t + 2π).
- [ ] **Step 2: Run** `npx vitest run src/three/pendant/motion.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** with the Global Constraints constants.
  - `breath(t, a) = 0.6 sin(0.73t + a) + 0.3 sin(1.31t + 2.1a) + 0.1 sin(2.17t + 3.7a)`.
  - A drag adds `dragDX × 0.012` to yaw, sets `handVel = dragDX × 0.6`, and adds `dragDY × 0.004` to handPitch.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(about): the pendant's motion: spin, scroll push, lean, lock, tumble, your hand (…)`.

### Task 4: Camera and projection (pure three maths)

**Files:**
- Create: `src/three/pendant/camera.ts`
- Test: `src/three/pendant/camera.test.ts`

**Interfaces:**
- Consumes: `Frame` (Task 2), `MotionState` + `breath` (Task 3).
- Produces:
  ```ts
  import type { PerspectiveCamera, Object3D, Box3 } from "three";
  export interface Box { l: number; t: number; r: number; b: number }     // screen px
  export interface Look { x: number; y: number }                          // eased cursor lean (rad)
  export function poseRig(f: Frame, m: MotionState, time: number, look: Look, vw: number, vh: number,
    camera: PerspectiveCamera, outer: Object3D, inner: Object3D): void;  // sets camera, lens shift, outer/inner rotations
  export function screenBox(bounds: Box3, inner: Object3D, camera: PerspectiveCamera, vw: number, vh: number): Box;
  export function distanceFor(h: number, fovDeg: number): number;       // 1 / (2 h tan(fov/2))
  ```

- [ ] **Step 1: Write the failing tests** (three's maths runs in jsdom):
  - `distanceFor(0.5, 30) ≈ 1 / (2 × 0.5 × tan(15°))`.
  - `poseRig places the aim point at (ax, ay)`: ax 0.3, ay 0.7, any az/el → projecting the aim's world point gives `x/vw ≈ 0.3`, `y/vh ≈ 0.7` (±1e-4).
  - `poseRig gives the asked size`: h 0.4 → the projected screen height of a unit-tall upright pendant (rz 0, el 0) ≈ 0.4 × vh (±2%).
  - `el 89 looks straight down`: camera forward · (0, −1, 0) > 0.999.
  - `rz 90 lays it over on screen`: the pendant's local up axis projects horizontal (|dy| < 1e-3 × |dx|).
  - `screenBox contains every projected corner`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the prototype's `frame()` maths:
  1. Orient the camera from az/el/roll alone, before positioning it (when |el| > 85°, up = (sin az, 0, cos az)).
  2. `outer.quaternion = camQ · euler(pitch + handPitch + 0.05·breath(t,1), 0, −rz + tilt + 0.04·breath(t,2)) · camQ⁻¹`.
  3. `inner.rotation.y = yaw`.
  4. Camera position = aim world + forward⁻¹ × `distanceFor(h, fov)` (+ Brownian 0.006 × dist).
  5. Cursor look: rotateX(look.x × 0.4), rotateY(look.y × 0.4).
  6. Lens shift: `P[8] = −(2ax − 1)`, `P[9] = −(1 − 2ay)`, then refresh `projectionMatrixInverse`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(about): the pendant's camera: framing, lens shift, the cursor's lean (…)`.

### Task 5: Readability layout

**Files:**
- Create: `src/three/pendant/layout.ts`
- Test: `src/three/pendant/layout.test.ts`

**Interfaces:**
- Consumes: `Box` (Task 4), `Layer` (Task 2).
- Produces:
  ```ts
  export interface TextRect { l: number; t: number; w: number; h: number }   // l in track px, t in viewport px
  export function hits(box: Box, texts: readonly TextRect[], s: number): number;     // text boxes the pendant overlaps at travel s
  export interface Sample { s: number; wanted: Layer; box: Box }
  export function layerTimeline(samples: readonly Sample[], texts: readonly TextRect[]): (s: number) => Layer;
  export function freeSpot(box: Box, texts: readonly TextRect[], s: number, vw: number, maxShift: number): number | null; // ax delta (share of width), nearest first
  ```

- [ ] **Step 1: Write the failing tests:**
  - `hits counts overlaps after shifting texts by s`: a text at l 2000 overlaps a box at screen x 500–600 when s = 1450, and not when s = 0.
  - `layerTimeline forces back where front would cover words`: samples wanting front with a hit at s 100–200 → layer back across 100–200.
  - `layerTimeline only switches where the pendant covers no words`: wanted switches front→back at s 150, but there's a hit at 120–180 → the switch happens at the nearest sample before 120 with no hit.
  - `freeSpot finds the nearest free horizontal position`: a box over a text with free room 0.06 to the right → +0.06 (±0.01). Nothing within maxShift 0.25 → null.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `layerTimeline` walks the samples in order. Front is allowed only on samples with zero hits. A change of layer is placed at the closest preceding sample whose box hits nothing.
  - Lookup by s is a binary search.
  - `freeSpot` searches ±0.01 steps alternately out to maxShift.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(about): the pendant never sits on a line you're reading: layer timeline and free spots (…)`.

### Task 6: The scene

**Files:**
- Create: `src/three/pendant/scene.ts`

**Interfaces:**
- Consumes: Tasks 2–4. Assets from Task 1.
- Produces:
  ```ts
  export const PENDANT_VERSION: string;                                  // cache-busting token, e.g. "2026-10-16"
  export class PendantScene {
    static load(canvas: HTMLCanvasElement): Promise<PendantScene>;      // rejects on any load failure
    readonly camera: PerspectiveCamera; readonly outer: Object3D; readonly inner: Object3D; readonly bounds: Box3;
    resize(vw: number, vh: number, dpr: number): void;
    draw(f: Frame, glass: { x: number; y: number; r: number } | null, dim: number): void;   // r: radius as a share of vh
    hit(x: number, y: number): boolean;                                 // raycast on the full mesh
    dispose(): void;
  }
  ```

- [ ] **Step 1: Build `load`.**
  - Renderer: `alpha: true, antialias: true`, clear alpha 0, AgX, `localClippingEnabled`.
  - Environment: RoomEnvironment through PMREM at intensity 0.55. The three lights as children of the camera.
  - Model: GLTFLoader with MeshoptDecoder. KTX2Loader with transcoder `/lab/basis/`.
  - Material: brass is `MeshStandardMaterial({ map: color, normalMap, roughnessMap, metalness: 1 })`.
  - Keep the GLB's node transforms. Centre it with a holder group: feet at −0.5, axis at x = z = 0. `bounds` comes from the holder.
- [ ] **Step 2: Build passes.**
  - The clay copy: `MeshStandardMaterial({ color: 0xb9ada3, roughness: 0.78, metalness: 0 })`, with two planes.
  - The wire GLB: `MeshBasicMaterial({ color: 0xf1e2d2, wireframe: true, transparent: true, opacity: 0.55 })`, with one plane.
  - Planes along the camera's right vector. Edges `eA = −0.42 + 0.84·clamp(1.5w)` and `eB = −0.42 + 0.84·clamp(1.5w − 0.5)`.
  - Brass left of eB, clay between eB and eA, wire right of eA. At w ≥ 0.999 the clips come off.
- [ ] **Step 3: Passes.**
  - RenderPass, then BokehPass with `gl_FragColor.a = 1.0;` removed from its shader, so the page shows through.
  - Focus = the camera distance, aperture = `f.aperture`, maxblur 0.012.
  - A dim ShaderPass multiplying rgb by `dim` (spec §6: in the shader, never a CSS filter).
  - OutputPass.
- [ ] **Step 4: Glass placeholder.** A sphere with `MeshPhysicalMaterial({ transmission: 1, roughness: 0.03, ior: 1.5, thickness: 2.2, color: 0xfff3ea, attenuationColor: 0xffdcc8, attenuationDistance: 4 })`. It's placed only when `glass` isn't null, using the prototype's maths: unproject the slot centre; distance 0.42 × the camera's; radius from r. Task 9 finishes it.
- [ ] **Step 5: Verify frames.**
  - Write `scripts/about/pendant-frames.cjs`: Playwright with `--use-angle=metal --enable-gpu --ignore-gpu-blocklist` at 1440×900 against `/about`. It scrolls to each key via `window.__pendant.keys` (Task 7) and saves `pendant-<id>.jpg`.
  - Run it after Task 7. Expected: each frame matches the storyboard's shot (framing, angle, layer).
- [ ] **Step 6: Commit** `feat(about): the pendant's scene: brass, build passes, depth of field, dimming (…)`.

### Task 7: Mount on About

**Files:**
- Create: `src/app/about/about-pendant.tsx`, `src/app/about/about-pendant.test.tsx`
- Modify: `src/app/about/about-track.tsx`:
  - `data-pendant` on the slides: `line1`, `band`, `how` (ABOUT.lines 0–2), `e2e` (opening), `quote1`, `quote2`, `find`, `check`, `build` (verbs).
  - Mount `<AboutPendant />` inside `.ab-pin`.
- Modify: `src/app/about/about.css`:
  - `.ab-clip { position: relative; z-index: 1 }`
  - `.ab-pendant { position: absolute; inset: 0; pointer-events: none; z-index: 2 }`, and `z-index: 0` under `[data-layer="back"]`
  - pill and bar `z-index: 3`
- Create: `e2e/about-pendant.spec.ts` (first two tests here; Task 8 adds the sweep)

**Interfaces:**
- Consumes: Tasks 2–6. `trackProgress`, `trackLayout` from `src/app/about/track.ts`.
- Produces:
  - `window.__pendant = { keys: {id, y}[], s, layer, box, ready }`, written each frame, for e2e and the frame script.
  - Anchors are read with `[data-pendant="<name>"]`. The pictures thread adds `strip`, `glass` and `deskfilm` later; until then the fallbacks apply.

- [ ] **Step 1: Write the failing unit tests** in `about-pendant.test.tsx` (mock `@/three/pendant/scene`):
  - `renders no canvas without WebGL2`: `getContext("webgl2")` returns null → no `.ab-pendant`.
  - `loads the scene only after About's text has painted`: `PendantScene.load` isn't called synchronously on mount, and is called after fonts resolve plus an idle tick.
  - `a load failure removes the canvas and logs nothing`: load rejects → no `.ab-pendant`, `console.error` not called.
  - `reduced motion still mounts it, in still mode`: `matchMedia("(prefers-reduced-motion: reduce)")` true → the component reports `data-mode="still"`.
- [ ] **Step 2: Run** `npx vitest run src/app/about/about-pendant.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement `AboutPendant`.** It owns the canvas and the loop:
  - Dynamic-import `scene.ts`, so three stays out of About's first bundle.
  - Measure anchors and text boxes on layout, resize and `document.fonts.ready`. Text boxes come from `.ab-big, .ab-quote blockquote, .ab-quote figcaption, .ab-verb .ab-mono, .ab-verb-title, .ab-skills li, .cap`.
  - Each frame:
    1. Smoothed s.
    2. `shotAt`, then `stepMotion`, then `poseRig`.
    3. Outro: `o = clamp((scrollY − (top + H − vh)) / vh)`, giving `h × (1 − 0.6o)`, `ay + 0.5o` and `dim × (1 − o)`.
    4. `draw`.
  - Run only while the section intersects the viewport and `!document.hidden`.
  - Pointer on `window`: pointerdown with `scene.hit` true starts a drag and calls `preventDefault()`; pointermove feeds dragDX/DY; pointerup ends it.
  - `webglcontextlost`: hide the canvas and stop the loop. `webglcontextrestored`: reload the scene.
- [ ] **Step 4: Add e2e tests** in `e2e/about-pendant.spec.ts`:
  - `the pendant draws on About with no console errors`: canvas visible, `window.__pendant.ready === true` within 10 s, no `pageerror`.
  - `About works when the pendant's model fails`: `page.route("**/about/pendant/**", r => r.abort())` → the text is visible, no canvas, no `pageerror` (Review Focus 3).
  - `a lost WebGL context hides the canvas without errors`: `WEBGL_lose_context.loseContext()` → canvas hidden, no `pageerror`; then `restoreContext()` → `ready` again (Review Focus 4).
- [ ] **Step 5: Run** `npx vitest run src/app/about` and `npx playwright test e2e/about-pendant.spec.ts`. Expected: PASS.
- [ ] **Step 6: Review clip for Liam.** Record the desktop pass (opening → hero) with the frame script in video mode and send it with SendUserFile. **Wait for his OK before Task 8** (spec §10.3).
- [ ] **Step 7: Commit** `feat(about): the pendant on About: mounted, scrubbed by the track, grab to turn (…)`.

### Task 8: Readability, solved per screen

**Files:**
- Modify: `src/app/about/about-pendant.tsx` (build the layer timeline and free spots at layout time)
- Modify: `e2e/about-pendant.spec.ts`

**Interfaces:**
- Consumes: `layerTimeline`, `freeSpot`, `hits` (Task 5), `screenBox` (Task 4).

- [ ] **Step 1: Write the failing e2e tests:**
  - `never in front of a line, at any screen` × 1440×900, 1280×800, 1920×1080, 1024×768: scroll the section in 120 steps, settling 400 ms each. At every step where `__pendant.layer === "front"`, `__pendant.box` overlaps no box from the Task 7 text selectors.
  - `follows a resize from track to stack and back`: at 1440×900 mid-track → set 390×844 → the section's `data-mode` is "stack", `__pendant.ready`, no `pageerror` → back to 1440×900 → the overlap check holds at the current step (Review Focus 1).
  - `a jump doesn't put it over the words`: `keyboard.press("End")`, then sample every frame for 1.5 s → no front overlap while it settles; the same after `Home` (Review Focus 2).
  - `a press on the pendant drags; elsewhere links work`:
    - A mousedown/up on `__pendant.box`'s centre over a proof link → URL unchanged.
    - A click on a proof link outside the box → navigates (Review Focus 5).
- [ ] **Step 2: Run.** Expected: the sweep FAILS on at least one screen (the prototype overlapped at 1024×768).
- [ ] **Step 3: Implement.** At layout, sample s every 8 px:
  1. `shotAt`, then `poseRig` with `REST` motion and zero look, then `screenBox` grown by 3% to cover the breath, spin and lean.
  2. For rest windows (t at 0 or 1) where front hits text, apply `freeSpot` (maxShift 0.25) to that shot's ax for this screen. Re-sample.
  3. Build `layerTimeline`. The frame uses the timeline's layer, not `Frame.layer`.
- [ ] **Step 4: Run.** Expected: PASS at all four sizes.
- [ ] **Step 5: Commit** `feat(about): the pendant solves its spots and layers from the measured text on every screen (…)`.

### Task 9: The glass, shared with the testimonials

**Files:**
- Create: `src/lib/about-glass.ts`, `src/lib/about-glass.test.ts`
- Modify: `src/three/pendant/scene.ts`, `src/app/about/about-pendant.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type GlassOwner = "pendant" | "testimonials";
  export function claimGlass(owner: GlassOwner): () => void;   // returns release
  export function glassOwner(): GlassOwner;                    // "testimonials" when nobody claimed
  export function setGlassRim(rgb: readonly [number, number, number] | null): void;  // the edge light's colour at the ball
  export function glassRim(): readonly [number, number, number] | null;
  ```
- **Coordination:**
  - The testimonials shader (pictures spec §4.2) draws its own ray-traced ball only while `glassOwner() === "testimonials"`, and calls `setGlassRim` every frame with the edge colour it faces.
  - The pendant claims the glass when its scene is ready, and releases it on unmount or context loss.
  - Whichever is built first, one ball is drawn.

- [ ] **Step 1: Write the failing tests:**
  - `glassOwner is testimonials until claimed, pendant after, testimonials after release`.
  - `rim colour round-trips and clears with null`.
- [ ] **Step 2: Run** `npx vitest run src/lib/about-glass.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** A module-level store, no React.
- [ ] **Step 4: Finish the ball in the scene.**
  - Glass slot: `[data-pendant="glass"]`'s rect, else the gap between the quotes. The slot is 17vw, radius 0.44 × the slot (pictures spec §4.2).
  - `glassRim()`, when set, tints a rim DirectionalLight behind the ball (`intensity 1.2`) so its edge catches the testimonials' colour. No glow sprite.
- [ ] **Step 5: Verify** with the frame script at the glass key: the pendant reads refracted, magnified and upside down inside the ball.
- [ ] **Step 6: Run** `npx vitest run src/lib src/app/about`. Expected: PASS.
- [ ] **Step 7: Commit** `feat(about): one glass ball: the pendant draws it and the testimonials light its rim (…)`.

### Task 10: Motion blur and the performance pass

**Files:**
- Create: `src/three/pendant/motion-blur.ts`
- Modify: `src/three/pendant/scene.ts`
- Create: `scripts/about/pendant-perf.cjs`

**Interfaces:**
- Produces: `class MotionBlurPass extends Pass { setPrevious(viewProj: Matrix4, model: Matrix4): void }`. It renders the pendant's per-pixel screen velocity (current vs previous MVP) to a half-resolution target, then blurs the colour along it: 8 taps, blue-noise jitter, length capped at 24 px. It's placed after the bokeh.

- [ ] **Step 1: Implement the pass.** The velocity material's vertex shader takes `uPrevMVP`, `uMVP`, and writes `(curr.xy/curr.w − prev.xy/prev.w) × 0.5` into RG.
- [ ] **Step 2: Verify.** Frame script at the whirl key with a 30 ms frame step: the edges smear along the spin. At the opening (slow spin), no visible smear.
- [ ] **Step 3: Write `pendant-perf.cjs`.** Playwright with GPU flags at 1440×900. It wraps the composer render in `EXT_disjoint_timer_query_webgl2` through a debug hook in `window.__pendant.gpuMs`, scrolls the full track, and prints the median and p95 GPU ms. Run it with no Blender running (`pgrep -fl Blender` empty: perf-lessons).
- [ ] **Step 4: Run it.** Expected: median < 6 ms. If over: cap the pixel ratio at 1.5 under load (the site's governor pattern), then halve the bokeh resolution, never the model.
- [ ] **Step 5: Commit** `feat(about): motion blur on the pendant's fast moves; frame cost under budget (…)`.

### Task 11: Phones and reduced motion

**Files:**
- Modify: `src/three/pendant/shots.ts` (add `SHOTS_STACK`)
- Modify: `src/three/pendant/shots.test.ts`, `src/app/about/about-pendant.tsx`

**Interfaces:**
- Produces: `export const SHOTS_STACK: readonly Shot[]`.
  - The opening, tumble, from above, glass, whirl and hero, anchored on the stacked slides.
  - `fx` reads as `fy`: the anchor centre's height as a share of the screen.
  - Every `ay` sits in the bands above or below the text column.
  - In stack mode, travel is the vertical scroll inside the section.

- [ ] **Step 1: Write the failing test** `SHOTS_STACK keeps the six phone shots in order`: ids `opening, tumble, above, glass, whirl, hero`.
- [ ] **Step 2: Stills for Liam.**
  - Fill `SHOTS_STACK` from the prototype's values, reframed for 390×844.
  - Capture the six stills with the frame script at 390×844 and send them. **Wait for his OK** (spec §8).
- [ ] **Step 3: Implement stack mode** in the mount: the same loop, vertical travel, stack anchors.
- [ ] **Step 4: Implement reduced motion.**
  - `stepMotion(..., reduced: true)`.
  - The frame snaps to the nearest shot instead of blending, and a change of shot crossfades the canvas opacity over 0.6 s. No outro movement, only the fade.
- [ ] **Step 5: Run** `npx vitest run src/three/pendant src/app/about` and `npx playwright test e2e/about-pendant.spec.ts`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(about): the pendant on phones and under reduced motion (…)`.

## Self-review notes

**Spec coverage:**

| Spec section | Task |
|---|---|
| §3 shots | 2 |
| §4 motion | 3, 4, 7 (outro), 10 (blur) |
| §5 readability | 5, 8 |
| §6 rendering | 6, 9, 10 |
| §7 assets | 1 |
| §8 loading, fallbacks, perf, phones | 7, 10, 11 |
| §9 code shape | file map above |
| §10 order and Liam's two checkpoints | Tasks 7.6 and 11.2 |

**One interpretation, recorded:** spec §7's "4K detail map" for the face is met by giving the heads 4× texel area inside the 2048 maps (Task 1 Step 2). That holds the 2.5 MB budget from the same section.

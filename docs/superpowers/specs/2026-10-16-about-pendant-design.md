# About: the pendant (design)

Date: 2026-10-16. Status: storyboard approved by Liam (opening revised), spec awaiting his review.
Storyboard: `docs/storyboard/about-pendant-storyboard-v1.jpg` (frames 03–13) + `docs/storyboard/about-pendant-opening-v2.jpg` (the revised opening). Live prototype: `.superpowers/brainstorm/78029-1792148196/content/pendant-film-v3.html`.

## 1. What it is

Liam's brass four-faced Brahma pendant, modelled in Blender (`blender/amulet/`), lives on the About page as a quiet companion you can also play with. A real 3D camera films it through the whole sideways About track. It never stops moving: it drifts, turns and leans with the scroll the whole time. At each part of About, the camera frames it from a new angle (worm's eye, top-down, through glass, lying down, close and cropped). It can pass over, under and behind the text, but every line stays readable while you read it.

Quality bar (standing rule): Lusion-level craft, the highest-quality option at every choice, no shortcuts. Reference studied: lusion.co home and its production bundle (`cameraLookStrength`/`cameraLookEaseDamp 0.1`, Brownian camera shake, dolly zoom, 35 mm base lens, motion-blur prepass, shots driven by each DOM section's screen ratio).

## 2. Liam's decisions

- **Where:** the About page only.
- **Role:** a quiet companion and something you play with. It can go over, under and behind the text; every text layer must stay readable; transitions are free.
- **Approach A:** one live WebGL layer whose depth against the text changes with the choreography. The text stays real HTML.
- **Testimonials:** the pendant is seen inside the glass ball between the quotes, one shared moment.
- **Storyboard:** approved. The opening changed (2026-10-16): small, centred above the first line, spinning in place (it replaced the macro on the eyes, "a bit intense").
- **Motion:** it floats and moves continuously with the scroll, not only between parts.

## 3. The shots

Each shot is fully on when its anchor's centre reaches `fx` of the screen width on the track. Between two shots, every value blends (smootherstep: zero speed and acceleration at each key; size in log space; a locked face turns on the shortest arc, and a lock eases in and out with the blend), so the camera is always moving.

| # | Anchor (`fx`) | Shot | Camera | Pendant | Layer |
|---|---|---|---|---|---|
| 01 | top of About | Small, centred above the first line, spinning in place | az 0°, el 8°, fov 30°, h 0.20, at (line 1 centre, 0.21) | spin 0.22 turns/s | front |
| 02 | band line (0.92) | It lets go: drifts up and right, still turning | az −50°, el 14°, roll 7°, fov 38°, h 0.25, at (0.64, 0.13) | spin 0.09 | front |
| 03 | band line (0.42) | Tumble: end over end, sinking behind "eight years managing two rock bands" | az −70°, el 0°, fov 32°, h 0.5, at (0.46, 0.56) | tumble 0.32 turns/s | back, dimmed to 0.4 |
| 04 | "That's still how I work" (0.5) | Worm's eye, cropped by the bottom edge | az 30°, el −62°, roll −8°, fov 62°, h 1.15, at (0.84, 1.08) | spin 0.1 | front |
| 05 | work strip (0.5) | From above: the four faces like a compass, turning like a record | az 0°, el 89°, fov 30°, h 0.8, aim the crown, at (0.81, 0.76) | spin 0.12 | front |
| 06 | glass ball (0.5) | Through the glass: magnified, bent, upside down | az 150°, el 8°, fov 30°, h 0.15, at the ball's centre | spin 0.16 | front, behind the glass |
| 07 | "Find the problem" (0.68 to 0.28) | Glide: lying down, rolling along the top, the full width of the screen | el 6°, fov 28°, h 0.5, from (1.08, 0.13) to (−0.08, 0.13) | laid 90°, roll 0.45 turns/s | front |
| 08 | "Check I'm right" (0.5) | Whirl: stands up spinning fast, slows to a new face | az 20°, el 10°, fov 34°, h 0.3, at (0.13, 0.17) | spin 1.3 turns/s easing down, motion blur | front |
| 09 | desk film (0.62 to 0.36) | Build passes: wire, then clay, then brass, swept left to right | az −25° to 10°, el 12°, fov 32°, h 0.28, at (0.5, 0.15) | spin 0.08 | front |
| 10 | end of the track | Hero: close and low, cut by the left edge, its face turned to "I'd like to hear about it" | az −62°, el −12°, roll 6°, fov 24°, h 1.35, aim the face, at (0.03, 0.5) | settles face −62° | front |
| out | the pull to Contact | It falls away into the dark as Contact rises | | | |

Shot 09 since 2026-10-18 (Liam: the desk film left About; build shot = candidate (b)): anchored on an empty stage right of "Build it." (`data-pendant="buildstage"`, 36vw), a big three-quarter close-up in front riding with it, 0.53 to 0.25: az −35° to −25°, el 12°, fov 30°, h 0.64 to 0.53, at (0.54, 0.43) to (0.32, 0.475), spin 0, lock −10° to 0°. Values in `src/three/pendant/shots.ts`.

Key to the columns:
- **h:** the pendant's height as a share of the screen's height.
- **at:** the aim point's screen position. A lens shift places it there, so perspective stays true.
- **az/el:** where the camera stands (az 0 faces face one; el 90 looks straight down).

These are the prototype's values. The build keeps them as data (`shots.ts`) and tunes them on Liam's screens.

## 4. Motion: never still

- **Smoothed scroll:** a soft follow, matching the site's Lenis feel. Scrolling back plays everything in reverse.
- **Spin:**
  - Each shot sets its own turn speed.
  - Scroll speed adds to the spin.
  - A shot with a `lock` pulls a face toward the camera with a spring instead.
- **Tumble:** turns end over end; it springs upright when the shot's tumble ends.
- **Lean:** tilts into the scroll direction (up to 0.35 rad), easing back.
- **Breath:** small layered-sine drift on its rotation and position. The camera has Brownian drift and a slight roll wander, after Lusion.
- **Cursor:** leans the camera by up to about 0.035 rad, eased 0.1 a frame (Lusion's values).
- **Grab:** press on the pendant (raycast hit) to turn it with inertia. Letting go hands it back to the shot. The canvas never takes pointer events, so the links underneath keep working; the pointer is read on the window.
- **Motion blur:** a velocity blur on fast moves (whirl, glide, tumble), following Lusion's motion-blur prepass. No bloom, no halo, no glow (standing rule).

## 5. Readability

**The rule:** while you read a line, the pendant never sits on top of it. It passes over text only during flights, and only where no words are. Whenever a shot passes under text, the pendant goes behind the words and dims.

**Layering:**
- One canvas, either in front of the track or behind it.
- It only switches sides where the pendant's projected bounds overlap no text box. The switch point is found per screen at layout time, not fixed in the data.
- Every flight is checked, and a flight that would cross text is forced behind.

**Fitting each screen:**
- Shot positions are solved from the measured text boxes on every viewport.
- If a shot's spot is taken on a given screen, it moves to the nearest free spot in the same band.

**Automated check:** an end-to-end test scrolls the whole track at 1440×900, 1280×800, 1920×1080 and 1024×768. It fails on any overlap between the pendant's projected bounds and a text box while the layer is "front".

## 6. Rendering

**Stage:**
- `src/three/pendant/`: three.js 0.186.1, one renderer, a transparent canvas fixed inside `.ab-pin`. About stays its own page; the home story's stage isn't used here.
- Tone mapping: AgX.
- Lights ride with the camera: a warm key high left, a rose rim behind right, a dim cool fill, plus a room-environment probe for the metal. Tuned against the Blender renders Liam approved.

**Depth of field:** a bokeh pass focused on the aim point, with alpha kept so the page shows through. Gentle everywhere, a little stronger on the hero.

**The glass (shot 06):**
- A real refracting sphere (physical transmission) in the same scene, placed exactly over the ball's place in the page.
- **Coordination:** this replaces the ray-traced sphere in the testimonials "water" mockup (v19). The water's edge light stays the testimonials thread's screen pass.

**Build passes (shot 09):**
- Three versions of the pendant, clipped by two planes that sweep across its screen width.
- Brass (built) | clay | wire (not yet built).
- The wire is a 5k-triangle copy, so it reads as wire.

**Dimming:** behind the words, the pendant renders at reduced brightness in the shader (the prototype's CSS filter is not used: a perf rule from 2026-10-11).

## 7. Assets

- **Model:** `blender/amulet/amulet.py` + `head.py` (MPFB 2.0.18 base head, CC0 assets vendored in `blender/amulet/mpfb`).
- **Main GLB:** the worn-gold material is baked to colour, roughness and normal maps.
- **Web build:**
  - `public/about/pendant/pendant.glb`: meshopt, about 2.3 MB today.
  - The textures move to KTX2 (`scripts/lab/desk3d-ktx2.py` pattern), with a target of at most 2.5 MB total.
- **Close shots:** the hero at h 1.35 needs more detail than the simplified web model gives.
  - The face region gets a 4K detail map.
  - The heads are kept at full resolution, with only the rest simplified.
  - The hood edge is cleaned (its ragged step shows close up).
- **Wire copy:** `pendant-wire.glb` (about 0.1 MB).

## 8. Loading, performance, fallbacks

**Loading:**
- The pendant loads after About's text has painted. It fades in on its opening spot; the text never waits for it.
- It renders only while About's track is on screen, and pauses on a hidden tab.

**Frame cost:**
- Pixel ratio capped at 2, with the site's governor pattern stepping it down under load.
- Target: under 6 ms a frame on Liam's M1 Pro at 1440×900.
- Frame time is measured after each feature (`perf-lessons`).

**Fallbacks:**
- **Reduced motion:** the pendant holds a still pose per part (no spin, drift or flights), crossfading between parts.
- **No WebGL:** About as it is today.
- **Phones (About stacks):** the same shots, framed for a tall screen in the free bands above and below the text column, with the opening, tumble, from above, glass, whirl and hero kept. The phone framing is shown to Liam as stills before it ships.

## 9. Code shape

- `src/three/pendant/shots.ts`: the shot data, and `shotAt(travel)` (blend, anchors to travel). Pure, unit-tested.
- `src/three/pendant/motion.ts`: spin, tumble, lean, breath, hand. A pure step function, unit-tested.
- `src/three/pendant/layout.ts`: anchors and text boxes measured from the DOM, layer switch points, the free-spot solver. Unit-tested on fixture rects.
- `src/three/pendant/scene.ts`: the renderer, lights, the GLBs, the glass, the build-pass clipping, the bokeh and blur passes.
- `src/app/about/about-pendant.tsx`: mounts inside `.ab-pin`, reads the same section progress as `track.ts`, handles reduced motion and no-WebGL.
- **`about-track.tsx` change:** `data-pendant` anchors on the slides only. It's touched minimally, because the About pictures work is in progress in the same files.
- `e2e/about-pendant.spec.ts`: the readability sweep (§5) and a frame-time budget check.

## 10. Order of work

1. **Assets:** the hero-detail pass (4K face map, full-resolution heads, clean hood), the KTX2 web build and the wire copy.
2. **Pure core:** shots, motion and layout, with tests.
3. **Scene and mount:** in About on a branch, opening → hero, desktop. Review clip for Liam.
4. **Readability:** layer switching and the free-spot solver, then the e2e sweep.
5. **The glass:** with the testimonials thread.
6. **Effects:** motion blur and dimming in the shader. Perf pass.
7. **Phones:** stills for Liam, then build. Then reduced motion and no-WebGL.

**Dependencies:**
- The About pictures and testimonials work is uncommitted on `main` (another session). The build branches after it lands, or rebases onto it.
- The glass ball needs one agreement with the testimonials thread (§6).

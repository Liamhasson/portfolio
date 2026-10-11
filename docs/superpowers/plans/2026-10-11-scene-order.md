# The New Scene Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the hero page's story as: the cloud packs into the ball in the hero (same scene), then one forward camera shot tilts down to the desk, where sand rises endlessly toward the unseen ball, and pushes into the laptop's screen, where the project index lives.

**Architecture:**
- **Camera.** The camera follows a path exported as JSON (desk metres, Blender z-up), exactly like today's moves. A new pure-Python generator writes it: the hero framing, a slight ease-in, a tilt in place, a glide down and forward, then the approved tail of today's flight to the screen.
- **Live page.** The page maps scroll (in screens) to beats through a small, tested timeline module.
- **Rising sand.** A new points system shares the sand's uniforms and fragment shader. Its motion is stateless, computed in the vertex shader from per-grain seeds and time. Its rest spots come from the Cycles look-dev spill.

**Tech Stack:** Next.js 16 (read `node_modules/next/dist/docs/` before touching Next APIs), React 19, three.js 0.186 (GLSL3 ShaderMaterial), Lenis 1.3, Vitest 5 + Testing Library, Playwright (capture scripts), Blender 5.1 (Cycles, Python hooks), ffmpeg.

**Spec:** `docs/superpowers/specs/2026-10-11-scene-order-design.md` (approved by Liam 2026-10-11)

## Global Constraints

- **Camera direction:** the camera only ever moves forward and down after the hero. No pull-back.
- **Hero copy:** "Hi, I'm Liam." and its two lines are on screen from the hero's first frame (no delayed entrance). They drift out (upward drift and fade, line by line) while the cloud turns into the ball, and are gone by the time it locks in.
- **Desk headline, verbatim, headline only:** `Tested until people believe in it.` Remove both "From chaos to product." and "I find the problem nobody pointed at, test what could solve it, and build what works."
- **Removed:**
  - the ball settling on the desk
  - the rise to the top view
  - the attempts bursts
  - the ball's drift up
  - the flight through the cloud
  - the pull-back
  - the glass state
- **Kept:**
  - the wordmark's ambient wave (`src/three/sand/wordmark.ts`) and its fill-to-outline on load
  - the haze, film grade, depth of field, size range, floating grains (streams)
  - the 3D baked pallet desk and the lamp
  - the lid and screen states
  - the live index
- **Rising sand:** endless and ambient (on its own clock, never on scroll), in random places, uneven paces and waves. One system with the sand (SAND_FRAGMENT, its palette and lights). No grain pops in or out in view.
- **Pill nav** (Projects, About, Contact; its look unchanged): Projects reaches the index from any frame (Lenis, about 1.5 s). About and Contact go to anchors at the page's end until those sections are built.
- **Reduced motion:** held states joined by short crossfades through black. No camera shot; the rising sand is stilled.
- **Never edit `blender/lookdev/lookdev.py`.** Also leave alone the other chat's uncommitted files:
  - `docs/storyboard/portfolio-storyboard.html`
  - `.claude/launch.json`
  - `blender/lookdev/renders/*-camera.json`
  - `docs/superpowers/specs/2026-10-05-portfolio-concept-v2.md`

  Stage only your own files, by path.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push to `phase/2-home` (Vercel builds a preview per push: team liamhasson-2414s-projects, project liamhasson-portfolio).
- **Coordinates:** hero ↔ desk is `hero = (desk - (0, 0.03, 0.46)) / 0.1`, then Blender z-up to three y-up `(x, y, z) -> (x, z, -y)` (`Pullback.toHero`, `src/three/sand/pullback.ts:202`).

## Review Focus

1. **Portrait phones (375×812).** The vertical field of view is far taller than on 16:10, so the ball could stay in frame after the tilt. Expected: the ball (and the wordmark) are fully out of frame at the tilt's end on a phone too. Pinned in Task 9, step 6 (portrait extra tilt) and Task 14, step 2 (projection check).
2. **Projects from the first frame.** Lenis jumps about 4 screens in 1.5 s. Expected: the lid ends open, the screen awake and the index settled and interactive, with no stuck half-states (revealT, sleep). Pinned in Task 11, step 7 (e2e).
3. **Scrolling back up from the index to the hero.** Expected:
   - the lid shuts and the screen sleeps
   - the headline leaves, and the hero copy and wordmark return
   - the ball unpacks into the cloud

   Pinned in Task 14, step 3 (reverse capture).
4. **A long session.** Hours of ambient time grow `uRiseTime`. Expected: no stutter, no grain teleporting in view, no precision banding. Pinned in Task 6 (`grainAt` continuity test at t = 100 000 s).
5. **Reduced motion.** Expected: every line of copy is still readable (the hero copy and the desk headline) and the index is reachable. Pinned in Task 12 (`reducedStory` tests cover a held desk state).

---

## File Structure

**New files:**

| File | Does |
|---|---|
| `blender/lookdev/pallet.py` | The pallet wood and its slot swap (moved out of cinematic_set.py / bake_pallet.py), plus the desk spill's points. One home for what the bake, the look-dev set and the exports share. |
| `blender/lookdev/export_spill.py` | Hook: the spill's rest spots → `public/lab/sand/desk-spill.bin`. |
| `blender/lookdev/shot_path.py` | Pure-Python camera-path generator (no bpy) → `public/lab/shot/camera.json`, with a self-check. |
| `blender/lookdev/shot_preview.py` | Hook: renders the shot over the pallet desk in Cycles → `blender/lookdev/renders/review/shot-preview.mp4`. |
| `src/three/sand/story-timeline.ts` (+ `.test.ts`) | The beats in screens, `span`/`ease`, `shotFrame`, `pAtFrame`, `reducedStory`, the `ShotMeta` type. |
| `src/three/sand/rising.ts` (+ `.test.ts`) | The rising sand's motion: constants, its GLSL, a TS mirror for tests, and `spillToHero`. |
| `src/three/sand/loose-grain.ts` | The loose-grain vertex shader and uniforms shared by the floating grains and the rising sand (extracted from drift-grains.ts). |
| `src/three/sand/rising-sand.ts` | The `RisingSand` points system. |
| `src/lib/story.ts` | Where the story lives (`STORY_PATH`, `STORY_HREF`). |

**Modified:**
- `blender/lookdev/cinematic_set.py` and `blender/lookdev/bake_pallet.py`: they import from pallet.py.
- `src/three/sand/drift-grains.ts`: uses loose-grain.ts.
- `src/three/sand/baked-desk.ts`: the spill-light pool, `setSpill`.
- `src/app/lab/sand/sand-lab.tsx`: the new story wiring; plates, settle, rise, attempts and the through cloud removed.
- `src/app/lab/sand/hero-overlay.tsx`: copy.
- `src/components/shell/pill-nav.tsx` (+ test) and `src/components/providers/smooth-scroll.tsx`: the nav's targets.

**Deleted:**
- `src/three/sand/attempts.ts` (+ test)
- `public/lab/settle/`, `public/lab/rise/`, `public/lab/through/`, `public/lab/pullback/`

---

### Task 1: Publish the pallet desk bake

The bake (`blender/lookdev/bake_pallet.py`, runner in the session scratchpad) has baked shut and open, and is baking lit.

**Files:**
- Modify (generated): `public/lab/desk3d/*`

**Interfaces:**
- Consumes: `blender/lookdev/renders/bake/{shut,open,lit}/` (bake_pallet.py output)
- Produces: `public/lab/desk3d/` with the pallet wood (desk.glb, desk.json, bake_*.jpg, probe.exr)

- [ ] **Step 1: Wait for the lit state, then confirm all three states have the pallet wood**

Run:
```bash
cd "/Users/liamwindhasson/Documents/My portfolio - project/blender/lookdev"; until ! pgrep -f "bake_pallet.py" >/dev/null; do sleep 15; done; for s in shut open lit; do echo "$s wrote=$(grep -c '^WROTE' renders/bake-$s.log) pallet=$(grep -c 'BAKE pallet' renders/bake-$s.log)"; done
```
Expected: every state shows `wrote=1 pallet=1`. If lit shows `pallet=0` (an old log), bake it alone:
```bash
cd "/Users/liamwindhasson/Documents/My portfolio - project/blender/lookdev"; BAKE_STATE=lit BAKE_SAMPLES=256 caffeinate -i /Applications/Blender.app/Contents/MacOS/Blender --background --python bake_pallet.py -- --scene bakedesk --out renders > renders/bake-lit.log 2>&1; grep -c '^WROTE' renders/bake-lit.log
```
Expected: `1`.

- [ ] **Step 2: Publish**

Run: `python3 scripts/lab/desk3d-publish.py`
Expected: `published N surfaces; ...M public/lab/desk3d` (N ≈ 18, size ≈ 20M).

- [ ] **Step 3: Check it live**

Start the dev server with `preview_start {name: "sand-lab"}` (port 3100). Then run the existing capture:
```bash
node "$SCRATCH/desk-shot.mjs" "$PWD" "$SCRATCH/after-desk.png"
```
(`$SCRATCH` is the session scratchpad. Copy `desk-shot.mjs` from the earlier session's scratchpad if absent; its full source is in `docs/superpowers/plans/2026-10-11-scene-order.md` Appendix A.)

Expected: the desk shows pallet planks with gaps, knots and rings, with no walnut. Compare with `before-desk.png` (the walnut) in the same folder.

- [ ] **Step 4: Commit**

```bash
git add public/lab/desk3d && git commit -m "feat: the 3D desk baked in the pallet wood (shut, open, lit)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: One home for the pallet wood and the spill; export the spill's rest spots

**Files:**
- Create: `blender/lookdev/pallet.py`, `blender/lookdev/export_spill.py`
- Modify: `blender/lookdev/cinematic_set.py` (the `srgb` and `pallet_wood` defs and the inline spill block move out), `blender/lookdev/bake_pallet.py`
- Output: `public/lab/sand/desk-spill.bin`

**Interfaces:**
- Produces:
  - `pallet.srgb(hex) -> (r, g, b, 1)`
  - `pallet.pallet_wood() -> bpy.types.Material`
  - `pallet.swap_pallet() -> None`
  - `pallet.spill_points(np, rng, hh, pallet: bool) -> (pts float32 (n, 3), hue float32 (n,), radius float32 (n,))`
  - `desk-spill.bin`: little-endian float32, 4 per spot `(x, y, z, hue)` in desk metres (Blender z-up), shuffled, at most 30 000 spots

- [ ] **Step 1: Create `blender/lookdev/pallet.py`**

Move these verbatim:
- `def srgb(hex_)` (cinematic_set.py, the 4-line function after `scene.cycles.samples = ...`)
- `def pallet_wood()` (cinematic_set.py, from `def pallet_wood():` through its `return m`)

Above them, put:

```python
"""What the look-dev set (cinematic_set.py), the desk bake (bake_pallet.py) and the exports share: the pallet wood
(Liam, 2026-10-11: a vintage pallet table, the wood only, in the sand's tones, procedural) and the sand spilled on the
desk (the mound under the ball's place, a patchy scatter, grains fallen into the plank gaps)."""
import bpy
```

Then append these two functions:

```python
def swap_pallet():
    """The desk's walnut slots -> the pallet wood."""
    pw = pallet_wood()
    for o in bpy.data.objects:
        for slot in getattr(o, "material_slots", []):
            if slot.material and slot.material.name.startswith("walnut"):
                slot.material = pw
                print("PALLET wood on", o.name, flush=True)


def spill_points(np, rng, hh, pallet):
    """The spill (cinematic_set.py SET_WORLD=sand, as approved 2026-10-11): a soft mound where the ball forms and a
    patchy scatter thinning away from it, resting on the desk or the paper under it (a ray down), none past the desk's
    edge; on the pallet desk a grain over a plank gap (y = +-0.1, ~8 mm) drops into the crack. `hh`: the hue pool.
    Returns (points (n, 3), hue (n,), radius (n,)), float32, desk metres."""
    from mathutils import Vector as V3
    def patchy(xy):
        x, y = xy[:, 0] * 18.0, xy[:, 1] * 18.0
        return 0.5 + 0.25 * np.sin(x * 1.3 + np.sin(y * 0.7) * 2.0) * np.cos(y * 1.1 + np.sin(x * 0.9) * 1.7) + 0.25 * np.sin(x * 3.1 + y * 2.3)
    n1, n2 = 22000, 60000
    d = rng.normal(0, 0.04, (n1, 2)); r1 = rng.uniform(0.0003, 0.0006, n1)
    mound = 0.004 * np.exp(-(d ** 2).sum(1) / (2 * 0.035 ** 2)) * rng.uniform(0, 1, n1)
    p1 = np.stack([d[:, 0], 0.03 + d[:, 1], r1 + mound], 1)
    q = rng.normal(0, 0.12, (n2, 2)) * rng.choice([1.0, 2.2], (n2, 1), p=[0.75, 0.25])
    q[:, 1] += 0.03
    keep = (np.abs(q[:, 0]) < 0.58) & (np.abs(q[:, 1]) < 0.28) & (rng.uniform(0, 1, n2) < patchy(q) ** 2.5)
    q = q[keep]; r2 = rng.uniform(0.0003, 0.0006, len(q))
    zz = np.zeros(len(q))
    papers = [o for o in bpy.data.objects if o.type == "MESH" and o.name.split(".")[0] in ("card_a", "card_b", "sticky_hero", "sticky_b", "sticky_c", "blank")]
    bpy.context.view_layer.update()
    for o in papers:
        inv = o.matrix_world.inverted()
        for k in range(len(q)):
            lp = inv @ V3((q[k, 0], q[k, 1], 0.05))
            hit, loc, _n, _i = o.ray_cast(lp, inv.to_3x3() @ V3((0, 0, -1)))
            if hit:
                zz[k] = max(zz[k], (o.matrix_world @ loc).z)
    if pallet:
        for gy in (-0.1, 0.1):
            over = (np.abs(q[:, 1] - gy) < 0.0045) & (zz == 0)
            q[over, 1] = gy + (q[over, 1] - gy) * 0.45
            zz[over] = -r2[over] * 0.9
            over = np.abs(p1[:, 1] - gy) < 0.0045
            p1[over, 1] = gy + (p1[over, 1] - gy) * 0.45
            p1[over, 2] = p1[over, 2] - 0.0006
    p2 = np.stack([q[:, 0], q[:, 1], r2 + zz], 1)
    pts = np.vstack([p1, p2]).astype(np.float32)
    hh_spill = hh[hh > 0.45] if (hh > 0.45).any() else hh
    hue = rng.choice(hh_spill, len(pts)).astype(np.float32)
    return pts, hue, np.concatenate([r1, r2]).astype(np.float32)
```

- [ ] **Step 2: Make cinematic_set.py use it**

Delete the moved `srgb` and `pallet_wood` defs. Just below `import bpy`, add:
```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # (run through lookdev.py's hook: __file__ is lookdev.py, beside us)
from pallet import pallet_wood, spill_points, srgb, swap_pallet  # noqa: E402
```

Replace the `if os.environ.get("SET_DESK") == "pallet":` block (the slot-swap loop) with:
```python
if os.environ.get("SET_DESK") == "pallet":
    swap_pallet()
```

In the `SET_WORLD == "sand"` block, replace everything from `# a soft drift where the ball forms` through the line `print("CINE spill on papers", int((zz > 0).sum()))` and the following `pts = ...`, `r1, r2 = r1, r2`, `hh_spill = ...` lines, up to and including the `grains("spill", ...)` call, with:
```python
        pts, hue_spill, rad_spill = spill_points(np, rng, hh, os.environ.get("SET_DESK") == "pallet")
        grains("spill", pts, hue_spill, rad_spill)
```
Keep `print("CINE spilled sand", len(pts))` and everything after it.

- [ ] **Step 3: Make bake_pallet.py use it**

In `bake_pallet.py`, replace the whole `def swap_pallet(): ...` function with:
```python
sys.path.insert(0, HERE)
from pallet import swap_pallet  # noqa: E402
```
Also remove the now-unused `import ast`.

- [ ] **Step 4: Verify the look-dev set renders the same frame**

Run:
```bash
S="$SCRATCH"; env SET_LOOK=new SET_WORLD=sand SET_DESK=pallet SET_KEY=lamp SET_HAZE=0.04 SET_FSTOP=2.8 SET_FOCUS=ball SET_NAME=settle48 SET_TAG=-refactor SET_RES=800,500 SET_SAMPLES=32 SETTLE_FRAME=48 LOOKDEV_LIST=blender/lookdev/cinematic_set.py /Applications/Blender.app/Contents/MacOS/Blender --background --python blender/lookdev/lookdev.py -- --scene settle --out $S/settle-out 2>&1 | grep -E "CINE spilled|PALLET wood|WROTE|Error"
```
Expected: `PALLET wood on desk`, `CINE spilled sand <n>` (n ≈ 50–60k), `WROTE .../cinematic-set-settle48-new-refactor.png`. The image matches `cinematic-set-settle48-new-pallet-q.png` (same wood, same spill).

- [ ] **Step 5: Create `blender/lookdev/export_spill.py`**

```python
"""The desk spill's rest spots for the live rising sand (spec 2026-10-11 §5): pallet.spill_points on the desk as built,
shuffled, capped at 30 000 -> public/lab/sand/desk-spill.bin (float32 x, y, z, hue per spot; desk metres, Blender z-up).
Runs through lookdev.py's LOOKDEV_LIST hook on the desk scene:

  LOOKDEV_NO_SAND=1 LOOKDEV_LIST=blender/lookdev/export_spill.py /Applications/Blender.app/Contents/MacOS/Blender \
    --background --python blender/lookdev/lookdev.py -- --scene desk --out /tmp/x
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pallet import spill_points  # noqa: E402

rng = np.random.default_rng(23)
hh = rng.uniform(0.45, 0.9, 10000).astype(np.float32)   # (no sand object in this scene: the spill's own hue range)
pts, hue, _r = spill_points(np, rng, hh, True)
order = rng.permutation(len(pts))[:30000]
out = np.concatenate([pts[order], hue[order, None]], 1).astype("<f4")
dst = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "lab", "sand", "desk-spill.bin"))
out.tofile(dst)
print("SPILL", len(out), "spots ->", dst, "z range", float(pts[:, 2].min()), float(pts[:, 2].max()), flush=True)
sys.exit(0)
```

- [ ] **Step 6: Run the export and check it**

Run:
```bash
LOOKDEV_NO_SAND=1 LOOKDEV_LIST=blender/lookdev/export_spill.py /Applications/Blender.app/Contents/MacOS/Blender --background --python blender/lookdev/lookdev.py -- --scene desk --out "$SCRATCH/x" 2>&1 | grep -E "SPILL|Error"; ls -la public/lab/sand/desk-spill.bin
```
Expected: `SPILL 30000 spots -> .../desk-spill.bin z range -0.0006 0.00x`, file size `480000`.

- [ ] **Step 7: Commit**

```bash
git add blender/lookdev/pallet.py blender/lookdev/export_spill.py blender/lookdev/cinematic_set.py blender/lookdev/bake_pallet.py public/lab/sand/desk-spill.bin && git commit -m "feat(lookdev): pallet.py, one home for the pallet wood and the desk spill; the spill's rest spots exported for the live rising sand

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The shot's camera path

**Files:**
- Create: `blender/lookdev/shot_path.py`
- Output: `public/lab/shot/camera.json`

**Interfaces:**
- Consumes:
  - `public/lab/through/camera.json` (the approved tail: path entries with `position`, `quaternion` (w, x, y, z), `lens_mm`, `lid_open_deg`; `wake_frame` 1-based = 155)
  - `public/lab/pullback/camera.json` (its `lights`)
- Produces: `public/lab/shot/camera.json`
  - frames: `{ frame (1-based), position, quaternion (w, x, y, z), lens_mm, sensor_mm, lid_open_deg, focus_m }`
  - top level: `move: "shot"`, `fps: 24`, `frames: 209`, `units`, `up`, `chaos_center`, `chaos_scale`, `plate_overscan: 1.0`, `wake_frame` (1-based, 154), `screen_from` (0-based, 128), `beats: { ease: [0, 39], tilt: [39, 79], glide: [79, 149], tail: [149, 208] }`, `lights` (copied)

- [ ] **Step 1: Write `blender/lookdev/shot_path.py`**

```python
"""The shot (spec 2026-10-11-scene-order-design.md §3, §9.1): one forward camera move from the hero's framing to the
laptop's screen, in desk metres (Blender z-up). Pure Python (no bpy): run with any python3.

  frames   0-39   ease   the hero framing easing in 4% toward the ball while it forms
          39-79   tilt   in place, down until the ball has left the frame above and the desk fills it
          79-149  glide  down and forward, past the notes, to the approved tail's frame 151 (the lid opening on the way)
         149-208  tail   public/lab/through/camera.json frames 151-210, verbatim (the lid's last degrees, the wake, the push)

  python3 blender/lookdev/shot_path.py            # writes public/lab/shot/camera.json
  python3 blender/lookdev/shot_path.py --check    # and asserts the joins, the direction and the ball leaving the frame
"""
import json
import math
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
THROUGH = os.path.join(ROOT, "public", "lab", "through", "camera.json")
PULLBACK = os.path.join(ROOT, "public", "lab", "pullback", "camera.json")
OUT = os.path.join(ROOT, "public", "lab", "shot", "camera.json")

HERO_POS = (0.0, -0.92, 0.52)        # the hero camera (public/lab/sand/sand.json camera (0, 0.6, 9.5)) in desk metres
HERO_AT = (0.0, 0.03, 0.47)          # its target (0, 0.1, 0)
BALL = (0.0, 0.03, 0.46)             # the ball stays here, above the desk (the hero's centre)
BALL_R = 0.07
EASE_IN = 0.04                       # the ease-in: 4% of the way to the ball
TILT_AT = (0.0, -0.06, 0.0)          # where the tilt ends looking: the desk's front middle (about 32 degrees down)
JOIN = 150                           # the tail's index joined (its frame 151: below the hero's height, the lid at 101)
BEATS = {"ease": (0, 39), "tilt": (39, 79), "glide": (79, 149), "tail": (149, 208)}
BLEND = 15                           # the glide's last frames turn from the look-at to the tail's own orientation


def add(a, b): return tuple(x + y for x, y in zip(a, b))
def sub(a, b): return tuple(x - y for x, y in zip(a, b))
def mul(a, s): return tuple(x * s for x in a)
def dot(a, b): return sum(x * y for x, y in zip(a, b))
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def norm(a): return mul(a, 1.0 / math.sqrt(dot(a, a)))
def lerp(a, b, t): return add(a, mul(sub(b, a), t))
def smoother(t): t = min(max(t, 0.0), 1.0); return t * t * t * (t * (t * 6 - 15) + 10)


def look_quat(pos, at):
    """A Blender camera at `pos` looking at `at`, no roll (it looks down -Z, +Y up): (w, x, y, z)."""
    f = norm(sub(at, pos))
    r = norm(cross(f, (0.0, 0.0, 1.0)))
    u = cross(r, f)
    b = mul(f, -1.0)
    m = ((r[0], u[0], b[0]), (r[1], u[1], b[1]), (r[2], u[2], b[2]))
    tr = m[0][0] + m[1][1] + m[2][2]
    if tr > 0:
        s = math.sqrt(tr + 1.0) * 2
        return (0.25 * s, (m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s)
    if m[0][0] > m[1][1] and m[0][0] > m[2][2]:
        s = math.sqrt(1.0 + m[0][0] - m[1][1] - m[2][2]) * 2
        return ((m[2][1] - m[1][2]) / s, 0.25 * s, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s)
    if m[1][1] > m[2][2]:
        s = math.sqrt(1.0 + m[1][1] - m[0][0] - m[2][2]) * 2
        return ((m[0][2] - m[2][0]) / s, (m[0][1] + m[1][0]) / s, 0.25 * s, (m[1][2] + m[2][1]) / s)
    s = math.sqrt(1.0 + m[2][2] - m[0][0] - m[1][1]) * 2
    return ((m[1][0] - m[0][1]) / s, (m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, 0.25 * s)


def slerp(a, b, t):
    d = dot(a, b)
    if d < 0: b, d = mul(b, -1.0), -d
    if d > 0.9995: return norm(lerp(a, b, t))
    th = math.acos(d)
    return norm(add(mul(a, math.sin((1 - t) * th) / math.sin(th)), mul(b, math.sin(t * th) / math.sin(th))))


def rotate(q, v):
    """Rotate v by the unit quaternion q (w, x, y, z)."""
    w, x, y, z = q
    u = (x, y, z)
    t = mul(cross(u, v), 2.0)
    return add(add(v, mul(t, w)), cross(u, t))


def bezier(p0, p1, p2, p3, t):
    a, b, c = lerp(p0, p1, t), lerp(p1, p2, t), lerp(p2, p3, t)
    return lerp(lerp(a, b, t), lerp(b, c, t), t)


def build():
    th = json.load(open(THROUGH))
    tp = th["path"]
    j = tp[JOIN]
    j_pos, j_q, j_lens = tuple(j["position"]), tuple(j["quaternion"]), j["lens_mm"]
    j_fwd = rotate(j_q, (0.0, 0.0, -1.0))
    j_at = add(j_pos, mul(j_fwd, 0.5))
    p1 = lerp(HERO_POS, BALL, EASE_IN)
    frames = []
    for i in range(BEATS["glide"][1] + 1):
        if i <= BEATS["ease"][1]:
            t = smoother(i / BEATS["ease"][1])
            pos, at, lens = lerp(HERO_POS, p1, t), HERO_AT, 45.0
        elif i <= BEATS["tilt"][1]:
            t = smoother((i - BEATS["tilt"][0]) / (BEATS["tilt"][1] - BEATS["tilt"][0]))
            pos, at, lens = p1, lerp(HERO_AT, TILT_AT, t), 45.0
        else:
            t = smoother((i - BEATS["glide"][0]) / (BEATS["glide"][1] - BEATS["glide"][0]))
            # down and forward: the height only ever falls (control points between the ends)
            c1 = (p1[0], p1[1] + 0.16, p1[2] - 0.012)
            c2 = (j_pos[0], j_pos[1] - 0.14, j_pos[2] + 0.004)
            pos = bezier(p1, c1, c2, j_pos, t)
            at = lerp(TILT_AT, j_at, t)
            lens = 45.0 + (j_lens - 45.0) * t
        q = look_quat(pos, at)
        if i > BEATS["glide"][1] - BLEND:
            q = slerp(q, j_q, smoother((i - (BEATS["glide"][1] - BLEND)) / BLEND))
        # the lid: shut until the glide's last frames, then the tail's own opening (its frames 136-150)
        k = JOIN - (BEATS["glide"][1] - i)
        lid = tp[k]["lid_open_deg"] if i > BEATS["glide"][1] - 15 else 0.0
        frames.append({"frame": i + 1, "position": list(pos), "quaternion": list(q), "lens_mm": lens, "sensor_mm": 36,
                       "lid_open_deg": max(lid, 0.0), "focus_m": math.sqrt(dot(sub(at, pos), sub(at, pos)))})
    frames[-1].update(position=list(j_pos), quaternion=list(j_q), lens_mm=j_lens, lid_open_deg=tp[JOIN]["lid_open_deg"])
    for k in range(JOIN + 1, th["frames"]):
        e = tp[k]
        frames.append({"frame": len(frames) + 1, "position": e["position"], "quaternion": e["quaternion"], "lens_mm": e["lens_mm"],
                       "sensor_mm": 36, "lid_open_deg": e["lid_open_deg"], "focus_m": frames[-1]["focus_m"]})
    off = BEATS["glide"][1] - JOIN   # tail index k -> shot index k + off
    return {
        "move": "shot", "fps": 24, "frames": len(frames), "units": "metres", "up": "z",
        "chaos_center": th["chaos_center"], "chaos_scale": th["chaos_scale"], "plate_overscan": 1.0,
        "wake_frame": th["wake_frame"] + off, "screen_from": 129 + off,
        "beats": {k: list(v) for k, v in BEATS.items()},
        "lights": json.load(open(PULLBACK))["lights"],
        "path": frames,
    }


def check(d):
    P = d["path"]
    assert d["frames"] == 209 and len(P) == 209, d["frames"]
    assert max(abs(a - b) for a, b in zip(P[0]["position"], HERO_POS)) < 1e-9, "starts on the hero framing"
    th = json.load(open(THROUGH))["path"]
    for i, k in ((149, 150), (150, 151), (208, 209)):
        assert max(abs(a - b) for a, b in zip(P[i]["position"], th[k]["position"])) < 1e-9, ("joins the tail", i)
    # forward and down: from the tilt on, the camera never climbs or backs away (0.5 cm tolerance: the tail's wobble)
    for i in range(BEATS["tilt"][0], 208):
        assert P[i + 1]["position"][2] <= P[i]["position"][2] + 0.005, ("climbs", i)
        assert P[i + 1]["position"][1] >= P[i]["position"][1] - 0.005, ("backs away", i)
    # the ball is above the frame's top (16:10, horizontal fit) once the tilt has ended
    q = tuple(P[BEATS["tilt"][1]]["quaternion"]); pos = tuple(P[BEATS["tilt"][1]]["position"])
    inv = (q[0], -q[1], -q[2], -q[3])
    c = rotate(inv, sub(BALL, pos))
    tan_v = 18.0 / P[BEATS["tilt"][1]]["lens_mm"] / 1.6
    assert c[1] / -c[2] - BALL_R / math.sqrt(dot(c, c)) > tan_v, "the ball still in frame after the tilt"
    print("shot ok:", d["frames"], "frames; wake", d["wake_frame"], "; screen from", d["screen_from"])


if __name__ == "__main__":
    d = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(d, open(OUT, "w"))
    print("WROTE", OUT)
    if "--check" in sys.argv:
        check(d)
```

- [ ] **Step 2: Run it with the check**

Run: `python3 blender/lookdev/shot_path.py --check`
Expected:
```
WROTE .../public/lab/shot/camera.json
shot ok: 209 frames; wake 154 ; screen from 128
```
If "climbs" or "backs away" fails, adjust `c1`/`c2` (keep `c1.z <= p1.z` and `c2.z >= j_pos.z`, `c1.y >= p1.y`). If "the ball still in frame" fails, move `TILT_AT` nearer the camera (smaller y) until it passes. Rerun.

- [ ] **Step 3: Commit**

```bash
git add blender/lookdev/shot_path.py public/lab/shot/camera.json && git commit -m "feat: the shot's camera path (hero framing, ease-in, tilt, forward glide, the approved tail), with its checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The shot's preview render (Liam's gate)

**Files:**
- Create: `blender/lookdev/shot_preview.py`
- Output: `blender/lookdev/renders/review/shot-preview.mp4`

**Interfaces:**
- Consumes: `public/lab/shot/camera.json` (Task 3), `pallet.swap_pallet` (Task 2)
- Produces: a reviewable clip. **Do not start Task 9 until Liam approves it.** Framing changes go back into `shot_path.py`'s constants (Task 3), then this task reruns.

- [ ] **Step 1: Write `blender/lookdev/shot_preview.py`**

```python
"""The shot over the pallet desk in Cycles, for Liam's approval before it is wired live (spec §9.1). Every 2nd frame,
960x600, 32 samples; a stand-in ball (matte, the sand's mid tone) where the ball stays; the lid and the screen follow
the path. Runs through lookdev.py's hook on the desk scene:

  LOOKDEV_NO_SAND=1 LOOKDEV_LIST=blender/lookdev/shot_preview.py /Applications/Blender.app/Contents/MacOS/Blender \
    --background --python blender/lookdev/lookdev.py -- --scene desk --out /tmp/x
Writes blender/lookdev/renders/shot-preview/f_NNNN.png; then ffmpeg makes the clip (Step 2)."""
import json
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pallet import srgb, swap_pallet  # noqa: E402

scene = bpy.context.scene
swap_pallet()
d = json.load(open(os.path.join(HERE, "..", "..", "public", "lab", "shot", "camera.json")))
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, location=(0.0, 0.03, 0.46), segments=48, ring_count=24)
ball = bpy.context.active_object; ball.name = "ball_standin"
m = bpy.data.materials.new("ball_standin"); m.use_nodes = True
m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = srgb("#bf8a78")
m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.6
ball.data.materials.append(m)
cam = scene.camera
cam.rotation_mode = "QUATERNION"
cam.data.dof.use_dof = True
cam.data.dof.aperture_fstop = 2.0
hinge = bpy.data.objects.get("hinge")
display = bpy.data.materials.get("display")
out = os.path.join(HERE, "renders", "shot-preview")
os.makedirs(out, exist_ok=True)
scene.render.resolution_x, scene.render.resolution_y = 960, 600
scene.cycles.samples = 32
for i in range(0, d["frames"], 2):
    fr = d["path"][i]
    cam.location = fr["position"]
    cam.rotation_quaternion = fr["quaternion"]
    cam.data.lens = fr["lens_mm"]
    cam.data.dof.focus_distance = fr["focus_m"]
    if hinge:
        hinge.rotation_euler.x = math.radians(90.0 - fr["lid_open_deg"])
    if display:
        display.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 1.1 if i + 1 >= d["wake_frame"] else 0.0
    scene.render.filepath = os.path.join(out, f"f_{i // 2 + 1:04d}.png")
    bpy.ops.render.render(write_still=True)
    print("SHOT frame", i + 1, flush=True)
sys.exit(0)
```

- [ ] **Step 2: Render and make the clip**

Run (about 20–30 min; run it in the background):
```bash
rm -rf blender/lookdev/renders/shot-preview; LOOKDEV_NO_SAND=1 LOOKDEV_LIST=blender/lookdev/shot_preview.py /Applications/Blender.app/Contents/MacOS/Blender --background --python blender/lookdev/lookdev.py -- --scene desk --out "$SCRATCH/x" > "$SCRATCH/shot-preview.log" 2>&1; grep -c "SHOT frame" "$SCRATCH/shot-preview.log"
ffmpeg -y -loglevel error -framerate 12 -i blender/lookdev/renders/shot-preview/f_%04d.png -vf "vignette=PI/6,colorlevels=romin=0.043:gomin=0.035:bomin=0.031" -pix_fmt yuv420p blender/lookdev/renders/review/shot-preview.mp4 && ls -la blender/lookdev/renders/review/shot-preview.mp4
```
Expected: `105` frames, then the mp4.

Check these frames yourself before sending:
- frame 1: the hero framing, the stand-in ball centred
- frame 40: the ball a touch larger
- frame 80: the ball gone above the frame, the lamp's pool on the desk ahead
- around frame 115: the yellow "Who is this product for?" note readable in passing
- frame 150: the lid opening
- frame 209: the screen filling the view

- [ ] **Step 3: Send it to Liam and wait for approval**

Send the clip with `SendUserFile` (status `normal`) and one line per beat (frames as above). Ask: "Does the shot's framing work, especially the pass over the notes?"

Apply framing notes in `shot_path.py`:
- `TILT_AT`
- the glide's `c1`/`c2`
- `EASE_IN`

Then rerun Task 3's step 2 and this task's step 2 until he approves.

- [ ] **Step 4: Commit**

```bash
git add blender/lookdev/shot_preview.py && git commit -m "feat(lookdev): the shot's Cycles preview over the pallet desk (Liam's approval before the live wiring)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(Do not commit `renders/shot-preview/` frames; the mp4 under `renders/review/` is untracked review output.)

---

### Task 5: The story timeline module

**Files:**
- Create: `src/three/sand/story-timeline.ts`, `src/three/sand/story-timeline.test.ts`

**Interfaces:**
- Produces:
  - `BEATS` (readonly record of `[from, to]` in screens)
  - `STORY_SCREENS = 4.3`
  - `span(p, [a, b])`, `ease(t, [a, b])` (smootherstep)
  - `interface ShotBeats { ease, tilt, glide, tail: [number, number] }`
  - `interface ShotMeta { frames: number; wake_frame: number; screen_from: number; beats: ShotBeats }`
  - `shotFrame(p, beats): number` (0-based fractional frame)
  - `pAtFrame(f, beats): number`
  - `reducedStory(p): { p: number; veil: number }`

- [ ] **Step 1: Write the failing tests**

```ts
// src/three/sand/story-timeline.test.ts
import { describe, expect, test } from "vitest";
import { BEATS, STORY_SCREENS, ease, pAtFrame, reducedStory, shotFrame, span, type ShotBeats } from "./story-timeline";

const SHOT: ShotBeats = { ease: [0, 39], tilt: [39, 79], glide: [79, 149], tail: [149, 208] };

describe("story timeline", () => {
  test("the beats run in order, in screens, and end with the story", () => {
    expect(BEATS.hero[1]).toBeLessThanOrEqual(BEATS.compact[0]);
    expect(BEATS.compact[1]).toBeLessThanOrEqual(BEATS.hold[1]);
    expect(BEATS.hold[1]).toBeLessThanOrEqual(BEATS.tilt[0]);
    expect(BEATS.tilt[1]).toBeLessThanOrEqual(BEATS.glide[0]);
    expect(BEATS.glide[1]).toBeLessThanOrEqual(BEATS.tail[0]);
    expect(BEATS.indexIn[1]).toBe(STORY_SCREENS);
  });

  test("the hero copy is gone by the time the ball locks in", () => {
    expect(BEATS.copyOut[1]).toBeLessThanOrEqual(BEATS.compact[1]);
    expect(BEATS.copyOut[0]).toBeGreaterThanOrEqual(BEATS.compact[0]);
  });

  test("the desk headline arrives with the desk and leaves before the laptop", () => {
    expect(BEATS.headlineIn[0]).toBeGreaterThanOrEqual(BEATS.tilt[1] - 0.1);
    expect(BEATS.headlineOut[1]).toBeLessThanOrEqual(BEATS.tail[0]);
  });

  test("span and ease clamp to 0..1", () => {
    expect(span(-1, [0, 1])).toBe(0);
    expect(span(2, [0, 1])).toBe(1);
    expect(ease(0.5, [0, 1])).toBeCloseTo(0.5);
    expect(ease(5, [0, 1])).toBe(1);
  });

  test("the shot's frame: the hero on frame 0, held between beats, the tail's last frame at the end", () => {
    expect(shotFrame(0, SHOT)).toBe(0);
    expect(shotFrame(BEATS.compact[1], SHOT)).toBe(39);
    expect(shotFrame((BEATS.hold[0] + BEATS.hold[1]) / 2, SHOT)).toBe(39);
    expect(shotFrame(BEATS.tilt[1], SHOT)).toBe(79);
    expect(shotFrame(BEATS.tail[1], SHOT)).toBe(208);
    expect(shotFrame(99, SHOT)).toBe(208);
  });

  test("the shot's frame never runs backwards", () => {
    let prev = -1;
    for (let p = 0; p <= STORY_SCREENS; p += 0.005) {
      const f = shotFrame(p, SHOT);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });

  test("pAtFrame inverts shotFrame", () => {
    for (const f of [0, 20, 39, 60, 79, 120, 149, 180, 208]) expect(shotFrame(pAtFrame(f, SHOT), SHOT)).toBeCloseTo(f, 5);
  });

  test("reduced motion: held states (cloud, ball, desk, index) joined by crossfades through black", () => {
    expect(reducedStory(0)).toEqual({ p: 0, veil: 0 });
    const ball = reducedStory(1.5), desk = reducedStory(2.9), index = reducedStory(STORY_SCREENS);
    expect(ball.p).toBe(BEATS.hold[0]);
    expect(desk.p).toBeGreaterThanOrEqual(BEATS.headlineIn[1]);
    expect(desk.p).toBeLessThanOrEqual(BEATS.headlineOut[0]);
    expect(index.p).toBe(STORY_SCREENS);
    expect(ball.veil + desk.veil + index.veil).toBe(0);
    for (const cut of [0.9, 2.2, 3.5]) expect(reducedStory(cut).veil).toBeCloseTo(1);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/three/sand/story-timeline.test.ts`
Expected: FAIL (`Cannot find module './story-timeline'`).

- [ ] **Step 3: Write the module**

```ts
// src/three/sand/story-timeline.ts
/**
 * The hero page's story in screens scrolled (spec docs/superpowers/specs/2026-10-11-scene-order-design.md §3): the
 * hero; the ball forming in place (the camera easing in); a hold; one forward shot (tilt down, glide over the desk,
 * the laptop and the push into the screen); the index.
 */
export const BEATS = {
  hero: [0, 0.4],
  compact: [0.4, 1.6],
  copyOut: [0.45, 1.45],
  hold: [1.6, 1.8],
  tilt: [1.8, 2.4],
  glide: [2.4, 3.2],
  headlineIn: [2.35, 2.65],
  headlineOut: [2.95, 3.2],
  tail: [3.2, 4.2],
  takeover: [4.12, 4.2],
  indexIn: [4.2, 4.3],
} as const satisfies Record<string, readonly [number, number]>;

/** Where the story ends and the index's own scrolling begins (screens). */
export const STORY_SCREENS = 4.3;

export const span = (p: number, [a, b]: readonly [number, number]) => Math.min(Math.max((p - a) / (b - a), 0), 1);

/** smootherstep of t over [a, b] (Blender's ease in lookdev.py). */
export function ease(t: number, r: readonly [number, number]): number {
  const x = span(t, r);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export interface ShotBeats { ease: [number, number]; tilt: [number, number]; glide: [number, number]; tail: [number, number] }
/** public/lab/shot/camera.json's own fields (blender/lookdev/shot_path.py). */
export interface ShotMeta { frames: number; wake_frame: number; screen_from: number; beats: ShotBeats }

const segments = (b: ShotBeats): [readonly [number, number], [number, number]][] => [
  [BEATS.compact, b.ease], [BEATS.tilt, b.tilt], [BEATS.glide, b.glide], [BEATS.tail, b.tail],
];

/** Progress (screens) -> the shot's frame (0-based, fractional). Between beats it holds the last one's end. */
export function shotFrame(p: number, b: ShotBeats): number {
  let f = b.ease[0];
  for (const [[p0, p1], [f0, f1]] of segments(b)) {
    if (p <= p0) return f;
    if (p <= p1) return f0 + (f1 - f0) * ((p - p0) / (p1 - p0));
    f = f1;
  }
  return f;
}

/** The progress that shows frame f (calibration: ?shotframe=N). */
export function pAtFrame(f: number, b: ShotBeats): number {
  for (const [[p0, p1], [f0, f1]] of segments(b)) if (f <= f1) return p0 + (p1 - p0) * ((f - f0) / (f1 - f0));
  return BEATS.tail[1];
}

/** Reduced motion (spec §8): held states (the cloud, the ball, the desk with its headline, the index), each cut a
 *  short crossfade through black (veil 0..1..0 over 0.2 screens), the scene switching at the veil's peak. */
const HELD = [0, BEATS.hold[0], (BEATS.headlineIn[1] + BEATS.headlineOut[0]) / 2, STORY_SCREENS];
const CUTS = [0.9, 2.2, 3.5];
export function reducedStory(p: number): { p: number; veil: number } {
  let state = 0, veil = 0;
  CUTS.forEach((c, i) => {
    if (p >= c) state = i + 1;
    veil = Math.max(veil, 1 - Math.min(Math.abs(p - c) / 0.1, 1));
  });
  return { p: HELD[state], veil };
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/three/sand/story-timeline.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/three/sand/story-timeline.ts src/three/sand/story-timeline.test.ts && git commit -m "feat: the story's timeline in screens (beats, the shot's frame, reduced motion's held states)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The rising sand's motion (pure, tested)

**Files:**
- Create: `src/three/sand/rising.ts`, `src/three/sand/rising.test.ts`

**Interfaces:**
- Produces:
  - `RISE` constants
  - `RISE_GLSL` (GLSL functions `risePhase`, `riseLift`, `riseAlpha`, `risePos`; it needs `uDeskY` passed in)
  - TS mirrors: `rNoise(x, z)`, `grainAt(rest: [x, y, z], seed: [a, b, c, d], t): { cycle, lift, alpha, pos: [x, y, z] }`
  - `spillToHero(raw: Float32Array, c: [number, number, number], k: number): Float32Array` (x, y, z, hue per spot, hero units, three y-up)

- [ ] **Step 1: Write the failing tests**

```ts
// src/three/sand/rising.test.ts
import { describe, expect, test } from "vitest";
import { RISE, grainAt, rNoise, spillToHero } from "./rising";

const seeds = (n: number) => Array.from({ length: n }, (_, i) => [((i * 0.6180339) % 1), ((i * 0.4142135) % 1), ((i * 0.7320508) % 1), ((i * 0.2360679) % 1)] as [number, number, number, number]);

describe("rising sand", () => {
  test("a grain fades out at the top and grows back in at rest: never a pop at the cycle's turn", () => {
    const rest: [number, number, number] = [1.2, -4.6, -0.8], seed: [number, number, number, number] = [0.3, 0.7, 0.4, 0.5];
    for (let t = 0; t < 200; t += 0.01) {
      const a = grainAt(rest, seed, t), b = grainAt(rest, seed, t + 0.01);
      if (a.cycle !== b.cycle) {
        expect(a.alpha).toBeLessThan(0.02);
        expect(b.alpha).toBeLessThan(0.05);
      }
    }
  });

  test("it rests on its spot, then only rises, faster as it climbs", () => {
    const rest: [number, number, number] = [0, -4.6, 0], seed: [number, number, number, number] = [0.5, 0.5, 0.5, 0.5];
    let prev = grainAt(rest, seed, 0), prevStep = 0;
    for (let t = 0.05; t < 60; t += 0.05) {
      const g = grainAt(rest, seed, t);
      if (g.cycle === prev.cycle) {
        expect(g.lift).toBeGreaterThanOrEqual(prev.lift);
        if (g.lift > 0.05 && prev.lift > 0.05) { expect(g.lift - prev.lift).toBeGreaterThanOrEqual(prevStep - 1e-6); prevStep = g.lift - prev.lift; }
      } else prevStep = 0;
      if (g.lift === 0) expect(g.pos[1]).toBeCloseTo(rest[1], 6);
      prev = g;
    }
  });

  test("never all at once: between a fifth and a half of the desk is in the air at any moment", () => {
    const S = seeds(3000);
    for (const t of [0, 7.3, 31, 120, 999]) {
      let up = 0;
      S.forEach((s, i) => { if (grainAt([((i * 37) % 120) / 10 - 6, -4.6, ((i * 53) % 60) / 10 - 3], s, t).lift > 0) up++; });
      expect(up / S.length).toBeGreaterThan(0.2);
      expect(up / S.length).toBeLessThan(0.5);
    }
  });

  test("waves: grains close together lift close together, far apart they don't", () => {
    const s: [number, number, number, number] = [0.5, 0.5, 0.5, 0.5];
    const near = Math.abs(rNoise(1.0, 1.0) - rNoise(1.05, 1.0));
    const far = Math.abs(rNoise(1.0, 1.0) - rNoise(4.0, -2.0));
    expect(near).toBeLessThan(0.05);
    expect(far).toBeGreaterThan(near);
    // two grains 0.1 apart start lifting within a few seconds of each other
    const startOf = (x: number) => { for (let t = 0; t < 40; t += 0.02) if (grainAt([x, -4.6, 0], s, t).lift > 0) return t; return 40; };
    expect(Math.abs(startOf(2.0) - startOf(2.1))).toBeLessThan(3);
  });

  test("hours in: still smooth, no jumps in view", () => {
    const rest: [number, number, number] = [0.4, -4.6, 1.1], seed: [number, number, number, number] = [0.2, 0.9, 0.1, 0.6];
    for (let t = 100000; t < 100030; t += 1 / 60) {
      const a = grainAt(rest, seed, t), b = grainAt(rest, seed, t + 1 / 60);
      if (a.cycle === b.cycle && a.alpha > 0.05) expect(Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2])).toBeLessThan(0.5);
    }
  });

  test("the spill's spots in the hero's units: the ball's place is the origin, the desk 4.6 below", () => {
    const raw = new Float32Array([0, 0.03, 0.46, 0.5, 0.1, -0.07, 0, 0.7]);
    const h = spillToHero(raw, [0, 0.03, 0.46], 0.1);
    expect(Array.from(h.slice(0, 4))).toEqual([0, 0, 0, 0.5]);
    expect(h[4]).toBeCloseTo(1); expect(h[5]).toBeCloseTo(-4.6); expect(h[6]).toBeCloseTo(1); expect(h[7]).toBeCloseTo(0.7);
    expect(RISE.height).toBeGreaterThan(4.6);   // they rise past the ball's height, out of frame
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/three/sand/rising.test.ts`
Expected: FAIL (`Cannot find module './rising'`).

- [ ] **Step 3: Write the module**

```ts
// src/three/sand/rising.ts
/**
 * The rising sand's motion (spec 2026-10-11-scene-order-design.md §5): grains resting on the desk lift as if gravity
 * worked upward, toward the ball above, out of frame; in waves (a slow noise field over the desk sets each region's
 * timing), each grain at its own pace; endless. Stateless: a grain's place is a function of its rest spot, four seeds
 * and time, so the vertex shader computes it (RISE_GLSL) and these TS mirrors test it. The two agree in form, not to
 * the last bit (JS doubles, GLSL floats).
 *
 * A grain's life: rest (its share of the cycle, 50-75%), then lift (slow, then faster: pow(a, 1.8..2.8)), fading as it
 * nears the ball's height; the next life grows in from nothing a little way from the last spot (cracks: along the crack).
 */
export const RISE = {
  periodMin: 10, periodMax: 20,   // seconds per life, by region
  restMin: 0.5, restMax: 0.75,    // the share of a life at rest
  growIn: 0.1,                    // the share of a life growing in (1-2 s)
  fadeFrom: 0.8,                  // the lift past which it fades
  height: 6.0,                    // hero units it rises (the desk is 4.6 below the ball)
  sway: 0.25,                     // hero units of sideways drift at the top
  jitter: 0.2,                    // hero units between one life's spot and the next
  waveScale: 0.35,                // the timing field's scale (per hero unit): a few regions across the desk
  offsetScale: 0.6,
} as const;

const f = (v: number) => v.toFixed(4);
export const RISE_GLSL = /* glsl */ `
float rHash(float n) { return fract(sin(n) * 43758.5453123); }
float rNoise(vec2 p) {
  vec2 i = floor(p), q = fract(p);
  vec2 u = q * q * (3.0 - 2.0 * q);
  float a = rHash(dot(i, vec2(127.1, 311.7)));
  float b = rHash(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7)));
  float c = rHash(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7)));
  float d = rHash(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7)));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// x: which life, y: how far through it (0..1)
vec2 risePhase(vec4 rest, vec4 seed, float t) {
  float n1 = rNoise(rest.xz * ${f(RISE.waveScale)});
  float n2 = rNoise(rest.xz * ${f(RISE.offsetScale)} + vec2(17.3, -4.1));
  float period = mix(${f(RISE.periodMin)}, ${f(RISE.periodMax)}, n1) * (1.0 + 0.08 * (seed.x * 2.0 - 1.0));
  float ph = t / period + 0.9 * n2 + 0.15 * seed.y;
  return vec2(floor(ph), fract(ph));
}
float riseLift(vec4 seed, float u) {
  float restShare = mix(${f(RISE.restMin)}, ${f(RISE.restMax)}, seed.z);
  float a = clamp((u - restShare) / (1.0 - restShare), 0.0, 1.0);
  return pow(a, 1.8 + seed.w);
}
float riseAlpha(vec4 rest, vec4 seed, float t) {
  vec2 ph = risePhase(rest, seed, t);
  return smoothstep(0.0, ${f(RISE.growIn)}, ph.y) * (1.0 - smoothstep(${f(RISE.fadeFrom)}, 1.0, riseLift(seed, ph.y)));
}
vec3 risePos(vec4 rest, vec4 seed, float t, float deskY) {
  vec2 ph = risePhase(rest, seed, t);
  float lift = riseLift(seed, ph.y);
  vec2 j = (vec2(rHash(seed.x * 91.7 + ph.x * 13.13), rHash(seed.y * 53.3 + ph.x * 7.77)) - 0.5) * ${f(RISE.jitter)};
  if (rest.y < deskY - 1e-4) j.y = 0.0;   // in a plank's crack: only along it
  float sway = lift * ${f(RISE.sway)};
  return vec3(rest.x + j.x + sin(t * 0.7 + seed.x * 6.2831) * sway, rest.y + lift * ${f(RISE.height)}, rest.z + j.y + cos(t * 0.6 + seed.y * 6.2831) * sway);
}
`;

const fract = (x: number) => x - Math.floor(x);
const rHash = (n: number) => fract(Math.sin(n) * 43758.5453123);
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

export function rNoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), qx = x - ix, qz = z - iz;
  const ux = qx * qx * (3 - 2 * qx), uz = qz * qz * (3 - 2 * qz);
  const h = (a: number, b: number) => rHash(a * 127.1 + b * 311.7);
  const a = h(ix, iz), b = h(ix + 1, iz), c = h(ix, iz + 1), d = h(ix + 1, iz + 1);
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uz;
}

export function grainAt(rest: [number, number, number], seed: [number, number, number, number], t: number, deskY = rest[1]) {
  const n1 = rNoise(rest[0] * RISE.waveScale, rest[2] * RISE.waveScale);
  const n2 = rNoise(rest[0] * RISE.offsetScale + 17.3, rest[2] * RISE.offsetScale - 4.1);
  const period = (RISE.periodMin + (RISE.periodMax - RISE.periodMin) * n1) * (1 + 0.08 * (seed[0] * 2 - 1));
  const ph = t / period + 0.9 * n2 + 0.15 * seed[1];
  const cycle = Math.floor(ph), u = ph - cycle;
  const restShare = RISE.restMin + (RISE.restMax - RISE.restMin) * seed[2];
  const a = Math.min(Math.max((u - restShare) / (1 - restShare), 0), 1);
  const lift = Math.pow(a, 1.8 + seed[3]);
  const alpha = smoothstep(0, RISE.growIn, u) * (1 - smoothstep(RISE.fadeFrom, 1, lift));
  const jx = (rHash(seed[0] * 91.7 + cycle * 13.13) - 0.5) * RISE.jitter;
  const jz = rest[1] < deskY - 1e-4 ? 0 : (rHash(seed[1] * 53.3 + cycle * 7.77) - 0.5) * RISE.jitter;
  const sway = lift * RISE.sway;
  const pos: [number, number, number] = [
    rest[0] + jx + Math.sin(t * 0.7 + seed[0] * 6.2831) * sway,
    rest[1] + lift * RISE.height,
    rest[2] + jz + Math.cos(t * 0.6 + seed[1] * 6.2831) * sway,
  ];
  return { cycle, lift, alpha, pos };
}

/** desk-spill.bin (x, y, z, hue in desk metres, Blender z-up) -> hero units, three y-up (Pullback.toHero). */
export function spillToHero(raw: Float32Array, c: [number, number, number], k: number): Float32Array {
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i += 4) {
    const x = (raw[i] - c[0]) / k, y = (raw[i + 1] - c[1]) / k, z = (raw[i + 2] - c[2]) / k;
    out[i] = x; out[i + 1] = z; out[i + 2] = -y; out[i + 3] = raw[i + 3];
  }
  return out;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/three/sand/rising.test.ts`
Expected: PASS (6 tests).

If "never all at once" fails on the upper bound, raise `RISE.restMin`/`restMax` by 0.05 and rerun; on the lower bound, lower them. If "a pop at the cycle's turn" fails, lower `fadeFrom` by 0.05.

- [ ] **Step 5: Commit**

```bash
git add src/three/sand/rising.ts src/three/sand/rising.test.ts && git commit -m "feat: the rising sand's motion (waves by region, own pace, endless, never a pop), tested

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Shared loose-grain shader; the RisingSand system

**Files:**
- Create: `src/three/sand/loose-grain.ts`, `src/three/sand/rising-sand.ts`
- Modify: `src/three/sand/drift-grains.ts:21-165` (the VERTEX string) and `:242-276` (attributes, uniforms)

**Interfaces:**
- Consumes: `RISE_GLSL`, `spillToHero` (Task 6); `SAND_FRAGMENT` (`src/three/sand/shaders.ts`)
- Produces:
  - `looseGrainVertex(decl: string, locals: string): string`
  - `looseGrainUniforms(sand: THREE.ShaderMaterial): Record<string, THREE.IUniform>`
  - `class RisingSand { mesh; material; constructor(sand, spots: Float32Array, count: number); update(time, on, deskY, grainR): void; dispose(): void; static loadSpots(url, c, k): Promise<Float32Array> }`

- [ ] **Step 1: Capture the floating grains before the refactor (regression reference)**

With the dev server on 3100, run:
```bash
node "$SCRATCH/hero-shot.mjs" "$PWD" "$SCRATCH/drift-before.png"
```
(`hero-shot.mjs`: Appendix A. It loads `?hero&tier=high&still` and screenshots the hero after 4 s.)

- [ ] **Step 2: Create `src/three/sand/loose-grain.ts`**

Move into it, verbatim from `drift-grains.ts`:
- lines 27–79 (the uniforms and outs) as `const LOOSE_UNIFORMS`
- lines 80–97 (`ramp`, `density`, `transmittance`) as `const LOOSE_FUNCS`
- lines 99–163 (the body of `main()`, without the braces) as `const LOOSE_BODY`

Then add:

```ts
import * as THREE from "three";

/**
 * Loose grains (the floating grains, the rising sand) drawn and lit as the sand's own: one vertex shader (light through
 * the sand's density volumes, the cursor's light and drift, motion blur, the pebble's shape) feeding the sand's fragment
 * shader. Each system declares its inputs (`decl`) and computes the four locals the body reads (`locals`):
 *   vec3 iPos (world), vec3 iVel (world / s), vec2 iSizeHue (radius, hue), float iSeed.
 */
export function looseGrainVertex(decl: string, locals: string): string {
  return `precision highp float;\n${decl}\n${LOOSE_UNIFORMS}\n${LOOSE_FUNCS}\nvoid main() {\n${locals}\n${LOOSE_BODY}\n}\n`;
}

/** The sand's own uniforms, shared (its palette, lights, material, cursor, drift field, grain look, shadows). */
export function looseGrainUniforms(sand: THREE.ShaderMaterial): Record<string, THREE.IUniform> {
  const su = sand.uniforms;
  return {
    uRamp: su.uRamp, uRampAt: su.uRampAt,
    uLightPos: su.uLightPos, uLightCol: su.uLightCol, uLightR2: su.uLightR2, uSpotDir: su.uSpotDir, uSpotCos: su.uSpotCos,
    uCursorPos: su.uCursorPos, uCursorCol: su.uCursorCol, uCursorReach: su.uCursorReach,
    uExposure: su.uExposure, uOutScale: su.uOutScale, uWrap: su.uWrap, uGapFill: su.uGapFill, uRough: su.uRough,
    uBounce: su.uBounce, uGroundCol: su.uGroundCol, uFillCol: su.uFillCol, uFrontKey: su.uFrontKey, uUpView: su.uUpView,
    uSpec: su.uSpec, uGloss: su.uGloss, uSSS: su.uSSS, uLampSat: su.uLampSat,
    uShutter: su.uShutter, uMotionBlur: su.uMotionBlur, uPointScale: su.uPointScale, uMinPx: su.uMinPx, uEdge: su.uEdge,
    uGround: su.uGround, uPaint: su.uPaint, uPaintScale: su.uPaintScale, uViewport: su.uViewport, uBufH: su.uBufH,
    uLo: su.uLo, uSize: su.uSize, uVolA: su.uVolA, uVolB: su.uVolB, uVolMix: su.uVolMix, uSigmaMax: su.uSigmaMax,
    uShadowK: su.uShadowK, uCompact: su.uCompact, uChaosC: su.uChaosC, uChaosRot: su.uChaosRot, uBallC: su.uBallC,
    uBallVolC: su.uBallVolC, uBallVolS: su.uBallVolS, uBallRot: su.uBallRot, uGrainShadow: { value: 1 },
  };
}
```

- [ ] **Step 3: Make drift-grains.ts use it**

Replace the `const VERTEX = ...` string with:
```ts
const VERTEX = looseGrainVertex(
  "in vec3 aPos;\nin vec3 aVel;\nin vec2 aSizeHue;\nin float aSeed;",
  "  vec3 iPos = aPos; vec3 iVel = aVel; vec2 iSizeHue = aSizeHue; float iSeed = aSeed;",
);
```

Rename the geometry attributes:
- `geo.setAttribute("iPos", ...)` → `"aPos"`
- `"iVel"` → `"aVel"`
- `"iSizeHue"` → `"aSizeHue"`
- `"iSeed"` → `"aSeed"`

Replace the material's `uniforms: { ... }` object with `uniforms: looseGrainUniforms(sand),` and delete the now-unused `const su = sand.uniforms;`. Add `import { looseGrainUniforms, looseGrainVertex } from "./loose-grain";`.

- [ ] **Step 4: Check the floating grains are unchanged**

Run: `npx tsc --noEmit -p . && node "$SCRATCH/hero-shot.mjs" "$PWD" "$SCRATCH/drift-after.png" && ffmpeg -loglevel error -i "$SCRATCH/drift-before.png" -i "$SCRATCH/drift-after.png" -lavfi "ssim" -f null - 2>&1 | tail -1`
Expected: no type errors; SSIM `All:` ≥ 0.97 (`?still` freezes ambient motion; the grain noise differs slightly). The browser console shows no GLSL errors (`read_console_messages` with `onlyErrors`).

- [ ] **Step 5: Create `src/three/sand/rising-sand.ts`**

```ts
import * as THREE from "three";
import { looseGrainUniforms, looseGrainVertex } from "./loose-grain";
import { RISE_GLSL, spillToHero } from "./rising";
import { SAND_FRAGMENT } from "./shaders";

const DECL = `
in vec4 aRest;     // a resting spot on the desk (hero units) and its hue
in vec4 aSeed;     // four randoms
uniform float uRiseTime;
uniform float uRiseOn;
uniform float uDeskY;
uniform float uGrainR;
${RISE_GLSL}`;
const LOCALS = `
  vec3 iPos = risePos(aRest, aSeed, uRiseTime, uDeskY);
  vec3 iVel = (iPos - risePos(aRest, aSeed, uRiseTime - 1.0 / 60.0, uDeskY)) * 60.0;
  vec2 iSizeHue = vec2(uGrainR * mix(0.7, 1.3, aSeed.w) * riseAlpha(aRest, aSeed, uRiseTime) * uRiseOn, aRest.w);
  float iSeed = aSeed.x;`;

/**
 * The sand on the desk, pulled upward toward the ball above (spec 2026-10-11 §5): the look-dev spill's spots
 * (public/lab/sand/desk-spill.bin), each grain resting, lifting, fading near the ball's height and growing back in at
 * rest, on its own clock (rising.ts). Drawn and lit as the sand's own grains (loose-grain.ts, SAND_FRAGMENT), in its
 * layer (the lens, the shadows). Nothing on the CPU per frame but four uniforms.
 */
export class RisingSand {
  readonly mesh: THREE.Points;
  readonly material: THREE.ShaderMaterial;

  /** `spots`: hero units, 4 floats each (x, y, z, hue), in random order; the first `count` are drawn. */
  constructor(sand: THREE.ShaderMaterial, spots: Float32Array, count: number) {
    const n = Math.min(count, spots.length / 4);
    const geo = new THREE.BufferGeometry();
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));   // (three needs one)
    geo.setAttribute("aRest", new THREE.BufferAttribute(spots.slice(0, n * 4), 4));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: looseGrainVertex(DECL, LOCALS),
      fragmentShader: SAND_FRAGMENT,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      alphaToCoverage: true,
      uniforms: { ...looseGrainUniforms(sand), uRiseTime: { value: 0 }, uRiseOn: { value: 0 }, uDeskY: { value: 0 }, uGrainR: { value: 0.004 } },
    });
    this.mesh = new THREE.Points(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** `time` seconds (ambient), `on` 0..1 (0: none drawn), `deskY` the desk top (hero units), `grainR` the sand's grain radius. */
  update(time: number, on: number, deskY: number, grainR: number): void {
    const u = this.material.uniforms;
    u.uRiseTime.value = time; u.uRiseOn.value = on; u.uDeskY.value = deskY; u.uGrainR.value = grainR;
    this.mesh.visible = on > 0.001;
  }

  static async loadSpots(url: string, c: [number, number, number], k: number): Promise<Float32Array> {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return spillToHero(new Float32Array(await r.arrayBuffer()), c, k);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
```

- [ ] **Step 6: Type-check and commit**

Run: `npx tsc --noEmit -p . && npx vitest run src/three`
Expected: no errors; all tests pass.

```bash
git add src/three/sand/loose-grain.ts src/three/sand/drift-grains.ts src/three/sand/rising-sand.ts && git commit -m "feat: one loose-grain shader for the floating grains and the rising sand; the RisingSand system

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The hero light's spill on the desk

**Files:**
- Modify: `src/three/sand/baked-desk.ts:169-180` (VIEW), `:330` (uniform declarations), `:354-358` (the lights patch), `:536-537` (view-space update), and add `setSpill` beside `setBallShadow` (`:552`)

**Interfaces:**
- Produces: `BakedDesk.setSpill(centre: THREE.Vector3 /* world, hero units */, radius: number, gain: THREE.Vector3): void`, which brightens the baked light in a soft pool (gain 0 = off).

- [ ] **Step 1: Add the uniforms**

In `VIEW` (line 169), add:
```ts
  uSpillC: { value: new THREE.Vector3() }, uSpillR: { value: 1 }, uSpillK: { value: new THREE.Vector3() },   // the hero light from above (spec §8)
```
Add a field to the class: `private readonly spill = { centre: new THREE.Vector3() };`.

In the declarations string at line 330, append `uniform vec3 uSpillC;\nuniform float uSpillR;\nuniform vec3 uSpillK;\n` to the existing string.

- [ ] **Step 2: Add the pool to the lights patch**

In the `#include <lights_physical_fragment>` replacement, before the final `#include <lights_physical_fragment>`, add:
```glsl
        {
          // the hero light, still on the ball above, spilling down onto the desk: a soft warm pool (the baked light, brighter)
          float ds = length(-vViewPosition - uSpillC) / max(uSpillR, 1e-4);
          totalEmissiveRadiance *= vec3(1.0) + uSpillK * exp(-ds * ds);
        }
```

- [ ] **Step 3: Keep the pool's centre in view space, and add the setter**

Next to `VIEW.uShBall.value.copy(this.shadow.ball).applyMatrix4(v);` (line 536), add:
```ts
    VIEW.uSpillC.value.copy(this.spill.centre).applyMatrix4(v);
```
After `setBallShadow`, add:
```ts
  /** The hero light's pool on the desk: `centre` (world, hero units), `radius` (hero units), `gain` per channel (0 = off). */
  setSpill(centre: THREE.Vector3, radius: number, gain: THREE.Vector3): void {
    this.spill.centre.copy(centre);
    VIEW.uSpillR.value = radius;
    VIEW.uSpillK.value.copy(gain);
    this.viewStamp = -1;
  }
```

- [ ] **Step 4: Type-check and commit**

Run: `npx tsc --noEmit -p .`
Expected: no errors. (Its effect is checked visually in Task 9.)

```bash
git add src/three/sand/baked-desk.ts && git commit -m "feat: the desk takes a soft pool of the hero light from the ball above

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Wire the new story into the page

**Files:**
- Modify: `src/app/lab/sand/sand-lab.tsx`. Replace:
  - `:30-86` (TL, SCROLL_KEYS, PAGE_VH, progressAt, THROUGH_KEYS, throughFrame, WAKE_FRAME)
  - `:101-106` (local `ease`/`span`)
  - `:127-133` (the copy readers)
  - `:210-225` (loads)
  - `:235-240` (attempts and cloud state)
  - `:287`, `:297` (`desk`/`deskBall` from the shot), `:309-315` (calibration hooks on the old paths)
  - `:472-795` (the frame loop's story)
  - `:820-858` (haze, lens, drift density)
  - `:880-884` (filter)
  - `:968-985` (page length, anchors)

**Interfaces:**
- Consumes:
  - `BEATS`, `STORY_SCREENS`, `span`, `ease`, `shotFrame`, `pAtFrame`, `ShotMeta` (Task 5)
  - `RisingSand` (Task 7)
  - `BakedDesk.setSpill` (Task 8)
  - `public/lab/shot/camera.json` (Task 3)
  - `public/lab/sand/desk-spill.bin` (Task 2)
- Produces: the live story. `readExit` / `readEnter` / `readLeave` keep their names; Task 10 changes only how the overlay uses them.

- [ ] **Step 1: Replace the timeline header (lines 30–86 and 101–106)**

Delete `TL`, `SCROLL_KEYS`, `progressAt`, `THROUGH_KEYS`, `throughFrame` and the local `ease`/`span`. Put this in their place:
```ts
import { BEATS, STORY_SCREENS, ease, pAtFrame, shotFrame, span, type ShotMeta } from "@/three/sand/story-timeline";
import { RisingSand } from "@/three/sand/rising-sand";
/** The story's length (spec 2026-10-11 §3): the index settles at STORY_SCREENS, then the page runs on through it. */
const PAGE_VH = STORY_SCREENS * 100 + 100;
/** The frame the screen wakes on (0-based; the shot's camera.json). */
let WAKE_FRAME = 153;
const SHOT_BASE = "/lab/shot";
```
Keep `SIDE_FILL`, `LEAN`, `LEAN_DAMP`, `DRIFT`, `damp`. Delete `FRONT_KEY` and the `__frontKey` hook (no cloud passage). Remove the import of `burstAt`.

- [ ] **Step 2: The copy readers (lines 127–133)**

```ts
  const readExit = useCallback(
    () => (hero ? span(progressRef.current, BEATS.copyOut) : Math.min(Math.max((compactRef.current - 0.6) / 0.3, 0), 1)),
    [hero],
  );
  const readScrolled = useCallback(() => progressRef.current, []);
  const readEnter = useCallback(() => span(progressRef.current, BEATS.headlineIn), []);
  const readLeave = useCallback(() => span(progressRef.current, BEATS.headlineOut), []);
```

- [ ] **Step 3: The loads (lines 210–225)**

```ts
      // the story's one shot (blender/lookdev/shot_path.py), over the 3D desk
      const shot = hero && !compare ? await Pullback.load(SHOT_BASE, false) : null;
      const shotMeta = shot?.data as unknown as ShotMeta | undefined;
      if (shotMeta) WAKE_FRAME = shotMeta.wake_frame - 1;
      if (disposed) return;
      const desk3d = shot ? await BakedDesk.load(stage.renderer) : null;
      if (disposed) return;
      if (desk3d) stage.scene.add(desk3d.group);
      // the sand on the desk, rising toward the ball above (spec §5)
      const spots = desk3d && shot
        ? await RisingSand.loadSpots(`${SAND_BASE}/desk-spill.bin`, shot.data.chaos_center, shot.data.chaos_scale).catch(() => null)
        : null;
      if (disposed) return;
      const rising = spots ? new RisingSand(field.material, spots, tier === "low" ? 6000 : 20000) : null;
      if (rising) { rising.mesh.layers.set(SAND_LAYER); stage.scene.add(rising.mesh); }
```
Delete `usePlates`, `pullback`, `settle`, `rise`, `through`, `holdThrough`/`thFrame`, `attUp`, `attIndex`, `cloudAxis`, `cloudK`. Keep `revealT`, `sleep`, `indexMix`, `lidHold`, `revealHold`, `fillGain`. Add:
```ts
      const holdFrame = Number(new URLSearchParams(window.location.search).get("shotframe") || NaN);   // calibration: hold a shot frame
```

At lines 287 and 297, change `pullback?.deskLights(...)` to `shot?.deskLights(...)` (the shot's JSON carries the same `lights`), and in `__pbGains` change `pullback?.deskLights` to `shot?.deskLights`. Delete `pbFrame`, and change `calibrating` to:
```ts
      const calibrating = Number.isFinite(holdFrame);
```
Delete `shadow`/`BallShadow` and the `settle` block (lines 270–279). The desk3d path draws the ball's shadow itself (`setBallShadow`). Remove the unused `BallShadow` import.

- [ ] **Step 4: The frame loop's story (replace lines 472–795)**

```ts
        progressRef.current = damp(progressRef.current, hero ? (progress * (PAGE_VH - 100)) / 100 : progress, 6, dt);
        if (Number.isFinite(holdFrame) && shotMeta) progressRef.current = pAtFrame(holdFrame - 1, shotMeta.beats);
        const p = progressRef.current;
        state.compact = shot
          ? (() => { const x = span(p, BEATS.compact); return x * x * (3 - 2 * x); })()
          : damp(state.compact, compactFor(progress), 6, dt);
        compactRef.current = state.compact;
        if (shot && shotMeta && desk) {
          const deskNow = desk;
          const f = shotFrame(p, shotMeta.beats);
          // the light moves to the lamp as the camera tilts onto the desk (the ball is leaving the frame: unseen)
          const h = ease(p, BEATS.tilt);
          if (!calibrating) {
            const mixLook: Record<string, number> = {};
            for (const [key, v] of Object.entries(DESK_LOOK)) {
              const from = SAND_LOOK[key as keyof typeof SAND_LOOK] as number;
              mixLook[key] = from + (v - from) * h;
            }
            for (const [key, v] of Object.entries(BALL_LOOK)) {
              const from = mixLook[key] ?? (SAND_LOOK[key as keyof typeof SAND_LOOK] as number);
              mixLook[key] = from + (v - from) * state.compact;
            }
            field!.setLook({ ...baseLook, ...mixLook });
          }
          state.ballRoll = 0;
          // the lid and the screen, from the shot (the tail's own angles and wake)
          let openF = 0;
          if (desk3d) {
            const P = shot.data.path as unknown as { lid_open_deg: number }[];
            const fi = Math.min(Math.floor(f), shotMeta.frames - 2), fr = f - fi;
            const lidDeg = P[fi].lid_open_deg + (P[fi + 1].lid_open_deg - P[fi].lid_open_deg) * fr;
            openF = lidDeg / 108;
            desk3d.setLid(Number.isFinite(lidHold) ? lidHold : lidDeg);
            const awake = f >= WAKE_FRAME;
            if (Number.isFinite(revealHold)) { revealT = revealHold; sleep = 0; }
            else if (awake) { sleep = Math.max(sleep - dt / 0.35, 0); if (sleep === 0 || revealT > 0) revealT += dt; }
            else { sleep = Math.min(sleep + dt / 0.35, 1); if (sleep === 1) revealT = 0; }
            const rf = revealAt(revealT);
            rf.wake = Math.max(rf.wake, sleep);
            rf.light *= 1 - sleep;
            desk3d.setScreen(rf);
            desk3d.setState(openF, rf.light);
          }
          const v = shot.view(f);
          stage!.setView(v.position, v.quaternion, v.lens);
          const cam = stage!.camera;
          const W = canvas.clientWidth || 1, H = canvas.clientHeight || 1;
          // portrait phones see far more height: the tilt goes further there so the ball leaves the frame (spec §10)
          {
            const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), tanV16 = Math.tan(THREE.MathUtils.degToRad(v.lens > 0 ? 2 * Math.atan(18 / v.lens / 1.6) * 180 / Math.PI : cam.fov) / 2);
            const extra = Math.max(Math.atan(tanV) - Math.atan(tanV16), 0) * ease(p, BEATS.tilt) * (1 - ease(p, BEATS.glide));
            if (extra > 1e-4) { cam.quaternion.multiply(leanQ.setFromEuler(leanE.set(-extra, 0, 0, "YXZ"))); cam.updateMatrixWorld(); }
          }
          // the lean: toward the cursor, eased; out as the index takes over
          {
            const want = pointer.active
              ? new THREE.Vector2(Math.min(Math.max((pointer.x / W) * 2 - 1, -1), 1), Math.min(Math.max(1 - (pointer.y / H) * 2, -1), 1))
              : new THREE.Vector2();
            lean.lerp(reduced || calibrating ? new THREE.Vector2() : want, 1 - Math.exp(-LEAN_DAMP * dt));
            const w = 1 - ease(p, [BEATS.takeover[0] - 0.02, BEATS.takeover[1]]);
            if (w > 0.0001) {
              leanE.set(-lean.y * LEAN * w, lean.x * LEAN * w, 0, "YXZ");
              cam.quaternion.multiply(leanQ.setFromEuler(leanE));
              cam.updateMatrixWorld();
            }
          }
          // 3: the live index over the screen's quad, crossfading in where they coincide, then settling into the view
          const ix = indexRef.current;
          if (ix && desk3d) {
            const pt = Math.min(Math.max((f - shotMeta.screen_from) / (shotMeta.frames - 1 - shotMeta.screen_from), 0), 1);
            const take = ease(span(p, BEATS.takeover), [0, 1]);
            const sett = ease(span(p, BEATS.indexIn), [0, 1]);
            const portrait = W / H < 1;
            const project = () => (desk3d.screenCorners() ?? []).map((q0) => {
              const q = q0.clone().project(cam);
              return [(q.x + 1) / 2 * W, (1 - q.y) / 2 * H] as [number, number];
            });
            if (pt > 0 && portrait) {
              const xs = project().map((q) => q[0]);
              if (xs.length === 4) {
                const need = (Math.max(...xs) - Math.min(...xs)) / (W * 0.902);
                const wgt = ease(pt, [0.3, 1]);
                if (need > 1 && wgt > 0) {
                  const k = 1 + (need - 1) * wgt;
                  cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * k));
                  cam.updateProjectionMatrix();
                }
              }
            }
            const proj = pt > 0 ? project() : [];
            if (proj.length === 4) {
              const { w, h: ih } = ix.size();
              if (portrait) {
                ix.place(proj as [[number, number], [number, number], [number, number], [number, number]]);
                const xs = proj.map((q) => q[0]), ys = proj.map((q) => q[1]);
                const r0 = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
                const g2 = ease(sett, [0, 0.55]);
                ix.panel(take > 0.999 ? { x: r0.x * (1 - g2), y: r0.y * (1 - g2), w: r0.w + (W - r0.w) * g2, h: r0.h + (H - r0.h) * g2 } : null);
                ix.show((Number.isFinite(indexMix) ? indexMix : take) * (1 - ease(sett, [0.05, 0.35])));
                ix.list(ease(sett, [0.4, 1]));
                ix.interactive(sett > 0.999 ? "list" : "none");
              } else {
                const s = Math.min(W / w, H / ih), cw = w * s, ch = ih * s, x0 = (W - cw) / 2, y0 = (H - ch) / 2;
                const rest: [number, number][] = [[x0, y0], [x0 + cw, y0], [x0 + cw, y0 + ch], [x0, y0 + ch]];
                const quad = proj.map((q, i) => [q[0] + (rest[i][0] - q[0]) * sett, q[1] + (rest[i][1] - q[1]) * sett]) as [[number, number], [number, number], [number, number], [number, number]];
                ix.place(quad);
                let area = 0;
                for (let i = 0; i < 4; i++) { const a = proj[i], b2 = proj[(i + 1) % 4]; area += a[0] * b2[1] - b2[0] * a[1]; }
                const fill = Math.abs(area) / 2 / (W * H) / (Math.min(W / H, 1.6) / Math.max(W / H, 1.6));
                const byFill = THREE.MathUtils.smoothstep(fill, 0.86, 0.98);
                const shown = Number.isFinite(indexMix) ? indexMix : Math.max(Math.min(take, byFill), sett);
                ix.show(shown);
                ix.panel({ x: 0, y: 0, w: W, h: H }, Math.max(shown, sett));
                ix.list(0);
                ix.interactive(sett > 0.999 ? "wide" : "none");
              }
              ix.scroll(Math.max(window.scrollY - max, 0));
              if (++spacerTick % 20 === 0 && spacerRef.current) {
                const need = `${Math.round(ix.overflow())}px`;
                if (spacerRef.current.style.height !== need) spacerRef.current.style.height = need;
              }
            } else {
              ix.show(0); ix.panel(null); ix.list(0); ix.interactive("none");
            }
          }
          // no cloud passage any more: the cloud's parting off, no defocus; the desk's dim lifts as the lamp finds it
          field!.setCloud(0, 0, new THREE.Vector3(0, 0, 1), 0, 0, 0, 1e9, 1e9, 1, 0, 1);
          field!.setFrontKey(new THREE.Vector3());
          if (composite) { composite.defocus = 0; composite.deskDim = 0.6 * (1 - ease(p, [BEATS.tilt[0] + 0.1, BEATS.tilt[1] + 0.1])); }
          // the ball above, out of frame: its shadow on the desk and the hero light's spill around it (spec §8)
          if (desk3d) {
            const ballR = (field!.material.uniforms.uBallR.value as number) * shadowK[2];
            const k = shadowK[1] * state.compact;
            desk3d.setBallShadow(ballC, ballR, deskNow.lights[0].pos, shadowK[0], k, 0, k, k);
            const below = new THREE.Vector3(ballC.x, deskTop ? deskTop.y : ballC.y - 4.6, ballC.z);
            desk3d.setSpill(below, 2.5, new THREE.Vector3(0.35, 0.26, 0.2).multiplyScalar(state.compact * h));
          }
          field!.setPointScale(stage!.bufferHeight, THREE.MathUtils.degToRad(stage!.camera.fov));
          field!.setGround(groundCol.clone().multiplyScalar(THREE.MathUtils.lerp(LIFT.ground * h, LIFT.groundBall, state.compact)), stage!.camera, fillCol.clone().multiplyScalar(LIFT.fill * h * (1 - state.compact)),
            deskTop ? deskTop.y : -1e3, LIFT.reach);
          field!.setLights(
            heroLights.map((l, i) => {
              const d0 = deskNow.lights[i];
              const db = deskBall && !calibrating ? deskBall.lights[i] : d0;
              const d = { pos: d0.pos, col: d0.col.clone().lerp(db.col, state.compact), r: d0.r };
              if (i === 2 && openF > 0) {
                d.pos = shot.toHero(SIDE_FILL.pos);
                d.col = new THREE.Vector3(...(SIDE_FILL.color as [number, number, number]))
                  .multiplyScalar((SIDE_FILL.watts / (shot.data.chaos_scale ** 2)) * g.wattsToIrradiance * fillGain * openF);
                d.r = SIDE_FILL.radius;
              }
              const pos = l.pos.clone().lerp(d.pos, h);
              const r2 = (vv: THREE.Vector3) => Math.max(vv.distanceToSquared(chaosC), 1e-3);
              const col = l.col.clone().divideScalar(r2(l.pos)).lerp(d.col.clone().divideScalar(r2(d.pos)), h).multiplyScalar(r2(pos));
              return { pos, col, r: (d.r ?? 0) * h };
            }),
            { dir: deskNow.spot.dir, cos: new THREE.Vector2(-3, -2).lerp(deskNow.spot.cos, h) },
            (calibrating ? lampSat : lampSat + (0.05 - lampSat) * state.compact) * h,
          );
          // the name leaves the frame with the ball (it is a plane in the world behind it); faded once it has gone
          wordmark?.setFade(1 - ease(p, [BEATS.tilt[0] + 0.3, BEATS.tilt[1]]));
          // the rising sand: on once the desk is coming into view, off inside the screen (its clock: ambient)
          const um = field!.material.uniforms;
          const grainR = (um.uRadMax.value as number) * (um.uCountScale.value as number) * 0.7 * (um.uRadScale.value as THREE.Vector2).y;
          rising?.update(state.time, (reduced ? 0 : 1) * ease(p, [BEATS.tilt[0], BEATS.tilt[0] + 0.3]) * (1 - ease(p, [BEATS.tail[1] - 0.15, BEATS.tail[1]])),
            deskTop ? deskTop.y : -4.6, grainR);
        }
```

`max`, `progress`, `canvas`, `pointer`, `lean`, `leanQ`, `leanE`, `revealAt`, `indexRef`, `spacerRef`, `deskTop`, `heroLights`, `g`, `groundCol`, `fillCol`, `LIFT`, `lampSat`, `shadowK`, `ballC`, `chaosC` and `reduced` are the existing locals. Move the declarations of `reduced` and `still` (lines 414–416) above `stage.onFrame` if they aren't already.

- [ ] **Step 5: Haze, lens, drift and filter (lines 820–858 and 880–884)**

Replace the haze line with:
```ts
          if (composite) composite.hazeAmount = hazeOn ? (hero ? 1 - ease(pg, BEATS.tilt) : 1) : 0;
```
Replace the lens block's first lines (through `const lensK = ...`) with:
```ts
            const clear = hero ? ease(state.compact, [0.0, 0.6]) : 0;
            const fstop = Math.exp(THREE.MathUtils.lerp(Math.log(SAND_LOOK.dofFstop), Math.log(2.0), clear));
            const lensK = dofOn ? (hero ? 1 - ease(pg, [BEATS.tail[0] + 0.4, BEATS.tail[1]]) : 1) : 0;
```
After `const toFocus = ...`, add the shot's own focus once the camera has tilted, and use it:
```ts
            const shotF = shot && shotMeta ? (shot.data.path as unknown as { focus_m: number }[])[Math.min(Math.round(shotFrame(pg, shotMeta.beats)), shotMeta.frames - 1)].focus_m / shot.data.chaos_scale : toFocus;
            const focusD = THREE.MathUtils.lerp(toFocus, shotF, hero ? ease(pg, BEATS.tilt) : 0);
```
Then in the `if (composite)` branch:
- `composite.lens.focus = Math.max(focusD, 0.5)`
- `composite.lens.desk = lensK * (hero ? ease(pg, BEATS.tilt) : 0);`

Replace the drift `density` expression with:
```ts
          const density = (!hero ? DRIFT.hero : DRIFT.hero * (1 - ease(pg, BEATS.tilt))) * (1 - formed);
```
Replace the filter block (`toDesk`) with:
```ts
          const toDesk = shot ? ease(progressRef.current, BEATS.tilt) : 0;
```

- [ ] **Step 6: The page's end (lines 968–985)**

The page height stays `${PAGE_VH}vh`. Keep `#projects` at `PAGE_VH - 100`. After the spacer, add the About and Contact anchors (their sections come later):
```tsx
    {hero && <div ref={spacerRef} className="bg-black" style={{ height: 0 }} aria-hidden />}
    {hero && <div id="about" aria-hidden className="h-px" />}
    {hero && <div id="contact" aria-hidden className="h-px" />}
```

- [ ] **Step 7: Type-check, lint, unit tests**

Run: `npx tsc --noEmit -p . && npx eslint src/app/lab/sand src/three/sand && npx vitest run`
Expected: no errors. Every test passes except `attempts.test.ts` (deleted in Task 13). If its import breaks the build, delete it now together with `attempts.ts`.

- [ ] **Step 8: Look at every beat live**

With the dev server on 3100, capture `http://localhost:3100/lab/sand?hero&tier=high&shotframe=N` for N = 1, 40, 60, 80, 115, 150, 175, 209 (`$SCRATCH/shot-frames.mjs`, Appendix A).

Expected:
- 1: the hero, the copy on screen
- 40: the ball formed, slightly closer, the copy gone
- 60: the ball near the top, the desk appearing in the lamp's pool, grains lifting
- 80: the ball and the name gone; the desk lit with rising grains and the soft shadow under the ball's place
- 115: the notes passing, the headline lower left
- 150: the lid opening
- 175: the screen awake
- 209: the index taking over

Compare 80, 115 and 150 with the Cycles preview's frames. No console errors.

- [ ] **Step 9: Commit**

```bash
git add src/app/lab/sand/sand-lab.tsx && git commit -m "feat: the new story live: the ball forms in the hero, one forward shot down to the desk with the rising sand, into the screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The copy

**Files:**
- Modify: `src/app/lab/sand/hero-overlay.tsx`
- Create: `src/app/lab/sand/hero-overlay.test.tsx`

**Interfaces:**
- Consumes: `readExit` (now `span(p, BEATS.copyOut)`), `readEnter` / `readLeave` (headline in / out), from Task 9
- Produces: `export function driftOut(e: number, i: number): { y: number; opacity: number }` (y in vh, negative is up)

- [ ] **Step 1: Write the failing tests**

```tsx
// src/app/lab/sand/hero-overlay.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { HeroOverlay, driftOut } from "./hero-overlay";

describe("HeroOverlay", () => {
  test("the hero copy is there from the first frame: no delayed rise", () => {
    render(<HeroOverlay exit={() => 0} scrolled={() => 0} enter={() => 0} leave={() => 0} />);
    const name = screen.getByText("Hi, I’m Liam.");
    expect(name.closest(".hero-rise")).toBeNull();
    expect(screen.getByText("I build ambiguous ideas into products").closest(".hero-rise")).toBeNull();
  });

  test("the desk's headline only, in Liam's words", () => {
    render(<HeroOverlay exit={() => 0} scrolled={() => 0} enter={() => 0} leave={() => 0} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Tested until people believe in it.");
    expect(screen.queryByText("From chaos to product.")).toBeNull();
    expect(screen.queryByText(/I find the problem nobody pointed at/)).toBeNull();
  });

  test("the copy drifts up and out, line by line, and is gone at the end", () => {
    expect(driftOut(0, 0)).toEqual({ y: 0, opacity: 1 });
    expect(driftOut(1, 0).opacity).toBe(0);
    expect(driftOut(1, 2).opacity).toBe(0);
    expect(driftOut(0.4, 0).opacity).toBeLessThan(driftOut(0.4, 2).opacity);   // the first line leaves first
    expect(driftOut(0.5, 1).y).toBeLessThan(0);                                 // upward
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/app/lab/sand/hero-overlay.test.tsx`
Expected: FAIL (`driftOut` not exported; the heading text differs).

- [ ] **Step 3: Implement**

In `hero-overlay.tsx`:

(a) Replace `exitT` with the exported `driftOut`:
```ts
/** The hero copy leaving as the cloud becomes the ball (Liam, 2026-10-11): line by line, a slow upward drift and fade. */
export function driftOut(e: number, i: number): { y: number; opacity: number } {
  const t0 = Math.min(Math.max((e - i * STAGGER) / (1 - 2 * STAGGER), 0), 1);
  const t = t0 * t0 * (3 - 2 * t0);
  return { y: t === 0 ? 0 : -t * 9, opacity: 1 - t };
}
```
In the tick, replace the `[data-exit]` loop body with:
```ts
          const { y, opacity } = driftOut(e, Number(line.dataset.exit));
          line.style.transform = y !== 0 ? `translate3d(0,${y}vh,0)` : "";
          line.style.opacity = String(opacity);
```

(b) Add a plain line (no rise) and use it for the hero copy:
```tsx
function Still({ children }: { children: React.ReactNode }) {
  return <span className="block pb-[0.12em]">{children}</span>;
}
```
Replace `<Line delay={200}>Product Designer</Line>` (both places), `<Line delay={350}>Hi, I&rsquo;m Liam.</Line>`, `<Line delay={520}>I build ambiguous ideas into products</Line>` and `<Line delay={620}>where design and user needs meet.</Line>` with `<Still>…same text…</Still>`. Keep `Line` for the scroll cue.

(c) Replace the `data-enter` block's contents with the headline only:
```tsx
          <h2 className="text-[clamp(28px,3.5vw,54px)] font-normal leading-[1.08] tracking-[-0.015em]">Tested until people believe in it.</h2>
```
(Remove `whitespace-nowrap`: the line is longer than before and must wrap on phones. Remove the `<p>`.)

(d) Update the header comments:
- `HeroOverlay`'s doc: "the copy drifts up and out, line by line, as the cloud becomes the ball; the desk's headline enters from the right as the desk is revealed and leaves before the laptop"
- the `{/* 2.1: ... */}` comment: "the desk's headline"

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/app/lab/sand/hero-overlay.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/lab/sand/hero-overlay.tsx src/app/lab/sand/hero-overlay.test.tsx && git commit -m "feat: the hero copy there from the first frame, drifting up and out as the ball forms; the desk's headline: Tested until people believe in it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: The pill nav, linked into the story

**Files:**
- Create: `src/lib/story.ts`
- Modify: `src/components/shell/pill-nav.tsx`, `src/components/shell/pill-nav.test.tsx`, `src/components/providers/smooth-scroll.tsx:15`

**Interfaces:**
- Produces: `STORY_PATH = "/lab/sand"`, `STORY_HREF = "/lab/sand?hero"`. When the home phase moves the story to `/`, only these two lines change.

- [ ] **Step 1: Update the nav tests (failing)**

In `pill-nav.test.tsx`, replace the first test with these two, and change `"marks the active section on home"` to set `pathname.mockReturnValue("/lab/sand")` first:
```tsx
  test("on the story page the pills are in-page anchors", () => {
    pathname.mockReturnValue("/lab/sand");
    render(<PillNav />);
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "#projects");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "#about");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "#contact");
  });

  test("from any other page they lead into the story", () => {
    pathname.mockReturnValue("/cyvore");
    render(<PillNav />);
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/lab/sand?hero#projects");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/lab/sand?hero#contact");
  });
```

Run: `npx vitest run src/components/shell/pill-nav.test.tsx`
Expected: FAIL (hrefs are `/#projects`).

- [ ] **Step 2: Create `src/lib/story.ts`**

```ts
/** Where the story lives (spec 2026-10-11-scene-order-design.md §6): the lab page until the home phase moves it to "/". */
export const STORY_PATH = "/lab/sand";
export const STORY_HREF = "/lab/sand?hero";
```

- [ ] **Step 3: Point the nav at it**

In `pill-nav.tsx`:
```tsx
import { STORY_HREF, STORY_PATH } from "@/lib/story";
// ...
  const isHome = pathname === STORY_PATH;
  // ...
          const href = isHome ? `#${item.id}` : `${STORY_HREF}#${item.id}`;
```
Keep everything else, including the plain `<a>` on the story page (Lenis owns its scroll).

- [ ] **Step 4: Run the nav tests**

Run: `npx vitest run src/components/shell/pill-nav.test.tsx`
Expected: PASS.

- [ ] **Step 5: Projects in about 1.5 s**

Check Lenis's anchor option type first: `grep -n "anchors" node_modules/lenis/dist/lenis.d.ts`. Expected: `anchors?: boolean | ScrollToOptions;`. Then in `smooth-scroll.tsx`, change:
```ts
    const lenis = new Lenis({ lerp: 0.1, anchors: true, stopInertiaOnNavigate: true });
```
to:
```ts
    // anchors (the pill nav): a fixed 1.5 s, so Projects from the hero plays the story through in fast-forward (spec §6)
    const lenis = new Lenis({ lerp: 0.1, anchors: { duration: 1.5 }, stopInertiaOnNavigate: true });
```

- [ ] **Step 6: Type-check and run all tests**

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: PASS.

- [ ] **Step 7: The jump end to end**

Run `$SCRATCH/nav-jump.mjs` (Appendix A) against `http://localhost:3100/lab/sand?hero&tier=high`. It waits for `__sand`, clicks the Projects pill at the top, waits 2.5 s, then reads the `work-index` interactive state, `window.__sand.state.compact`, and screenshots.

Expected:
- the index is settled and interactive
- compact = 1
- the lid is open (`__desk3d` lid ≈ 108)
- the screenshot shows the index with no laptop edges
- the console has no errors

- [ ] **Step 8: Commit**

```bash
git add src/lib/story.ts src/components/shell/pill-nav.tsx src/components/shell/pill-nav.test.tsx src/components/providers/smooth-scroll.tsx && git commit -m "feat: the pill nav leads into the story: Projects reaches the index from any frame (1.5 s), About and Contact to their anchors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Reduced motion

**Files:**
- Modify: `src/app/lab/sand/sand-lab.tsx` (the progress line from Task 9, step 4, plus a veil element)

**Interfaces:**
- Consumes: `reducedStory` (Task 5)

- [ ] **Step 1: Use the held states under reduced motion**

In the frame loop, replace:
```ts
        progressRef.current = damp(progressRef.current, hero ? (progress * (PAGE_VH - 100)) / 100 : progress, 6, dt);
```
with:
```ts
        const rawP = hero ? (progress * (PAGE_VH - 100)) / 100 : progress;
        if (hero && reduced) {
          // reduced motion (spec §8): held states joined by crossfades through black, no shot
          const r = reducedStory(rawP);
          progressRef.current = r.p;
          if (veilRef.current) veilRef.current.style.opacity = String(r.veil);
        } else progressRef.current = damp(progressRef.current, rawP, 6, dt);
```
Add `reducedStory` to the story-timeline import. Add `const veilRef = useRef<HTMLDivElement>(null);` beside `pageRef`. In the JSX, right after `{gradeOn && <FilmGrade />}`, add:
```tsx
      {hero && <div ref={veilRef} aria-hidden className="pointer-events-none fixed inset-0 bg-black opacity-0" style={{ zIndex: 5 }} />}
```

- [ ] **Step 2: Check it**

Run `$SCRATCH/reduced.mjs` (Appendix A). It uses Playwright with `reducedMotion: "reduce"`, scrolls to 0, 1.5, 2.9 and 4.3 screens, and screenshots each.

Expected:
- 0: the cloud and copy
- 1.5: the ball, no copy
- 2.9: the desk with "Tested until people believe in it." and still sand
- 4.3: the index

The headline is readable and nothing moves between scrolls.

- [ ] **Step 3: Commit**

```bash
git add src/app/lab/sand/sand-lab.tsx && git commit -m "feat: reduced motion: the story as held states (cloud, ball, desk, index) joined by crossfades through black

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Remove what the story no longer uses

**Files:**
- Delete: `src/three/sand/attempts.ts`, `src/three/sand/attempts.test.ts`, `public/lab/settle/`, `public/lab/rise/`, `public/lab/through/`, `public/lab/pullback/`
- Modify: `blender/lookdev/shot_path.py` (it read `public/lab/through` and `public/lab/pullback`)

- [ ] **Step 1: Keep the shot's sources reproducible before deleting**

Copy the two inputs `shot_path.py` reads into the look-dev folder, and point it there:
```bash
mkdir -p blender/lookdev/shot-src && cp public/lab/through/camera.json blender/lookdev/shot-src/through-camera.json && cp public/lab/pullback/camera.json blender/lookdev/shot-src/pullback-camera.json
```
In `shot_path.py`:
```python
THROUGH = os.path.join(ROOT, "blender", "lookdev", "shot-src", "through-camera.json")
PULLBACK = os.path.join(ROOT, "blender", "lookdev", "shot-src", "pullback-camera.json")
```
Run: `python3 blender/lookdev/shot_path.py --check && git diff --stat public/lab/shot/camera.json`
Expected: `shot ok: ...` and no change to camera.json.

- [ ] **Step 2: Delete**

```bash
git rm -r -q src/three/sand/attempts.ts src/three/sand/attempts.test.ts public/lab/settle public/lab/rise public/lab/through public/lab/pullback
```
Then search for leftovers:
```bash
grep -rn "lab/settle\|lab/rise\|lab/through\|lab/pullback\|PULLBACK_BASE\|attempts\"\|burstAt\|usePlates\|?plates" src | grep -v "\.test\." 
```
Expected: only `pullback.ts`'s own `PULLBACK_BASE` export. Delete that constant if nothing imports it.

- [ ] **Step 3: Type-check, tests, build**

Run: `npx tsc --noEmit -p . && npx vitest run && npm run build 2>&1 | tail -5`
Expected: all pass; the build succeeds.

- [ ] **Step 4: Commit**

```bash
git add blender/lookdev/shot-src blender/lookdev/shot_path.py && git commit -m "chore: remove the settle, rise, attempts, the flight through the cloud and the pull-back plates (the new story doesn't use them); the shot's sources kept beside its generator

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Verify, push, send the link

- [ ] **Step 1: The beats, desktop**

Run `$SCRATCH/shot-frames.mjs` (Appendix A) at 1600×1000 for the beats in Task 9, step 8. Make a contact sheet:
```bash
ffmpeg -y -loglevel error -i "$SCRATCH/sf-%d.png" -vf "scale=533:-1,tile=4x2" "$SCRATCH/story-sheet.jpg"
```
Expected: as listed in Task 9, step 8.

- [ ] **Step 2: Phones (Review Focus 1)**

At 375×812, at `shotframe=80`, run in the page:
```js
const c = window.__sand.stage.camera, b = window.__sand.field.material.uniforms.uBallC.value.clone().project(c); b.y
```
Expected: `b.y > 1.2` (the ball's centre above the frame by more than its radius on screen). Screenshot frames 1, 80, 115 and 209 on the phone.

- [ ] **Step 3: Scrolling back (Review Focus 3)**

Run `$SCRATCH/reverse.mjs` (Appendix A). It scrolls to the index's settle, then back to 0 in 8 steps, screenshotting each.

Expected:
- the index leaves
- the screen sleeps and the lid shuts
- the headline leaves
- the ball and the name return
- the ball unpacks
- the hero copy returns

There are no stuck states (compare step 8 with the first hero frame).

- [ ] **Step 4: Performance**

On Liam's Mac, close other tabs running the lab first (an open lab tab skews the GPU). Run `$SCRATCH/perf.mjs` (Appendix A): frame times over 5 s held at the hero, at `shotframe=115` with the rising sand on, and the same with `rising.update(0, 0, ...)` forced via `window.__sand.rising.mesh.visible = false`.

Expected: p95 frame time under 16.7 ms on high tier at 1600×1000. Report the numbers honestly, including any frame that misses.

- [ ] **Step 5: Push and get the preview link**

```bash
git push origin phase/2-home
```
Then find the preview with the Vercel tools: `list_deployments` for project liamhasson-portfolio, the newest for branch `phase/2-home`. Wait until it is `READY`. The link is `<deployment url>/lab/sand?hero`.

- [ ] **Step 6: Report to Liam**

Send:
- the contact sheet and the phone frames (`SendUserFile`)
- the preview link
- one line per beat
- what was measured (performance numbers)
- what's left

What's left:
- the loader, with its own spec
- any framing notes he gave on the preview that are still to apply
- that `docs/storyboard/portfolio-storyboard.html` (the other chat's uncommitted edits) still shows the old chapters

---

## Appendix A: capture scripts (session scratchpad)

Each runs as `node <script> "<project dir>" <out> [query]`, against `http://localhost:3100` (the `sand-lab` dev server). Each loads Playwright from the project (`createRequire(proj + "/package.json")("playwright")`) and launches Chromium with `--use-angle=metal --enable-gpu --ignore-gpu-blocklist`. Each hides the Next dev overlay with `nextjs-portal{display:none!important}`.

- **`desk-shot.mjs`** (existing): the ball formed on the desk, scrolling until `__sand.state.compact > 0.995`. In the new story that is the hero's own ball; use it only for Task 1, which runs before the new story.
- **`hero-shot.mjs`**: `goto /lab/sand?hero&tier=high&still`, wait for `window.__sand?.state`, wait 4 s, screenshot.
- **`shot-frames.mjs`**: for each N in `process.env.FRAMES` (default `1,40,60,80,115,150,175,209`), `goto /lab/sand?hero&tier=high&shotframe=N`, wait for `__sand`, wait 3 s, screenshot `sf-<i>.png`. The viewport comes from `process.env.VIEWPORT` (`1600x1000` or `375x812`).
- **`nav-jump.mjs`**: goto `?hero&tier=high`, wait for `__sand`, click `getByRole('link', { name: 'Projects' })`, wait 2.5 s. Print:
  - `document.querySelector('[data-testid=work-index]')?.dataset.interactive`
  - `__sand.state.compact`
  - `__desk3d?.lid?.pivot` rotation

  Then screenshot.
- **`reduced.mjs`**: `browser.newContext({ reducedMotion: "reduce", viewport })`. For vh in [0, 150, 290, 430], `scrollTo(0, vh * innerHeight / 100)`, wait 1.5 s, screenshot.
- **`reverse.mjs`**: scroll to `430vh`, wait 3 s. Then for i = 8..0, `scrollTo(0, i / 8 * 430vh)`, wait 1.5 s, screenshot `rev-<i>.png`.
- **`perf.mjs`**: per state, collect 300 `requestAnimationFrame` deltas in the page and print p50/p95/max.

Add `window.__sand.rising = rising` to the `__sand` debug object in sand-lab.tsx (Task 9) so these scripts can reach it.

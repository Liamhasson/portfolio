# The new scene order: the ball forms in the hero, one forward shot down to the desk and into the screen

**Status:** agreed with Liam in chat, 2026-10-11, for review as written (revision 2: the camera only ever moves forward,
the critical pass's changes folded in). Supersedes the chapter 1 to 2.3 flow in `2026-10-07-portfolio-concept-v3.md`
and the scroll timeline in `src/app/lab/sand/sand-lab.tsx`. The loader (chapter 0) is a separate piece with its own
design, planned after this one. The quality bar stands: Awwwards/Lusion level, Cycles renders as the reference for the
live build.

## 1. Why

The projects sat about ten screens deep, and the story took three detours on the way (the ball landing on the desk,
the rise to the top view, the attempts). The new order tells the same idea in one gesture: the chaos becomes the
ball in front of you, then you look down at where it came from and lean into the work. The camera only ever moves
forward (Liam: going down and forwards, never back). The index arrives around screen 4.5, and the nav reaches it
from the first frame.

## 2. The order of events

| # | Beat | What happens |
|---|---|---|
| 0 | Loader | New, designed separately; it hands off into the hero without a cut (section 8). |
| 1 | Hero | The chaos cloud, the outlined LIAM HASSON behind it, and "Hi, I'm Liam." with its lines. |
| 2 | The ball forms, same scene | The cloud packs into the ball in the centre while the camera eases in slightly; the copy drifts out. |
| 3 | One forward shot | The camera tilts down (the ball leaves the frame above), moves down and forward over the desk, closes in on the laptop as it opens, and pushes into the screen, where the project index lives. |

Every beat is driven by scroll and reverses when scrolling back (except the rising sand, which is ambient).

## 3. Beat by beat (scroll positions approximate, in screens)

**Hero (0 to ~0.4).**
- As built: the chaos, the haze, the depth of field (f/0.35, dreamy) and the outlined name with its ambient wave of light (`src/three/sand/wordmark.ts`: every 15 s it spreads like water from a new spot).
- Changed: "Hi, I'm Liam." and its two lines are on screen from the hero's first frame (no delayed entrance).

**The ball forms (~0.4 to ~1.6).**
- The cloud packs inward into the ball, exactly centred, about 46% of the viewport's height.
- The camera eases in a few percent as it forms, so the scene keeps moving and the forward motion starts here.
- The lens stops down to about f/2 as the ball locks in (the clarity arc, now ending in the hero).
- The copy drifts out while the cloud turns into the ball: line by line, a slow upward drift and fade, gone by the time it locks in.

**The hold (~1.6 to ~1.8).** The formed ball, alive: idle spin, the cursor's light, the wordmark's wave.

**The shot (~1.8 to ~4.3): one continuous forward camera move.**
1. *Tilt down (~1.8 to 2.4).*
   - The camera tilts down in place. In desk scale it stands about 80 cm in front of the ball, just past the desk's front edge.
   - The ball and the wordmark rise out of the top of the frame together. The wordmark is a plane in the haze behind the ball and moves with the world, never fixed to the screen.
   - Below, the table is found by the lamp: its warm pool appears ahead, with darkness in the foreground. It's one natural light; the desk doesn't fade in.
   - The ball's soft shadow lies on the desk where the sand rises, and a little of the hero light spills down from above. Both say the ball is still there.
2. *Down and forward over the desk (~2.4 to 3.2).*
   - The camera glides low past the handwritten notes, framed so "Who is this product for?" reads on the way.
   - The rising sand runs throughout.
   - The desk headline arrives lower left as the desk is revealed and leaves before the laptop. It's headline only; today's "From chaos to product." and its second line are removed. Its words are chosen in section 4.
3. *The laptop and the screen (~3.2 to 4.3).* Shut as the desk is revealed; as the camera closes in, the lid opens and the screen wakes (the existing behaviour, from the current shot's tail). Then the push through the glass; the live index takes over and settles.

**Page length:** about 4.5 to 5 screens to the index (from about 10).

## 4. The desk headline

The desk passage tells "how I work". Its headline must add to the hero line, never repeat it: the hero already says
"I build ambiguous ideas into products where design and user needs meet", so a second "into products" is out. Liam's
draft was "From shapes into products people believe in". Options, for Liam to choose or rewrite:

- "Tested until people believe in it." (keeps his words; says the how)
- "It starts with the questions nobody asked."
- "Questions first. Then the shape. Then the product."
- "Every product starts on a desk like this."

## 5. The rising sand (endless, like Lusion's)

The sand on the desk is pulled upward, as if gravity worked upward, toward the ball above, out of frame:
- in random places
- at uneven paces
- in waves

It never runs out.

- **Where the grains rest:** the look-dev spill (`blender/lookdev/cinematic_set.py`, SET_WORLD=sand):
  - the soft mound under the ball's place, in its shadow
  - the patchy scatter across the desk and the papers
  - grains settled into the cracks between planks

  Their resting positions are exported from Blender (a small binary file), so the live desk matches the approved frames.
- **The waves:** a slow noise field drifts across the desk. Where it crosses a threshold, grains lift. Each grain has its own delay, speed and sway, so a wave reads as a ragged front, never a line.
- **The rise:**
  - A grain leaves the desk slowly, speeds up as it climbs, and drifts a little sideways on the same flow noise as the cloud.
  - It leaves the frame upward, toward the ball.
  - It then reappears at rest at another spot outside the view, so nothing pops in where it can be seen, and the desk never looks emptied.
- **Look:**
  - One system with the rest of the sand: the same points, the same shader (SAND_FRAGMENT), the same palette, size range and gloss.
  - Lit by the lamp; darker inside the ball's shadow.
  - Grains near the lens go soft through the existing depth-of-field pass.
  - The cursor's light touches them as it does the cloud.
- **Scroll:** the lift runs on its own clock (ambient); scrolling back only returns the camera.
- **Budget:** about 15k to 30k grains, culled when the desk is out of view. One extra draw call, no CPU simulation (all in the vertex shader from per-grain seeds and time).

## 6. The nav

The pill nav (`src/components/shell/pill-nav.tsx`: Projects, About, Contact, top right; Liam likes its look) stays as
designed, now linked into the story page:

- **Projects** jumps to the index from any point, including the first frame. On the story page the jump scrolls the timeline (Lenis), so the shot plays through in fast-forward, about 1.5 s, and the page never shows a state the timeline can't reach. Its active state lights up once the index has arrived.
- **About** and **Contact** link to their sections' anchors after the index. Those sections are built later; until then their anchors sit at the end of the page.
- From other pages (the case studies), the pills link back to the story page's anchors.

The story still lives at `/lab/sand?hero`; it moves to `/` when the home phase lands, and the pills' targets move with it.

## 7. Removed from the current build

- The ball settling onto the desk (2.1)
- The rise to the top view (2.2)
- The attempts bursts
- The ball's drift up
- The flight through the cloud (2.3)
- The pull-back (replaced by the tilt)
- The glass state, dropped from the story: chaos → ball → the work in the computer. The projects are the shipped state.

The code paths and assets for these come out of the live page: the settle, rise and through plates or paths it no longer loads, and their timeline keys.

## 8. Kept, and carried across

- **Kept:**
  - the hero's cloud, haze, film grade, depth of field and wordmark (its fill-to-outline on load and its wave)
  - the size range and the floating grains (streams)
  - the 3D baked desk with the pallet wood, and the lamp
  - the ball's shadow on the desk (now with the ball out of frame)
  - the laptop's lid and screen states (shut, open, lit)
  - the live index
- **The loader hand-off:** the loader ends as the hero's first frame (the light finding the sand), not on a separate screen. It also preloads the desk (~20 MB) and the shot's data, so the shot never stalls. Both are designed in the loader's own spec.
- **Reduced motion:** visitors who ask for less motion get the three states as short crossfades in place of the shot:
  - the cloud
  - the ball
  - the index

  The rising sand is stilled, and the nav works the same.

## 9. How it's built

1. **The shot, authored in Blender.**
   - A new camera move in a hook script (lookdev.py itself stays untouched), exported as a camera JSON like the existing moves. It starts on the hero's exact framing: the hero camera mapped into the desk's space (desk = CHAOS_C + 0.1 · hero). It includes the slight ease-in during the forming, the tilt in place, then down and forward.
   - Its last stretch (closing on the laptop, the lid, the push) joins the current shot's approved ending ("out", "lid", "push") or is re-authored to match it.
   - Its depth of field is keyed in Blender, and the live lens follows it.
   - A preview render goes to Liam for approval before it's wired live.
2. **The ball in the hero.** Compaction is driven by the hero's own scroll stretch (today it's tied to the settle on the desk). The ball stays at the hero's centre, which in desk space is above the desk; the shot leaves it there.
3. **The wordmark in the world.** It becomes a plane in the scene behind the ball (or its screen position follows the camera's tilt exactly), so it leaves the frame with the ball.
4. **The light.**
   - The hero light stays on the cloud and ball.
   - The desk is the baked lamp state. The lamp's arrival is the camera finding it: the existing desk dim lifts as the table comes into view.
   - The ball's shadow on the desk stays; the hero light's spill from above is a soft added pool.
   - The rising sand uses the lamp as its key.
5. **The rising sand:** a points system sharing the sand's uniforms and fragment shader, its rest positions exported from the look-dev spill (section 5).
6. **The copy:**
   - `hero-overlay.tsx`: the hero copy is visible from the first frame and its exit is tied to compaction.
   - The desk line is replaced by the chosen headline (section 4).
7. **The nav:** the pills' targets on the story page (section 6), Projects' fast-forward jump, and its active state.
8. **The timeline:** `TL` and `SCROLL_KEYS` in `sand-lab.tsx` are rewritten for the new beats; the page's length follows.
9. **The pallet desk bake** finishes first (shut, open and lit with the new wood), since the desk is in every frame of the shot.

## 10. Verification

- **Frame checks.** A frame at each beat, captured from the live page and compared with the Cycles preview of the shot:
  - hero
  - mid-compaction
  - ball locked
  - mid-tilt (ball and wordmark leaving together)
  - over the notes
  - lid opening
  - in the screen
- **Reverse check.** Scroll back through every beat: the camera, the copy and the ball reverse cleanly; the rising sand keeps going.
- **The sand.** No grain pops in or out in view, and none rests floating above the desk or inside a plank.
- **Copy.** The hero copy is visible on the first frame and gone by the ball's lock-in. The desk headline is readable over the moving sand (the scrim).
- **The nav.**
  - Projects from the first frame lands on the settled index in about 1.5 s.
  - About and Contact reach their anchors.
  - The pills work from a case study back to the story.
  - Keyboard focus and aria-current are correct.
- **Reduced motion.** The crossfade path works end to end.
- **Performance.** Frame times on Liam's Mac and a mid-range phone, with the rising sand on and off.
- **Phones.** The same order. The index arrival keeps today's phone behaviour (the screen grows into the section).

## 11. Open items

- The desk headline's words (section 4): Liam chooses.
- The loader: its own design, next.
- The shot's exact framing over the notes, set by the preview render (Liam approves before the live wiring).

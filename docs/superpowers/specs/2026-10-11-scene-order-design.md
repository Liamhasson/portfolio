# The new scene order: the ball forms in the hero, one shot down to the desk and into the screen

**Status:** agreed with Liam in chat, 2026-10-11, for review as written. Supersedes the chapter 1 to 2.3 flow in
`2026-10-07-portfolio-concept-v3.md` (and the scroll timeline in `src/app/lab/sand/sand-lab.tsx`). The loader
(chapter 0) is a separate piece with its own design, planned after this one. The quality bar stands: Awwwards/Lusion
level, Cycles renders as the reference for the live build.

## 1. Why

The projects sat about ten screens deep, and the story took three detours on the way (the ball landing on the desk,
the rise to the top view, the attempts). The new order tells the same idea in one gesture: the chaos becomes the
ball in front of you, and then the camera leaves it to go where the work lives.

## 2. The order of events

| # | Beat | What happens |
|---|---|---|
| 0 | Loader | New, designed separately. |
| 1 | Hero | The chaos cloud, the outlined LIAM HASSON behind it, and "Hi, I'm Liam." with its lines. |
| 2 | The ball forms, same scene | No camera move. The cloud packs into the ball in the centre; the copy drifts out. |
| 3 | One shot | The camera pulls back and tilts down onto the table (the ball leaves the frame above and is never seen again), travels over the desk, closes in on the laptop as it opens, and pushes into the screen, where the project index lives. |

Every beat is driven by scroll and reverses when scrolling back.

## 3. Beat by beat (scroll positions approximate, in screens)

**Hero (0 to ~0.4).**
- As built: the chaos, the haze, the depth of field (f/0.35, dreamy) and the outlined name.
- The wordmark keeps its ambient wave of light as built (`src/three/sand/wordmark.ts`: every 15 s it spreads like water from a new spot).
- Changed: "Hi, I'm Liam." and its two lines are on screen from the hero's first frame (no delayed entrance after the loader).

**The ball forms (~0.4 to ~1.8).**
- The camera holds; the cloud packs inward into the ball, exactly centred, about 46% of the viewport's height.
- The lens stops down to about f/2 as the ball locks in (the clarity arc, now ending in the hero).
- The copy drifts out while the cloud turns into the ball: line by line, a slow upward drift and fade, gone by the time the ball locks in.

**The hold (~1.8 to ~2.1).** The formed ball, alive: idle spin, the cursor's light, the wordmark's wave.

**The shot (~2.1 to ~5.8): one continuous camera move.**
1. *Pull back and tilt down (~2.1 to 3.0).*
   - The ball rises out of the top of the frame and stays where it is, above the desk, out of shot.
   - The table is in the dark below. The lamp finds it: its warm pool appears as the camera tilts onto it. It's one natural light; the desk doesn't fade in.
   - The rising sand is already lifting into that light.
2. *Over the desk (~3.0 to 4.2).*
   - The camera glides low past the handwritten notes, framed so "Who is this product for?" reads on the way.
   - The line arrives lower left as the desk is revealed and leaves before the laptop: **"From shapes into products people believe in."** (headline only; today's second line and "From chaos to product." are removed).
3. *The laptop (~4.2 to 5.4).* Shut as the desk is revealed; as the camera closes in, the lid opens and the screen wakes (the existing behaviour, from the current shot's tail).
4. *Into the screen (~5.4 to 5.8).* The push through the glass; the live index takes over and settles.

**Page length:** about 6 to 7 screens (from about 10); the projects arrive around screen 6.

## 4. The rising sand (endless, like Lusion's)

The sand on the desk is pulled upward, as if gravity worked upward, toward the ball above, out of frame:
- in random places
- at uneven paces
- in waves

It never runs out.

- **Where the grains rest:** the look-dev spill (`blender/lookdev/cinematic_set.py`, SET_WORLD=sand):
  - the soft mound under the ball's place
  - the patchy scatter across the desk and the papers
  - grains settled into the cracks between planks

  Their resting positions are exported from Blender (a small binary file), so the live desk matches the approved frames.
- **The waves:** a slow noise field drifts across the desk. Where it crosses a threshold, grains lift. Each grain has its own delay, speed and sway, so a wave reads as a ragged front, never a line.
- **The rise:**
  - A grain leaves the desk slowly, speeds up as it climbs, and drifts a little sideways on the same flow noise as the cloud.
  - It leaves the frame upward, toward the ball.
  - It then reappears at rest at another spot on the desk (it doesn't pop in under the camera's eye), so the desk never looks emptied.
- **Look:**
  - One system with the rest of the sand: the same points, the same shader (SAND_FRAGMENT), the same palette, size range and gloss.
  - Lit by the lamp, and shadowed where the volume says so.
  - Grains near the lens go soft through the existing depth-of-field pass.
  - The cursor's light touches them as it does the cloud.
- **Scroll:** the lift runs on its own clock (it's ambient), while the camera is on scroll. Scrolling back simply returns the camera; the sand keeps rising.
- **Budget:** about 15k to 30k grains, culled when the desk is out of view. One extra draw call, no CPU simulation (all in the vertex shader from per-grain seeds and time).

## 5. Removed from the current build

- The ball settling onto the desk (2.1)
- The rise to the top view (2.2)
- The attempts bursts
- The ball's drift up
- The flight through the cloud (2.3)
- The ball's shadow on the desk
- The glass state, dropped from the story: chaos → ball → the work in the computer. The projects are the shipped state.

The code paths and assets for these come out of the live page: the settle, rise and through plates or paths it no longer loads, and their timeline keys.

## 6. Kept

- The hero's cloud, haze, film grade, depth of field and wordmark (with its fill-to-outline on load and its wave)
- The size range
- The floating grains (streams)
- The 3D baked desk with the pallet wood, and the lamp
- The laptop's lid and screen states (shut, open, lit)
- The live index

## 7. How it's built

1. **The shot, authored in Blender (1A).**
   - A new `deskmove`-style camera move in a hook script (lookdev.py itself stays untouched), exported as a camera JSON like the existing moves. It starts on the hero's exact framing: the hero camera mapped into the desk's space (desk = CHAOS_C + 0.1 · hero).
   - It pulls back and tilts down past the notes. Its last stretch (closing on the laptop, the lid, the push) reuses the current shot's frames ("out", "lid", "push"), so the approved ending is unchanged.
   - Its depth of field is keyed in Blender, and the live lens follows it.
   - A preview render goes to Liam for approval before it's wired live.
2. **The ball in the hero.** Compaction is driven by the hero's own scroll stretch (today it's tied to the settle on the desk). The ball's place stays the hero's centre; in the shot it's simply left behind above the frame.
3. **The light.**
   - The hero light stays on the cloud and ball.
   - The desk is the baked lamp state.
   - The lamp's arrival is the camera finding it (no fade of the desk), with the existing desk dim lifting as the table comes into view.
   - The rising sand uses the lamp as its key.
4. **The rising sand (2A):** a points system sharing the sand's uniforms and fragment shader, its rest positions exported from the look-dev spill (section 4).
5. **The copy:**
   - `hero-overlay.tsx`: the hero copy is visible from the first frame and its exit is tied to compaction.
   - The desk line is replaced by the new headline.
6. **The timeline:** `TL` and `SCROLL_KEYS` in `sand-lab.tsx` are rewritten for the new beats; the page's length follows.
7. **The pallet desk bake** finishes first (shut, open and lit states with the new wood), since the desk is in every frame of the shot.

## 8. Verification

- **Frame checks.** A frame at each beat, captured from the live page and compared with the Cycles preview of the shot:
  - hero
  - mid-compaction
  - ball locked
  - ball leaving the frame
  - over the notes
  - lid opening
  - in the screen
- **Reverse check.** Scroll back through every beat: the camera, the copy and the ball reverse cleanly; the rising sand keeps going.
- **The sand.** No grain pops in or out in view, and none rests floating above the desk or inside a plank.
- **Copy.** The hero copy is visible on the first frame and gone by the ball's lock-in. The desk line is readable over the moving sand (the scrim).
- **Performance.** Frame times on Liam's Mac and a mid-range phone, with the rising sand on and off.
- **Phones.** The same order. The index arrival keeps today's phone behaviour (the screen grows into the section).

## 9. Open items

- The loader: its own design, next.
- The camera path's exact framing over the notes, set by the preview render (Liam approves before the live wiring).

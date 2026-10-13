# Desk note stories (easter eggs) — design

Approved by Liam note by note, 2026-10-13/14, from mockups (frames and clips). Built on `feat/desk-note-stories`.

## The interaction
- **Where:** the four notes on the desk, while the desk is in view (story screens `BEATS.tilt[0] + 0.3` to `BEATS.tail[0] + 0.5`), never during the snap into the screen, not under reduced motion.
- **Hover (fine pointers):** the note lifts a little (6% of its height) and the lens racks focus onto it: the desk through the composite's desk lens at f/1.4, focus at the note's depth. The cursor becomes a pointer. No text, no glow.
- **Click / tap:** the note comes off the desk to the camera (never the camera to the note: the shot only moves forward). Its frame comes from `lookdev.py build_desk` (size, rot_z), not from the bakes' uv. The desk behind softens (disc defocus) and dims; scroll is held.
- **Up close:** the note sits square to the screen inside a crisp selection frame with handles and straight dashed guides (the design motif). Glued along its top, its lower part lifts, ripples and sways.
- **The story:** the insight is written first, above the note, circled, one key word pressed harder. Then four pencil sketches join a tilted circle around the note one by one, each drawn as its place passes the front (bottom: sharp, largest, fully readable). One constant slow pace throughout (11°/s, steps ~8 s apart, each drawn in 2.2 s); the circle keeps turning. Its near half passes in front of the note; its far half goes behind it (hidden by the paper, softened and thinned by the lens, passing behind the insight). No arrows, no numbers.
- **Back:** scroll, a click or Esc: the story fades, the note returns to its place on the desk, scroll resumes.

## Look
Pencil after the Oryzo/Lusion case-study drawings: graphite tooth, construction guides that overshoot, repeated passes, pressure, hatching with a rubbed tone; procedural (Liam's choice), drawn on canvas so it can draw itself on. Handwriting: Nothing You Could Do (readability is a hard rule). Line colour: the sketches' `rgb(230,191,174)`.

## The four stories
1. **"Who is this product for?"** (yellow) · Cyvore. Insight: "Attackers don't target companies. They target the person most likely to click." Steps: the CTO's mum (a side project, "you've won!") → elderly, not tech-savvy → cyber attacks happen to everyone (a crowd) → banks, armies, institutions (buildings, no label).
2. **"What would make this fail?"** (pink) · Pulse. Insight: "A feature's name is a promise. 'Injury Log' promised a doctor." Steps: the Injury Log, "your recovery plan is ready" → a tester's thought, "is there a real doctor behind this?" → sore/torn, a plan, a worse knee, a gavel: "liability risk" → the Training Log redrawn over earlier tries, "from guiding recovery to tracking habits", "round 2: no one raised it".
3. **"Who does this better?"** (yellow) · Eventread. Insight: "Nobody did it better. The answer was between them." Steps: a figure at a wall calendar, question marks, no label → three unnamed competitors' windows with pieces that don't fit ("books the venue's calendar" / "routes the tour" / "answers in general"), "competitors each answer part of it" → a light bulb over the gap and "danger = capacity × genre × timing", "No one covers the gap" → a scan across every field to one safe date.
4. **"What do they check before they commit?"** (index card, landscape frame) · Nordic Logic. Insight: "Knowing they can decide is what makes a stranger trust it." Steps: a sceptic with arms folded and the request sheet, "a stranger is being asked to trust in a new company" → a them/us table, "present differentiators" → a CSV becoming the full breakdown, "show the work before asking" → a level scale over two identical buttons, "continue or walk away".

## Code
- `src/three/sand/note-story/pencil.ts` — the pencil (counted marks, incremental draw-on).
- `src/three/sand/note-story/stories.ts` — the four stories.
- `src/three/sand/note-story/desk-notes.ts` — picking, the lift, poses, depth.
- `src/three/sand/note-story/story-player.ts` — the overlay: flight, frame, orbit, insight, back.
- `src/three/sand/sand-composite.ts` — the desk lens can run without the sand's.
- `src/app/lab/sand/sand-lab.tsx` — wiring (hover, click, scroll hold, rack focus, backdrop).

## Open
- Phones: the overlay scales the desktop layout; a portrait layout (the flow top to bottom) is still to design.
- The note's baked shadow stays on the desk while the note is up (visible under the blur).
- The external drive → `/playground` easter egg is designed but not built.

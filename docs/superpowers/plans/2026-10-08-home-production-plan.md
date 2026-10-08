# Home page: production plan v1 (for Liam's review, nothing built)

**Date:** 2026-10-08. **Supersedes:** plan 2a (`2026-10-05-phase-2a-stage-loader-hero.md`) and the chapter notes in concept v2/v3 where they conflict. **Inputs:** the approved look-dev renders (`blender/lookdev/renders/lookdev-*.jpg`), the decisions of 2026-10-08, and the references Liam named (lusion.co/about hero → manifesto; his current toolkit animation; eventread.vercel.app; the two live case studies).

**Quality bar:** moto-card.com / oryzo.ai / lusion.co. No shortcuts. Every real-time frame is compared side by side with its render before Liam approves it. Nothing is designed without a reference. Ask before guessing.

---

## 1. What the Lusion reference does (read from the four states Liam sent)

1. **Hero:** a dense, lit particle cloud close to the camera; the brand name huge at the bottom; "scroll to explore".
2. **Pull-back begins:** the camera dollies back and tilts; the cloud recedes and becomes a streak high in the frame; the environment appears around it (astronaut, valley, mountains). Display copy arrives in large caps, with **italic** for the second half.
3. **Further back:** the cloud is now a single point of light with a beam down to the figure; the scene is small in frame; copy holds.
4. **Manifesto:** the scene is far away; the intro copy slides **left** off screen as the manifesto slides **in from the right**, right-aligned and dimmed, with italic emphasis ("A worldwide team of…").

What to take from it:
- **One continuous camera move.** The hero object never cuts away; it shrinks into the distance while the world is revealed around it.
- **Scroll drives depth and text at once.** Vertical scroll = the camera moving on z; text moves horizontally (exits left, enters right).
- **Type carries hierarchy with size, italic and opacity, not weight.** Aeonik 400 nearly everywhere (verified in their CSS), 500 only on buttons, italic for emphasis, mono for labels, reduced opacity for staging.
- **Cursor:** on the about hero the cursor is a light (grains near it brighten) plus a soft screen-space drift field. Not a repel, not a video (verified in their code). Approved for our sand.

## 2. The story and the sphere's journey (restructured 2026-10-08, revised)

The object performs each step of "how I work"; the sets support it. **One location, always night, seen from three points of view** (Liam: day/night changes are a cliché). Scroll always moves the camera; no cuts.

**The desk:** a **waterfall slab** (thick top, grain wrapping over the edge and down the sides, no legs; shape reference: Liam's two oak desk photos), floating in the black void. **Oak character** (knots, wide planks, raw matte grain) in the current **dark walnut colour**. Objects: handwritten notes, pen, three dark grey picks at the back (the transcript stack was removed) and a **laptop in the form of a 14-inch MacBook Pro in Space Black**, on the desk in every view: shut in steps 2.1–2.2, open in 2.3. Its lid carries Liam's grain mark (from the chaos cloud's silhouette, 507 grains, 55 mm) as a flush, mirror-polished inlay, the material of the real logo. One warm lamp off-frame, the only key light, in every view.

| # | Moment | Sphere | View | Camera |
|---|---|---|---|---|
| 0 | Loader | chaos, introduced | black void | none: the light finds the sand |
| 1 | Hero: name, title, one line | chaos, moving around itself (never forms) | black void + glowing LIAM HASSON (the one light exception) | holds; cursor light + drift |
| 1→2.1 | Pull-back | chaos | the void is the dark room above the desk | pulls back and tilts down; the lamp finds the desk beneath |
| 2.1 | **I look for problems nobody pointed at** | chaos **compacts into the dense ball** (scroll-driven) | **three-quarter view** over the notes (the approved desk render) | settles |
| 2.1→2.2 | Rise | ball, rising with the camera | – | camera rises and turns to look straight down (`deskmove-rise`, approved) |
| 2.2 | **Then I test solutions** | **three attempts**: clarity sweeps in from the core and collapses back; each attempt gets further; the third tips over | **top-down**: the ball over the notes, its shadow on them; the slab's edges fall off into black | holds |
| 2.2→2.3 | Descend | the third attempt holds and travels to hover beside the laptop | the **lid opens on the way down**, passing behind the ball (kept: depth, not a product demo); the **screen wakes with the index reveal as the view settles** | camera drops to desk height and orbits to the side (`deskmove-descend`, approved) |
| 2.3 | **And I build it** | two beats, one action each (see below): **build**, it turns fully into glass while still hovering; **ship**, only then does it fall and land beside the laptop | **low side view** at desk height: the waterfall edge in frame, the void beyond; laptop open, the index on its screen | settles |
| 2.3→3 | Into the work | glass, at rest; passes in the foreground, refracting the screen | the laptop screen shows the **project index** | camera orbits square to the screen and pushes in until the 16:10 screen fills the frame; the live index takes over (`deskmove-push`, approved) |
| 3.0 | Project index | glass, small, to one side | the index is the full screen | – |
| 3.1–3.3 | Project full screens | glass (reflects each set) | per project | one push-in per project |
| 3.4 | In progress | dense ball (not shipped) | two plinths | short push-in |
| 4 | Toolkit | – | bead canvas | logos burst from centre |
| 5 | About | – | – | horizontal text travel |
| 6 | Testimonials | – | – | – |
| 7 | Contact | glass, at rest, one soft light | black void | final push-in |

Removed: the gravity grid and bead-canvas stations (the bead canvas survives only in the toolkit), "And then it ships" as its own beat (merged into step 3), and the phone / A/B printouts / findings notes.

**2.3, build then ship (approved 2026-10-08).** Through the whole page the sand is weightless: it drifts, compacts in mid-air, hovers through every attempt. The moment it becomes a product is the first time it has weight. The idea floats; the product lands. So the ball keeps its high hover after the descend (the drop is the meaning; a low hover would shrink the landing to a nudge), and the beat is split so each part reads:
1. **Build:** the inside-out clearing completes while the ball hovers in place.
2. **Ship:** only once it is fully glass, it falls: accelerating like a real fall (gravity curve on scroll, not an eased glide), one small soft settle on contact, glass on wood, no bounce. Its shadow shrinks and sharpens into a tight contact shadow as it falls; the shadow sells the weight.
3. **Push:** the camera moves into the screen, the glass ball resting where it refracts the screen in the foreground.
Never: glass and fall at once (two ideas blur), an eased drift down (reads as floating), a bounce. All scroll-driven; scrolling back lifts it off the desk, it loses its weight and turns back to sand.

**Camera moves (built 2026-10-08).** The camera orbits a moving centre (distance, height angle and bearing interpolated, bearing turning only once the view has tipped off the vertical), so leaving the overhead view never spins the image. Each move exports per frame: camera position, rotation, lens, focus, the ball's centre and the screen's four corners. The live index sits on those corners during the push and takes over at the last frame, so the screen is never a baked image on the site (the review clips bake it, with the camera finish's vignette).

Step 2 is the risk: a ball flickering between states reads as a glitch. It must read as progress: three distinct attempts, each clearing further than the last, each collapse visibly fighting back, all scrubbed by the visitor's scroll.

## 3. Pipeline

**Blender (source of truth for look).** One scene file per station, built by `blender/lookdev/lookdev.py` (extended), sharing the sand/glass materials and the grade. Changes already agreed:
- Loader, hero, studio: **pitch black void**, every light invisible to the camera (`visible_camera = False`), illumination unchanged. The **glowing LIAM HASSON** is the single allowed exception.
- Chapter 3: the sphere **floats in black**; backdrop and softboxes invisible to the camera, their light kept. Expect the glass to read darker inside; the rims carry it.
- Camera moves rendered as **frame sequences** (AVIF, ~1440px, 48–96 frames each), one per transition row in §2, with the **camera path exported** (position, rotation, focal length per frame) as JSON.
- Sets rendered as **depth-layered plates** (background / mid / foreground) for in-station parallax.
- New sets: project index, three project sets (Eventread venue / Cyvore violet / Pulse blue, each with its Blender-modelled device), in-progress plinths, toolkit on the bead canvas, About set, Contact.

**Real-time (three.js, one fixed canvas).**
- The sand/ball: GPU particles drawn as **lit, depth-tested sphere impostors** (solid, matte, no additive glow), with the **same grain data** exported from the look-dev script so the filament structure is identical to the renders.
- Cursor: a light uniform (brighten near the cursor, falloff with distance) plus a low-res screen-space drift field (curl noise, dissipation). Active on every station where the sand is on screen.
- Scroll: Lenis + GSAP ScrollTrigger drive (a) the frame index of the current camera sequence, (b) the camera from the exported path, (c) the sphere's state and position, (d) the text. Scrubbed both ways.
- Transformations: the ball contracting into glass is a shader blend driven by scroll (inside-out clearing, warm frost, flush surface), matched to `lookdev-ch3-mid.jpg`.
- Fallbacks: reduced motion and no-WebGL get the still renders per station and all copy.
- Budget: 60fps on a mid-range laptop; frame sequences streamed per station; quality tiers and the runtime governor from plan 2a stay.

## 4. Type and copy system

- **Sans only.** Working family Hanken Grotesk (final pick side by side with Aeonik as the reference), DM Mono for labels.
- **Weights:** display 400, buttons/labels 500, **no 700/800**. Emphasis by **italic**, by size, and by opacity (secondary lines at ~60%).
- **Scale:** display lines large (clamp 3–7vw), uppercase for manifesto-style lines, sentence case for personal lines. One idea per line.
- **Horizontal text travel** (About, and the hero→desk copy): sentences exit left and enter right with scroll.

## 5. Chapters (approved copy)

**0 Loader (5.4s, max 6s, not skippable, once per session).** Darkness → the light finds the sand → "Hi, I'm Liam." types → the name glows up in the haze → "I build ambiguous ideas" rises → "Product Designer" label + scroll cue → scroll unlocks, nav last.

**1 Hero.** Name, title and one line, all at once (no word swap): "Hi, I'm Liam." / Product Designer / "I build ambiguous ideas into products where design and user needs meet."

**2 How I work (one desk at night, three views).** 2.1 "I look for problems nobody pointed at." / 2.2 "Then I test solutions." / 2.3 "And I build it." (Approved by Liam, 2026-10-08.)

**3.1–3.4 The work.** First a compact **index** (all five, one line each). Then one full screen each for the live projects, each with: title, one line, three pills, impact.

| Project | Title | Line | Pills | Impact |
|---|---|---|---|---|
| Eventread | Eventread · SaaS web app | The check every booker skips. | End-to-end design · API integration · Risk formula | Finds every competing event, ticketed or not, before the date is booked. |
| Cyvore | Cyvore · B2B website | A cybersecurity startup needed a site investors would believe in. | Research · Information architecture · Micro-animations | Closed their first funding round. |
| Pulse | Pulse · Fitness app | A goal-focused fitness app designed around four retention milestones. | Branding · Retention research · Cross-feature implementation | Designed around four retention milestones. |
| Nordic Logic | Nordic Logic · B2B website | A carrier invoice audit startup that needed to build trust without any social proof or clients. | 3D motion design · B2B website · UX research | In progress |
| Stub | Stub | Coming soon | – | – |

Eventread's device shows the **month calendar laid out by risk** (the results view). Proposed capture: Berlin, November 2026, Rock, 500–1,500 cap (the live app's own example), captured from eventread.vercel.app, no login.

**4 Toolkit.** The 3D bead canvas returns under the logos. Copy on one line: "My toolkit *never stops* expanding." "My toolkit" slides in from the left, "expanding" from the right, then "never stops" fades in. Logos scale up from near the centre and travel to their resting spots, staggered, scrubbed (as on the live site). Chip: "My current challenge: 3D modeling with Blender".

**5 About.** Text: `docs/copy/about.md` (approved). Presentation: Lusion manifesto model, sentence by sentence, horizontal travel with scroll, italic emphasis on one phrase per sentence. Portrait and View resume stay.

**6 Testimonials.** The two quotes.

**7 Contact.** "Got something on your mind?" / Based in Berlin, Germany / Email (copies) / LinkedIn / Phone.

## 6. The work section: why full screens can fail, and the guards

Fails when: five identical layouts in a row (template, buries 3–5); no overview for a skimmer; a pinned screen with only a title on black; heavy on mobile.
Guards: the **index first**; full screens only for the three live projects; a **different composition per project** (device type, sphere position, set colour); no pin longer than ~1.2 screens; nav always visible; the in-progress pair on one quiet screen.

## 7. Case studies: thinking before building

What exists today (live site): Eventread is a long research-led page (origin story, problem, personas, market, competitor table, the Danger Score formula with worked examples, the two-API architecture, the "how I built it" steps, challenges and solutions). Pulse is brand → challenge → retention milestones with numbers → solution → onboarding → three usability-testing decisions → process. Cyvore (not re-read today) has the four-panel hero, before/after and a testimonial.

Proposed shell (from the original spec, still valid): back button to the exact card, pill nav with reading progress, `SectionLabel`, `StatCard` count-ups, `Device`, `BeforeAfter`, `FlowSequence`, `Quote`, `ProcessList`, `Marquee`, plus the signature interactions: Cyvore's clickable four-tab hero, Pulse's pinned flow step-through, Eventread's live Danger Score calculator.

Open questions for the case studies are in §9; they must be answered before a case-study plan is written.

## 8. Build order (after this plan is approved)

1. **Blender:** black-void re-renders (loader, hero, studio) → the three transition camera sequences for hero→desk, desk→grid, grid→canvas → review with Liam.
2. **Real-time prototype:** sand + ball + cursor light/drift + scroll spin, compared with the renders → review.
3. **The hero→desk pull-back** live, with the exported camera path → review (this proves the whole approach).
4. Remaining stations and transitions, chapter by chapter, each with a review.
5. Work section (footage capture first; Blender devices and sets), toolkit, about, testimonials, contact.
6. Case studies (after their plan).

## 9. Decisions (answered by Liam, 2026-10-08)

1. **Hero → desk:** one continuous space. The hero's void is the dark room above the desk; the camera pulls back and tilts down, the ball shrinks, the lamp-lit desk fades up beneath it.
2. **Contact:** the glass sphere returns, at rest, one soft light.
3. **Pulse pill:** "Retention research".
4. **Eventread impact:** "Finds every competing event, ticketed or not, before the date is booked."
5. **Eventread calendar capture:** Berlin, November 2026, Rock, 500–1,500 (the app's own example).
6. **Case studies:** their own visual worlds, no sphere (original spec). The sphere's story lives on the home page.
7. **Loader:** once per browser session.
8. **Typeface:** decided from a side-by-side sheet (Hanken Grotesk and three alternatives next to Aeonik); Liam picks.

10. **Laptop:** MacBook Pro form, Space Black, grain mark as a polished inlay at 55 mm; the mark's silhouette at distance is accepted as is.
11. **Lid** opens during the descend; the **screen wakes** on arrival at 2.3 (the reveal plays as the side view settles).
12. **2.3** is split into build (glass while hovering) and ship (a real fall and landing); the high hover stays.

**Status:** complete; build step 1 in progress (pull-back and the three desk moves approved; next: the 2.2 attempts).

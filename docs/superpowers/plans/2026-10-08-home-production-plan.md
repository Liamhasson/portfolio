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

## 2. The sphere's journey (proposal: "stations in the dark")

Scroll always moves the camera **forward** on z. The sets are stations in a black void; the next one emerges from the depth as the previous falls behind. The sphere is the constant, and it **changes position and depth at every station**. No cuts; every move is a rendered camera path (decision A) with parallax layers inside a set (decision B).

| # | Station | Sphere state | Sphere in frame | Camera move into it |
|---|---|---|---|---|
| 0 | Loader (void) | chaos, drifting | fills the frame, centred | none: light finds the sand |
| 1 | Hero (void + glowing name) | chaos → dense ball | large, exact centre, in front of the name | scroll compacts the sand; ball turns with scroll, idles after |
| 1→2.1 | **Pull-back** (the Lusion move) | dense | shrinks toward the distance | camera pulls back and tilts down; the lamp-lit desk fades up beneath the ball: the hero's void was the dark room above the desk; the name recedes and dims |
| 2.1 | Desk | dense, alive, flares | low right, close, hovering over the notes | holds; parallax on the notes with the cursor |
| 2.1→2.2 | Rise | dense | lifts off the desk, small | camera rises and pushes forward into the dark; the glowing grid floor emerges below |
| 2.2 | Gravity | dense | small and far, centred over the well | holds; the grid bends under it |
| 2.2→2.3 | Drop | dense | grows, drifts left | camera drops to bead-canvas level, pushing forward |
| 2.3 | Canvas | dense | mid-left, mid distance | holds; beads crowd it and part around the cursor |
| 2.3→3.0 | Approach | dense | comes toward the camera, to centre | camera glides forward into the studio glow |
| 3.0 | Studio | dense → **contracts into glass** | centre, then slightly smaller | holds through the transformation |
| 3.0→3.1 | Index | glass | drifts to one side, small | camera pulls back; the project index fades in |
| 3.1–3.3 | Project sets | glass (reflects each set) | varies per project: right/left/top, never the same twice | one push-in per project, device enters from the depth |
| 3.4 | In progress | dense (not shipped) | two small balls on plinths | short push-in |
| 4 | Toolkit | none | – | the bead canvas returns, logos burst from centre |
| 5 | About | none | – | horizontal text travel (Lusion manifesto) |
| 6 | Testimonials | none | – | – |
| 7 | Contact | glass, at rest | centre, one soft light | final push-in, then stillness |

Two things to decide on this table (see §9): whether the hero void is literally the room above the desk, and whether the glass sphere returns at Contact.

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

**1 Hero.** Copy: "Hi, I'm Liam. I build ambiguous ideas → into products where design and user needs meet." Label: Product Designer.

**2 How I work.** 2.1 "I go looking for problems." / 2.2 "Then I check if I'm actually right." / 2.3 "Then I build it." (Supporting lines as in concept v3.)

**3.0 It ships.** "And then it ships."

**3.1–3.4 The work.** First a compact **index** (all five, one line each). Then one full screen each for the live projects, each with: title, one line, three pills, impact.

| Project | Title | Line | Pills | Impact |
|---|---|---|---|---|
| Eventread | Eventread · SaaS web app | The check every booker skips. | End-to-end design · API integration · Risk formula | Accurate search and results covering every industry that competes with live shows. *(tighten with Liam)* |
| Cyvore | Cyvore · B2B website | A cybersecurity startup needed a site investors would believe in. | Research · Information architecture · Micro-animations | Closed their first funding round. |
| Pulse | Pulse · Fitness app | A goal-focused fitness app designed around four retention milestones. | Branding · **Retention research** *(proposed in place of "business-focused design", see §9)* · Cross-feature implementation | Designed around four retention milestones. |
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

## 9. Open questions (answer before step 1)

1. **The hero void = the room above the desk?** The pull-back reveals the desk beneath the ball (one continuous space), versus the desk emerging from the depth as a separate station.
2. **Does the glass return at Contact?** The table assumes yes, at rest, one soft light.
3. **Pulse pill:** replace "business-focused design" with "Retention research" (what you described), or another wording?
4. **Eventread impact line:** keep as written, or tighten (e.g. "Finds every competing event, ticketed or not, before a date is booked")?
5. **Eventread calendar capture:** Berlin / Nov 2026 / Rock / 500–1,500 (the app's own example), or a different search?
6. **Case studies:** do they keep their own visual worlds (Pulse blue, Cyvore violet, Eventread light) as the original spec says, or inherit the black void and the sphere? Does the sphere appear inside case studies at all?
7. **Loader frequency:** once per session (current) or every visit.
8. **Typeface:** Hanken Grotesk vs alternatives, decided side by side against Aeonik.

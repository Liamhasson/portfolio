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

## 2. The story and the sphere's journey (restructured 2026-10-08)

The object performs each step of "how I work"; the sets support it, they don't carry it. One desk, three moments in the life of a project, the camera tracking along it. Scroll always moves the camera; no cuts.

| # | Moment | Sphere | Set / light | Camera |
|---|---|---|---|---|
| 0 | Loader | chaos, introduced | black void | none: the light finds the sand |
| 1 | Hero: name, title, one line | chaos, moving around itself (never forms) | black void + glowing LIAM HASSON (the one light exception) | holds; cursor light + drift |
| 1→2.1 | Pull-back | chaos | the void is the dark room above the desk | pulls back and tilts down; the lamp finds the desk beneath |
| 2.1 | **I look for problems nobody pointed at** | chaos **compacts into the dense ball** (scroll-driven) | **night**: lamp, handwritten questions, transcript, picks | settles over the desk |
| 2.1→2.2 | Track | ball | time passes | lateral dolly along the same desk |
| 2.2 | **Then I check if I'm actually right** | **three attempts**: clarity sweeps in from the core and collapses back to sand; each attempt gets further; the third tips over | **daylight**: phone running a prototype, versions A and B, findings on sticky notes, cold coffee | slow track continues |
| 2.2→2.3 | Track | the third attempt holds | daylight fades | lateral dolly |
| 2.3 | **And I build it** | **turns fully into glass** and comes to rest (this is "it ships") | **late night**: desk cleared to a laptop, screen glow the only light | settles; the laptop screen hands off into the work |
| 2.3→3 | Into the work | glass | – | push into the laptop screen → the work index |
| 3.1–3.3 | Project sets | glass (reflects each set) | per project | one push-in per project |
| 3.4 | In progress | dense ball (not shipped) | two plinths | short push-in |
| 4 | Toolkit | – | bead canvas | logos burst from centre |
| 5 | About | – | – | horizontal text travel |
| 6 | Testimonials | – | – | – |
| 7 | Contact | glass, at rest, one soft light | black void | final push-in |

Removed: the gravity grid (2.2) and the bead-canvas set (2.3) as story stations, and "And then it ships" as its own beat (merged into step 3). The bead canvas survives only in the toolkit.

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

**2 How I work (one desk, three moments).** 2.1 "I look for problems nobody pointed at." / 2.2 "Then I check if I'm actually right." / 2.3 "And I build it." *(Exact wording to confirm with Liam.)*

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

**Status:** approved for build step 1 once Liam confirms this document.

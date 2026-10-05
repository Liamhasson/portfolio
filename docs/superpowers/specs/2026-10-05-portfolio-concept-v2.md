# Liam Hasson Portfolio: Concept v2

**Status:** draft for Liam's approval (2026-10-05). Supersedes the home-page concept in `2026-10-01-portfolio-site-design.md` §3.1, §4.1–4.3 and its §12 amendment where they conflict. Phase 1 (foundation) stands as built. Case-study content (§4.4–4.5 of the original spec) stands.

**Storyboard:** `docs/storyboard/portfolio-storyboard.html` (v2), published as the "Portfolio Storyboard" artifact.

---

## 1. The idea in one paragraph

One object travels through the whole site: a sphere that is **Liam's process made visible**. It begins as **scattered particles** (ambiguity), scroll pulls them into a **dense ball of particles** (an idea taking shape, still alive and being tested), and at the work section the particles **fuse into one polished rose-gold sphere** (the shipped product). Every chapter puts the sphere in a different set, with its own background, light and use, the way oryzo.ai stages its coaster. Scrolling back up reverses every step, so the ball also quietly says "iteration".

The work is the substance; the sphere is the thread that makes the visit memorable.

## 2. Why this works for the audience

The audience is in-house hiring (design leads, product managers, recruiters). They skim. So:

- The story needs no explanation: a visitor watches the process happen to the object. Nothing is claimed that the work doesn't show.
- **Work is always one click away** (the nav), and the whole page is capped at about **14 to 16 screens** (oryzo.ai is about 48 screens; that length suits a brand stunt, not a hiring skim).
- Case studies remain the depth. The home page earns the click.

## 3. The object

| State | Look | Meaning | Where |
|---|---|---|---|
| **Chaos** | Scattered, drifting particles with no order | Ambiguity: the messy start | Loader, start of the hero |
| **Dense ball** | A tight, very dense sphere of particles; surface alive, slight shimmer | An idea taking shape, still being researched and tested | End of the hero, the three "How I work" chapters, in-progress projects |
| **Polished ball** | One smooth, solid, mirror-polished **rose-gold metal** sphere | The final product: shipped | The fusing moment, the three live projects, contact |

**Rules**
- The sphere's centre is always exactly where the layout puts it (centred in the hero; measured automatically, as already planned).
- Every transition is scroll-driven and reversible. The only timed motion is the loader.
- **Particles never morph into other shapes** (no logos, portraits or devices). They only ever become the ball or leave it.
- In-progress projects (Nordic Logic, Stub) show the ball still as dense particles: not shipped yet. Live projects show it polished.
- Once polished, the sphere reflects its surroundings: each project's set and that product's screens show in its surface.

**Density.** The dense ball must read as a solid mass of particles, not a sparse shell: target about 160,000 particles on capable machines, with tiers for weaker ones (as planned).

**The fusing moment** is the climax and the hardest visual: particles converge onto the surface, grow and brighten, a light sweep crosses the ball, and the solid metal sphere takes over (same lighting environment, so it reads as one object changing state). It is prototyped first after this concept is approved.

## 4. Chapters (scroll order)

Lengths are approximate; total about 14 to 16 screens. Each chapter is a **set**: a non-flat background with cinematic light, rendered in Blender, with the live sphere composited in front, lit by the same environment.

**0. Loader (timed, ≤ 6s, not skippable, once per session).** Design-tool handles draw a circle and its bounding box in the dark (the language of a vector editor: anchor points, dashed guides). A dot ignites at the centre and bursts into the particle chaos while "Hi, I'm Liam." types in. Scroll unlocks; the nav appears last.

**1. Hero: ambiguity becomes an idea (~3 screens, pinned).** A dark, hazy set with a soft rim light and a floor that catches a faint reflection. A giant "LIAM HASSON" wordmark sits in depth: the cloud drifts in front of and behind the letters. Scrolling pulls the chaos into the dense ball while the copy swaps: "I build ambiguous ideas" → "into products where design and user needs meet." A small "Product Designer" label stays visible.

**2. How I work: three short chapters with the dense ball (~3 screens).** Same ball, three sets, three kinds of light:
- **2.1 Finding the problem.** A research desk at night under a warm lamp: interview notes, sticky notes, printed competitor screens, a pen. The ball sits among the clutter.
- **2.2 Checking I'm right.** A test bench in cool daylight: a measuring grid, calipers, two printed versions labelled A and B. The ball is being measured.
- **2.3 Building it.** Inside a design-tool canvas: the ball in a frame with selection handles, layout guides and a cursor labelled "Liam".

**3. The work: it ships (~4 screens).**
- **3.0 The fusing moment.** The dense ball fuses into the polished rose-gold sphere. Headline: "And then it ships."
- **3.1 to 3.3 Live projects.** Each project gets its own set, with its device (Blender-modelled laptop or phone) playing the real recorded footage beside the sphere, which reflects it:
  - **Eventread:** a dim live-music venue, stage light through haze. Footage: date picker → results marked Critical, Threat, Safe.
  - **Cyvore:** a dark violet, technical set. Footage: the four-panel hero (Security, Exposure, Coverage, Enables).
  - **Pulse:** a cool blue training space. Footage: the phone flows.
  Click opens the case study (the device carries over into its hero).
- **3.4 In progress.** Nordic Logic and Stub on smaller plinths, each with the ball still in particles, labelled "In progress", not clickable.

**4. Toolkit (~1 screen).** A pegboard and shelf set with the tools as physical objects (a scrubbed spread, no particles). "My toolkit never stops expanding." Chip: "Current challenge: 3D in Blender (you're looking at it)."

**5. About (~2 screens).** Portrait in a warm set, "I love looking for problems", "I own my work" (the band story), the six capabilities (market research, user research, streamlining workflows, design systems, interaction design, rapid prototyping), View resume.

**6. What people say (~1 screen).** The two testimonials (Yoav Rotem, CTO Cyvore; Andrada Popan-Dorca, UX Mentor CareerFoundry).

**7. Contact (~1 screen).** The polished sphere at rest, centred, catching a single soft light. "If you made it here, let's just talk?" Email (copies on click), LinkedIn, phone.

## 5. Visual language

- **Type: sans-serif only. No serif anywhere.** One free, self-hosted variable grotesk for display and text, plus **DM Mono** for technical labels and footnotes. Starting choice for the storyboard: **Hanken Grotesk** (variable 300–800). Final family chosen side by side against oryzo.ai's Halyard Display before the build; candidates: Hanken Grotesk, Instrument Sans, Onest, Schibsted Grotesk, Host Grotesk. Accent words are set by weight and colour, never by a serif italic.
- **Overlay motif: design-tool handles.** Bounding boxes, anchor points, dashed guides and measurement labels in DM Mono frame the sphere at key moments, the way oryzo.ai uses vector-editing handles. It is Liam's own tool language as a product designer.
- **Footnotes with dry wit**, in DM Mono, bottom corners, like oryzo.ai's formulas (see §6).
- **Colour:** each set has its own light and palette; the constants are black, warm white text, and the rose-gold sphere.
- **Navigation:** the floating pill nav stays (Projects, About, Contact) with the sliding highlight.

## 6. Voice and copy (draft, for Liam to edit)

Light, personal, memorable; not satire and not formal. It should feel like getting to know Liam. Built from lines Liam already wrote. Facts marked *(confirm)* need Liam's check.

| Where | Headline | Supporting line | Footnote (mono) |
|---|---|---|---|
| Hero | Hi, I'm Liam. I build ambiguous ideas → into products where design and user needs meet. | | |
| 2.1 | I go looking for problems. | All of my projects started with something nobody pointed at. | Problems found ≥ problems assigned |
| 2.2 | Then I check if I'm actually right. | I test my work against the thing it's replacing. If it doesn't hold up, I reframe and try again. | Confidence = evidence ÷ assumptions |
| 2.3 | Then I build it. | From a Figma playground to a deployed product, with some vibe-coding in the middle. | Handoff gap → 0 |
| 3.0 | And then it ships. | | |
| Eventread | A booking mistake cost my band a release show. | So I built the tool that would have caught it. | |
| Cyvore | A security startup needed a site investors would believe. | They closed their first funding round. *(confirm wording)* | |
| Pulse | *(line to write with Liam: what Pulse is and the outcome)* | | |
| Toolkit | My toolkit never stops expanding. | Current challenge: 3D in Blender (you're looking at it). | |
| About | I own my work. | The band story, as on the live site. | Nothing happens out of luck, only through work. |
| Reviews | Don't just take my word for it. | The two quotes. | |
| Contact | If you made it here, let's just talk? | | Ideas in progress: plenty. Polished balls: 1. |

## 7. Production approach

- **One shared WebGL stage** (single fixed canvas) renders the sphere in all three states. Particles are GPU-driven (as in the existing plan); the polished state is a real-time PBR metal sphere.
- **Sets are rendered in Blender** as backplates (stills or short seamless loops, AVIF/WebM) plus a matching **HDR environment** exported from the same scene. The live sphere is lit and reflects that environment, so it sits in each set convincingly. Set changes are scroll-scrubbed crossfades with a camera move.
- **Devices** (laptop, phone) are original Blender models exported as GLB, with the recorded product footage as video textures.
- **Budgets:** 60fps on a mid-range laptop; quality tiers plus the runtime governor; backplates sized per viewport; total page weight kept reasonable through lazy loading per chapter.
- **Fallbacks:** reduced motion and no-WebGL get still images of each set with the sphere in its state, and all copy.

## 8. Effort and order

This is weeks of 3D work: roughly 9 Blender sets, 2 devices, the three sphere states and the fusing transition. Order:
1. Approve this concept and storyboard v2.
2. Prototype the riskiest pieces for real: the dense ball and the fusing moment into polished rose-gold, in one lit set. Liam reviews against oryzo.ai.
3. Then plans per chapter: hero (rewrite of plan 2a), How I work, the work (with footage capture), the rest.

## 9. Carried over / superseded

- **Carried over:** Phase 1 foundation; the particle engine design, centring measurement, quality tiers, intro gating and loader rules from plan 2a; the footage-capture plan; case-study content and signature interactions.
- **Superseded:** Playfair (serif) accents; "particles in the hero only"; the plain projects grid with floating devices on black; the flat-black sections after the hero.

## 10. Open items

1. Final typeface family (side-by-side test).
2. Pulse copy line (needs Liam's facts).
3. Project tags: Figma and the live site disagree (Eventread, Pulse).
4. Loader frequency: once per session (current) or every visit.

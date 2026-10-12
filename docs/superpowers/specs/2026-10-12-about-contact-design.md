# After the index: About (with the quotes) and Contact

**Status:** designed with Liam in chat on 2026-10-12, with mockups in the brainstorming companion
(`.superpowers/brainstorm/…/content/about-contact.html`). It continues the story of `2026-10-11-scene-order-design.md`
past the projects index, and replaces its §6 placeholder ("About and Contact link to their sections' anchors after the
index… until then their anchors sit at the end of the page"). House rules apply: no glow anywhere, the hero's own sand,
Geist and Geist Mono, the motion is ours, the quality bar of Lusion and Oryzo.

## 1. Decisions (Liam, 2026-10-12)

- **Where:** sections after the index, on the one story page. Not separate routes.
- **What:** About, with the testimonials folded into it, then Contact. No Toolkit (the tools already sit in each case
  study's at-a-glance).
- **World:** past the index the camera goes forward, **through the screen**, into the dark with the sand. At Contact the
  sand gathers into the ball once more and the loader's brief is drawn around it: the site opens with a brief and ends
  asking for the next one.
- **About carries:** the approved text (`docs/copy/about.md`), a portrait, the six skills, a resume link.
- **The quotes:** on About's sideways track, as the proof right after "That's still how I work…". No heading. Built for
  2 to 4 quotes (Emil's, from Nordic Logic, comes later: a content change only).
- **Contact:** "Got something on your mind?", then Email (copies on click), LinkedIn, Phone. No location line.

## 2. The sequence (about 5 screens after the index)

The story's timeline (`story-timeline.ts`) runs on past the index: today it ends at `STORY_SCREENS` (4.3) plus the
`SCREEN_HOLD` (0.8). The new beats follow the hold, in story progress `p` (screens).

### 2.1 Through the screen (~0.7 screen)

- The index's surface comes apart into sand from its centre outward: the grains of the hero's own system, lit by the
  screen's light, opening a hole that grows to fill the frame.
- The camera keeps moving forward, through the hole. The index's DOM fades out as its surface opens and stops taking
  pointer events as soon as the opening starts.
- Beyond the screen is **the hero's void**: the same world as the loader and the hero, with the cloud loose and far.
  The switch from the laptop's camera to the void's camera happens while the sand fills the frame, so it never shows.
- Scroll-driven and reversible: scrolling back closes the screen and the index returns.

### 2.2 About (~3 screens)

A pinned section. A horizontal track moves right to left with scroll (scrubbed, eased, never on its own clock). On the
track, in order:

1. "I'm Liam. I love crafting products where *design and user needs meet.*"
2. "Before design, I spent ten years managing two rock bands and creative projects across a few industries: small
   teams of specialists making something out of nothing."
3. "That's still how I work. I go looking for problems nobody pointed at, check whether I'm actually right, and
   build it."
4. The quotes, one slide each, in this order: Yoav Rotem (CTO, Cyvore), Andrada Popan-Dorca (UX Mentor, CareerFoundry),
   later Emil (Nordic Logic). The quote large, with an opening quote mark hung in the margin; the name and role below
   in Geist Mono caps.
5. **What I do:** a Geist Mono label, then the six skills in two columns, each with a small hollow square (the brief's
   anchor): Market research, User research, Streamlining workflows, Design systems, Interaction design, Rapid
   prototyping. Below, a **View resume ↗** pill in the nav's style (opens the PDF in a new tab).
6. "If you're working on something that really matters to people, I'd like to hear about it." As it leaves, the sand
   begins to gather (2.3).

**Type:** Liam's sentences in Geist 400 at the display size (about 4vw, line height 1.15), emphasis in italic at lower
opacity (the Lusion setting chosen for the site). Quotes slightly smaller (about 3.1vw).

**The portrait:** right of the track, about 21vw wide, 4:5, holding still while the words pass on the left (the track is
clipped before it). Graded into the scene: warm, dark, matched to the sand's palette. In with the first sentence, out
before the last line.

**The sand:** the hero's cloud, far and faint behind the reading (its light scaled down, `uLightK`-style, so text stays
readable at WCAG AA against the darkest-to-lightest sand behind it), its swirl and the cursor's light as in the hero.

**Progress:** a thin line at the bottom of the frame shows how far along the track you are.

### 2.3 Contact (~1.5 screens)

- The cloud gathers into the ball in the centre: the hero's own compaction, a little smaller (the ball about 30% of the
  viewport's height), the camera holding still.
- As it locks in, **the brief is drawn around it**: the loader's drawing (`brief.tsx`), the circle at the ball's exact
  projected outline, the box with its corner anchors, the curve's anchors and handles, the dashed guides. It draws on
  with scroll (the circle and box drawing round, the anchors popping in after) and stays.
- Below the ball: **"Got something on your mind?"** (display size), then three pills in the nav's style:
  - **Email:** shows the address; a click copies it and says "Copied" in place for 2 s (and a `mailto:` for keyboard
    and screen-reader users).
  - **LinkedIn ↗:** `https://www.linkedin.com/in/liamhasson/`, new tab.
  - **Phone:** `+49 160 771 0652`, a `tel:` link.
- The page ends here. The ball keeps its slow idle spin; the cursor's light still touches it.

### 2.4 The nav

- **About** and **Contact** scroll the timeline to their sections, as Projects does now (Lenis, fast-forward, about
  1.5 s), from anywhere, including the hero's first frame. From the case studies they land on the story page's anchors.
- The pills light up for the section in view: About while the track is on screen, Contact at the end.

## 3. Content

| Item | Source |
|---|---|
| About text | `docs/copy/about.md` (approved 2026-10-08), verbatim |
| Yoav Rotem | "We weren't looking for a designer. Liam reached us and thanks to his work, we closed our first funding round." CTO, Cyvore |
| Andrada Popan-Dorca | **owed by Liam:** the full quote (the live site truncates it). Cut only at sentence boundaries, approved by Liam. UX Mentor, CareerFoundry |
| Emil (Nordic Logic) | later |
| Portrait | **owed by Liam:** a photo; graded to the scene |
| Resume | the current PDF link from the live site; replaced when Liam's new resume arrives |
| Contact | Liamhasson@gmail.com · linkedin.com/in/liamhasson · +49 160 771 0652 |

All content lives in one typed module (like `src/content/case-studies/*`), so a quote, the resume or a detail is a
one-line change.

## 4. Accessibility, phones, fallbacks

- **Reading order:** everything is real text in the DOM, in story order; the track is presentation only. Headings:
  About and Contact as section headings (visually hidden where the design has none).
- **Keyboard:** the pills and links are reachable in order; focusing a link on the track scrolls it into view.
- **Reduced motion:** no sideways scrub and no camera move: the screen fades to the void, About's slides stack
  vertically and fade in, the ball is held formed at Contact, the brief shown drawn.
- **Phones (portrait):** the track becomes a vertical sequence, one sentence per screen, sliding up; the portrait sits
  above the first sentence; the Contact pills stack.
- **No WebGL:** the existing fallback stills; About and Contact are plain sections on the graded black, the ball as the
  approved still with the brief drawn over it.

## 5. How it's built

- **Timeline:** `story-timeline.ts` gains the beats after the hold (through, about, contact) as named spans, with tests
  like the existing ones; the page's length grows accordingly. The index's anchor (`#projects`) is unchanged; `#about`
  and `#contact` move to the start of their sections.
- **Through the screen:** a short GPU dissolve of the screen's surface into grains (stateless, in the vertex shader,
  like `rising.ts`), plus the camera switch hidden behind it. The index DOM fades and goes inert.
- **New modules** (`sand-lab.tsx` is already 1,000 lines and only wires them):
  - `about-track.tsx`: the pinned track, its slides, the portrait, the progress line; its motion a pure function of
    progress (tested);
  - `contact-end.tsx`: the headline, the pills, copy-to-clipboard;
  - `after-index.ts`: the camera, cloud light and compaction for these beats as pure functions of `p` (tested).
- **Contact's brief:** the existing `Brief` component, driven from the ball's projection as in the loader's handoff.
- **Performance:** the governor keeps the frame rate; the desk and the rising sand are culled once through the screen.
  60 fps target on the high tier while reading.

## 6. Checks

- Unit tests: the timeline's new spans (monotonic, reversible, the anchors' positions), the track's progress mapping
  (2 to 4 quotes), the copy button's states.
- Frame captures on desktop and phone of each beat, against the mockups.
- The live build: scroll through and back, the nav's jumps from the first frame and from a case study, reduced motion.

## 7. Out of scope

- The Toolkit chapter.
- A contact form.
- Testimonials beyond the quotes on the track (no carousel, no logos).

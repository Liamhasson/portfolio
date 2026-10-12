# About and Contact: their own pages

**Status:** designed with Liam in chat on 2026-10-12, with mockups in the brainstorming companion
(`.superpowers/brainstorm/…/content/about-contact.html`). Replaces §6's placeholder in `2026-10-11-scene-order-design.md`
("About and Contact link to their sections' anchors after the index"). House rules apply: no glow anywhere, Geist and
Geist Mono, the motion is ours, the quality bar of Lusion and Oryzo.

**History, kept short:** first designed as sections after the index on the story page, the index turning into sand at
its end (a prototype: `…/content/index-to-sand.html`). Liam judged that too complicated and chose separate pages, joined
by a hand-off at the bottom of each (2026-10-12).

## 1. Decisions (Liam, 2026-10-12)

- **Three pages in a row:** the story (ending in the projects index) → **/about** → **/contact**.
- **The hand-off between them is a deliberate pull** (§2), not an automatic redirect (Claude pushed back: it fires while
  people read, momentum overshoots, and Back from About would land at the index's bottom and redirect again; WCAG
  3.2.5). Click works too.
- **About** carries the approved text (`docs/copy/about.md`) in two colours, the testimonials folded into it, a portrait,
  What I do (under Liam's three verbs, every skill with its proof), and a resume link. **No WebGL**: the quiet reading
  page.
- **Contact** is the ending: the live sand, entering the way the loader does, gathers into the ball inside the brief;
  then "Got something on your mind?" with Email (copies on click), LinkedIn, Phone. No location line.
- No Toolkit section (the tools sit in each case study's at-a-glance).

## 2. The hand-off: a deliberate pull

At the bottom of the story's index and of About:

- **The next page peeks in:** its opening, in its own look ("About" with the first line of the text; "Contact" with
  the brief's circle), the same pattern as the case studies' Next project. It is a link: a click opens it.
- **Scrolling on past the end** fills a thin line (warm hairline, the brief's colour) across the peek. When it is full,
  the next page opens. Stop and it holds; scroll back and it empties. About 0.6 screen of extra scroll to fill, so a
  trackpad's momentum alone never fills it.
- **Back never re-triggers:** arriving back at a page (history navigation) lands just above the pull with the line
  empty; it needs a fresh scroll down.
- **Keyboard and screen readers:** the peek is an ordinary link ("Next: About"); the line is decoration.
- **Reduced motion:** the peek and its link; no fill gesture (a click or Enter opens it).
- **Phones:** the same, by touch scroll; the fill needs a deliberate drag past the end.
- Between the pages: the next page enters with its own entry (About: the text track's first line slides in; Contact:
  the brief grows), no cross-page morph.

## 3. About (/about)

A pinned page. A horizontal track moves right to left with scroll (scrubbed, eased, never on its own clock); a thin
progress line at the bottom shows how far along it is. On phones (portrait) the track becomes a vertical sequence, one
sentence per screen, sliding up.

### 3.1 The track, in order

1. "I'm Liam. I love crafting products where design and user needs meet."
2. "Before design, I spent ten years managing two rock bands and creative projects across a few industries: small
   teams of specialists making something out of nothing."
3. "That's still how I work. I go looking for problems nobody pointed at, check whether I'm actually right, and
   build it."
   Then *"End to end, from the problem to the shipped product"* (plain text, not a link: Liam, 2026-10-12) as its own slide: the story's
   conclusion (Liam, 2026-10-12: it read disconnected before What I do).
4. **The quotes**, one slide each, as the proof of that claim: Yoav Rotem (CTO, Cyvore), Andrada Popan-Dorca (UX Mentor,
   CareerFoundry), later Emil (Nordic Logic). The quote large, an opening quote mark hung in the margin, name and role
   below in Geist Mono caps. Built for 2 to 4 quotes: adding one is a content change.
5. **What I do:** one slide per verb. Each skill: a small hollow square (the brief's anchor), its name, and one short proof line in
   the darker tone that links to its case study.
   - **Find the problem:** User research (*Pulse: what 5 of 6 testers expected reshaped the onboarding*) · Market &
     competitor research (*Eventread: Prism.fm, TourSmart, ChatGPT each answer part; none checks the whole night*) ·
     Information architecture (*Cyvore: finding a section, 35s → 8s*).
   - **Check I'm right:** Usability testing (*Pulse round 2: 6 of 6 completed every task*) · Data-informed decisions
     (*Eventread: risk bands checked on 3,172 real listings*) · Stakeholder communication (*Cyvore: argued for a
     7-second animation over the full video; it shipped*).
   - **Build it:** Interaction & motion (*Cyvore: the mission animation, the CTA's states*) · Design systems
     (*Eventread: one type family, three risk colours, a CI test*) · Web design (*Cyvore's investor site, and this one*)
     · Branding (*Pulse: the brand and its promise*) · Prototyping in code (*Eventread: built and shipped in Next.js*)
     · 3D modeling (*this site: the desk and the laptop, modelled and lit in Blender*; no link).

   Then **View resume ↗**, a pill in the nav's style (the PDF, new tab).
6. "If you're working on something that really matters to people, I'd like to hear about it." Then the pull to
   Contact (§2).

### 3.2 Type: two colours

Geist 400 at the display size (about 4vw, line height 1.15). The important part of each sentence in the near-white, the
rest in the darker tone; no italic (Liam, 2026-10-12). Quotes slightly smaller (about 3.1vw), the same two colours.

| Sentence | In white |
|---|---|
| 1 | "I'm Liam. I love crafting products" |
| 2 | "ten years managing two rock bands" … "making something out of nothing" |
| 3 | "That's still how I work." … "problems nobody pointed at" |
| Yoav's quote | "we closed our first funding round." |
| 6 | "I'd like to hear about it." |

Andrada's and Emil's highlights are chosen with Liam when their quotes arrive.

### 3.3 The portrait and the ground

- The portrait: right of the track, about 21vw wide, 4:5, holding still while the words pass (the track is clipped
  before it). Graded warm and dark, into the site's palette. In with the first sentence, out before the last line.
- The ground: the graded black (#0b0908) with the site's film grain; no sand, no WebGL.

## 4. Contact (/contact)

One screen, no scroll.

1. **The brief grows** in the centre, exactly as the loader's does (`brief.tsx`, `BriefGrowth`): from a point, its size
   the loading progress of the sand (the light tier's grains, about 0.7 MB, plus the three density volumes, about 3.5 MB: about 4.2 MB in all; final review 2026-10-12), at least 1.2 s. The words never wait for it: they are in by 8 s after the page opens, whatever the load is doing.
2. **At 100% its anchors become grains** and split (the loader's cascade, `cascade.ts`), but the grains **gather into
   the ball** inside the brief instead of building the vortex: the hero's own ball, about 30% of the viewport's
   height, lit by the hero's light.
3. **The brief stays**, drawn at the ball's exact projected outline (it does not dissolve, unlike the loader's): the
   circle, the box with its corner anchors, the curve's anchors and handles, the dashed guides.
4. **The words arrive** below: "Got something on your mind?" (display size), then three pills in the nav's style:
   - **Email:** shows the address; a click copies it and says "Copied" in place for 2 s; a `mailto:` for keyboard and
     screen-reader users.
   - **LinkedIn ↗:** `https://www.linkedin.com/in/liamhasson/`, new tab.
   - **Phone:** `+49 160 771 0652`, a `tel:` link.
5. The ball keeps its slow idle spin; the cursor's light touches it.

- **Reduced motion:** the brief drawn, the ball held formed (no cascade), the words in with a short fade.
- **No WebGL or an error:** the approved ball still with the brief drawn over it; the words and pills as normal.
- Arriving directly (a shared link) or from the pull: the same entry.

## 5. Navigation

- The pill nav: **About** → `/about`, **Contact** → `/contact`, from every page (next/link). **Projects** stays as it is
  (the story's index). The pill for the current page is lit.
- The story page's `#about` and `#contact` anchors are removed; deep links to them redirect to the pages.
- The pulls: index → /about, About → /contact. Contact is the end.

## 6. Content

| Item | Source |
|---|---|
| About text | `docs/copy/about.md` (approved 2026-10-08), verbatim |
| Yoav Rotem | "We weren't looking for a designer. Liam reached us and thanks to his work, we closed our first funding round." CTO, Cyvore |
| Andrada Popan-Dorca | "Exceptional talent, a strong aesthetic sense, and an in-depth ability to make inquiries about the problems he is trying to solve." UX Mentor, CareerFoundry (from the live portfolio; in white: "an in-depth ability … to solve.") |
| Emil (Nordic Logic) | later |
| Portrait | **owed by Liam:** a photo; graded to the site |
| Resume | `/Liam-Hasson-Resume.pdf`, hosted on the site (Liam's new resume, 2026-10-12) |
| Contact | Liamhasson@gmail.com · linkedin.com/in/liamhasson · +49 160 771 0652 |

All of it in one typed content module (like `src/content/case-studies/*`): a quote, the resume or a detail is a
one-line change.

## 7. How it's built

- **Routes:** `src/app/about/page.tsx`, `src/app/contact/page.tsx` (read `node_modules/next/dist/docs` first: this
  Next.js has breaking changes).
- **The pull:** one component, `next-page-pull.tsx`, used at the bottom of the story's index and of About. Its fill a
  pure function of overscroll (tested); history arrivals reset it.
- **About:** `about-track.tsx` (the pinned track, slides, portrait, progress line; its motion a pure function of
  progress, tested), content from `src/content/about.ts`.
- **Contact:** `contact-end.tsx` (words, pills, copy-to-clipboard) over a small stage that reuses the sand field, the
  brief, the brief's growth and the cascade, with one new target for the cascade: the ball instead of the vortex
  (tested in the cascade's TS mirror: every grain ends on the ball with no jump).
- **Performance:** About ships no WebGL. Contact loads the light tier only; the governor keeps 60 fps.

## 8. Checks

- Unit tests: the pull's fill and reset, the track's progress mapping (2 to 4 quotes), the copy button's states, the
  cascade's ball target.
- Frame captures, desktop and phone, of each page against the mockups.
- The live build: the pulls (wheel, trackpad momentum, touch, keyboard), Back from each page, reduced motion, direct
  links.

## 9. Out of scope

- The index turning into sand (the earlier transition).
- The Toolkit chapter, a contact form, testimonials beyond the quotes on the track.

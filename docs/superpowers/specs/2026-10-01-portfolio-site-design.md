# Liam Hasson Portfolio: Design Spec

**Date:** 2026-10-01
**Status:** Awaiting review
**Replaces:** https://liamhasson.figma.site (Figma Sites)
**Launch domain:** liamhasson.com (bought at launch)

---

## 1. Goal

Rebuild the portfolio in code so it represents Liam better than the Figma Sites version, without its limits. Figma stays the sketchboard. The site is built and deployed from code.

**Audience:** in-house hiring managers and recruiters at product companies and startups.
**Positioning:** Product Designer. Motion is the differentiator the site *shows*, never *claims* in copy.
**Bar:** Awwwards Site of the Day polish, with every animation justified.

### Motion principle: "own the animation"

There's no on-page commentary or toggle. Every animation must have one of three jobs, or it gets cut:

| Role | Job | Examples |
|---|---|---|
| Guide | Direct attention in reading order | Section reveals, staggered cards, line-by-line text |
| Explain | Show how a product behaves | Product loops, case-study flow sequences, live calculators, stat count-ups |
| Connect | Link one state to the next | Loader to hero, card to case-study hero, sliding nav highlight, copy-email feedback |

---

## 2. Sources of truth

| What | Source |
|---|---|
| Layout, type, color, content (desktop 1280 / tablet 800 / mobile 375) | Figma file `65QHzAsnx9NtQxHJwmccXf`, page `0:1` |
| Home | Figma section `1:670` (Desktop `1:202`, Tablet `1:358`, Mobile `1:514`) |
| Pulse | Figma section `1:1380` (`1:672` / `1:908` / `1:1144`) |
| Cyvore | Figma section `1:2105` (`1:1382` / `1:1623` / `1:1864`) |
| Eventread | **The live site page `/eventread-case-study` wins over Figma** (Figma section `1:3457` is flagged as outdated). New product imagery is captured from https://eventread.vercel.app |
| Nordic Logic | Not built yet. Card only (see 4.3) |
| **All animation behavior** | **The live site only.** Figma has no motion data. See the inventory in section 3 |
| Resume | Liam provides a new file later. Until then, the current Google Drive link |

**Fonts** (all Google Fonts, no licensing cost): DM Sans (primary UI/body), Host Grotesk, Inter, Playfair Display Italic (rose accent words such as "never stops" and "let's just talk?"), DM Mono, Plus Jakarta Sans (Pulse), Michroma and Iceland (Cyvore). Exact usage per element is taken from Figma during the build.

---

## 3. Live-site animation inventory, and what happens to each

Recorded from the live site at 1440×900 on 2026-10-01. "Live" is what exists today. "New" is the decision for the rebuild. New behavior follows the motion tokens in section 5.

### 3.1 Home

| # | Element | Live behavior | New behavior |
|---|---|---|---|
| H1 | Title intro | **A video** (`485f…`, 12.9s, `mix-blend-mode: screen`) of text cycling "PRODUCT DESIGNER → GROWTH DESIGNER → EXPERIENCE DESIGNER" with blur/fade. It fades out over the first ~1800px of scroll | Replaced by **real text**: a fixed "Product Designer" title plus an alternating line (see 4.1). It's crisp, accessible and indexable |
| H2 | Dot-grid background | Static dotted texture behind the hero | Kept. Rendered as CSS/SVG rather than an image |
| H3 | Particle cloud | **A video** (`1d9f…`, 1920×1080, 6.25s loop, morphing cloud → compact sphere → cloud). Starts at ~0.24 opacity, fades to 1 and **scales from ~1.6× to ~5×** as you scroll the hero and projects, then fades out by ~3900px | Kept as-is: same video asset re-encoded, same fade-in and scale-up scrubbed on scroll. The loader hands off into it (see 4.1) |
| H4 | "Hi, I'm Liam" | Per-character typewriter with a caret, next to the circular portrait, ~1s | Kept: per-character typing with caret, then the caret blinks out |
| H5 | Hero sentence | Fades up (opacity 0→1, y 8→0), scrubbed by scroll | Content replaced by the "I can help you with…" line. Same fade-up, triggered once when the loader finishes |
| H6 | Floating pill nav (Projects / About / Contact) | Fades up on load (opacity 0, y 16 → 0). Hover gives a warm rose fill | Kept, plus a **sliding active-section highlight** and a reading-progress line on case studies |
| H7 | "Projects" intro text | Fades up y 8 → 0 on enter. **Re-hides when scrolled away** | Fades up once and doesn't re-hide |
| H8 | Project cards | Rise from y 100 → 0 as they enter. **Re-hide when scrolled away** | Rise once, 60ms stagger in reading order. Distance tuned to the motion tokens (see 5) |
| H9 | Project card hover | The render crossfades to a **brand-color panel with the project wordmark** (e.g. Eventread green) | Replaced by a **muted product loop** in the card (approved in design review). Brand color stays as the card's hover tint and in the transition into the case study. *See open question Q1* |
| H10 | Horizontal drifting band (~2200px wide, y≈2737) | Moves along X, scrubbed by scroll | Removed with the statement section |
| H11 | Statement "I turn shapes on screens / INTO SOMETHING PEOPLE BELIEVE IN" | Top line scales up (0.38→0.83) and bottom line scales down (1.42→0.97), scrubbed | **Removed**. The work should prove it, not text |
| H12 | Toolkit icons | ~12 tool logos start at scale 0.01, rotated, scattered offsets, and **burst out into their resting positions**, scrubbed by scroll. The large Figma logo drifts horizontally with a slight scale-up | Kept and scrubbed (it naturally reverses because it's tied to scroll). Adds a gentle cursor lean (≤8px, desktop only) |
| H13 | "My toolkit / never stops / expanding" | "My toolkit" slides in from the left (x −150, scale 1.2, opacity 0), "expanding" from the right, "never stops" fades in. Reverses on exit | Kept as-is, scrubbed |
| H14 | "My current challenge: 3D modeling with Blender" chip | Pops from scale 0.5 → 1.02 → 1 | Kept: spring pop, once |
| H15 | About, "I own my work", testimonials | No meaningful motion | Adds a portrait unmask, line-by-line text reveals, and testimonial cards rising in |
| H16 | Contact | Small particle cloud (the same video) above "If you made it here, let's just talk?" | Kept. Email pill **copies to clipboard** and shows "Copied" feedback. LinkedIn and phone stay as links |

### 3.2 Case studies

| # | Page | Live behavior | New behavior |
|---|---|---|---|
| C1 | All | Back button top-left. Its chevron shifts a few px with scroll | Kept. Back goes to the exact card on home with the reverse shared-element transition |
| C2 | Pulse | Tag marquee ("Cross-feature implementation · Onboarding flow · Usability testing · Design system…"), infinite, 48s loop | Kept. Pauses off-screen and under reduced motion |
| C3 | Pulse | Hero phone screen is a 3s video loop. Second phone video (~3s) mid-page | Kept, re-encoded and lazy-loaded |
| C4 | Pulse | Static rotated phone mockups. Flow screens shown as static rows (Screens 1–3, 4–9, 10–12) | **Signature interaction:** flows become a pinned scroll sequence that steps through each screen with captions |
| C5 | Cyvore | Hero interaction shown as a 26.7s video. "After" micro-animation shown as a 13.7s video | Videos kept as supporting media. **Signature interaction:** a working, clickable replica of the 4-tab hero (Security / Exposure / Coverage / Enables) |
| C6 | Cyvore | Before/after shown as stacked images | `BeforeAfter` drag slider |
| C7 | Eventread | Static page | **Signature interaction:** the Danger Score calculator runs live (capacity × genre × timing → score) on the example events. Product screens re-captured from the live app |
| C8 | All | Stats are static numbers | `StatCard` counts up once when 60% visible |

---

## 4. Pages and structure

### Routes

| Route | Page |
|---|---|
| `/` | Home |
| `/pulse` | Pulse case study |
| `/cyvore` | Cyvore case study |
| `/eventread` | Eventread case study |

**Redirects (permanent):** `/pulse-case-study` → `/pulse`, `/cyvore-case-study` → `/cyvore`, `/eventread-case-study` → `/eventread`.

### 4.1 Home: loader and hero

**Welcome loader.** It plays **once per browser session**, on the first arrival only. It never plays between pages or on return visits within the session. Click, scroll or a key press skips it.

1. Dark screen with the dot grid at low opacity, and a small glowing point in the rose accent at center.
2. The point expands into a soft rose field while the greeting types in: "Hi, I'm Liam. Welcome."
3. The field collapses back to a compact sphere and crossfades into the particle video, starting at its **sphere frame**. The video has a compact-sphere phase, so the loader's shape becomes the particle cloud. The cloud then blooms into the hero.
4. Total ≤ 3.2s. Then the hero content plays in.

**Hero hierarchy** (top to bottom in the composition):
- The particle video behind (H3).
- "Hi, I'm Liam" with the portrait, typed (H4). This is the name, so it's small.
- **Title: "Product Designer"**, the largest text, fixed.
- **Alternating line:** "I can help you with **{market research · user research · streamlining workflows · design systems · interaction design · rapid prototyping}**". The phrase swaps with a short vertical slide-and-fade, ~2.4s per phrase. The phrase width animates smoothly with no layout jump. It pauses when the tab is hidden. Under reduced motion it shows a static comma-separated list.
- Floating pill nav fades in last (H6).

### 4.2 Home: sections in order

1. Loader and hero (4.1)
2. **Projects**: heading plus the two-line intro ("I design around the gaps where competitors lose users…"), then a 2-column grid: Eventread, Cyvore, Pulse, Nordic Logic, Stub
3. **Toolkit** (H12–H14)
4. **About me** (portrait and text) → **I own my work** (text and View resume button)
5. **Testimonials** (Yoav Rotem, CTO Cyvore; Andrada Popan-Dorca, UX Mentor CareerFoundry)
6. **Contact** (H16)
7. Footer pill nav

The statement section ("I shape ideas / into something people believe in") is **removed**.

### 4.3 Project cards

- **Live projects** (Eventread, Cyvore, Pulse): hover plays the muted product loop, and the cursor shows the card as a link. Click starts the card → case-study shared-element transition.
- **In-progress projects** (Nordic Logic, Stub): **not clickable** and no link cursor. On hover the image dims slightly and an "In progress" label slides in. They aren't links, so keyboard focus skips them, and screen readers announce the "In progress" status as text.
- Tags under each card as in Figma.

### 4.4 Case-study shell (shared by every case study)

- **Entry:** the clicked card expands into the case-study hero. A direct visit gets a short hero reveal instead.
- **Back button** top-left (C1).
- **Floating pill nav** plus a thin reading-progress line.
- **Section labels:** one shared `SectionLabel` component (eyebrow and heading), tinted per project.
- **Next-project footer:** a large preview of the next live case study (Eventread → Cyvore → Pulse → Eventread). Clicking it plays the same card → hero transition.
- **Each project keeps its own visual world** from Figma: Pulse dark/blue with Plus Jakarta Sans, Cyvore purple with Michroma/Iceland, Eventread light/navy. The shell handles navigation, rhythm and transitions only.

### 4.5 Building blocks (case studies are MDX content files)

| Component | Purpose |
|---|---|
| `CaseHero` | Title, tags, intro media |
| `SectionLabel` | Eyebrow and heading, tinted per project |
| `StatCard` | Count-up stat (C8) |
| `Device` | Phone/laptop frame built in code, holding an image or video |
| `BeforeAfter` | Drag-to-compare slider |
| `FlowSequence` | Pinned scroll step-through of screens with captions |
| `Quote` | Testimonial |
| `ProcessList` | Process steps. A plain list now; expandable later if Liam adds content per step |
| `Marquee` | Tag ticker (C2) |
| `CyvoreTabs` | Clickable replica of the Cyvore hero (C5) |
| `DangerScore` | Live Eventread calculator (C7) |

---

## 5. Motion system

**Tokens** (single source, used everywhere):

| Token | Value |
|---|---|
| `ease.settle` (enter) | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `ease.exit` | `cubic-bezier(0.55, 0, 1, 0.45)` |
| `spring.pop` | stiffness 400, damping 22 (chip pop, small UI) |
| `dur.micro` | 180ms (hover, press) |
| `dur.ui` | 320ms (state changes) |
| `dur.reveal` | 600ms (section and card reveals) |
| `dur.page` | 900ms (card → hero, loader handoff) |
| Exit durations | ~65% of the matching enter |
| `distance.reveal` | 24px (text), 48px (cards; the live site uses 100px, toned down) |
| `stagger` | 60ms |

**Rules**
- Animate only `transform` and `opacity` (plus `clip-path` for unmasks).
- **Triggered reveals** play once. **Scrubbed effects** (H3, H12, H13) follow the scroll position both ways.
- Every animation can be interrupted by scroll or click. Nothing blocks input. The loader can be skipped.
- Lenis smooth scroll is on for desktop pointer devices only. Touch devices keep native scrolling.
- **Reduced motion:** the loader becomes a 300ms fade, slides become crossfades, the particle video is replaced by a static poster frame, scrubbed effects are off with elements in their resting state, and the marquee is static. Content and hierarchy stay the same.

---

## 6. Technical architecture

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript, static generation for all pages |
| Styling | Tailwind CSS with design tokens as CSS variables (global tokens plus a per-project theme scope) |
| UI motion and page transitions | Motion (`motion/react`): shared-element card → hero (`layoutId`), loader, text swaps |
| Scroll choreography | GSAP ScrollTrigger (scrubbed effects, pinned `FlowSequence`), Lenis smooth scroll |
| Content | MDX per case study in `content/`, with components from 4.5 |
| Media | Images exported from Figma → AVIF/WebP with explicit dimensions. Videos re-encoded to AV1 WebM plus H.264 MP4 fallback, with poster frames. Lazy-loaded below the fold. Hover loops load when the grid nears the viewport |
| Session loader flag | `sessionStorage`, wrapped in try/catch. If storage fails, the loader plays and the site still works |
| Hosting | Vercel, from a GitHub repo under Liam's account. Preview URL per change. Production updates only on Liam's approval |
| Domain | liamhasson.com, connected at launch after Liam buys it |

**Loader and SSR:** the loader overlay renders on the server too, so there's no flash of the hero underneath. A tiny inline script removes it immediately when the session flag is already set.

---

## 7. Accessibility and quality

- Contrast AA (4.5:1 body text). Check the gray-on-black small text from Figma and lift it where it fails.
- Full keyboard navigation with a visible focus ring, a skip link, and focus management after page transitions (focus moves to the case-study heading).
- Semantic headings (one `h1` per page). The alternating hero line is exposed to screen readers as a single static sentence.
- Alt text for all product imagery.
- **Targets:** Lighthouse ≥ 90 in all four categories on desktop, CLS < 0.1, 60fps scrolling on a mid-range laptop.
- Every phase is visually compared with the Figma frames at 1280 / 800 / 375, tested in the browser with reduced motion on and off, and checked in the latest Chrome, Safari and Firefox.

---

## 8. Build phases

Each phase ends with a Vercel preview link for Liam to review.

1. **Foundation:** repo, Next.js setup, tokens from Figma, motion tokens, shell (pill nav, back button, transitions, Lenis), media pipeline, redirects.
2. **Home:** loader, hero, projects grid (live and in-progress states), toolkit, about, testimonials, contact.
3. **Case studies:** Cyvore → Pulse → Eventread (capture live product screens first), each with its signature interaction.
4. **Polish and launch:** tablet and mobile layouts, reduced-motion pass, accessibility pass, performance, SEO metadata and social share images, favicon. Then the domain purchase (by Liam) and DNS hookup.

---

## 9. Inputs needed from Liam (and when)

| Input | Needed by |
|---|---|
| Test login for eventread.vercel.app, if screens are behind auth | Phase 3 |
| Product screen recordings for hover loops, *or* approval for me to record them from live products and prototypes | Phase 2 |
| New resume file | Phase 4 |
| Purchase of liamhasson.com | Launch |

---

## 10. Open questions

- **Q1. Card hover:** the live site shows a brand-color panel with the wordmark. The approved design plays a product loop. The proposal is the product loop with a brand-color hover tint. Confirm, or keep the live wordmark panel.

## 11. Out of scope (for this spec)

- The Nordic Logic and Stub case-study pages (cards only, "In progress").
- A CMS. Content lives in MDX files in the repo.
- A blog, analytics dashboards, contact forms.
- A real-time 3D (WebGL) particle system. The existing video stays the hero visual. It can be revisited after launch, for example once Liam's Blender work is ready.

# Cyvore new website: coming-soon teaser (design)

25 Nov 2026 · branch `feat/cyvore-new-site` · status: draft for Liam's approval

Every line is either **Liam's** (said in the planning conversation) or **my call** (proposed, open to correction).

## Intent

Recruiters should see that Liam is working on something new right now (Liam). The teaser is a "coming soon" case study for Cyvore's new website, shown through the site's live hero (Liam). The full case study comes later.

Cyvore has agreed to the new site being shown publicly before launch (Liam).

## Goals, non-goals, anti-goals

- **Goals:** a recruiter skimming the home grid spots the new project at once; opening it shows the real, working hero; the page reads as current and active.
- **Non-goals:** a full case study (no Problem, Solution, Challenges or Impact sections yet); the rest of the Cyvore site beyond its first screen; changes to the existing `/cyvore` study.
- **Anti-goals:** a card that looks like a duplicate of the older Cyvore study; a dead-end "coming soon" with nothing behind it; any claim of results (the site isn't launched: copy says what it is "designed to" do); a half-finished Cyvore push reaching recruiters; glow anywhere in the portfolio's own UI (standing rule).

## Facts

- **Role (Liam):** web and brand designer. He did all of the design and the build of the website, working closely with Cyvore's business development manager and CTO through many rounds of feedback, collaboration and design iterations.
- **Timeline:** started 2 Nov 2026 (first commit in the Cyvore repo) → "Nov 2026 – present" (my call, from the repo).
- **The site:** repo `~/Documents/Case studies assets/Cyvore Website` (GitHub `Liamhasson/cyvore`), deployed to Vercel project `cyvore-website`. The version to show is **Direction B at `/b/`** (Liam): the storybook world, Charlie the orange tabby on the gate arch, the disguised troll's shadow, hero title "Agentic workspace security." The root "world" pages are not used (Liam).
- **Where `/b/` comes from:** `public/b/` in the Cyvore repo, served by Vercel as-is, filled from `art/charlie-b/prototype` by `scripts/publish-b.mjs`. (`dist/b/` is a stale build from 22 Nov: ignore it.) At commit 3986c28 (25 Nov, 19:25):
  - `index.html` (148 KB) draws a 2736×1536 world scaled to cover the screen, with its own portrait layout for phones.
  - Films: `hero-v2-2k.mp4` (8.1 MB), `hero-v2-phone-2k.mp4` (4.1 MB), stills `hero-v2-2k.jpg`, `hero-v2-phone-2k.jpg`. The films hold only the art; title, lede, nav, the one button ("Request a meeting") and the "Trusted by" logos are HTML on top (`layers/`, `assets/`).
  - `overlays.js` / `overlays.css`: Request a meeting, ScanMySMS, Press and About open as overlays inside the page (the meeting form's endpoint is empty).
  - `scene/` (31 MB) is the Problem scene and the rest of the scroll story: not needed here.
  - It loads Hanken Grotesk from Google Fonts at runtime.
- **The deployed site can't be embedded:** it sends `Content-Security-Policy: frame-ancestors 'self'` and `X-Robots-Tag: noindex, nofollow`.

## Approaches

| | How | Trade-off |
|---|---|---|
| A. Embed the live site | iframe cyvore-website.vercel.app/b/, first screen only | Always current, but shows whatever was pushed that day, runs Cyvore's deployment inside the portfolio, breaks if the URL moves at launch — and is blocked anyway by `frame-ancestors 'self'`. |
| B. Recorded video loop | a hero recording on the page | Light and reliable, but not interactive; re-record on changes. |
| **C. Hosted snapshot (chosen)** | the built `/b/` hero copied into the portfolio, framed live like the Marni Came hero | Real working code, and Liam decides when it updates; costs ~12.5 MB of media in the repo, refreshed by hand. |

**Liam picked C** ("go with your pick"). The precedent is the Marni Came Website section (`src/components/case-study/marni-came/website.tsx`): the band site's first screen live in an iframe at its desktop size, scaled to the column, nothing to scroll.

## The design

### 1. On the home grid

- **First position (`01`)** (Liam), ahead of Nordic Logic. Every other card shifts down one number. On the laptop screen in the home story, which shows the first row, the teaser now leads and Eventread drops off it (accepted with the choice).
- **The "06 · Coming soon" card goes** (my call; `work-index.tsx`, the `soon: true` card added 2026-10-20 as "always more on the way"): the new card now plays that role with a real project, and the grid stays at 6 cards in 3 rows.
- **Name** (my call): "Cyvore" with "New website" so it can't be read as the older study, e.g. `Cyvore · New website`. **Tags:** `Web design · Brand`. **Badge:** the existing **In progress** tag on the media (`progress: true`).
- **Line (draft, Liam to approve):** "Cyvore's new site: workspace security told as a storybook, in the making."
- **Loop** (my call): a recording of the hero page itself (title, nav, button over the moving art), like the other cards in `public/work/`, which show the sites with their nav and headline. A bare film cut would read as illustration work. Recorded headless from the snapshot, encoded like the other loops (`.mp4` + `.jpg` poster).
- **Clickable**, opening the teaser page (unlike Stub, which is a card with no page).
- **The laptop screen:** update `docs/prototypes/work-index.html`, re-capture with `blender/lookdev/capture_index.mjs` (screen.jpg + screen-reveal.json, including the card's `media` video for the 3D screen).

### 2. The teaser page (my calls unless marked)

Route **`/cyvore-new`**, in the `(case-studies)` route group, with a Cyvore-world look consistent with the other studies (dark, Geist for Liam's words; Cyvore's own fonts only inside the snapshot).

```
┌───────────────────────────────────────────────┐
│ ┌───────────────────────────────────────────┐ │
│ │  Charlie at the gate · live hero          │ │
│ └───────────────────────────────────────────┘ │
│ CYVORE · NEW WEBSITE              In progress │
│ Web and brand designer · Nov 2026 – present   │
│ 2–3 lines on what it is and why               │
│ Full case study coming soon                   │
│ ─────────────────────────────────────────────│
│ Next project banner → Nordic Logic            │
└───────────────────────────────────────────────┘
```

- **Hero, desktop (≥1100px, the studies' existing breakpoint):** the snapshot in an iframe at 1440 wide, scaled to the column, first screen only, nothing to scroll inside it — the Marni Came pattern. A light window bar like Marni Came's is fine.
- **Hero, below 1100px:** the same live snapshot at a phone width (e.g. 390), scaled to fit, so the page's own portrait layout shows with its text, not the bare film. Reduced motion (both sizes): if the Cyvore page still moves under reduced motion, show a static screenshot of the snapshot instead (with its text; the bare film stills have none).
- **Inside the frame**, the button and links (Request a meeting, ScanMySMS, Press, About overlays, nav) do nothing: the frame shows the hero, not the site's flows.
- **No "Open the site ↗" link for now.** The only full site today is Cyvore's preview URL, which shows whatever was pushed that day (the anti-goal above). When the site launches, a link to the real address can be added.
- **At a glance:** Role "Web and brand designer" · Timeline "Nov 2026 – present" · Team "With Cyvore's business development manager and CTO" · Tools (Liam to confirm).
- **Copy (draft, Liam to approve, his voice, no results):**
  > I'm designing and building Cyvore's new website, from the brand world to the code. Every attack wears a familiar face, so the site tells it as a storybook: trolls in perfect disguise, and Charlie, the one who notices their shadow.
  > It's shaped in rounds of feedback with Cyvore's business development manager and CTO.
  > Full case study coming soon.
- **Footer:** the usual next-project banner, pointing to the first live study (Nordic Logic). The teaser itself is **not** in the next-project chain of finished studies, so no other study's footer leads to it.
- **SEO:** the teaser page is indexed and in the sitemap, with its own title, description and OG image (a hero still). The snapshot itself is `noindex`, like the Marni Came site.

### 3. The snapshot

- Lives in the portfolio as static files (e.g. `public/cyvore-new/site/`), same origin, so the iframe is allowed and the portfolio controls it.
- Holds only what the first screen needs: `index.html`, its scripts/CSS, both hero films and stills, `layers/`, the `assets/` the hero uses. Not `scene/` or the other pages.
- Must show the hero alone: the page must not scroll on into the Problem scene inside the frame.
- **Refreshed by a script in `scripts/`, run by hand**, that copies `public/b` from a **named commit** of the Cyvore repo (e.g. `git archive <ref> public/b`, default HEAD), never from the working folder, and records the commit it used. The first snapshot is taken at build time; Liam sees it on the branch before anything merges.

### 4. Data model

- `src/lib/projects.ts` gets the new project at the top, first in the grid order. It must stay out of `liveProjects` (the content tests require one MDX study per live project, and `nextProject` cycles through them), but unlike Stub it has a page. A new status (e.g. `"preview"`) or a field is the builder's choice.
- The case-study content model and frame validator (Frame B: shared top, Challenges, Outcome) don't apply: the teaser is a plain page, not an MDX study.

## Left to the builder

- How the snapshot shows the hero alone and keeps its links inert: patching the copied page in the snapshot script (preferred: no change to Cyvore's repo), or a small opt-in hero-only flag in the Cyvore source if patching is fragile. Either way the live Cyvore site behaves exactly as before.
- The new project status or field name; how `story-fallback.tsx`, `not-found.tsx`, the sitemap and tests handle it.
- Loop length and encoding (match the existing `public/work/` loops).
- Tests: unit (projects order and chain, grid has 6 cards with the teaser first), e2e on port 3101 (desktop and phone frames present and not scrollable, links inert, next-project banner).
- Asset weight: confirm the snapshot's total; it loads only on the teaser page.

## Open for Liam

- Approve or rewrite the card line and the page copy.
- The Tools line in the at-a-glance.

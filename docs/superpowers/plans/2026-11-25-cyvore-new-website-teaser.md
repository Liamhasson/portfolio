# Cyvore New Website Teaser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "coming soon" teaser for Cyvore's new website: first card on the home grid, opening `/cyvore-new`, where the site's live `/b/` hero runs from a snapshot hosted in the portfolio.

**Architecture:** A script copies `public/b` from a named commit of the Cyvore repo into `public/cyvore-new/site/`, leaves out what the first screen doesn't need, and patches the page so it holds on the hero with every link inert. The teaser page frames that snapshot the way the Marni Came Website section frames the band site (iframe at its own size, scaled to the column). The grid, the laptop screen and the project registry gain the new entry; it stays out of the chain of finished studies.

**Tech Stack:** Next.js (this repo's version: read `node_modules/next/dist/docs/` before writing route code, per AGENTS.md), React, Vitest + jsdom, Playwright (headless only), ffmpeg, Node 24 (runs `.ts` imports natively).

**Spec:** `docs/superpowers/specs/2026-11-25-cyvore-new-website-teaser-design.md` (approved by Liam 2026-11-25). Read it first.

## Global Constraints

- Branch `feat/cyvore-new-site`. Commit only your own files: other chats may work in this folder. Never commit `.claude/launch.json`.
- Cyvore repo: `~/Documents/Case studies assets/Cyvore Website` (`CYVORE_REPO` below). Read only. Never edit, commit or build in it.
- Snapshot source: `public/b` at a named commit (`git archive`), never the working folder, never `dist/b`.
- Slug `cyvore-new`, route `/cyvore-new`, snapshot at `/cyvore-new/site/index.html` (Next serves public files at exact paths: the iframe `src` must name `index.html`).
- Card: name `Cyvore · New website`, tags `["Web design", "Brand"]`, In progress badge, number `01`; every other card shifts down one; the `06 · Coming soon` card is removed (6 cards).
- Copy is draft until Liam approves it; keep it in one file (`src/content/cyvore-new.ts`) so his edits land in one place. No result claims.
- No glow anywhere in the portfolio's UI (no text-shadow, no blurred box-shadow, no bloom). The Cyvore page's own lantern is the client's art and stays.
- Every browser run headless. Never open a visible window.
- Phones/narrow breakpoint: 1100px, as in the other studies.
- No "Open the site" link.
- Don't poll Vercel deployments with rapid curl (Security Checkpoint).

## Review Focus

1. A wheel, trackpad swipe, touch drag, arrow/space/PageDown key, or Tab+Enter inside the framed hero must leave it on the hero: the page's own scroll-pull (`userInput` → `scrollBy`) must never start. Pinned in Task 1 (unit) and Task 3 (e2e).
2. Clicking "Request a meeting", a nav link, the logo or a client logo inside the frame must not navigate the frame or open an overlay (`overlays.js`). Pinned in Task 1 and Task 3.
3. Files left out of the snapshot (`scene/`, other pages) must not break the hero: no uncaught page errors at load. Pinned in Task 3 (`pageerror` listener).
4. Resizing across 1100px swaps desktop and phone frames without a stale scale (the ResizeObserver re-binds, like Marni Came's `[wide]` effect). Pinned in Task 3 (resize from 1440 to 390 and back).
5. Refreshing the snapshot with a bad ref, or a repo whose `public/b` lacks `index.html`, must fail loudly and leave the existing snapshot untouched. Pinned in Task 1.

---

### Task 1: The hero-only snapshot

**Files:**
- Create: `src/lib/cyvore-new/hero-only.ts` (pure HTML patch)
- Test: `src/lib/cyvore-new/hero-only.test.ts`
- Create: `scripts/cyvore-new-snapshot.mjs` (copies and patches; imports the `.ts` above, Node 24)
- Create: `public/cyvore-new/site/**` (the snapshot itself, output of the script) + `public/cyvore-new/site/SNAPSHOT.json`
- Modify: `src/lib/headers.ts` (snapshot noindex + media cache)
- Test: `src/lib/headers.test.ts` (create if missing)

**Interfaces:**
- Produces: `heroOnly(html: string): string`. `SNAPSHOT_KEEP: readonly RegExp[]` (paths kept from `public/b`). The snapshot at `/cyvore-new/site/index.html`. The script's CLI `node scripts/cyvore-new-snapshot.mjs [ref=HEAD]`.

- [ ] **Step 1: Write the failing tests** in `hero-only.test.ts`:
  - `heroOnly` output contains, before the page's first `<script`, one injected `<script data-hero-only>` and one `<style data-hero-only>`.
  - The style sets `html, body { overflow: hidden !important; }` and `a, button, [role="button"] { cursor: default !important; }`.
  - Run the injected script in jsdom (`new JSDOM(html, { runScripts: "dangerously" })`: create a document from the patched HTML of a minimal fixture whose own script does `addEventListener('wheel', f)`, `addEventListener('keydown', f)`, `addEventListener('touchmove', f)`, `document.addEventListener('click', f)`, `addEventListener('scroll', f)`): dispatching `wheel`, `keydown` (`ArrowDown`, `PageDown`, `" "`, `End`, `Tab`+`Enter` on a link), `touchmove` and a `click` on an `<a href="meeting.html">` calls `f` zero times, and the click's `defaultPrevented` is `true`.
  - Patching twice is idempotent (one `data-hero-only` script).
  - `heroOnly` throws on input with no `<script` (an unexpected page).
  - `SNAPSHOT_KEEP` matches `index.html`, `overlays.js`, `overlays.css`, `pages.css`, `pages.js`, `hero-v2-2k.mp4`, `hero-v2-2k.jpg`, `hero-v2-phone-2k.mp4`, `hero-v2-phone-2k.jpg`, `layers/sky-ext.jpg`, `assets/logo/x.svg`, and does not match `scene/room-v2-2k.mp4`, `about.html`, `meeting.html`, `press.html`.

- [ ] **Step 2: Run and see them fail**
  Run: `npx vitest run src/lib/cyvore-new/hero-only.test.ts`
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement `heroOnly` and `SNAPSHOT_KEEP`**
  The injected script registers window listeners in the **capture** phase, `{ passive: false }`, for `wheel`, `touchstart`, `touchmove`, `keydown`, `click`, `auxclick`, `submit`, `pointerdown` (on `a`/`button` only, so the cursor-led hero art still gets moves): `preventDefault()` + `stopImmediatePropagation()`. It must come before the page's own `<script>`, so its listeners register first. It also pins `scrollTo(0, 0)` on `load`. Leave `pointermove`/`mousemove` alone (the hero may react to the cursor).

- [ ] **Step 4: Run the tests to pass**
  Run: `npx vitest run src/lib/cyvore-new/hero-only.test.ts`
  Expected: PASS.

- [ ] **Step 5: Write `scripts/cyvore-new-snapshot.mjs`**
  `CYVORE_REPO` env, default `~/Documents/Case studies assets/Cyvore Website`. Steps: resolve the ref with `git -C $CYVORE_REPO rev-parse --verify <ref>^{commit}` (fail on a bad ref); `git archive <commit> public/b | tar -x -C <tmp>`; fail if `<tmp>/public/b/index.html` is missing; copy only `SNAPSHOT_KEEP` matches into a fresh temp folder, patching `index.html` through `heroOnly`; only then replace `public/cyvore-new/site/` (so a failure leaves the old snapshot in place); write `SNAPSHOT.json` `{ "repo": "Liamhasson/cyvore", "path": "public/b", "commit": "<full sha>", "subject": "<commit subject>", "date": "<commit date ISO>" }`; print the total size.

- [ ] **Step 6: Take the snapshot**
  Run: `node scripts/cyvore-new-snapshot.mjs HEAD`
  Expected: prints the commit (3986c28… or later) and a total of roughly 13–14 MB; `public/cyvore-new/site/scene/` does not exist. Then check the two failure paths (Review Focus 5): `node scripts/cyvore-new-snapshot.mjs not-a-ref` exits non-zero and `git status public/cyvore-new` is unchanged.

- [ ] **Step 7: Headers.** Test first in `headers.test.ts`: `siteHeaders()` has a rule for `/cyvore-new/site/:path*` with `X-Robots-Tag: noindex, nofollow` and the existing `MEDIA` cache header. Then add it to `siteHeaders()`. Run `npx vitest run src/lib/headers.test.ts`: PASS.

- [ ] **Step 8: Commit**
```bash
git add src/lib/cyvore-new src/lib/headers.ts src/lib/headers.test.ts scripts/cyvore-new-snapshot.mjs public/cyvore-new/site
git commit -m "feat(cyvore-new): the new site's /b/ hero as a hero-only snapshot, from a named commit"
```

---

### Task 2: The project in the registry, the nav and the sitemap

**Files:**
- Modify: `src/lib/projects.ts`, `src/lib/projects.test.ts`
- Modify: `src/lib/site.ts` (`PAGES`), `src/lib/site.test.ts`

**Interfaces:**
- Produces: `ProjectStatus = "live" | "in-progress" | "preview"`; the project `{ slug: "cyvore-new", name: "Cyvore · New website", status: "preview", tags: ["Web design", "Brand"] }` first in `projects`; `nextProject("cyvore-new")` returns the first live project.

- [ ] **Step 1: Update the tests first**
  - `projects.test.ts`: grid order is `["cyvore-new", "nordic-logic", "eventread", "cyvore", "marni-came", "pulse", "stub"]`; `liveProjects` is unchanged (`nordic-logic … pulse`); new test `"the teaser opens onto the first finished study and no study leads to it"`: `nextProject("cyvore-new").slug === "nordic-logic"` and no live slug's `nextProject` is `cyvore-new`.
  - `site.test.ts`: `PAGES` equals `["/", "/cyvore-new", "/eventread", "/cyvore", "/marni-came", "/pulse", "/nordic-logic", "/about", "/contact"]`.

- [ ] **Step 2: Run to fail**
  Run: `npx vitest run src/lib/projects.test.ts src/lib/site.test.ts`
  Expected: FAIL on order and `PAGES`.

- [ ] **Step 3: Implement.** Add the status and the project. In `nextProject`, a `"preview"` project returns `liveProjects[0]`. Add `"/cyvore-new"` after `"/"` in `PAGES` (this also lights Projects in the pill nav on the page and puts it in the sitemap).

- [ ] **Step 4: Run to pass**
  Run: `npx vitest run src/lib src/content`
  Expected: PASS (content tests still find one study per live project).

- [ ] **Step 5: Commit**
```bash
git add src/lib/projects.ts src/lib/projects.test.ts src/lib/site.ts src/lib/site.test.ts
git commit -m "feat(cyvore-new): the teaser in the registry, first in the order, outside the next-project chain"
```

---

### Task 3: The teaser page

**Files:**
- Create: `src/content/cyvore-new.ts` (all copy and facts)
- Create: `src/components/case-study/cyvore-new/teaser.tsx` (the page body, server)
- Create: `src/components/case-study/cyvore-new/snapshot-frame.tsx` (client: the framed hero)
- Create: `src/components/case-study/cyvore-new/cyvore-new.css`
- Modify: `src/components/case-study/worlds.css` (a `[data-world="cyvore-new"]` world)
- Modify: `src/components/case-study/next-project.tsx` (accept the teaser)
- Create: `src/app/(case-studies)/cyvore-new/page.tsx`
- Test: `src/components/case-study/cyvore-new/teaser.test.tsx`, `src/components/case-study/next-project.test.tsx` (extend)
- Test: `e2e/cs-cyvore-new.spec.ts`

**Interfaces:**
- Consumes: `/cyvore-new/site/index.html` (Task 1); `nextProject("cyvore-new")` (Task 2).
- Produces: `cyvoreNew` content object `{ slug: "cyvore-new", title: "Cyvore · New website", line: string, atAGlance: AtAGlance, body: readonly string[], soon: "Full case study coming soon." }`; `NextProject({ from }: { from: CaseSlug | "cyvore-new" })`; `SnapshotFrame()`.

- [ ] **Step 1: Write `src/content/cyvore-new.ts`** with the spec's draft copy verbatim:
  - `line`: "Cyvore's new site: workspace security told as a storybook, in the making."
  - `atAGlance`: role "Web and brand designer"; timeline "Nov 2026 – present"; team "With Cyvore's business development manager and CTO"; tools `[]` until Liam gives them (the Tools column renders only when the list is non-empty: see Step 4).
  - `body`: the spec's two paragraphs, then `soon`.
  Mark the file header: draft copy, awaiting Liam's approval.

- [ ] **Step 2: Write the failing unit tests**
  - `teaser.test.tsx`: renders an `article[data-world="cyvore-new"]`; an `h1` with "Cyvore · New website"; an "In progress" label; the at-a-glance with Role/Timeline/Team and **no** Tools term while `tools` is empty; the body paragraphs; "Full case study coming soon."; a link "Next project: Nordic Logic" to `/nordic-logic`; a Back link to `/#projects`; **no** link whose name matches `/open the site/i`.
  - `next-project.test.tsx`: `<NextProject from="cyvore-new" />` links to `/nordic-logic`.

- [ ] **Step 3: Run to fail**
  Run: `npx vitest run src/components/case-study/cyvore-new src/components/case-study/next-project.test.tsx`
  Expected: FAIL.

- [ ] **Step 4: Implement**
  - `NextProject`: widen `from`; `nextProject(from)` already returns Nordic Logic.
  - `AtAGlance`: hide the Tools `<div>` when `data.tools` is empty (keeps the other studies unchanged: their lists are non-empty; `at-a-glance.test.tsx` must still pass).
  - `teaser.tsx`: `<article data-world="cyvore-new" className="cs">` with `IconSprite`, `BackButton slug="cyvore-new"`, a header (kicker "Cyvore · New website", the In progress tag, `h1`), `SnapshotFrame`, `AtAGlance`, the body, `NextProject from="cyvore-new"`.
  - `snapshot-frame.tsx`: follow `marni-came/website.tsx`: `useSyncExternalStore` on `(min-width: 1100px)`; wide: window bar + `.win` (16:9) + iframe 1440×810; narrow: `.win` at 390:844 + iframe 390×844; both scaled by a ResizeObserver on `.win` (`width / 1440` or `width / 390`), re-bound when `wide` changes. `src="/cyvore-new/site/index.html"`, `title="The first screen of Cyvore's new website, in progress"`, `tabIndex={-1}`, and `aria-hidden` is **not** set (the title names it). Not `loading="lazy"` (it's the top of the page). Reduced motion: if the snapshot's hero film still plays under `prefers-reduced-motion` (check the Cyvore page's own rule at its line ~493), render `<img src="/case-studies/cyvore-new/peek.jpg">` (Task 4) instead of the iframe.
  - CSS: the world in `worlds.css` modelled on `[data-world="cyvore"]` (dark `--void`, `--ink`, `--hair-2`). `cyvore-new.css` scoped to `[data-world="cyvore-new"]`: the frame (copy the `.mc-site` rules), header, body, and the Nordic Logic peek (copy the `.nl-*` rules from `pulse.css:145-147` and its phone rule at `:217`, re-scoped). No text-shadow, no blurred box-shadow.
  - `page.tsx`: `metadata` = `title: "Cyvore · New website (in progress)"`, `description: cyvoreNew.line`, and `pageMetadata("/cyvore-new")` with `openGraph.images`/`twitter.images` set to the peek still (Task 4). Renders `<Teaser />`.

- [ ] **Step 5: Run unit tests to pass**
  Run: `npx vitest run src/components/case-study src/lib`
  Expected: PASS.

- [ ] **Step 6: Write `e2e/cs-cyvore-new.spec.ts`** (headless; runs under `playwright.case-studies.config.ts` on port 3101):
  - `"desktop: the live hero, framed, holding on its first screen"`: at 1440×900, `pageerror` count 0; the frame's content shows the hero title (`frameLocator('iframe').getByText(/Agentic workspace security/i)`); after `mouse.wheel(0, 2000)` over the frame, plus `ArrowDown`, `PageDown`, `Space` after clicking into the frame, the frame's `scrollY` is 0 and `#hero` is still visible.
  - `"inside the frame nothing leads away"`: click the frame's "Request a meeting" button, its ScanMySMS nav link and its logo: the frame's URL still ends in `/cyvore-new/site/index.html` and no overlay dialog is visible.
  - `"phones: the site's own portrait layout"`: at 390×844, the iframe's box is taller than wide and the hero title is visible inside it; resize to 1440×900 and back to 390×844: the iframe's scaled width equals `.win`'s width within 1px each time.
  - `"the page: in progress, no results, the way on"`: "In progress" visible; "Full case study coming soon." visible; "Next project" link to `/nordic-logic`; no link named `/open the site/i`; axe has no serious/critical violations (as `mc-site.spec.ts`); no glow (copy the `noAddedGlow` check from `mc-site.spec.ts`; it runs over `article *` in the page, not inside the iframe).
  - `"the snapshot is kept out of search"`: `request.get("/cyvore-new/site/index.html")` has header `x-robots-tag` containing `noindex`.

- [ ] **Step 7: Run e2e**
  Run: `npx playwright test -c playwright.case-studies.config.ts e2e/cs-cyvore-new.spec.ts`
  Expected: PASS. (The reduced-motion fallback image comes in Task 4; skip that check until then.)

- [ ] **Step 8: Commit**
```bash
git add src/content/cyvore-new.ts src/components/case-study/cyvore-new src/components/case-study/worlds.css src/components/case-study/next-project.tsx src/components/case-study/next-project.test.tsx src/components/case-study/at-a-glance.tsx "src/app/(case-studies)/cyvore-new" e2e/cs-cyvore-new.spec.ts
git commit -m "feat(cyvore-new): the teaser page, the new site's hero live in a frame (draft copy for Liam)"
```

---

### Task 4: The card loop and the page still

**Files:**
- Create: `scripts/capture/cyvore-new-clip.mjs`
- Create: `public/work/cyvore-new.mp4`, `public/work/cyvore-new.jpg`
- Create: `public/case-studies/cyvore-new/peek.jpg` (1200×630 hero still with its text: OG image + reduced-motion fallback)

**Interfaces:**
- Produces: `/work/cyvore-new` (loop base path, as the other cards), `/case-studies/cyvore-new/peek.jpg`.

- [ ] **Step 1: Write `cyvore-new-clip.mjs`** modelled on `scripts/capture/nordic-logic-clip.mjs`: headless Chrome on the GPU, CDP screencast at 2×, viewport 1440×900, but loading the **snapshot** through the local server (`http://localhost:3101/cyvore-new/site/index.html`, started with `npm run build && npx next start -p 3101`), not the Vercel URL. Let Google Fonts load (the hero's real type); fail and save nothing if the frame doesn't contain "Agentic workspace security". Record ~10 s of the hero idling, untouched. Output `test-results/work/cyvore-new-raw.mp4`. Also screenshot a 1200×630 still of the same view to `public/case-studies/cyvore-new/peek.jpg` (q 85).

- [ ] **Step 2: Cut the loop.** Crop the 16:9 capture to 16:10 (centre), scale to 1280×800, H.264 `yuv420p`, 30 fps, 6–8 s, with the 0.6 s crossfade loop used for Nordic Logic (see that file's commit for the ffmpeg lines), `+faststart`; poster `cyvore-new.jpg` = the loop's first frame. Check: `ffprobe` shows `h264,1280,800,yuv420p,30/1`, size under 1 MB.

- [ ] **Step 3: Check the reduced-motion fallback** in the teaser (Task 3 Step 4) against the real still, then add to `e2e/cs-cyvore-new.spec.ts`: `"reduced motion"` with `page.emulateMedia({ reducedMotion: "reduce" })`: either the iframe's hero film is paused or the page shows the peek image.

- [ ] **Step 4: Run e2e**
  Run: `npx playwright test -c playwright.case-studies.config.ts e2e/cs-cyvore-new.spec.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add scripts/capture/cyvore-new-clip.mjs public/work/cyvore-new.mp4 public/work/cyvore-new.jpg public/case-studies/cyvore-new e2e/cs-cyvore-new.spec.ts
git commit -m "feat(cyvore-new): the card's loop and the page's still, recorded headless from the snapshot"
```

---

### Task 5: The grid and the laptop screen

**Files:**
- Modify: `src/app/lab/sand/work-index.tsx:24-32` (`CARDS`)
- Modify: `src/app/lab/sand/sand-lab-fallback.test.tsx:40-43`
- Modify: `docs/prototypes/work-index.html:46-65` (the same six cards)
- Modify (generated): `src/three/sand/screen-reveal.json`, `public/lab/desk3d/screen.jpg`, `public/lab/desk3d/screen.half.jpg`

**Interfaces:**
- Consumes: `/work/cyvore-new` (Task 4), `/cyvore-new` (Task 3).

- [ ] **Step 1: Update the fallback test first:** names are `["Cyvore · New website", "Nordic Logic", "Eventread", "Cyvore", "Marni Came", "Pulse"]`; the first card links to `/cyvore-new` and shows "In progress"; there is no "Coming soon" card; numbers run `01`–`06`.

- [ ] **Step 2: Run to fail**
  Run: `npx vitest run src/app/lab/sand/sand-lab-fallback.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: `CARDS`:** new first entry `{ n: "01", name: "Cyvore · New website", tags: ["Web design", "Brand"], line: <cyvoreNew.line>, href: "/cyvore-new", video: "/work/cyvore-new", poster: "/work/cyvore-new.jpg", progress: true }` (import the line from `src/content/cyvore-new.ts`); renumber the rest `02`–`06`; delete the `soon` card and its comment. Mirror the same six cards in `docs/prototypes/work-index.html` (the In progress tag as `<span class="tag">In progress</span>` inside `.media`, as the CSS at line 23 expects).

- [ ] **Step 4: Run to pass**
  Run: `npx vitest run src/app`
  Expected: PASS.

- [ ] **Step 5: Re-capture the laptop screen** (no re-bake: the 2026-10-20 change, d9cbe14, did the same):
```bash
node blender/lookdev/capture_index.mjs
ffmpeg -v error -y -i blender/lookdev/textures-local/work-index-screen.png -q:v 2 public/lab/desk3d/screen.jpg
python3 scripts/lab/desk3d-screen-posters.py
python3 scripts/lab/desk3d-half.py
```
  Expected: `screen-reveal.json` lists `card1`…`card6`; its `media` has `/work/cyvore-new.mp4` first; the posters line reports the first-row cards pasted. Look at `public/lab/desk3d/screen.jpg`: the teaser card leads the first row with its In progress tag, Nordic Logic beside it.

- [ ] **Step 6: Check the home story** headless (`e2e/desk-laptop.spec.ts` and `e2e/smoke.spec.ts` with their own configs) and a headless screenshot of the settled index: the first card plays the teaser loop and opens `/cyvore-new`; Back from the teaser returns to `#projects`.

- [ ] **Step 7: Commit**
```bash
git add src/app/lab/sand/work-index.tsx src/app/lab/sand/sand-lab-fallback.test.tsx docs/prototypes/work-index.html src/three/sand/screen-reveal.json public/lab/desk3d/screen.jpg public/lab/desk3d/screen.half.jpg
git commit -m "feat(work): the Cyvore new website teaser leads the index and the laptop's screen; the Coming soon card goes (Liam, 2026-11-25)"
```

---

### Task 6: Whole-branch check

- [ ] **Step 1:** `npm run lint && npx tsc --noEmit && npx vitest run` — all pass.
- [ ] **Step 2:** `npx playwright test -c playwright.case-studies.config.ts` — all pass (every study, so the shared at-a-glance and next-project changes are covered).
- [ ] **Step 3:** `npm run build` — passes (if it fails only on the Google Fonts fetch, retry; see the Nordic Logic note).
- [ ] **Step 4:** One fresh reviewer on the whole branch against the spec. Fix what's real.
- [ ] **Step 5:** Send Liam headless screenshots (desktop and phone) of the teaser page and the index, and list what he still owes: the copy approval and the Tools line. Nothing merges or pushes without his go.

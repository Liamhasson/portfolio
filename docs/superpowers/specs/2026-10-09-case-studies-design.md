# Case studies: design (Eventread, Cyvore, Pulse)

**Date:** 2026-10-09. **Status:** decisions approved by Liam in the case-study round of 2026-10-09; this document awaits his review. **Supersedes:** the case-study parts of the original spec (`2026-10-01-portfolio-site-design.md` §3.2, §4.4, §4.5) and §7 of the home production plan (`docs/superpowers/plans/2026-10-08-home-production-plan.md`) where they conflict. **Not covered:** Nordic Logic and Stub (cards only, "Coming soon"), the home page.

**Inputs:** an audit of the three live case studies on liamhasson.figma.site (`/eventread-case-study`, `/cyvore-case-study`, `/pulse-case-study`), the live product at eventread.vercel.app, Liam's answers in this round, and the Eventread build sessions of August 2026 (design challenges, with commits). Review boards: `docs/prototypes/case-study-structure.html` (final block-by-block structure) and `.superpowers/brainstorm/` (the options compared).

**Quality bar:** moto-card.com / oryzo.ai / lusion.co. No shortcuts. Nothing is designed without a reference. Ask before guessing.

---

## 1. Job and audience

The home page earns the click; a case study is where an in-house hiring manager checks the claim. They skim for about two to three minutes, looking for: what Liam did, how he thinks, what happened as a result, and whether the evidence is honest. Every block below serves one of those four.

## 2. The frame (option B: shared frame, own middle)

Every case study has the same **top** and the same **ending**, so a skimmer always finds the facts in the same place. The **middle** tells each story its own way, built around one signature interaction, so the three pages never feel like one template.

| # | Block | Shared? | Screens |
|---|---|---|---|
| 1 | Hero | shared | 1 |
| 2 | At a glance | shared | 0.3 |
| 3 | The problem | own | 1 |
| 4 | Signature interaction | own | 2 |
| 5 | Supporting block | own | 1 |
| 6 | What got in the way | shared | 1 |
| 7 | Outcome | shared | 0.5 |
| 8 | Next project | shared | 0.7 |
| | **Total** | | **≈ 7.5 (cap 8)** |

There is no "What I'd do next" section: on a portfolio it reads as a to-do list and makes a finished project look incomplete. Forward-looking talk belongs in the interview.

## 3. Rules

**3.1 Length.** About 8 screens at 1440×900 per study (the live pages run 12–14). Anything that doesn't fit is cut or compressed, not appended.

**3.2 Outcome: only what happened.**
- Small samples are shown as counts, never percentages ("5 of 6 testers", not "80%").
- Every measured result says who it was measured on ("3 stakeholders, ~35s → ~8s").
- Projections are never outcomes. Pulse's retention targets move into the problem block as the design's goal.
- No usage or market claims the product hasn't earned. Where there is no data, the product itself is the evidence (a live link).
- The same rule applies to research claims anywhere on the page: methods are named only if they were done.

**3.3 What got in the way.** Label `CHALLENGES` (Geist Mono), heading "What got in the way".
- Two or three items per study. Each item: **what happened → what I did → what it changed** (a number or a concrete fact).
- At least one item per study is about design, users or stakeholders, not only engineering.
- Every item ends solved; nothing is left open.
- No overlap with the middle: the middle shows the core design; this block shows obstacles and surprises.

**3.4 Visual worlds (option A: your voice, their world).**
- Every word Liam writes is set in **Geist** (display 400, italic for emphasis, opacity for hierarchy) with **Geist Mono** for labels, on every page.
- Each project brings its own colour world: **Eventread** light with navy, **Cyvore** deep violet, **Pulse** deep blue.
- Project fonts (Cyvore's Michroma and Iceland, Pulse's Plus Jakarta Sans) appear **only inside the product**: screens, logo, brand strip. Never in headings or body.

**3.5 Voice.** Light and personal, first person, one idea per line. The page shows; it doesn't claim.

## 4. Shared blocks

**Hero.** Title with descriptor ("Eventread · SaaS web app"), the one-line description approved for the home page, the hero media (device or video), and a link out where a live product exists.

**At a glance.** One strip directly under the hero, four fields in this order: **Role · Timeline · Team · Tools**, plus the project type where it explains the context (client contract, course project).

**What got in the way.** As §3.3.

**Outcome.** As §3.2. Short: half a screen.

**Next project.** A large preview of the next live case study, looping **Eventread → Cyvore → Pulse → Eventread**. Clicking it plays the same device-into-hero transition as the home page.

## 5. The three studies

### 5.1 Eventread (world: light, navy)

| Block | Content |
|---|---|
| Hero | Eventread · SaaS web app. "The check every booker skips." Laptop with the month calendar laid out by risk, captured from eventread.vercel.app: Berlin, November 2026, Rock, 500–1,500. Visit site. |
| At a glance | Research, design and build, end to end · Mar 2026 – ongoing · Solo · Figma, Figma MCP, Claude Code, Next.js, Vercel · Ticketmaster + JamBase APIs |
| Problem: "Two bands, one lost night" | The origin story (Liam's band's release show lost its audience to a Måneskin arena show; a friend's band lost theirs to the Champions League final), then the problem. The live page's personas, market numbers (54,000 events, 151 million fans, one company) and competitor comparison compress onto this one screen. |
| Signature: Danger Score, live | A working calculator: capacity × genre × timing, run on the Berlin example. The formula stays visible while the visitor plays with it. |
| Supporting: "One search, two APIs" | Ticketmaster for the big ticketed shows; JamBase for the smaller, local shows Ticketmaster doesn't list (mostly sold through Eventim and DICE). Berlin, November 2026, measured 9 Oct: 487 shows against Ticketmaster's 93, 436 of them not on Ticketmaster at all. JamBase replaced PredictHQ on 2026-10-09 because PredictHQ's API only lives inside a 14-day trial. Followed dates and updates. An **Under the hood** line holds the two engineering fixes: same-name cities ("Cambridge" returned 124 events across the UK and US → 21) and tour shows wanting the same night (two-pass assignment). |
| What got in the way | 1. **A blank calendar looked "safe".** No data read as no competition (London showed 7 days of a month; Tel Aviv a green "No conflicts"; holidays missing) → "Not checked" and "no coverage" states, holidays shown but not scored, an "announced" indicator based on an 8-city count (about 95% of a month's shows are listed one month out, 1% at twelve). London: 7 → 31 days. 2. **The 0–100 score claimed precision it didn't have.** "Safe 18" read like a date → Safe · Threat · Critical only, with the cut-points checked on 3,172 real listings. 3. **A feature cut the same day.** Distance to competing shows asked for the venue first, the very answer people come to Eventread to find → removed. |
| Outcome | Live at eventread.vercel.app, built solo. "Finds every competing event, ticketed or not, before the date is booked." Try it. No user numbers (not launched to market yet). |
| Next project | → Cyvore |

### 5.2 Cyvore (world: deep violet)

| Block | Content |
|---|---|
| Hero | Cyvore · B2B website. "A cybersecurity startup needed a site investors would believe in." The four-panel hero. |
| At a glance | Research, information architecture, prototype and investor presentations · About 1 month, part of a 2025–26 project-based contract · Solo, reviewed with the CTO, a developer and DevOps · Figma, Figma MCP, Claude Code |
| Problem: a linear site vs an investor meeting | Why a scroll-through website fails when a founder presents live. Liam pitched the fix unasked. |
| Signature: one screen, everything | A working replica of the four-tab hero (Security · Exposure · Coverage · Enables). |
| Supporting: before / after | A drag slider, old site vs new: navigation and micro-animation. The design system (a third of the live page) shrinks to one strip: type, tokens, states. The live page's "Main CFA" typo becomes "Main CTA". |
| What got in the way | 1. **The CEO wanted the full product video on the site** → Liam argued for a ~7-second animation of the product's mission with the video one click away: in a meeting you present with visual support rather than narrate over a video, and investors had likely seen the only public product video already. 2. **No investors to test with** → tested with the three people who'd present it (CTO, developer, DevOps), four navigation tasks, task order counterbalanced. |
| Outcome | Used as the live product presentation in investor meetings (not a public site). 3 of 3 stakeholders completed all four tasks; time to find a section ~35s → ~8s. The CTO's words, exactly as on the home page: "We weren't looking for a designer. Liam reached us and thanks to his work, we closed our first funding round." Yoav Rotem, CTO, Cyvore. |
| Next project | → Pulse |

### 5.3 Pulse (world: deep blue)

| Block | Content |
|---|---|
| Hero | Pulse · Fitness app. "A goal-focused fitness app designed around four retention milestones." Phone video. |
| At a glance | UX design, research and branding · Dec 2025 – Feb 2026 · Solo, with a CareerFoundry mentor · Figma, Figma MCP, Claude Code · CareerFoundry final project, prototype |
| Problem: users quit before the habit | Fitness apps lose users before a habit forms (competitors BEAT81, Urban Sports; the cited first-week engagement stat with its source). The four milestones, Day 7 · 30 · 60 · 90, shown as the design's **targets**, labelled as such. |
| Signature: goal-based onboarding | The 12 onboarding screens (framing and personalisation 1–3, the booking loop 4–9, tour, permission and close 10–12), pinned, stepping through with captions as the visitor scrolls. |
| Supporting: challenges without pressure | Overview, reflect, progress; private Challenges. The brand (logo, billboard, app icon) shrinks to one strip and leaves the opening. |
| What got in the way | From two rounds of usability testing with people from the target group: 1. **The Injury Log read as medical advice** (4 of 6), a liability risk → renamed and reframed as the Training Log: how sessions felt, milestones, progression; habits, not health. 2. **5 of 6 expected to set a goal first** → goal-based onboarding (the flow above). 3. **4 of 6 thought Challenges were public** → a one-screen intro for each feature; Challenges are private, progress-based and unlimited. |
| Outcome | A tested prototype. After the fixes, 6 of 6 testers in round 2 (returning and new) completed every scenario task. |
| Next project | → Eventread |

## 6. Corrections to the live pages

| Live page says | Becomes | Why |
|---|---|---|
| Pulse: 80% / 70% / 60% of testers | 5 / 4 / 4 of 6 | Six testers cannot produce those percentages |
| Pulse: "Outcomes" over the Day 7–90 numbers | The numbers move to the problem block as targets | They are modelled, not measured |
| Pulse: "five screens" of onboarding | 12 screens | Five was wrong |
| Cyvore: "4× faster" as the lead | Counts with who was measured, inside the outcome | n = 3, internal |
| Cyvore: the case-study quote ("found us") | The home-page quote ("reached us") | Liam confirmed the home-page wording |
| Cyvore: "Main CFA" | "Main CTA" | Typo |
| Eventread: timeline unstated | Mar 2026 – ongoing | The work continued through August 2026 |

## 7. Entry and exit (from the home production plan, unchanged)

The home page shows the project index on the laptop screen, then one full screen per live project, each with its device in its own set. Clicking a project carries the device into the case study's hero; the back button returns to the same spot on the home page. A direct visit gets a short hero reveal instead. Case studies have their own worlds and no sphere.

## 8. Building blocks

Case studies are MDX content files sharing one shell (back button, pill nav with a reading-progress line), as in the original spec. Components:

| Component | Job |
|---|---|
| `CaseHero` | Title, descriptor, line, hero media, link out |
| `AtAGlance` | The four-field strip |
| `SectionLabel` | Mono label + display heading, tinted per project |
| `Device` | Laptop or phone frame holding an image or video |
| `DangerScore` | Eventread's live calculator |
| `CyvoreTabs` | Working replica of the four-tab hero |
| `FlowSequence` | Pulse's pinned 12-screen step-through |
| `BeforeAfter` | Drag-to-compare slider |
| `ChallengeList` | "What got in the way" items (happened → did → changed) |
| `Outcome` | Outcome block, with optional `Quote` |
| `NextProject` | The looping next-case-study preview and transition |

Proposed for removal from the original list (Liam to confirm in review): `ProcessList` (the frame has no process section; process shows through the middle and the challenges), `Marquee` (the tag ticker; the at-a-glance strip carries the facts), `StatCard` count-ups (counts like "5 of 6" read better plain than animated).

## 9. Assets

| Study | Have (from the live pages) | To capture or make |
|---|---|---|
| Eventread | Laptop and phone mockups, formula diagrams, worked example, comparison table | Fresh calendar capture from the live app (Berlin, Nov 2026, Rock, 500–1,500) now the search works; the "Not checked" states and the announced indicator for the challenges block |
| Cyvore | Hero interaction video, micro-animation video, prototype screens, old-site screenshots, token and state boards | The four-tab replica (built), the 7-second mission animation if it exists as a file |
| Pulse | Phone mockups, two videos, the 12 onboarding screens, brand renders, the annotated Challenges screen | Training Log screen before/after if available |

## 10. Open items (decided with Liam in the implementation plan, not here)

1. Final copy for every block (drafted from this spec, approved by Liam line by line).
2. Mobile and reduced-motion versions of the three signature interactions and the drag slider.
3. Whether the Cyvore 7-second mission animation is shown in the case study, and in which block.

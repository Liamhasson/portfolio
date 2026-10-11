# Case-study copy diff: approved boards vs site pages

Worktree: `.claude/worktrees/case-studies`

- **Boards:** `docs/prototypes/{eventread,cyvore,pulse}-mockups.html`. I checked the board scripts (`cyvore-mockups/story-board.js`, `cyvore-story.js`, `pulse-mockups/onboarding-story.js`, `onboarding-proto.js`). They inject only counters (`01 / 12`, the sr-only `Chapter N of 4`) and animated stat numbers. They add no new words.
- **Page:** `src/content/case-studies/*.ts` and `*.mdx`, plus `src/components/case-study/*.tsx`, `src/components/shell/back-button.tsx`, `src/components/shell/pill-nav.tsx` (rendered from `src/app/layout.tsx`) and `src/lib/projects.ts` (next project).
- **Method:** a script checked every page string against each board's text with the tags stripped. Every page sentence appears word for word on its board, except the items marked *changed* below. I read the board-only text from the HTML by hand.

**Kinds used**
- **changed:** both sides have the item and the words differ.
- **changed (grouping only):** the words are identical, but the board splits, merges or moves the text into a different paragraph or element.
- **board only / page only:** the item exists on one side only.
- **(non-visible):** alt text, aria-label or sr-only text.

**Shared, all three studies (identical, not repeated below):**
- The back button's aria-label is "Back to projects" on both.
- The pill nav reads "Projects", "About", "Contact" on both (`PillNav` renders on case pages).
- The page also has "Skip to content" (global layout, sr-only until focus) and a document title "`<Title>` case study | Liam Hasson". Neither is on any board. Both are outside the case-study components, so they are not counted.

---

## 1. Eventread

**Excluded as board annotation:**
- The board-head title and paragraph ("Eventread case study — mockup board, v3", "Revised to Eventread's design system…") and the legend ("End of a 900px screen (board only)", "1440 frames, scaled").
- The whole "00 · Nav motion" frame: the "Replay entrance" button, the demo tags "On paper" / "On navy", and the six motion notes (Entrance, Hover = light, Active page, Press, Keyboard, Reduced motion).
- The frame captions "01 · Hero — shared" to "08 · Next project — Cyvore peeks in", and "Mobile · 390 — hero, then the Solution band".
- Size markers ("1 screen · 1440 × 900", etc.), fold markers "900", the mobile gap label "At a glance · Problem", and the "How it stacks at 390" notes.

### Board section order
1. Hero: "Eventread" (eyebrow "SaaS web app")
2. At a glance: no visible heading
3. Problem: "Problem"
4. Solution: "Solution"
5. How it works: "How it works"
6. Challenges: "Challenges"
7. Impact: "Impact"
8. Next project: "Next project" / "Cyvore"

The page renders the same order.

### Differences

| Section | Page today (exact text) | Board (exact text) | Kind |
|---|---|---|---|
| Hero | (no image) | Image alt: "Eventread month view for Berlin, November 2026, with 18 November selected" (mobile alt: "Eventread month view, cropped to the day tiles") | board only (non-visible) |
| Hero | "Visit site" + sr-only " (opens in a new tab)" | "Visit site" | page only (non-visible suffix) |
| At a glance | Tools as one string: "Figma · Figma MCP · Claude Code · Next.js · Vercel · Ticketmaster · JamBase · football-data.org · Wikidata" | The same nine tools as separate chips, with no " · " separators | changed (separator/format only) |
| At a glance | `<dl aria-label="At a glance">` | No label | page only (non-visible) |
| Problem | Two paragraphs: "Two bands, one lost night." then "My band's release show lost its audience to a Måneskin arena show on the same night. A friend's band lost theirs to the Champions League final. Nobody had checked, because there was nothing to check with." | One display paragraph: "Two bands, one lost night. My band's release show … Champions League final. *Nobody had checked, because there was nothing to check with.*" (last sentence set quiet) | changed (grouping only) |
| Problem | — | Stat figure: "150" / "shows every night" / "Live Nation alone · 54,000 a year" | board only |
| Solution | One paragraph: "On the live product's own example, … and TAEMIN at 3,638 is Safe. Size isn't danger; relevance is." | Two elements: body "On the live product's own example, … and TAEMIN at 3,638 is Safe." and display "Size isn't danger; *relevance is.*" | changed (grouping only) |
| Solution | — | Callouts above the calculator: "Your show" · "Capacity × genre × timing" · "Band" | board only |
| Solution | — | Calculator header: "Nov 18, 2026", "Berlin, Germany · Rock", "Capacity × Genre × Timing", badges "Safe" "Threat" "Critical" | board only |
| Solution | — | Calculator "Your show" panel: "Your show", "Capacity", "1,000 CAP", ticks "100" "1,000" "10,000", "Genre", "Rock" "Alternative" "Pop" "Electronic" "Hip hop" "Jazz" "Metal" "Folk", "Start time", "20:00", "Within 2 h: 1.0 · within 6 h: 0.7 · later: 0.3" | board only |
| Solution | — | Row 1: "Muse - The Wow! Signal Europa Tour", "Uber Arena, Berlin · 17,000 cap · Rock · 19:30", "Critical"; Capacity "1.0" "17,000 vs your 1,000"; Genre "1.0" "Rock, same genre"; Timing "1.0" "19:30, within 2 h"; "1.0 × 1.0 × 1.0" "= 1.00" | board only |
| Solution | — | Row 2: "Horse Lords", "Silent Green, Berlin · 532 cap · Rock · 20:00", "Threat"; Capacity "0.6" "532 vs your 1,000"; Genre "1.0" "Rock, same genre"; Timing "1.0" "20:00, same start"; "0.6 × 1.0 × 1.0" "= 0.60" | board only |
| Solution | — | Row 3: "TAEMIN", "Verti Music Hall, Berlin · 3,638 cap · Other · 20:00", "Safe"; Capacity "0.8" "3,638 vs your 1,000"; Genre "0.2" "Other, unrelated"; Timing "1.0" "20:00, same start"; "0.8 × 0.2 × 1.0" "= 0.16" | board only |
| Solution (mobile) | — | Mobile calculator variant: labels "Cap" / "Genre" / "Time"; meta lines without city or time ("Uber Arena · 17,000 cap · Rock", "Silent Green · 532 cap · Rock", "Verti Music Hall · 3,638 cap · Other"); five genres only (Rock, Alternative, Pop, Electronic, Jazz); no "why" lines, ticks or time help | board only |
| How it works | "**Search, then save it as an act.** A manager or an agent books…" (bold run-in, with full stop) | Step number "01" + h3 "Search, then save it as an act" (no full stop) + body "A manager or an agent books…" | changed |
| How it works | "**Follow the date you booked.** Shows keep getting announced…" | "02" + h3 "Follow the date you booked" (no full stop) + body | changed |
| How it works | "**Plan a tour as one run.** Eight cities typed in any order…" | "03" + h3 "Plan a tour as one run" (no full stop) + body | changed |
| How it works | — | Step numbers "01", "02", "03" | board only |
| How it works | — | Figure captions "After a search · the offer" and "Next search · one click" | board only |
| How it works | — | Media alt/aria: "Results for Berlin, November 2026: the Save Rock · 500–1,500 as an act offer is named The Quiet Hours and becomes a chip"; "The search form: picking Mira Solenne fills Electronic and 1,500–5,000"; "Followed dates: two dates followed, both at risk, three new conflicts since the last visit"; "Tour planner result: Berlin to Paris, 8 stops, 2,495 km, 12 days; the 20 shortest alternative routes checked, none better" | board only (non-visible) |
| How it works | "Under the hood: Ticketmaster covers the big ticketed shows…" (inline, with colon) | Label "Under the hood" (no colon, separate label) + "Ticketmaster covers the big ticketed shows…" | changed |
| Challenges | — | Numbers "01", "02", "03" before each title | board only |
| Challenges | — | Step labels "What happened" / "What I did" / "What it changed" on each of the 3 challenges | board only |
| Challenges | — | Chips, challenge 1: "Not checked", "No coverage here", "All Saints' Day" | board only |
| Challenges | — | Chips, challenge 2: "Safe", "Threat", "Critical" | board only |
| Challenges | — | Chips, challenge 3: "Follow this date", "Threat", "Conflicts 9" | board only |
| Impact | "Live at eventread.vercel.app, built solo." (plain text) | "Live at eventread.vercel.app, built solo." (the domain is a link) | changed (format only) |
| Impact | "Try it" + sr-only " (opens in a new tab)" | "Try it" | page only (non-visible suffix) |
| Next project | — | Line: "A cybersecurity startup needed a site investors would believe in." | board only |
| Next project | — | Image alt: "Cyvore website hero on a laptop" | board only (non-visible) |
| Next project | aria-label "Next project: Cyvore"; nav aria-label "Next case study" | No labels | page only (non-visible) |

### Identical items per section
- Hero: 3 ("SaaS web app", "Eventread", "The check every booker skips.")
- At a glance: 7 (labels Role, Timeline, Team, Tools; values for role, timeline, team)
- Problem: 4 ("Problem"; the lead + story sentences, words identical; "Eventread is built for…"; "Live Nation alone puts on…")
- Solution: 4 ("Solution", "The Danger Score.", "Every competing event gets three weights…", the example paragraph's words)
- How it works: 7 ("How it works", "One search, then it remembers.", the intro paragraph, the three step bodies, the under-the-hood body)
- Challenges: 13 ("Challenges", 3 titles, 9 happened/did/changed texts)
- Impact: 3 ("Impact", "Finds the competing events, ticketed or not, before the date is booked.", "Try it")
- Next project: 2 ("Next project", "Cyvore")

**Eventread differences: 31.** By kind:
- Wording changed: 4 (three step titles, "Under the hood")
- Grouping or format only: 4
- Board only: 19 (3 of them non-visible)
- Page only: 4 (all non-visible)

---

## 2. Cyvore

**Excluded as board annotation:**
- The board-head title and paragraph ("Cyvore case study — mockup board, v1", "The dark world: …") and the legend.
- The whole "00 · References" block: the Linear, Raycast and Resend screenshots and their captions.
- The frame captions "01 · Hero — shared, no Visit site…" to "08 · Next project — Pulse peeks in, deep blue", and "Phone — hero and the replica, stacked".
- Size markers ("~1.7 screens seen · pinned scroll not counted", etc.), fold markers "900", the mobile gap labels "At a glance · Problem" and "How it works · Challenges · Impact · Next", and the "Phone" notes list.

### Board section order
1. Hero: "Cyvore" (eyebrow "B2B website"), no Visit site
2. At a glance: no visible heading
3. Problem: "Problem"
4. Solution: "Solution" (contains the pinned site replica with the chapter bar)
5. How it works: "How it works"
6. Challenges: "Challenges"
7. Impact: "Impact"
8. Next project: "Next project" / "Pulse"

The page renders the same order.

### Differences

| Section | Page today (exact text) | Board (exact text) | Kind |
|---|---|---|---|
| Hero | (no media) | Video aria-label: "Cyvore's main screen moving through Security, Exposure, Coverage and Enables" (mobile: "Cyvore's main screen moving through its four panels") | board only (non-visible) |
| At a glance | Tools as one string: "Figma · Figma MCP · Claude Code" | Same three tools as separate chips | changed (separator/format only) |
| At a glance | `<dl aria-label="At a glance">` | No label | page only (non-visible) |
| Problem | Three paragraphs: "A linear site vs an investor meeting." / "Cyvore was raising its first round. Its website was linear: about 35 seconds of non-stop scrolling to reach a section, and no story holding it together. Fine for a visitor, wrong for a founder presenting live, who needs any answer in one click." / "Nobody had asked for a redesign. I pitched one." | Display: "A linear site vs an investor meeting. Cyvore was raising its first round. *Its website was linear: about 35 seconds of non-stop scrolling to reach a section, and no story holding it together.*"; then body "Fine for a visitor, wrong for a founder presenting live, who needs any answer in one click."; then pitch "Nobody had asked for a redesign. *I pitched one.*" | changed (grouping only) |
| Problem | — | Stat figure: "35s" / "of scrolling to reach a section" / "The old linear site" | board only |
| Solution | Paragraph 2 ends "…while both navigation bars stay visible the whole time. Wherever the presentation is, every section is one move away." | Intro ends at "…stay visible the whole time."; "Wherever the presentation is, every section is one move away." moves to the footer, after the replica | changed (grouping only) |
| Solution | "The replica below is refined for this portfolio: the content and layout are as shipped; type, colour and depth are tightened." (before any replica; the page has no replica) | Same words, placed in the footer after the replica | changed (position only) |
| Solution | — | Hint above the replica: "Scroll: the story plays" · "Hover or click: explore · bar: jump" | board only |
| Solution | — | Replica nav: "cyvore TM", "Technology", "Solutions", "Resources", "About Us", "Contact", "REQUEST YOUR DEMO" | board only |
| Solution | — | Chapter 1 ("Why it matters"): heading "SECURITY IN EVERY PART OF YOUR WORKPLACE"; buttons "REQUEST YOUR DEMO", "ABOUT US"; panels "SECURITY" ("Got a business offer from WhatsApp Business", "Received a suspicious email", "Called back to an unknown number"; "Secures employee activity and AI agent operations, internally and externally."), "EXPOSURE" ("Exposes the complete chain of events to stop phishing and fraud."), "COVERAGE" (tiles "zoom" "T" "#" "M" "O" "G"; "Covers Zoom, Teams, Slack, WhatsApp Business, email, CRM systems, and beyond."), "ENABLES" ("zoom Manipulation behavior during zoom call", "AI image of company representative", "New business inquiry via email"; "Enables precise investigation of every Indicator of Compromise (IOC).") | board only |
| Solution | — | Chapter 2: "THE RISK IS REAL", "The numbers you need to see"; "2,535%" "Increase in malicious phishing messages from Q4 2022"; "83%" "Cybersecurity professionals polled reported being targets of phishing attacks"; "967%" "Increase in credential phishing from Q4 2022"; "15B" "Cyberattacks are launched every single day" | board only |
| Solution | — | Chapter 3: "REAL-WORLD ATTACK"; story captions "A link lands in the call." / "Cyvore reads it." / "Blocked."; video aria-label "A phishing link lands in a video call; the security bot flags it and Cyvore blocks it" | board only |
| Solution | — | Chapter 4: "WHAT POWERS US", "Three proprietary engines"; "OPR" "(Optical Phishing Recognition)" "AI driven visual phishing detection"; "TIAO" "(Threat Intelligence Autonomous Operation)" "Proactive threat engine that mimics analyst behavior, catching Zero-Day threats before they are launched."; "DAN" "(Data Analysis NLU)" "Context-aware language model that understands behavioral patterns across human and AI agents." | board only |
| Solution | — | Chapter bar: "Why it matters", "The risk is real", "Real-world attack", "What powers us"; sr-only live text "Chapter 1 of 4" | board only |
| Solution (mobile) | — | Mobile intro is shortened to: "One screen, everything. I rebuilt the information architecture around the meeting, not the scroll." | board only (mobile variant) |
| How it works | One paragraph: "Every animation carries the founder from one answer to the next. A 7-second sequence tells the product's mission: a phishing link lands in a video call, and Cyvore blocks it. The design system behind it: type, colour tokens and component states." | Intro ends at "…and Cyvore blocks it."; "The design system behind it: type, colour tokens and component states." is a separate paragraph after the CTA video | changed (grouping only) |
| How it works | — | CTA video aria-label: "The main call to action on the shipped site: it glows after a delay, ripples on hover, fills on press" | board only (non-visible) |
| How it works | — | Design-system strip, type: "Type", "MICHROMA", "Headings, navigation and buttons", "ICELAND", "The chapter bar, set apart" | board only |
| How it works | — | Design-system strip, colour: "Colour tokens", "8A38F5" "9C83FB" "51218F" "411F6E" "43246C" "2C1747" "160B23" "0C0E12" "161122" "D1D5DC" "FFFFFF" | board only |
| How it works | — | Design-system strip, states: "States"; "REQUEST YOUR DEMO" ×4 with "Main CTA / Default · resting", "Main CTA / After delay · glows", "Main CTA / Hover · ripple starts", "Main CTA / Pressed · full ripple"; "Text" ×2 with "Chapter tab / Default", "Chapter tab / Active · purple glow" | board only |
| Challenges | — | Numbers "01", "02" | board only |
| Challenges | — | Step labels "What happened" / "What I did" / "What it changed" on both challenges | board only |
| Challenges | — | Chips, challenge 1: "WATCH THE FULL VIDEO", "7s mission animation" | board only |
| Challenges | — | Chips, challenge 2: "CTO", "Developer", "DevOps", "4 tasks · counterbalanced" | board only |
| Impact | Quote without quotation marks: "We weren't looking for a designer. Liam reached us and thanks to his work, we closed our first funding round." | Quote in curly quotation marks: "“We weren't looking for a designer. Liam reached us and thanks to his work, we closed our first funding round.”" | changed |
| Impact | Attribution "Yoav Rotem · CTO, Cyvore" (one line, " · " separator) | "Yoav Rotem" (bold) and "CTO, Cyvore" (label) as two elements, no separator | changed (separator/format only) |
| Next project | — | Line: "A goal-focused fitness app designed around four retention milestones." | board only |
| Next project | — | Image alt: "Pulse's first onboarding screen" | board only (non-visible) |
| Next project | aria-label "Next project: Pulse"; nav aria-label "Next case study" | No labels | page only (non-visible) |

### Identical items per section
- Hero: 3 ("B2B website", "Cyvore", "A cybersecurity startup needed a site investors would believe in."). Neither side has Visit site.
- At a glance: 9 (labels Role, Timeline, Team, Tools, Type; values for role, timeline, team, type)
- Problem: 4 ("Problem" plus the words of the 3 page paragraphs)
- Solution: 4 ("Solution", "One screen, everything.", the words of paragraph 2, the words of the replica note)
- How it works: 3 ("How it works", "Motion with a job.", the words of the body)
- Challenges: 9 ("Challenges", 2 titles, 6 happened/did/changed texts)
- Impact: 5 ("Impact", 2 lines, "Yoav Rotem", "CTO, Cyvore")
- Next project: 2 ("Next project", "Pulse")

**Cyvore differences: 29.** By kind:
- Wording changed: 1 (quotation marks added to the quote)
- Grouping, position or format only: 6
- Board only: 20 (3 of them non-visible)
- Page only: 2 (both non-visible)

---

## 3. Pulse

**Excluded as board annotation:**
- The board-head title and paragraph ("Pulse case study — mockup board, v1", "The deep-blue world: …") and the legend.
- The frame captions "01 · Hero — shared; the home screen loading in…" to "08 · Next project — Eventread peeks in, light; the loop closes", and "Phone — hero and the onboarding story, stacked".
- Size markers ("~1.4 screens · 1440 × ~1260", etc.), fold markers "900", the mobile gap labels "At a glance · Problem" and "How it works · Challenges · Impact · Next", and the "Phone" notes list.
- The in-app text of the twelve onboarding screens (`onboarding-app.js`), which was ignored as instructed.

### Board section order
1. Hero: "Pulse" (eyebrow "Fitness app"), no Visit site
2. At a glance: no visible heading
3. Problem: "Problem" (the four milestones as one row)
4. Solution: "Solution" (pinned onboarding, 12 screens, plus the "Tap through it yourself" prototype overlay)
5. How it works: "How it works"
6. Challenges: "Challenges"
7. Impact: "Impact"
8. Next project: "Next project" / "Eventread"

The page renders the same order.

### Differences

| Section | Page today (exact text) | Board (exact text) | Kind |
|---|---|---|---|
| Hero | (no media) | Video aria-label: "Pulse's home screen loading in: Challenges, My Routine, Training Log, your trainers" (mobile: "Pulse's home screen loading in") | board only (non-visible) |
| At a glance | Tools as one string: "Figma · Figma MCP · Claude Code" | Same three tools as separate chips | changed (separator/format only) |
| At a glance | `<dl aria-label="At a glance">` | No label | page only (non-visible) |
| Problem | "Users quit before the habit." / "Fitness apps lose people before a habit forms. In a study of 389,481 Fitbod users, …(Conti et al., 2026). BEAT81 and Urban Sports Club sell access to classes. Pulse is built around the habit." | Display: "Users quit before the habit. *Fitness apps lose people before a habit forms.*"; body: "In a study of 389,481 Fitbod users, … (Conti et al., 2026). BEAT81 and Urban Sports Club sell access to classes. Pulse is built around the habit." | changed (grouping only) |
| Problem | Bulleted list item "**Day 7:** the first habit loop." | Milestone column: "Day" (small) "7", then "**The first habit loop.**" | changed |
| Problem | "**Day 30:** a routine. The first month predicts who stays." | "Day" "30", then "**A routine.** The first month predicts who stays." | changed |
| Problem | "**Day 60:** a habit. Habits take a median of 66 days to become automatic (Lally et al., 2010)." | "Day" "60", then "**A habit.** Habits take a median of 66 days to become automatic (Lally et al., 2010)." | changed |
| Problem | "**Day 90:** staying power." | "Day" "90", then "**Staying power.**" | changed |
| Solution | — | Counter "01 / 12" (updates as you scroll) | board only |
| Solution | — | Twelve per-screen captions: "What Pulse is for, in three lines." / "Pick the goals that matter to you." / "Choose the activities; the plan follows." / "Your first booking, free to cancel." / "The best matches for your activities." / "Studios near you, with ratings." / "A slot that fits, with what's still free." / "Everything in one place before you book." / "Booked, and one tap to your calendar." / "What else Pulse does, in four lines." / "Notifications, asked for with a reason." / "In." | board only |
| Solution | — | Stage labels: "Frame & goal", "First booking", "Tour & close" | board only |
| Solution | — | Button: "Tap through it yourself" | board only |
| Solution | — | Per-screen figcaptions, numbered: "01 · What Pulse is for, in three lines." through "12 · In." (the same 12 captions with "NN · " prefixes) | board only |
| Solution | — | Screen aria-labels: "Onboarding screen 1: Welcome", "…2: What brings you here?", "…3: What do you love?", "…4: Book your first workout", "…5: Choose a workout", "…6: Choose a studio", "…7: Pick a time", "…8: Confirm booking", "…9: You're booked!", "…10: You're all set", "…11: Stay in the loop", "…12: Welcome to Pulse" | board only (non-visible) |
| Solution | — | Prototype overlay (dialog "Pulse onboarding prototype"): eyebrow "Pulse · onboarding prototype", counter "01 / 12", the same 12 captions, note "Tap the screen as you would in the app. Screens from the Figma file; only its real controls respond.", buttons "Restart" and "Close" | board only |
| Solution (mobile) | — | Mobile body is replaced by: "Goal-based onboarding. Twelve screens, one goal-first flow." | board only (mobile variant) |
| How it works | One paragraph: "Overview, reflect, progress: a Training Log for how sessions felt, and Challenges that are private, progress-based and unlimited. The brand carries the same promise: you set the goal, the app shows the way." | Intro ends at "…private, progress-based and unlimited."; "The brand carries the same promise: you set the goal, the app shows the way." is a separate paragraph after the three phones, above the brand strip | changed (grouping only) |
| How it works | — | Phone captions: "Training Log", "Challenges", "A challenge completed" | board only |
| How it works | — | Media alt/aria: "Training Log: weekly goal, current focus, most booked activities and trainers"; "Challenges: Strength Development in progress, and challenges to browse"; "Challenge completed: you crushed the Strength Development challenge"; "Pulse logo"; "Pulse app icon"; "Pulse billboard: You set the goal, we show the way" | board only (non-visible) |
| Challenges | — | Numbers "01", "02", "03" | board only |
| Challenges | — | Step labels "What happened" / "What I did" / "What it changed" on each of the 3 challenges | board only |
| Challenges | — | Chips: "4 of 6 testers" (ch. 1); "5 of 6 testers" (ch. 2); "4 of 6 testers", "6 of 6 in round 2" (ch. 3) | board only |
| Challenges | — | Screenshot alts: "The Training Log that replaced it"; "Onboarding: What brings you here? Pick the goals that matter most"; "Challenges, private and progress-based" | board only (non-visible) |
| Next project | — | Line: "The check every booker skips." | board only |
| Next project | — | Image alt: "Eventread month view for Berlin, November 2026" | board only (non-visible) |
| Next project | aria-label "Next project: Eventread"; nav aria-label "Next case study" | No labels | page only (non-visible) |

### Identical items per section
- Hero: 3 ("Fitness app", "Pulse", "A goal-focused fitness app designed around four retention milestones."). Neither side has Visit site.
- At a glance: 9 (labels Role, Timeline, Team, Tools, Type; values for role, timeline, team, type)
- Problem: 4 ("Problem", "Users quit before the habit.", the words of the study paragraph including both citation links, "I designed Pulse around four milestones, each with its own job:")
- Solution: 3 ("Solution", "Goal-based onboarding.", "Twelve screens. Screens 1–3 frame the app and learn your goal; 4–9 walk you through your first booking; 10–12 give the tour, ask for permissions and close.")
- How it works: 3 ("How it works", "Challenges without pressure.", the words of the body)
- Challenges: 13 ("Challenges", 3 titles, 9 happened/did/changed texts)
- Impact: 3 ("Impact", "A tested prototype.", "After the fixes, 6 of 6 testers in round 2 (returning and new) completed every scenario task."). Neither side has a link.
- Next project: 2 ("Next project", "Eventread")

**Pulse differences: 26.** By kind:
- Wording changed: 4 (the four milestone lines: "Day N:" label dropped and the first word capitalised)
- Grouping or format only: 3
- Board only: 17 (5 of them non-visible)
- Page only: 2 (both non-visible)

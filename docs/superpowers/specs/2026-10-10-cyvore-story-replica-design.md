# Cyvore story replica — design

Date: 2026-10-10 · Status: approved in conversation (approach C), awaiting Liam's review of this document
Scope: the Solution section of the Cyvore case study (board: `docs/prototypes/cyvore-mockups.html`), and the knock-on change to How it works.
Follows: `2026-10-09-case-studies-design.md` §5.2 (Cyvore). Where this document and §5.2 differ, this one wins.

## 1. Intent

The Solution section shows the site Liam designed for Cyvore: one screen that a founder presents live, where every answer is one move away. The replica today is four tabs a visitor may or may not click. It should instead **unfold as a story, screen by screen**, the way the founder walked investors through it: why it matters, the risk is real, a real-world attack, what powers us.

Success: a visitor who only scrolls sees the whole story, in order, without clicking anything; a visitor who wants to explore can still hover, click and jump; nothing ever looks broken mid-transition.

## 2. Decisions (Liam, 2026-10-10)

| Question | Decision |
|---|---|
| Framing | **Faithful look, better flow.** Content, layout and Cyvore's look stay as shipped. Only how it plays improves: order, pacing, transitions, handovers. It is still honestly "the site I shipped". |
| Pacing | **Scroll drives it.** The replica pins on screen and the scroll moves the story forward. |
| Length | **Count what's seen.** The pinned story counts by what the visitor sees, not scroll distance. The large mission animation leaves How it works because it now plays inside the story. |
| Improvements | All four, at Claude's judgement: clean handovers, chapter bar as progress, chapters that build in beats, readable panel text. |
| Approach | **C, hybrid.** Scroll picks the beat and the beat plays itself at its tuned speed; only the attack video is scrubbed by scroll. |

## 3. What the live site does wrong (and the replica fixes)

Seen in Liam's screenshot of the shipped site mid-change:

1. **Overlapping chapters.** The outgoing and incoming chapters fade at the same time, so "SECURITY IN EVERY PART OF YOUR WORKPLACE" sits behind "WHAT POWERS US", the old buttons ghost through, and the old column labels show behind the new cards.
2. **No sense of order or progress.** The chapter bar says where you are, not how far through you are or what comes next.
3. **Text too small to read.** Panel descriptions are Michroma at about 10px on a laptop.

## 4. Approach C

- The replica is **pinned** while its scroll range passes. The scroll range is divided into **beats** (§5).
- **Interface beats are triggered, not scrubbed.** Entering a beat plays that beat's animation forward at its designed duration; scrolling back into the previous beat plays it in reverse. A visitor who stops scrolling always sees a finished state, never a column frozen half-open.
- **The attack video is scrubbed.** Its playhead maps to scroll position across its beat, so the phishing link lands and gets blocked at the visitor's own pace. Captions change at fixed points.
- **The visitor can still drive.** Inside the active chapter, hover (mouse) and click/tap open a column as on the live site. Clicking a chapter in the bar scrolls smoothly to that chapter's first beat. Keyboard: arrows move between columns; Tab reaches the chapter bar.
- **Why not fully scrubbed (A):** a paused visitor would leave Cyvore's UI half-transitioned and it would look broken. **Why not timed only (B):** the video is the one piece that benefits from following the scroll exactly.

## 5. The beats

Each beat is about one third of a screen of scroll (≈300px at 900px tall); 12 beats ≈ 4 screens of pinned scroll.

| # | Chapter | What happens | Duration |
|---|---|---|---|
| 1 | Why it matters | The site arrives: top bar, headline "SECURITY IN EVERY PART OF YOUR WORKPLACE", buttons, four closed columns. | 600ms |
| 2 | | Security opens: the three alerts land. | 560ms + stagger |
| 3 | | Exposure opens: the chain builds link by link. | 560ms + stagger |
| 4 | | Coverage opens: the channel tiles pop in, then "+". | 560ms + stagger |
| 5 | | Enables opens: the three indicators slide in. | 560ms + stagger |
| 6 | The risk is real | **Handover** (§6). 2,535% opens and counts up from 0. | 360ms out + 520ms in |
| 7 | | 83% opens and counts up. | 560ms |
| 8 | | 967% opens and counts up. | 560ms |
| 9 | | 15B opens and counts up. | 560ms |
| 10 | Real-world attack | **Handover.** The Zoom sequence is scrubbed across the beat, with three captions (§7). | scroll-driven |
| 11 | What powers us | **Handover.** The dashed diagram draws from the top node down; OPR, TIAO, DAN light up one after another along it; the lower lines converge on the bottom node. | 360ms out + 1200ms build |
| 12 | (release) | The chapter bar shows all four complete; the replica unpins and the page continues. | — |

Count-ups: numbers count from 0 to their value over 900ms with an ease-out, formatted as on the site (2,535%, 83%, 967%, 15B). Under reduced motion they show the final value.

## 6. Handovers between chapters

One chapter leaves before the next arrives; they never overlap.

- **Out (360ms):** the stage content and the headline fade to 0 and move 16px in the direction of travel (up when moving forward, down when moving back).
- **In (520ms, starting when Out ends):** the next headline and stage enter from 16px on the opposite side and fade in, on the settle curve `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Stays put:** the top nav, the stage frame and its glow, and the chapter bar. They are the "both navigation bars stay visible" idea from the case study, now literally true during every change.
- Only `opacity` and `transform` animate.

## 7. Real-world attack (scrubbed)

- The mission recording (8.5s; the first 0.9s is black and is trimmed) is mapped across beat 10.
- Three captions sit under the stage's top edge in Michroma, small like the site's sub-headings, one at a time:
  1. at the link card (≈3.0s): **"A link lands in the call."**
  2. at "Analyzing incoming communication streams…" (≈4.5s): **"Cyvore reads it."**
  3. at "Phishing Attempt Confirmed · BLOCK" (≈7.0s): **"Blocked."**
- **These three captions are new copy and need Liam's approval** before the build uses them (the live site had no captions; Cyvore's own heading here is just "REAL-WORLD ATTACK").

## 8. What powers us (new chapter, content from the live site)

Heading "WHAT POWERS US", sub-heading "Three proprietary engines". Three cards on a dashed diagram: a vertical dashed line from a top node, curving out to each card, and curving back in below them to a bottom node with a downward arrow.

| Engine | Expansion | Description |
|---|---|---|
| OPR | (Optical Phishing Recognition) | AI driven visual phishing detection |
| TIAO | (Threat Intelligence Autonomous Operation) | Proactive threat engine that mimics analyst behavior, catching Zero-Day threats before they are launched. |
| DAN | (Data Analysis NLU) | Context-aware language model that understands behavioral patterns across human and AI agents. |

Text exactly as on the live site (Liam's screenshot, 2026-10-10).

## 9. The chapter bar as progress

- Same component as the live site (Iceland, four equal tabs, the active one outlined in violet with a glow).
- **Progress:** a 2px line along the bottom of the active tab fills left to right as the visitor moves through that chapter's beats. Finished chapters keep a full, dimmer line; upcoming ones have none.
- **Jump:** clicking a chapter scrolls (smoothly; instantly under reduced motion) to its first beat. The live site's own behaviour, a click switching chapters, is preserved.
- **Accessible:** `role="tablist"`, `aria-selected` on the current chapter, progress also given as text ("Chapter 2 of 4"), and chapters that are not on screen are `inert` so keyboard and screen readers never land in hidden content.

## 10. Readability (same fonts)

- Panel descriptions: 10.5px → **13px** at the 1440 frame, line height 1.7, white at 92% → **96%**.
- Card text inside the art (alerts, indicators): 12px → **13px**.
- Collapsed column labels stay 13px; panel titles stay 24px. No font changes.

## 11. Rest of the page

- **How it works** loses the large mission animation block (it plays in the story now). It becomes the design-system strip plus a short row of motion notes (the three motion jobs: open a column, hand over a chapter, show progress). Target ≈1 screen.
- **mdx copy impact:** How it works currently says "A 7-second sequence tells the product's mission: a phishing link lands in a video call, and Cyvore blocks it." With the sequence now inside the Solution, Liam decides whether that sentence stays (it still describes the site) or moves. **Open question.**
- **Screen count** (what is seen): hero 1, at a glance 0.3, problem 0.9, solution ≈1.7 (title + one pinned screen), how it works ≈1.0, challenges 0.9, impact 0.75, next 0.7 ≈ **7.3**. Pinned scroll adds ≈4 screens of scroll distance, which by Liam's decision is not counted.

## 12. Phone

- Same 12 beats, same order, pinned. The columns stack as rows and open downward (as in v1); the stats stack the same way; the attack video fits the width; the three engine cards stack along a vertical dashed line.
- The chapter bar sits under the stage as a 2 × 2 grid, 44px tall tabs.
- Tap still opens a row; there is no hover.

## 13. Reduced motion

No pinning, no scrubbing. The four chapters sit one under another as still screens, each fully open (Why it matters shows Security open; the stats show final values; the attack shows the BLOCK frame with all three captions listed; the engines diagram drawn). Clicks still open other columns, instantly.

## 14. Build notes (board now, site later)

- **Board (Part B):** GSAP 3 with ScrollTrigger from cdnjs, pinned inside the board's 1440 frame. Beats are ScrollTrigger ranges with `onEnter` / `onEnterBack` / `onLeaveBack` playing short timelines; the video uses `scrub` on `currentTime`, and pauses all decoding while off screen.
- **Site (Part C):** the same structure ports to the Next.js app with the project's GSAP + Lenis setup. Not built in this step.
- Only `transform` and `opacity` animate; the video is the one scrubbed element; `will-change` only during a handover.

## 15. Verification

- Scroll through at normal speed: every beat lands, nothing overlaps, the bar's progress matches the beat.
- Stop scrolling mid-beat several times: the replica always rests in a finished state.
- Scroll back up through every handover: reverses cleanly in the right direction.
- Click each chapter in the bar: scrolls to that chapter's first beat.
- Keyboard only: reach columns and chapters, open them, see focus.
- Reduced motion: stacked still screens, nothing animates.
- Phone frame: the same story, stacked.
- No console errors; 60fps while scrolling in Chrome (Performance panel, no long tasks during handovers).

## 16. Open questions for Liam

1. Approve the three attack captions (§7) or replace them.
2. Keep or move the How it works sentence about the 7-second sequence (§11).
3. Then: the design-system pairing from styles.refero.design (next step after this build, per Liam).

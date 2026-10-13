# Case study: Nordic Logic (design)

**Date:** 2026-10-13. **Status:** awaiting Liam's review. **Extends:** `2026-10-09-case-studies-design.md`. Its frame,
rules (§3) and building blocks (§8) apply unchanged; this document adds the fourth study. **Supersedes:** that spec's
"Not covered: Nordic Logic" line, and every earlier Nordic Logic draft (the Sep 21 HTML pages and the Figma case-study
frames v2–v4 in `roRU56wcKr0sooXpR7Rc7T`), which are not used as sources.

**Source of truth:** the live site, https://nordic-logic.vercel.app, and the Nordic Logic project record: the repo
(`~/Documents/Case studies assets/Nordic Logic`, `WORKPLAN.md`, `DESIGN.md`), its Claude Code memory and chats
(28 Aug – 12 Oct 2026), and the competitor analysis page for Emil (updated 8 Sep).

---

## 1. Decisions taken with Liam (2026-10-13)

| # | Decision |
|---|---|
| 1 | Same shared frame as Eventread, Cyvore and Pulse (Hero · At a glance · Problem · Solution · How it works · Challenges · Impact · Next project). |
| 2 | The Solution says what the site is: a website designed for a sceptical buyer, built to earn trust before it asks for anything. It carries a data piece: the competitor comparison. |
| 3 | The competitor comparison uses only research that was done and can be checked: LateShipment. Refund Retriever and Share A Refund are out (only Emil's rates, never verified). |
| 4 | Look: follows the site. Light pages, dark bands where the site has them. No glow anywhere. |
| 5 | Product visuals: my own screen exports in a tray, as Eventread does. No device mockups. |
| 6 | The 3D "Why Nordic Logic" cards appear in How it works, as high-resolution video loops recorded from the live site. |
| 7 | Link the live site. The page never mentions the upload form or the legal pages (both are being finished; launch in about a week). |
| 8 | Timeline "Aug 2026 – ongoing". Role "Brand, product & web design". |
| 9 | Nordic Logic becomes a live project: the next-project loop gains it, and the home page follows as a second step. |
| 10 | The About page is unchanged ("Market & competitor research" keeps Eventread only). |
| 11 | Claude Code is named openly, and the collaboration is shown (Liam, 2026-09-21). |

## 2. The competitor research, re-verified 2026-10-13

Checked again on LateShipment's live pages (`/pricing`, `/solutions/dhl-lost-and-damaged-claims`) on 2026-10-13.

| | LateShipment | Nordic Logic |
|---|---|---|
| Fee on billing errors | 35% (25% only inside the ONE+ bundle) | 35% |
| Fee on lost and damaged claims | 50% | 50% |
| Contract | "No contracts" | Cancel any month |
| Minimum | "No minimums" | None |
| **First step** | **A 30-day trial on their platform, or a demo; integration ("live in 4 hours")** | **Send one CSV, get a free full breakdown. Nothing to connect, nothing signed** |
| **What you buy** | **Audit is one of four products in a post-purchase platform** | **Only the audit** |
| **Who files** | **"Automated refund claims"** | **One named person reviews every dispute** |

**The finding:** on price, terms and minimums the two are level. The difference is what a buyer has to do first, and
what they're buying. The original brief led with price ("35% against a 40–50% market standard"), the one place
Nordic Logic had no edge.

Also from the research, for the copy: LateShipment's own G2 reviews (9 collected, 6 Sep) praise people, not the
software ("Daniel and the team…"). Emil's belief that LateShipment "don't do the filings" and "don't offer real
customer service" was checked against their pages and their reviews and was wrong (8 Sep).

**Dropped as no longer true:** "EU-native" (markets are the US, UK and Ireland since Emil's notes, 25 Sep);
"48 hours" (turnaround is one week); "no minimum" as a differentiator (LateShipment now says the same).

## 3. The study, block by block

All copy below is a draft for Liam's line-by-line approval on the board (§6). Voice and rules as the case-studies spec §3.

### Hero
- **Title:** Nordic Logic · B2B website
- **Line:** "A launch site for a startup with no clients to point to yet."
- **Visual:** the live hero in a tray: the 3D film's final frame handing over to the dashboard ("Your carriers owe you."), exported at 2×.
- **Link:** Visit site → nordic-logic.vercel.app

### At a glance
Brand, product & web design · Aug 2026 – ongoing · Solo, with the founder · Figma, Figma MCP, Claude Code, Next.js, three.js, Vercel, PostHog

### Problem
- Opens: "A stranger, asked for their invoices."
- Nordic Logic recovers what parcel carriers overcharge. To do it, a one-person company asks a sceptical finance or
  operations lead for their carrier invoices, then a power of attorney, with no clients, reviews or results to show.
- The brief I started from led with price: "35% against a 40–50% market standard." The main competitor publishes 35%.
- Visual: no product image. The brief's price line is set large as a quote; the problem is told, not illustrated
  (final-visuals rule).

### Solution (signature)
- Opens: "Built for the sceptic."
- A website designed for a buyer who expects to be sold to: it shows the work before it asks for anything, and it
  never claims more than it can prove.
- **Data piece: Level on price. Different on the first step.** The table in §2, designed in the portfolio's own type
  (no logos). The four level rows sit quiet; the three rows that differ carry the weight. Source line: "LateShipment's
  pricing and claims pages, checked 13 Oct 2026."
- **Signature interaction: the first audit, working.** A replica of the site's "Your first audit" flow. Send your
  invoices → Get a full breakdown → You decide. At the fork the visitor chooses: sign a power of attorney (we file the
  disputes → carriers credit your account) or walk away. Both branches are drawn with the same weight, as on the site,
  and either choice plays to its end. Caption: "Walking away weighs the same as signing. Knowing they can leave is what
  lets them stay."
- Mobile: the flow runs vertically; the choice is two equal buttons. Reduced motion: the flow is shown drawn, the
  choice still works.

### How it works
- Opens: "Four things worth knowing."
- The four 3D cards from the live How it works page, each as its own seamless loop on the site's dark band:
  Three carriers, in depth · Carrier comparison · Multiple shops · No minimum. One line each, from the site.
- Below: "When a carrier says no." The dark chapter as one recorded clip (it pins, fills the screen, brings in the
  four outcomes).
- Then the system strip: colour (Signal blue, Ink, the warm grounds), type (Schibsted Grotesk, Instrument Sans,
  IBM Plex Mono), the N/L mark. One strip, as Cyvore's.

### Challenges (three; happened → did → changed)
1. **The founder's competitor read didn't hold** (stakeholder)
   - Happened: Emil saw LateShipment as no real competitor: they "don't do the filings", "don't offer real customer
     service", and that's "why they are cheaper".
   - Did: I checked each point against their own pages and the nine G2 reviews I'd collected. All three were wrong:
     they file, their support is what customers praise most, and their price matches ours (8 Sep). When he then
     wanted the site to compare only against firms that charge more, I asked myself the question out loud ("Should
     we just follow his instructions as it's his company, or push back?", 12 Sep) and pushed back: choosing who you
     compare against is itself a claim.
   - Changed: the site names no rival and compares on nothing it can't defend; the fee is stated as plain fact.
     (Emil's reaction isn't on record, so the page doesn't describe it.)
2. **No number without a source** (design), with the Claude Code exchanges
   - Happened: the savings calculator needed a recovery rate, and Nordic Logic had no completed recovery to take one from.
   - Did: I asked where every figure came from. The 2.13% in an early build had been made up by the AI, and I caught
     it. Published rates run 1–20% and rise with the vendor's cut, so no average means anything.
   - Changed: a conservative 1–3% range (Emil's own estimate), and "Sample data" set inside every figure that isn't real.
   - Extras: the calculator (final, $) and the two exchanges: "Why 2.12%? Where did you get this number from?" →
     "I made it up, and I was wrong to." · "Make the average of the whole…" → "An average of vendor claims from 1% to
     20% means nothing, so use the lowest, least biased range."
3. **Planned what happens after "Send"** (design)
   - Happened: companies upload carrier invoices to a one-person company. Where do the files go, who sees them, and
     for how long?
   - Did: I mapped every service that touches visitor data, chose analytics without cookies (so no consent banner),
     and designed the path: contact details first, then the file; a confirmation to the sender, an alert to Emil.
     The audit works without names, addresses or contents, so the site tells people they can strip those columns first.
   - Changed: no cookie banner, and every file has a deletion date: 100 days after upload.
   - Extras: the data-flow diagram, designed (Upload → Founder's storage → Emil alerted → Sender confirmed →
     Deleted after 100 days), with the services around it.

### Impact
- "Live at nordic-logic.vercel.app. Brief to launch in three weeks, with the founder; ongoing since."
- "Every claim on it is traced to a source, or cut."
- No usage numbers (outreach hasn't started). Link: Visit site.

### Next project
→ Eventread. The loop becomes Eventread → Cyvore → Pulse → Nordic Logic → Eventread (Pulse's next becomes Nordic Logic).

## 4. Visual world

- **Colour:** the site's own tokens, read from `web-v2` at build time: Daylight and the warm grounds for pages, Ink
  for the dark bands (How it works cards, the denial chapter), Signal `#1B4DFF` as the one accent. No gradients, no glow.
- **Type:** every word I write in Geist / Geist Mono, as on the other studies. Schibsted Grotesk, Instrument Sans and
  IBM Plex Mono appear only inside the product: screens, the comparison's product cells if needed, the system strip.
- **Product frames:** Eventread's tray treatment, straight, no tilt.

## 5. Assets (all recorded or exported by me from the live site, 2×)

| Asset | Block | Note |
|---|---|---|
| Hero still | Hero, peek | the film's last frame on the dashboard, $ |
| First-audit flow | Solution | reference for the replica (built in code, not a video) |
| Why cards ×4 | How it works | one seamless loop each, 1:1 or the card's own shape |
| When a carrier says no | How it works | re-recorded (the Sep 29 clip predates the 3D site) |
| Calculator with cursor | Challenge 2 | re-recorded in $ |
| Data-flow diagram | Challenge 3 | designed, not captured |
| System strip | How it works | type, colour, the mark (`brand/svg`) |

Every Sep 29 recording and mockup is retired: they predate the 3D hero and Why cards (4 Oct) and show euros.
Recording blocks PostHog so no visits reach Emil's data.

## 6. Order of work

1. **Board** `docs/prototypes/nordic-logic-mockups.html`, as for the other three: each frame with its final copy and
   visuals. Liam approves it line by line.
2. **Build** in this repo: `CaseSlug` gains `nordic-logic`; `src/content/case-studies/nordic-logic.{ts,mdx,entry.ts}`;
   `src/components/case-study/nordic-logic/*` (hero visual, problem, comparison, first-audit replica, how it works,
   challenge extras); the route; next-project map and order; `projects.ts` status live; sitemap. Tests and the
   screen budget as for the other studies; verified in the browser at 1440, tablet and phone, and with reduced motion.
3. **Home page** (separate step, its own approval): Nordic Logic's chapter in the home story as a live project.

## 7. Checked at build time, not open questions

- "20 screens → 9" and "three weeks" are re-measured against the repo before they're used anywhere.
- Every figure on the page is checked against the live site the day it ships.

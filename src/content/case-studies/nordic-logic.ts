import type { CaseStudy } from "@/lib/case-studies/types";
import { STANDARD_BUDGET } from "@/lib/case-studies/budget";

/** Copy verbatim from the board (docs/prototypes/nordic-logic-mockups.html), facts re-checked on the live site and on
 *  LateShipment's own pages on 2026-10-13 (spec: docs/superpowers/specs/2026-10-13-nordic-logic-case-study-design.md). */
export const nordicLogic: CaseStudy = {
  slug: "nordic-logic",
  title: "Nordic Logic",
  descriptor: "B2B website",
  line: "A launch site for a startup with no clients to point to yet.",
  liveUrl: "https://nordic-logic.vercel.app",
  atAGlance: {
    role: "Brand, product & web design",
    timeline: "Aug 2026 – ongoing",
    team: "Solo, with the founder",
    tools: ["Figma", "Figma MCP", "Claude Code", "Next.js", "three.js", "Vercel", "PostHog"],
  },
  challenges: [
    {
      kind: "stakeholder",
      title: "The founder's read on the competition didn't hold",
      happened:
        "Emil saw LateShipment as no real competitor: they didn't file claims themselves, offered no real customer service, and were cheaper because of it.",
      did: "I checked each point against their own pages and the nine G2 reviews I'd collected. All three were wrong. When he then wanted the site to compare only against firms that charge more, I pushed back: choosing who you compare against is itself a claim.",
      changed: "The site names no rival and makes no comparison it can't defend. The fee is stated as plain fact.",
    },
    {
      kind: "design",
      title: "No number without a source",
      happened:
        "The savings calculator needed a recovery rate, and Nordic Logic had no completed recovery to take one from. An early build showed 2.13%, a number the AI had made up.",
      did: "I asked where every figure came from. Published rates run from 1% to 20% and rise with the vendor's cut, so I used the lowest range as a range, then narrowed it to Emil's own estimate.",
      changed: "A conservative 1–3% range, stated as an estimate, and the worked examples marked as sample data.",
    },
    {
      kind: "design",
      title: "Planned what happens after “Send”",
      happened: "Companies upload their carrier invoices to a one-person company. Where do the files go, who sees them, and for how long?",
      did: "I mapped every service that touches visitor data and chose analytics without cookies, so the site needs no consent banner. Each upload confirms to the sender and alerts Emil, and the form says the audit works without names, addresses or contents.",
      changed: "No cookie banner, and every file is deleted 100 days after upload.",
    },
  ],
  outcome: {
    lines: ["Live at nordic-logic.vercel.app, three weeks from brief to launch.", "Every claim on it is traced to a source, or cut."],
    link: { href: "https://nordic-logic.vercel.app", label: "Visit site" },
  },
  peek: { src: "/case-studies/nordic-logic/peek.jpg", alt: "Nordic Logic's home page: Your carriers owe you, over the client portal's overview", width: 1200, height: 750 },
  // Measured on the built page at 1440×900: 10.3 screens on 2026-10-13; 11.9 on 2026-10-19 with the Brand section, image
  // first and held to about two screens (Liam: no more than two): the lockup's construction on the dot grid, the strategy
  // row, and one bento. The system strip it replaced left How it works. 14.9 on 2026-10-26 with more of the live site
  // (Liam: the site wasn't shown enough): the hero's whole film in a taller tray (1.65), What this costs in the
  // Solution, Where the money hides opening How it works, three phones in Impact.
  screenCap: 15,
  budget: { ...STANDARD_BUDGET, hero: 1.65, signature: 3.45, supporting: 4.9, challenges: 1.5, outcome: 1.45 },
};

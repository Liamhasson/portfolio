import type { CaseStudy } from "@/lib/case-studies/types";
import { STANDARD_BUDGET } from "@/lib/case-studies/budget";

export const eventread: CaseStudy = {
  slug: "eventread",
  title: "Eventread",
  descriptor: "SaaS web app",
  line: "The check every booker skips.",
  liveUrl: "https://eventread.vercel.app",
  atAGlance: {
    role: "Research, design and build, end to end",
    timeline: "Mar 2026 – ongoing",
    team: "Solo",
    tools: ["Figma", "Figma MCP", "Claude Code", "Next.js", "Vercel", "Ticketmaster", "JamBase", "football-data.org", "Wikidata"],
  },
  challenges: [
    {
      kind: "design",
      title: "A blank calendar looked safe",
      happened:
        "A month with no data looked exactly like a month with no competition. London showed 7 days of events, Tel Aviv came back as a green “No conflicts”, and holidays were missing.",
      did: "I gave missing data its own states (“Not checked”, “No coverage here”), showed holidays without scoring them, and added an “announced” indicator built on an 8-city count: about 95% of a month's shows are listed one month out, 1% a year out.",
      changed: "London went from 7 visible days to all 31.",
    },
    {
      kind: "design",
      title: "The score claimed precision it didn't have",
      happened: "“Safe 18” on a tour date read like a date or a time, and a 0–100 number promised more precision than the formula has.",
      did: "I dropped the number and kept three bands, Safe, Threat and Critical, after checking the cut-points on 3,172 real listings.",
      changed: "The formula produced only 27 distinct values, and none fell between 35–45 or 64–80: the bands sit on real gaps.",
    },
    {
      kind: "design",
      title: "One product, two visual languages",
      happened:
        "The interface had grown by feature: pill-shaped navigation next to square buttons, colour used for decoration as much as for risk.",
      did: "I surveyed product design systems and built one from three references: Vercel's type, Ramp's colour discipline, Cal.com's month view. Risk became the only colour, shown as a dot and a word.",
      changed: "One type family, one set of shapes, three colours that always mean risk, and a CI test that fails if an old style comes back.",
    },
  ],
  outcome: {
    lines: [
      "Live at eventread.vercel.app, built solo.",
      "Finds the competing events, ticketed or not, before the date is booked.",
    ],
    link: { href: "https://eventread.vercel.app", label: "Try it" },
  },
  budget: STANDARD_BUDGET,
};

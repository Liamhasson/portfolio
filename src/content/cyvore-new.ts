import type { AtAGlance } from "@/lib/case-studies/types";

/**
 * The Cyvore new website teaser (spec docs/superpowers/specs/2026-11-25-cyvore-new-website-teaser-design.md).
 * DRAFT COPY, awaiting Liam's approval: the line and the body are proposals in his voice; the role and team are his
 * words (2026-11-25). Tools: empty until Liam gives them (the at-a-glance hides the column while it is).
 * No results: the site isn't launched.
 */
export const cyvoreNew = {
  slug: "cyvore-new",
  title: "Cyvore · New website",
  line: "Cyvore's new site: workspace security told as a storybook, in the making.",
  atAGlance: {
    role: "Web and brand designer",
    timeline: "Nov 2026 – present",
    team: "With Cyvore's business development manager and CTO",
    tools: [],
  } satisfies AtAGlance,
  body: [
    "I'm designing and building Cyvore's new website, from the brand world to the code. Every attack wears a familiar face, so the site tells it as a storybook: trolls in perfect disguise, and Charlie, the one who notices their shadow.",
    "It's shaped in rounds of feedback with Cyvore's business development manager and CTO.",
  ],
  soon: "Full case study coming soon.",
  /** The snapshot of the site's first screen (scripts/cyvore-new-snapshot.mjs). */
  site: "/cyvore-new/site/index.html",
  /** The hero still with its text: the link preview, and the frame's stand-in under reduced motion. */
  still: { src: "/case-studies/cyvore-new/peek.jpg", width: 1200, height: 630, alt: "The first screen of Cyvore's new website: Agentic workspace security, Charlie on the gate arch" },
} as const;

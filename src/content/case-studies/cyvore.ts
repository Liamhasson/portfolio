import type { CaseStudy } from "@/lib/case-studies/types";
import { STANDARD_BUDGET } from "@/lib/case-studies/budget";

export const cyvore: CaseStudy = {
  slug: "cyvore",
  title: "Cyvore",
  descriptor: "B2B website",
  line: "A cybersecurity startup needed a site investors would believe in.",
  atAGlance: {
    role: "Research, information architecture, prototype and investor presentations",
    timeline: "About 1 month, part of a 2025–26 contract",
    team: "Solo, reviewed with the CTO, a developer and DevOps",
    tools: ["Figma", "Figma MCP", "Claude Code"],
    type: "Project-based contract",
  },
  challenges: [
    {
      kind: "stakeholder",
      title: "The CEO wanted the full video on the site",
      happened: "The CEO wanted the full product video on the site.",
      did: "I argued for a 7-second animation of the product's mission, with the video one click away. In a meeting you present with visual support; you don't narrate over a video. And investors had likely seen the only public product video already.",
      changed: "The mission reads in about 7 seconds, and the full video stays one click away.",
    },
    {
      kind: "user",
      title: "No investors to test with",
      happened: "The people the site was for, investors in a live meeting, weren't available to test with.",
      did: "I tested with the three people who'd present it, the CTO, a developer and DevOps: four navigation tasks, with the task order counterbalanced.",
      changed: "Every task was measured on the people who'd actually be presenting it.",
    },
  ],
  outcome: {
    lines: [
      "Used as the live product presentation in investor meetings.",
      "3 of 3 stakeholders completed all four tasks. Time to find a section: about 35s → about 8s.",
    ],
    quote: {
      text: "We weren't looking for a designer. Liam reached us and thanks to his work, we closed our first funding round.",
      name: "Yoav Rotem",
      title: "CTO, Cyvore",
    },
  },
  budget: STANDARD_BUDGET,
};

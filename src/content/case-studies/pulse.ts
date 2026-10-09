import type { CaseStudy } from "@/lib/case-studies/types";
import { STANDARD_BUDGET } from "@/lib/case-studies/budget";

export const pulse: CaseStudy = {
  slug: "pulse",
  title: "Pulse",
  descriptor: "Fitness app",
  line: "A goal-focused fitness app designed around four retention milestones.",
  atAGlance: {
    role: "UX design, research and branding",
    timeline: "Dec 2025 – Feb 2026",
    team: "Solo, with a CareerFoundry mentor",
    tools: ["Figma", "Figma MCP", "Claude Code"],
    type: "CareerFoundry final project · prototype",
  },
  challenges: [
    {
      kind: "user",
      title: "The Injury Log read as medical advice",
      happened: "4 of 6 testers took the Injury Log's results as medical advice: a liability risk.",
      did: "I removed the Injury Log and reframed it as the Training Log: progress and habit-building instead of analysis and guidance.",
      changed: "Nothing in the app reads as medical guidance any more: the log tracks how sessions felt, milestones and progression.",
    },
    {
      kind: "user",
      title: "People wanted to set a goal first",
      happened: "5 of 6 testers expected to set a goal during onboarding.",
      did: "I redesigned onboarding around goals, activity preferences and booking habits, before anything else.",
      changed: "The goal-based onboarding shown above.",
    },
    {
      kind: "user",
      title: "Challenges looked public",
      happened: "4 of 6 testers thought Challenges were public.",
      did: "I gave each feature a one-screen introduction.",
      changed: "In round 2, 6 of 6 testers understood that Challenges are private.",
    },
  ],
  outcome: {
    lines: [
      "A tested prototype.",
      "After the fixes, 6 of 6 testers in round 2 (returning and new) completed every scenario task.",
    ],
  },
  budget: STANDARD_BUDGET,
};

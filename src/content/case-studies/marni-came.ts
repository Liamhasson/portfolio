import type { CaseStudy } from "@/lib/case-studies/types";
import { STANDARD_BUDGET } from "@/lib/case-studies/budget";
import { MC_ASSETS } from "@/lib/marni-came/assets";

/** Copy as approved on the board (docs/prototypes/marni-came-mockups.html, Part 2, Liam 2026-10-20); facts from Liam's BA
 *  ("Finding and Branding My Musical Persona", BIMM Berlin, May 2024) and the band's EPK
 *  (spec: docs/superpowers/specs/2026-10-20-marni-came-case-study-design.md). */
export const marniCame: CaseStudy = {
  slug: "marni-came",
  title: "Marni Came",
  descriptor: "Brand identity",
  line: "A Berlin grunge rock band that kept its mistakes, in sound and in brand.",
  atAGlance: {
    role: "Brand identity, art direction, video & web design",
    timeline: "2022 – 2024",
    team: "Band of four · Imri Agmon, co-director (Badehaus)",
    tools: ["Photoshop", "Premiere Pro", "Pro Tools", "Ableton (live shows: lights, playback, click)"],
    type: "Band project, alongside a BA at BIMM Berlin",
  },
  challenges: [
    {
      kind: "user",
      title: "Choosing the first single",
      happened: "Three finished songs, money for one music video.",
      did: "Posted a snippet of each and let our followers choose.",
      changed: "The debut single was theirs: 176 likes and 37 comments, the band's most-engaged post at the time.",
    },
    {
      kind: "design",
      title: "Filming a show with no crew",
      happened: "We wanted a live video and had no camera team.",
      did: "Brought thirteen cameras to the show and handed a couple to friends in the crowd, then edited it.",
      changed: "The Dopamine live video, filmed partly by the audience.",
    },
  ],
  outcome: {
    lines: [
      "Account reach up 74.5% to 4,913 in the three months after the vote post.",
      "386 accounts engaged; 1,043 followers.",
      "Three singles, a music video and a live video.",
      "Played Lido, Badehaus twice and the Emergenza semi-finals.",
    ],
  },
  peek: { src: MC_ASSETS.heroPoster, alt: "Marni Came live at Badehaus, in black and white, amber light burning in from the left", width: 1440, height: 810 },
  // Brand-book middle (spec §3): about 13.7 screens at 1440×900; Liam allowed the longer page (2026-10-20).
  screenCap: 14.5,
  budget: { ...STANDARD_BUDGET, signature: 2, supporting: 7, challenges: 1.2, outcome: 0.5 },
};

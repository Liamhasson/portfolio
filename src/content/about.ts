// src/content/about.ts
/**
 * About and Contact (spec 2026-10-12-about-contact-design.md §3, §4, §6). Liam's approved text (docs/copy/about.md) in
 * two colours: each line a run of segments, `hi` the part in the near-white (Liam, 2026-10-12: "highlight the important
 * parts of the sentence"). A quote, the resume, the portrait or a detail is a one-line change here.
 */
export type Seg = { t: string; hi?: boolean };
export type Line = Seg[];
export type Quote = { text: Line; name: string; role: string };
export type Skill = { name: string; proof: string; href?: string };
export type Verb = { title: string; skills: Skill[] };

export const plain = (l: Line) => l.map((s) => s.t).join("");

export const ABOUT = {
  lines: [
    [{ t: "I’m Liam. I love crafting products", hi: true }, { t: " where design and user needs meet." }],
    [
      { t: "Before design, I spent " }, { t: "ten years managing two rock bands", hi: true },
      { t: " and creative projects across a few industries: small teams of specialists " },
      { t: "making something out of nothing", hi: true }, { t: "." },
    ],
    [
      { t: "That’s still how I work.", hi: true }, { t: " I go looking for " }, { t: "problems nobody pointed at", hi: true },
      { t: ", check whether I’m actually right, and build it." },
    ],
  ] as Line[],
  // (Emil's, from Nordic Logic, added here when it comes; up to four)
  quotes: [
    {
      text: [{ t: "We weren't looking for a designer. Liam reached us and thanks to his work, " }, { t: "we closed our first funding round.", hi: true }],
      name: "Yoav Rotem",
      role: "CTO, Cyvore",
    },
    {
      // (verbatim from the live portfolio, liamhasson.figma.site; Liam, 2026-10-12)
      text: [{ t: "Exceptional talent, a strong aesthetic sense, and " }, { t: "an in-depth ability to make inquiries about the problems he is trying to solve.", hi: true }],
      name: "Andrada Popan-Dorca",
      role: "UX Mentor, CareerFoundry",
    },
  ] as Quote[],
  // (plain text, not a link: it didn't read as clickable; Liam, 2026-10-12)
  opening: { text: [{ t: "End to end", hi: true }, { t: ", from the problem to the shipped product." }] as Line },
  verbs: [
    {
      title: "Find the problem.",
      skills: [
        { name: "User research", proof: "Pulse: what 5 of 6 testers expected reshaped the onboarding", href: "/pulse" },
        { name: "Market & competitor research", proof: "Eventread: Prism.fm, TourSmart, ChatGPT each answer part; none checks the whole night", href: "/eventread" },
        { name: "Information architecture", proof: "Cyvore: finding a section, 35s → 8s", href: "/cyvore" },
      ],
    },
    {
      title: "Check I’m right.",
      skills: [
        { name: "Usability testing", proof: "Pulse round 2: 6 of 6 completed every task", href: "/pulse" },
        { name: "Data-informed decisions", proof: "Eventread: risk bands checked on 3,172 real listings", href: "/eventread" },
        { name: "Stakeholder communication", proof: "Cyvore: argued for a 7-second animation over the full video; it shipped", href: "/cyvore" },
      ],
    },
    {
      title: "Build it.",
      skills: [
        { name: "Interaction & motion", proof: "Cyvore: the mission animation, the CTA’s states", href: "/cyvore" },
        { name: "Design systems", proof: "Eventread: one type family, three risk colours, a CI test", href: "/eventread" },
        { name: "Web design", proof: "Cyvore’s investor site, and this one", href: "/cyvore" },
        { name: "Branding", proof: "Pulse: the brand and its promise", href: "/pulse" },
        { name: "Prototyping in code", proof: "Eventread: built and shipped in Next.js", href: "/eventread" },
        { name: "3D modeling", proof: "This site: the desk and the laptop, modelled and lit in Blender" },
      ],
    },
  ] as Verb[],
  // (hosted on the site: Liam's new resume, 2026-10-12; replacing it later is one file swap)
  resume: { href: "/Liam-Hasson-Resume.pdf", label: "View resume" },
  closing: [{ t: "If you’re working on something that really matters to people, " }, { t: "I’d like to hear about it.", hi: true }] as Line,
  // (Liam's photo, graded to the site, when he sends it: { src: "/about/portrait.jpg", alt, width, height })
  portrait: null as { src: string; alt: string; width: number; height: number } | null,
};

export const CONTACT = {
  headline: "Got something on your mind?",
  email: "Liamhasson@gmail.com",
  linkedin: "https://www.linkedin.com/in/liamhasson/",
  phone: "+49 160 771 0652",
};

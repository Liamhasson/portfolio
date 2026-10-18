// src/content/about.ts
/**
 * About and Contact (spec 2026-10-12-about-contact-design.md §3, §4, §6). Liam's approved text (docs/copy/about.md) in
 * two colours: each line a run of segments, `hi` the part in the near-white (Liam, 2026-10-12: "highlight the important
 * parts of the sentence"). A quote, the resume, the portrait or a detail is a one-line change here.
 */
export type Seg = { t: string; hi?: boolean; href?: string };
export type Line = Seg[];
export type Quote = { text: Line; name: string; role: string };
export type Skill = { name: string; proof: string; href?: string };
export type Verb = { title: string; skills: Skill[] };
/** A picture along the track: a still, or a short silent loop with its poster; `href` makes it a link (title = the hover text). */
export type Picture = { id: string; src: string; poster?: string; alt: string; caption?: string; href?: string; title?: string; loop: boolean };
/** A picture that leads somewhere: the strip's, where a missing href is a compile error. */
export type Linked = Picture & { href: string };

export const plain = (l: Line) => l.map((s) => s.t).join("");

// (the pictures along the track, spec 2026-10-16-about-pictures-design.md §2; Liam, 2026-10-16. Pulse stays out of About.)
type Pictures = {
  bands: [Picture, Picture];
  studio: Picture;
  strip: [Linked, Linked, Linked];
};
const PICTURES: Pictures = {
  // word-sized loops, inline right after "two rock bands", part of the link to /playground; the title shows on hover.
  // (The loops here play About's own copies in /about/loops/: the bands 320 x 180, the strip 480 x 300, limited-range yuv420p,
  // each at 120 fps with its frames repeated. Once two or more videos play, Chrome holds the whole page to the fastest one's
  // frame rate until the next scroll or touch: two 30 fps loops held it at 30 fps. The shared 1280-wide /playground and /work
  // files stay as they are for their other users.)
  bands: [
    { id: "marni-came", src: "/about/loops/after-heartbreaks-loop.mp4", poster: "/playground/after-heartbreaks-film.jpg", alt: "Marni Came on stage", title: "Marni Came", loop: true },
    { id: "sanskrit", src: "/about/loops/my-small-world-loop.mp4", poster: "/playground/my-small-world.jpg", alt: "Sanskrit, my band before Marni Came", title: "Sanskrit", loop: true },
  ],
  // right of the second paragraph, a still
  studio: { id: "studio", src: "/playground/studio-overhead.jpg", alt: "The studio desk from above, mid-session", caption: "Producing · Marni Came", loop: false },
  // under "End to end", each loop captioned and linking to its case study
  strip: [
    { id: "cyvore", src: "/about/loops/cyvore.mp4", poster: "/work/cyvore.jpg", alt: "The Cyvore investor site", caption: "Cyvore", href: "/cyvore", loop: true },
    { id: "eventread", src: "/about/loops/eventread.mp4", poster: "/work/eventread.jpg", alt: "Eventread, the night's risk read in the app", caption: "Eventread", href: "/eventread", loop: true },
    { id: "nordic-logic", src: "/about/loops/nordic-logic-live.mp4", poster: "/work/nordic-logic-live.jpg", alt: "The Nordic Logic site, live", caption: "Nordic Logic", href: "/nordic-logic", loop: true },
  ],
  // (the desk film, "This desk · wire to final", right of "Build it.", left About on 2026-10-18: Liam, "Remove the desk. Let's
  // focus on the pendant." Its files stay in public/about/desk-build.{mp4,jpg}; restoring it is a `desk` entry here and its <Pic>.)
};

export const ABOUT = {
  lines: [
    [{ t: "I’m Liam. I love crafting products", hi: true }, { t: " where design and user needs meet." }],
    // (the bands link to the playground: their music, films and art; Liam, 2026-10-15)
    [
      { t: "Before design, I spent " }, { t: "eight years managing two rock bands", hi: true, href: "/playground" },
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
  // (Liam's graduation photo, cropped to him: left of the first line, travelling with the track; mirrored so he faces the text,
  // not walks away from it (Liam, 2026-10-16); replacing it is one file swap)
  portrait: { src: "/about/portrait-facing.jpg", alt: "Liam walking across the stage at his graduation, a rolled certificate in his hand", width: 760, height: 1273 } as { src: string; alt: string; width: number; height: number } | null,
  pictures: PICTURES,
};

export const CONTACT = {
  headline: "Got something on your mind?",
  email: "Liamhasson@gmail.com",
  linkedin: "https://www.linkedin.com/in/liamhasson/",
  phone: "+49 160 771 0652",
};

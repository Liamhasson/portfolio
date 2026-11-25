/** live: a finished case study. in-progress: a card only. preview: a teaser page for work still being made (Cyvore's new
 *  website, Liam 2026-11-25), outside the chain of finished studies. */
export type ProjectStatus = "live" | "in-progress" | "preview";

export interface Project {
  readonly slug: string;
  readonly name: string;
  readonly status: ProjectStatus;
  readonly tags: readonly string[];
}

/** Order = order on the home grid (Liam, 2026-10-19: Nordic Logic, Eventread, Cyvore, Pulse; 2026-10-20: Marni Came
 *  before Pulse; 2026-11-25: the Cyvore new website teaser first), and of the next-project banners at the foot of each
 *  case study. */
export const projects: readonly Project[] = [
  { slug: "cyvore-new", name: "Cyvore · New website", status: "preview", tags: ["Web design", "Brand"] },
  {
    slug: "nordic-logic",
    name: "Nordic Logic",
    status: "live",
    tags: ["B2B", "Web design", "Motion", "Brand", "Design system"],
  },
  { slug: "eventread", name: "Eventread", status: "live", tags: ["B2B", "Web design", "Designer-builder"] },
  {
    slug: "cyvore",
    name: "Cyvore",
    status: "live",
    tags: ["B2B website design", "Information architecture", "Advanced animation"],
  },
  {
    slug: "marni-came",
    name: "Marni Came",
    status: "live",
    tags: ["Brand identity", "Art direction", "Video", "Web design"],
  },
  {
    slug: "pulse",
    name: "Pulse",
    status: "live",
    tags: ["Front-end development", "Usability testing", "Habit formation focused"],
  },
  {
    slug: "stub",
    name: "Stub",
    status: "in-progress",
    tags: ["Convert-focus onboarding", "Mono-line illustration", "User trust"],
  },
];

export const liveProjects: readonly Project[] = projects.filter((p) => p.status === "live");

/** The case study shown in the next-project footer. Cycles through live projects; a teaser opens onto the first. */
export function nextProject(slug: string): Project {
  if (projects.some((p) => p.slug === slug && p.status === "preview")) return liveProjects[0];
  const i = liveProjects.findIndex((p) => p.slug === slug);
  if (i < 0) throw new Error(`Unknown live project: ${slug}`);
  return liveProjects[(i + 1) % liveProjects.length];
}

export type ProjectStatus = "live" | "in-progress";

export interface Project {
  readonly slug: string;
  readonly name: string;
  readonly status: ProjectStatus;
  readonly tags: readonly string[];
}

/** Order = order on the home grid. */
export const projects: readonly Project[] = [
  { slug: "eventread", name: "Eventread", status: "live", tags: ["B2B", "Web design", "Designer-builder"] },
  {
    slug: "cyvore",
    name: "Cyvore",
    status: "live",
    tags: ["B2B website design", "Information architecture", "Advanced animation"],
  },
  {
    slug: "pulse",
    name: "Pulse",
    status: "live",
    tags: ["Front-end development", "Usability testing", "Habit formation focused"],
  },
  {
    slug: "nordic-logic",
    name: "Nordic Logic",
    status: "in-progress",
    tags: ["B2B", "Web design", "Motion", "Brand", "Design system"],
  },
  {
    slug: "stub",
    name: "Stub",
    status: "in-progress",
    tags: ["Convert-focus onboarding", "Mono-line illustration", "User trust"],
  },
];

export const liveProjects: readonly Project[] = projects.filter((p) => p.status === "live");

/** The case study shown in the next-project footer. Cycles through live projects. */
export function nextProject(slug: string): Project {
  const i = liveProjects.findIndex((p) => p.slug === slug);
  if (i < 0) throw new Error(`Unknown live project: ${slug}`);
  return liveProjects[(i + 1) % liveProjects.length];
}

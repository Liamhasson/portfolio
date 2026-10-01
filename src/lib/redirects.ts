import { liveProjects } from "./projects";

/** Old liamhasson.figma.site paths → new routes, so shared links keep working. */
export const legacyRedirects = liveProjects.map((p) => ({
  source: `/${p.slug}-case-study`,
  destination: `/${p.slug}`,
  permanent: true,
}));

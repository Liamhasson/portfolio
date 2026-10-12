import { liveProjects } from "./projects";

/** Old liamhasson.figma.site paths → new routes, so shared links keep working. */
export const legacyRedirects = liveProjects.map((p) => ({
  source: `/${p.slug}-case-study`,
  destination: `/${p.slug}`,
  permanent: true,
}));

/** The story's old address goes home on the live site (it moved there for the launch, 2026-10-12). Locally the lab
 *  stays reachable: the calibration tools (scripts/lab) use it. Its assets under /lab/sand/ are other paths, unaffected. */
export function labRedirect(env: string | undefined) {
  return env === "production" ? [{ source: "/lab/sand", destination: "/", permanent: false }] : [];
}

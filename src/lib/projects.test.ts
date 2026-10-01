import { describe, expect, test } from "vitest";
import { liveProjects, nextProject, projects } from "./projects";

describe("project registry", () => {
  test("home grid order matches the live site", () => {
    expect(projects.map((p) => p.slug)).toEqual([
      "eventread",
      "cyvore",
      "pulse",
      "nordic-logic",
      "stub",
    ]);
  });

  test("only Eventread, Cyvore and Pulse are live", () => {
    expect(liveProjects.map((p) => p.slug)).toEqual(["eventread", "cyvore", "pulse"]);
  });

  test("tags have no duplicates", () => {
    for (const p of projects) expect(new Set(p.tags).size).toBe(p.tags.length);
  });

  test("next project cycles through live projects", () => {
    expect(nextProject("eventread").slug).toBe("cyvore");
    expect(nextProject("cyvore").slug).toBe("pulse");
    expect(nextProject("pulse").slug).toBe("eventread");
  });

  test("next project rejects in-progress or unknown slugs", () => {
    expect(() => nextProject("stub")).toThrow("Unknown live project: stub");
  });
});

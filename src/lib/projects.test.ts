import { describe, expect, test } from "vitest";
import { liveProjects, nextProject, projects } from "./projects";

describe("project registry", () => {
  test("home grid order matches the live site", () => {
    expect(projects.map((p) => p.slug)).toEqual([
      "nordic-logic",
      "eventread",
      "cyvore",
      "pulse",
      "stub",
    ]);
  });

  test("Nordic Logic, Eventread, Cyvore and Pulse are live, in that order (Liam, 2026-10-19)", () => {
    expect(liveProjects.map((p) => p.slug)).toEqual(["nordic-logic", "eventread", "cyvore", "pulse"]);
  });

  test("tags have no duplicates", () => {
    for (const p of projects) expect(new Set(p.tags).size).toBe(p.tags.length);
  });

  test("next project cycles through live projects, in their order", () => {
    expect(nextProject("nordic-logic").slug).toBe("eventread");
    expect(nextProject("eventread").slug).toBe("cyvore");
    expect(nextProject("cyvore").slug).toBe("pulse");
    expect(nextProject("pulse").slug).toBe("nordic-logic"); // (the last back to the first)
  });

  test("next project rejects in-progress or unknown slugs", () => {
    expect(() => nextProject("stub")).toThrow("Unknown live project: stub");
  });
});

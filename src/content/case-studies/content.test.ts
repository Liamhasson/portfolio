import { describe, expect, test } from "vitest";
import { liveProjects } from "@/lib/projects";
import { validateCaseStudy } from "@/lib/case-studies/validate";
import { cyvore } from "./cyvore";
import { eventread } from "./eventread";
import { pulse } from "./pulse";

const studies = [eventread, cyvore, pulse];

describe("case-study content", () => {
  test.each(studies)("$slug fits the frame", (study) => {
    expect(validateCaseStudy(study)).toEqual([]);
  });

  test("one study per live project, same order", () => {
    expect(studies.map((s) => s.slug)).toEqual(liveProjects.map((p) => p.slug));
  });

  test("each study's title matches its live project's name", () => {
    for (const study of studies) {
      const project = liveProjects.find((p) => p.slug === study.slug);
      expect(project?.name).toBe(study.title);
    }
  });

  test("Cyvore's quote is the home-page wording", () => {
    expect(cyvore.outcome.quote?.text).toBe(
      "We weren't looking for a designer. Liam reached us and thanks to his work, we closed our first funding round.",
    );
  });

  test("Pulse reports counts, not percentages", () => {
    const text = [...pulse.challenges.map((c) => c.happened), ...pulse.outcome.lines].join(" ");
    expect(text).toContain("4 of 6");
    expect(text).toContain("5 of 6");
    expect(text).toContain("6 of 6");
    expect(text).not.toMatch(/\d+%/);
  });
});

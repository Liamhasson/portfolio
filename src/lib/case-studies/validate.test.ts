import { describe, expect, test } from "vitest";
import type { CaseStudy, Challenge } from "./types";
import { SCREEN_CAP, STANDARD_BUDGET, validateCaseStudy } from "./validate";

const design: Challenge = { kind: "design", title: "t", happened: "h", did: "d", changed: "c" };
const engineering: Challenge = { ...design, kind: "engineering" };

const base: CaseStudy = {
  slug: "pulse",
  title: "Pulse",
  descriptor: "Fitness app",
  line: "l",
  atAGlance: { role: "r", timeline: "t", team: "s", tools: ["Figma"] },
  challenges: [design, engineering],
  outcome: { lines: ["A tested prototype."] },
  budget: STANDARD_BUDGET,
};

describe("validateCaseStudy", () => {
  test("a study inside the frame has no problems", () => {
    expect(validateCaseStudy(base)).toEqual([]);
  });

  test("the standard budget fits the cap", () => {
    const total = Object.values(STANDARD_BUDGET).reduce((s, n) => s + n, 0);
    expect(total).toBeLessThanOrEqual(SCREEN_CAP);
  });

  test("rejects fewer than 2 or more than 3 challenges", () => {
    expect(validateCaseStudy({ ...base, challenges: [design] })).toContain("pulse: 1 challenges (2–3 allowed)");
    expect(validateCaseStudy({ ...base, challenges: [design, design, design, design] })).toContain(
      "pulse: 4 challenges (2–3 allowed)",
    );
  });

  test("rejects a challenges block that is engineering only", () => {
    expect(validateCaseStudy({ ...base, challenges: [engineering, engineering] })).toContain(
      "pulse: no design, user or stakeholder challenge",
    );
  });

  test("rejects a budget over the cap", () => {
    expect(validateCaseStudy({ ...base, budget: { ...STANDARD_BUDGET, signature: 3 } })).toContain(
      "pulse: 8.5 screens (cap 8)",
    );
  });

  test("rejects percentages of a small sample", () => {
    const problems = validateCaseStudy({
      ...base,
      outcome: { lines: ["80% of testers expected a goal step."] },
    });
    expect(problems).toContain('pulse: percentage of a small sample: "80% of testers expected a goal step."');
  });

  test("allows percentages that aren't about a sample of people", () => {
    const study = {
      ...base,
      challenges: [{ ...design, did: "About 95% of a month's shows are listed one month out." }, engineering],
    };
    expect(validateCaseStudy(study)).toEqual([]);
  });
});

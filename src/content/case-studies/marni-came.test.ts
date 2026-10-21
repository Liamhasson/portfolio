import { expect, test } from "vitest";
import { validateCaseStudy } from "@/lib/case-studies/validate";
import { marniCame } from "./marni-came";

test("Marni Came fits the frame: two or three challenges, one about people, within its 16.5-screen cap (Strategy added, Liam 2026-10-21)", () => {
  expect(validateCaseStudy(marniCame)).toEqual([]);
  expect(marniCame.screenCap).toBe(16.5);
});

test("dates appear nowhere in the study's own words (only on posters and the ticket)", () => {
  const words = [marniCame.line, ...marniCame.outcome.lines, ...marniCame.challenges.flatMap((c) => [c.title, c.happened, c.did, c.changed])];
  for (const w of words) expect(w).not.toMatch(/\b\d{2}\.\d{2,4}\b/);
});

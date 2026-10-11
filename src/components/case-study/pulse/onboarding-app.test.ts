import { describe, expect, test } from "vitest";
import { INITIAL, SCRIPT, screensHTML, stateAt, stepEnd } from "./onboarding-app";

describe("the Pulse onboarding script", () => {
  test("the prototype starts unfilled (Liam, 2026-10-11)", () => {
    expect(INITIAL()).toMatchObject({ goals: [], activities: [], workout: null, studio: null, day: null, slot: null });
  });
  test("the story's user picks the Figma file's choices by the booking screen", () => {
    expect(stateAt(8, 0)).toMatchObject({ goals: ["Get stronger", "Stay active"], activities: ["HIIT", "Hyrox"], workout: "HIIT", studio: "Burn Club", day: "Mon, Dec 1", slot: 3 });
  });
  test("every screen rests untouched first: no step before 1.6s", () => {
    for (const steps of Object.values(SCRIPT)) for (const st of steps) expect(st.at).toBeGreaterThanOrEqual(1.6);
  });
  test("taps are at least 0.6s apart", () => {
    for (const steps of Object.values(SCRIPT)) steps.slice(1).forEach((st, i) => expect(st.at - stepEnd(steps[i])).toBeGreaterThanOrEqual(0.6));
  });
  test("twelve screens, their assets served from the site", () => {
    const html = screensHTML("t");
    expect(html).toHaveLength(12);
    expect(html.join("")).toContain('src="/case-studies/pulse/app/');
    expect(html.join("")).not.toContain("import.meta");
  });
});

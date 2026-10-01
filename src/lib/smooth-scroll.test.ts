import { expect, test } from "vitest";
import { shouldUseSmoothScroll } from "./smooth-scroll";

const media = (matches: Record<string, boolean>) => (q: string) => matches[q] ?? false;

test("on for a mouse/trackpad without reduced motion", () => {
  expect(shouldUseSmoothScroll(media({ "(pointer: fine)": true }))).toBe(true);
});

test("off on touch devices (native scrolling stays intact)", () => {
  expect(shouldUseSmoothScroll(media({ "(pointer: fine)": false }))).toBe(false);
});

test("off when the user prefers reduced motion", () => {
  expect(
    shouldUseSmoothScroll(
      media({ "(pointer: fine)": true, "(prefers-reduced-motion: reduce)": true }),
    ),
  ).toBe(false);
});

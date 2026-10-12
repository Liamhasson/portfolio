// src/app/contact/contact-timeline.test.ts
import { expect, test } from "vitest";
import { CONTACT_T, contactAt, contactStalled, wordsShown } from "./contact-timeline";

test("after the brief is full: its corners round, then the cascade, then the words", () => {
  expect(contactAt(0).round).toBe(0);
  expect(contactAt(CONTACT_T.round).round).toBe(1);
  expect(contactAt(0.3).cascade).toBeLessThan(0);
  expect(contactAt(CONTACT_T.round + 1).cascade).toBeCloseTo(1, 9);
  expect(contactAt(CONTACT_T.round + 2.7).words).toBe(0);
  expect(contactAt(CONTACT_T.round + 3.6).words).toBe(1);
});

test("a stalled load gives up after 15 s, never while it still moves or once it's complete (Review Focus 5)", () => {
  expect(contactStalled(15.1, 0.4)).toBe(true);
  expect(contactStalled(14.9, 0.4)).toBe(false);
  expect(contactStalled(30, 1)).toBe(false);
});

test("the words are there right away, a short arrival as the page opens, whatever the sand is doing (Liam, 2026-10-13)", () => {
  expect(wordsShown(0, 0)).toBe(0);
  expect(wordsShown(0.5, 0)).toBeGreaterThan(0.3);
  expect(wordsShown(1.1, 0)).toBe(1);
});

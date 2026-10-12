import { expect, test } from "vitest";
import { sectionRedirect } from "./story";

test("old links to the story's About and Contact anchors go to the pages (spec 2026-10-12 §5)", () => {
  expect(sectionRedirect("#about")).toBe("/about");
  expect(sectionRedirect("#contact")).toBe("/contact");
  expect(sectionRedirect("#projects")).toBeNull();
  expect(sectionRedirect("")).toBeNull();
});

import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { BackButton } from "./back-button";

test("goes back to the projects index (Liam, 2026-10-11), and catches the light like the pills", () => {
  render(<BackButton slug="cyvore" />);
  const link = screen.getByRole("link", { name: "Back to projects" });
  expect(link).toHaveAttribute("href", "/lab/sand?hero#projects");   // the story's index (src/lib/story.ts)
  expect(link).toHaveAttribute("data-light");
  expect(link.className).toContain("sh-back");
});

test("on the case studies: Back, with its arrow, in the middle of the nav's row (Liam, 2026-10-12, as on lusion.co)", () => {
  render(<BackButton slug="pulse" />);
  const link = screen.getByRole("link", { name: "Back to projects" });
  expect(link).toHaveTextContent("Back");
  expect(link.className).toMatch(/left-1\/2/);
  expect(link.querySelector("svg")).not.toBeNull();
});

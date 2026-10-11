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

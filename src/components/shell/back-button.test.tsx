import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { BackButton } from "./back-button";

test("returns to the originating card on home", () => {
  render(<BackButton slug="cyvore" />);
  const link = screen.getByRole("link", { name: "Back to projects" });
  expect(link).toHaveAttribute("href", "/#cyvore");
});

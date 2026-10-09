import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { NextProject } from "./next-project";

test("next project loops Eventread → Cyvore → Pulse → Eventread", () => {
  const { rerender } = render(<NextProject from="eventread" />);
  expect(screen.getByRole("link", { name: /Next project: Cyvore/ })).toHaveAttribute("href", "/cyvore");
  rerender(<NextProject from="cyvore" />);
  expect(screen.getByRole("link", { name: /Next project: Pulse/ })).toHaveAttribute("href", "/pulse");
  rerender(<NextProject from="pulse" />);
  expect(screen.getByRole("link", { name: /Next project: Eventread/ })).toHaveAttribute("href", "/eventread");
});

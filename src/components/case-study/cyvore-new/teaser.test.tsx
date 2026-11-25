import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { Teaser } from "./teaser";

beforeEach(() => {
  // (jsdom has neither; the frame reads the width and motion preference, and sizes itself to its box)
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
});

test("the teaser: its world, the title, in progress, the frame, no results and the way on (spec 2026-11-25 §2)", () => {
  const { container } = render(<Teaser />);
  expect(container.querySelector('article[data-world="cyvore-new"]')).not.toBeNull();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Cyvore · New website");
  expect(screen.getAllByText("In progress").length).toBeGreaterThan(0);
  expect(screen.getByText(/I'm designing and building Cyvore's new website/)).toBeInTheDocument();
  expect(screen.getByText("Full case study coming soon.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Next project: Nordic Logic" })).toHaveAttribute("href", "/nordic-logic");
  expect(screen.getByRole("link", { name: "Back to projects" }).getAttribute("href")).toMatch(/#projects$/);
  expect(screen.queryByRole("link", { name: /open the site/i })).toBeNull();
});

test("the at-a-glance: role, timeline and team in Liam's words; no Tools column until he gives them", () => {
  render(<Teaser />);
  const glance = within(screen.getByLabelText("At a glance"));
  expect(glance.getByText("Web and brand designer")).toBeInTheDocument();
  expect(glance.getByText("Nov 2026 – present")).toBeInTheDocument();
  expect(glance.getByText("With Cyvore's business development manager and CTO")).toBeInTheDocument();
  expect(glance.queryByText("Tools")).toBeNull();
});

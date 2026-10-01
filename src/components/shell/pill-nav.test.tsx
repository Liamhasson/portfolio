import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const pathname = vi.fn(() => "/");
const useActiveSection = vi.fn<(ids: readonly string[], resetKey?: string) => string | null>(() => null);

vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));
vi.mock("@/hooks/use-active-section", () => ({
  useActiveSection: (ids: readonly string[], resetKey?: string) => useActiveSection(ids, resetKey),
}));

import { PillNav } from "./pill-nav";

beforeEach(() => {
  pathname.mockReturnValue("/");
  useActiveSection.mockReset();
  useActiveSection.mockReturnValue(null);
});

describe("PillNav", () => {
  test("links to the three home sections from any page", () => {
    render(<PillNav />);
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/#projects");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/#about");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/#contact");
  });

  test("tracks the home sections and re-subscribes per page", () => {
    pathname.mockReturnValue("/cyvore");
    render(<PillNav />);
    expect(useActiveSection).toHaveBeenCalledWith(["projects", "about", "contact"], "/cyvore");
  });

  test("marks the active section on home", () => {
    useActiveSection.mockReturnValue("about");
    render(<PillNav />);
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "location");
    expect(screen.getByRole("link", { name: "Projects" })).not.toHaveAttribute("aria-current");
  });

  test("no reading progress on home", () => {
    render(<PillNav />);
    expect(screen.queryByTestId("reading-progress")).toBeNull();
  });

  test("reading progress on case studies, without active section", () => {
    pathname.mockReturnValue("/cyvore");
    useActiveSection.mockReturnValue("about");
    render(<PillNav />);
    expect(screen.getByTestId("reading-progress")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About" })).not.toHaveAttribute("aria-current");
  });
});

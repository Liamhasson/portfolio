import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const pathname = vi.fn(() => "/");
const useActiveSection = vi.fn<(ids: readonly string[], resetKey?: string) => string | null>(() => null);

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a data-next-link="" href={href} {...rest}>
      {children}
    </a>
  ),
}));
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
  test("on the story page the pills are in-page anchors", () => {
    pathname.mockReturnValue("/lab/sand");
    render(<PillNav />);
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "#projects");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "#about");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "#contact");
  });

  test("from any other page they lead into the story", () => {
    pathname.mockReturnValue("/cyvore");
    render(<PillNav />);
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/lab/sand?hero#projects");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/lab/sand?hero#contact");
  });

  test("tracks the home sections and re-subscribes per page", () => {
    pathname.mockReturnValue("/cyvore");
    render(<PillNav />);
    expect(useActiveSection).toHaveBeenCalledWith(["projects", "about", "contact"], "/cyvore");
  });

  test("marks the active section on home", () => {
    pathname.mockReturnValue("/lab/sand");
    useActiveSection.mockReturnValue("about");
    render(<PillNav />);
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "location");
    expect(screen.getByRole("link", { name: "Projects" })).not.toHaveAttribute("aria-current");
  });

  test("no reading progress bar anywhere (removed by Liam, 2026-10-09)", () => {
    render(<PillNav />);
    expect(screen.queryByTestId("reading-progress")).toBeNull();
    pathname.mockReturnValue("/cyvore");
    render(<PillNav />);
    expect(screen.queryByTestId("reading-progress")).toBeNull();
  });

  test("case studies show no active section", () => {
    pathname.mockReturnValue("/cyvore");
    useActiveSection.mockReturnValue("about");
    render(<PillNav />);
    expect(screen.getByRole("link", { name: "About" })).not.toHaveAttribute("aria-current");
  });

  test("the story uses plain anchors, other pages use next/link", () => {
    pathname.mockReturnValue("/lab/sand");
    const { unmount } = render(<PillNav />);
    for (const name of ["Projects", "About", "Contact"]) {
      expect(screen.getByRole("link", { name })).not.toHaveAttribute("data-next-link");
    }
    unmount();
    pathname.mockReturnValue("/cyvore");
    render(<PillNav />);
    for (const name of ["Projects", "About", "Contact"]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("data-next-link");
    }
  });

  test("active link holds exactly one decorative highlight", () => {
    pathname.mockReturnValue("/lab/sand");
    useActiveSection.mockReturnValue("about");
    render(<PillNav />);
    expect(screen.getByRole("link", { name: "About" }).querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Projects" }).querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });
});

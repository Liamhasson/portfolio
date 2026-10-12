import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const pathname = vi.fn(() => "/");   // the story is the home page (src/lib/story.ts)
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
  test("Projects goes to the projects index: in the story an in-page anchor, from any other page into the story", () => {
    render(<PillNav />);
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "#projects");
  });

  test("from a case study Projects leads into the story's index", () => {
    pathname.mockReturnValue("/cyvore");
    render(<PillNav />);
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/#projects");
  });

  test("on a case study Projects is lit; on a page that isn't one (the 404), nothing is (Liam, 2026-10-13)", () => {
    pathname.mockReturnValue("/cyvore");
    const { unmount } = render(<PillNav />);
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
    unmount();
    pathname.mockReturnValue("/no-such-page");
    render(<PillNav />);
    for (const name of ["Projects", "About", "Contact"]) expect(screen.getByRole("link", { name })).not.toHaveAttribute("aria-current");
  });

  test("tracks the home sections and re-subscribes per page", () => {
    pathname.mockReturnValue("/cyvore");
    render(<PillNav />);
    expect(useActiveSection).toHaveBeenCalledWith(["projects"], "/cyvore");
  });

  test("on home the section you're in is the active pill", () => {
    useActiveSection.mockReturnValue("projects");
    render(<PillNav />);
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "location");
    expect(screen.getByRole("link", { name: "Projects" }).className).toContain("is-active");
  });

  test("About and Contact are their own pages, from everywhere (spec 2026-10-12 §5)", () => {
    for (const path of ["/", "/cyvore", "/about"]) {
      pathname.mockReturnValue(path);
      const { unmount } = render(<PillNav />);
      expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
      expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
      expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("data-next-link");
      unmount();
    }
  });

  test("the pill of the page you're on is lit", () => {
    pathname.mockReturnValue("/about");
    const { unmount } = render(<PillNav />);
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page");
    unmount();
    pathname.mockReturnValue("/contact");
    render(<PillNav />);
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Projects" })).not.toHaveAttribute("aria-current");
  });

  test("a case study sits under Projects: Projects is the active pill", () => {
    pathname.mockReturnValue("/cyvore");
    useActiveSection.mockReturnValue("projects");
    render(<PillNav />);
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "About" })).not.toHaveAttribute("aria-current");
  });

  test("no reading progress bar anywhere (removed by Liam, 2026-10-09)", () => {
    render(<PillNav />);
    expect(screen.queryByTestId("reading-progress")).toBeNull();
  });

  test("home uses a plain anchor (Lenis owns the scroll), other pages next/link", () => {
    const { unmount } = render(<PillNav />);
    expect(screen.getByRole("link", { name: "Projects" })).not.toHaveAttribute("data-next-link");
    unmount();
    pathname.mockReturnValue("/cyvore");
    render(<PillNav />);
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("data-next-link");
  });

  test("one sliding highlight for the whole nav, hidden from assistive tech; every pill catches the light", () => {
    render(<PillNav />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav.querySelectorAll(".hl")).toHaveLength(1);
    expect(nav.querySelector(".hl")).toHaveAttribute("aria-hidden", "true");
    expect(nav.querySelectorAll("[data-light]")).toHaveLength(3);
  });
});

describe("phones: the burger (Liam, 2026-10-12)", () => {
  test("a Menu button, closed at first; the menu's links aren't on the page until it opens", () => {
    render(<PillNav />);
    const burger = screen.getByRole("button", { name: "Menu" });
    expect(burger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  test("it opens a full-screen menu: the three pages, the one you're on marked, focus inside", () => {
    pathname.mockReturnValue("/about");
    render(<PillNav />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const menu = screen.getByRole("dialog", { name: "Menu" });
    const links = within(menu).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Projects", "About", "Contact"]);
    expect(within(menu).getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page");
    expect(within(menu).getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(menu.contains(document.activeElement)).toBe(true);
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
  });
  test("Escape closes it, and focus returns to the button", () => {
    render(<PillNav />);
    const burger = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(burger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(burger);
  });
  test("choosing a page closes it", () => {
    pathname.mockReturnValue("/cyvore");
    render(<PillNav />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Contact" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

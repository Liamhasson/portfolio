import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const pathname = vi.fn(() => "/lab/sand");   // the story is home (src/lib/story.ts)
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
  pathname.mockReturnValue("/lab/sand");
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
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/lab/sand?hero#projects");
  });

  test("About and Contact look like the others but go nowhere yet (Liam, 2026-10-11)", () => {
    render(<PillNav />);
    for (const name of ["About", "Contact"]) {
      const pill = screen.getByRole("button", { name: `${name}, coming soon` });
      expect(pill).toHaveTextContent(name);
      expect(pill).toHaveAttribute("aria-disabled", "true");
      expect(pill).not.toHaveAttribute("href");
      expect(pill.className).toContain("pill");
      fireEvent.click(pill); // nothing happens, nothing throws
    }
    expect(screen.queryByRole("link", { name: /About|Contact/ })).toBeNull();
  });

  test("tracks the home sections and re-subscribes per page", () => {
    pathname.mockReturnValue("/cyvore");
    render(<PillNav />);
    expect(useActiveSection).toHaveBeenCalledWith(["projects", "about", "contact"], "/cyvore");
  });

  test("on home the section you're in is the active pill", () => {
    useActiveSection.mockReturnValue("projects");
    render(<PillNav />);
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "location");
    expect(screen.getByRole("link", { name: "Projects" }).className).toContain("is-active");
  });

  test("a case study sits under Projects: Projects is the active pill", () => {
    pathname.mockReturnValue("/cyvore");
    useActiveSection.mockReturnValue("about");
    render(<PillNav />);
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "About, coming soon" })).not.toHaveAttribute("aria-current");
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

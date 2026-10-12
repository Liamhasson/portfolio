import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const pathname = vi.fn(() => "/about");
const glideTo = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: React.ComponentProps<"a">) => <a data-next-link="" href={href} {...rest}>{children}</a> }));
vi.mock("@/lib/smooth-scroll", () => ({ glideTo: (...a: unknown[]) => glideTo(...a) }));

import { NavName } from "./nav-name";
import { nameRoll } from "@/lib/name-roll";

beforeEach(() => {
  glideTo.mockReset();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
});

const pairs = () => [...document.querySelectorAll<HTMLElement>("[data-roll]")];

describe("the name in the nav (Liam, 2026-10-12)", () => {
  test("fixed top left on every page: Liam Hasson, leading to the hero", () => {
    pathname.mockReturnValue("/about");
    render(<NavName />);
    const link = screen.getByRole("link", { name: "Liam Hasson, back to the start" });
    expect(link).toHaveAttribute("href", "/lab/sand?hero");
    expect(link).toHaveAttribute("data-next-link");
    expect(pairs().every((p) => p.style.transform === "translateY(-50%)")).toBe(true);   // (rolled: LIAM HASSON)
  });
  test("on the story it reads PRODUCT DESIGNER until the hero's line leaves, rolling with it", () => {
    pathname.mockReturnValue("/lab/sand");
    render(<NavName />);
    act(() => nameRoll.set(0));
    expect(pairs().every((p) => p.style.transform === "translateY(0%)")).toBe(true);
    act(() => nameRoll.set(1));
    expect(pairs().every((p) => p.style.transform === "translateY(-50%)")).toBe(true);
  });
  test("on the story a click glides back to the top instead of reloading", () => {
    pathname.mockReturnValue("/lab/sand");
    render(<NavName />);
    fireEvent.click(screen.getByRole("link", { name: "Liam Hasson, back to the start" }));
    expect(glideTo).toHaveBeenCalled();
    expect(glideTo.mock.calls[0][0]).toBe(0);
  });
});

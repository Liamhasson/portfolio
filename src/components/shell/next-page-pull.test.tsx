// src/components/shell/next-page-pull.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const push = vi.fn(), prefetch = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, prefetch }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: React.ComponentProps<"a">) => <a href={href} {...rest}>{children}</a> }));

import { NextPagePull } from "./next-page-pull";

let now = 0, scrollY = 0;
const setPage = (y: number, height = 3000) => {
  scrollY = y;
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrollY });
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, get: () => height });
};
beforeEach(() => {
  push.mockReset(); prefetch.mockReset(); now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 1000 });
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
  window.scrollTo = vi.fn((_x: unknown, y?: unknown) => { scrollY = Number(y); }) as never;
});
afterEach(() => vi.restoreAllMocks());

const wheel = (dy: number, n: number) => { for (let k = 0; k < n; k++) { now += 16; act(() => { fireEvent.wheel(window, { deltaY: dy }); }); } };

describe("NextPagePull", () => {
  test("a peek that is an ordinary link to the next page", () => {
    setPage(0);
    render(<NextPagePull href="/about" label="About" line="I’m Liam." />);
    const link = screen.getByRole("link", { name: "Next: About" });
    expect(link).toHaveAttribute("href", "/about");
    expect(link).toHaveTextContent("I’m Liam.");
  });
  test("a fresh scroll at the end fills the line and opens the next page when full", () => {
    setPage(1500);   // (mounted above the end; then the reader scrolls down to it)
    render(<NextPagePull href="/about" label="About" line="x" />);
    scrollY = 2000;
    now += 1000;
    wheel(80, 4);
    expect(push).not.toHaveBeenCalled();
    wheel(80, 4);
    expect(push).toHaveBeenCalledWith("/about");
    expect(push).toHaveBeenCalledTimes(1);
  });
  test("arriving back at the end (history) lands just above it: nothing fires by itself (Review Focus 2)", () => {
    setPage(2000);
    render(<NextPagePull href="/about" label="About" line="x" />);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 1750);
  });
  test("reduced motion: the link only, no gesture", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} }) as never;
    setPage(1999);
    render(<NextPagePull href="/about" label="About" line="x" />);
    now += 1000;
    wheel(200, 20);
    expect(push).not.toHaveBeenCalled();
  });
  test("inactive (the other layout of the index): it doesn't listen", () => {
    setPage(1999);
    render(<NextPagePull href="/about" label="About" line="x" active={false} />);
    now += 1000;
    wheel(200, 20);
    expect(push).not.toHaveBeenCalled();
  });
  test("Back restores the page at its end after it mounts (Next.js restores scroll later): it still steps back above the pull", () => {
    vi.useFakeTimers();
    setPage(0);   // (mounted at the top: the restoration hasn't happened yet)
    render(<NextPagePull href="/contact" label="Contact" line="x" />);
    scrollY = 2000;   // (the router restores the old position)
    act(() => { vi.advanceTimersByTime(500); });
    expect(window.scrollTo).toHaveBeenCalledWith(0, 1750);
    vi.useRealTimers();
  });
  test("…but never moves a reader who has already started scrolling", () => {
    vi.useFakeTimers();
    setPage(0);
    render(<NextPagePull href="/contact" label="Contact" line="x" />);
    now += 16; act(() => { fireEvent.wheel(window, { deltaY: 40 }); });
    scrollY = 2000;
    act(() => { vi.advanceTimersByTime(500); });
    expect(window.scrollTo).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
  test("the rest of the gesture that opened the next page doesn't scroll it: swallowed until the gesture ends", () => {
    setPage(1500);
    const { unmount } = render(<NextPagePull href="/about" label="About" line="x" />);
    scrollY = 2000;
    now += 1000;
    wheel(80, 8);
    expect(push).toHaveBeenCalledTimes(1);
    unmount();   // (the next page replaces this one)
    now += 16;
    const more = new WheelEvent("wheel", { deltaY: 80, cancelable: true });
    window.dispatchEvent(more);
    expect(more.defaultPrevented).toBe(true);
    now += 400;   // (a pause: a new gesture, the reader's own)
    const fresh = new WheelEvent("wheel", { deltaY: 80, cancelable: true });
    window.dispatchEvent(fresh);
    expect(fresh.defaultPrevented).toBe(false);
  });
});


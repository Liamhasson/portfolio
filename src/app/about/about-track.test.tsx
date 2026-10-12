// src/app/about/about-track.test.tsx
import { act, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: React.ComponentProps<"a">) => <a href={href} {...rest}>{children}</a> }));

import { AboutTrack } from "./about-track";
import { ABOUT, plain } from "@/content/about";

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
});

test("the whole approved text, in reading order, under an About heading", () => {
  render(<AboutTrack />);
  expect(screen.getByRole("heading", { level: 1, name: "About" })).toBeInTheDocument();
  const text = document.body.textContent!;
  let at = 0;
  for (const l of [...ABOUT.lines, ABOUT.closing]) {
    const i = text.indexOf(plain(l), at);
    expect(i).toBeGreaterThanOrEqual(at);
    at = i;
  }
});

test("two colours: the highlights are the near-white spans", () => {
  render(<AboutTrack />);
  const his = [...document.querySelectorAll(".hi")].map((n) => n.textContent);
  expect(his).toContain("I’m Liam. I love crafting products");
  expect(his).toContain("we closed our first funding round.");
});

test("the quotes are quotes: a blockquote with who said it", () => {
  render(<AboutTrack />);
  const fig = screen.getByText("Yoav Rotem · CTO, Cyvore").closest("figure")!;
  expect(within(fig).getByText(/we closed our first funding round/).closest("blockquote")).not.toBeNull();
});

test("What I do: three verbs, twelve skills, each proof linking to its case study (3D modeling: no link)", () => {
  render(<AboutTrack />);
  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Find the problem.", "Check I’m right.", "Build it."]);
  expect(screen.getAllByRole("listitem")).toHaveLength(12);
  expect(screen.getByRole("link", { name: /finding a section, 35s → 8s/ })).toHaveAttribute("href", "/cyvore");
  expect(screen.queryByRole("link", { name: /modelled and lit in Blender/ })).toBeNull();
});

test("the resume opens in a new tab, safely; the pull leads to Contact", () => {
  render(<AboutTrack />);
  const cv = screen.getByRole("link", { name: /View resume/ });
  expect(cv).toHaveAttribute("target", "_blank");
  expect(cv).toHaveAttribute("rel", "noopener noreferrer");
  expect(screen.getByRole("link", { name: "Next: Contact" })).toHaveAttribute("href", "/contact");
  expect(screen.getByRole("link", { name: "Next: Contact" })).toHaveTextContent("Keep scrolling");   // (Liam, 2026-10-12)
});

test("tabbing to a link on the track scrolls the page to its slide, not the clip (final review I3)", () => {
  window.scrollTo = vi.fn() as never;
  render(<AboutTrack />);
  screen.getByRole("link", { name: /finding a section, 35s → 8s/ }).focus();
  expect(window.scrollTo).toHaveBeenCalled();
});

test("the track is clipped, not a scroll container (overflow: clip), so nothing can scroll it sideways (final review I3)", async () => {
  const css = (await import("node:fs")).readFileSync(`${process.cwd()}/src/app/about/about.css`, "utf8");
  expect(css).toMatch(/\.ab-clip \{[^}]*overflow: clip/);
  expect(css).toMatch(/\.ab\[data-mode="track"\] \.ab-pin \{[^}]*overflow: clip/);
});

test("stacked (phones, reduced motion): each slide rises in as it comes into view (spec §3; final review I6)", () => {
  let cb: IntersectionObserverCallback = () => {};
  const observed: Element[] = [];
  globalThis.IntersectionObserver = class {
    constructor(c: IntersectionObserverCallback) { cb = c; }
    observe(el: Element) { observed.push(el); }
    unobserve() {}
    disconnect() {}
  } as never;
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} }) as never;   // (reduced: stacked)
  const { container } = render(<AboutTrack />);
  const slides = [...container.querySelectorAll(".ab-slide")];
  expect(observed.length).toBe(slides.length);
  expect(slides[0]).not.toHaveAttribute("data-in");
  act(() => { cb([{ target: slides[0], isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver); });
  expect(slides[0]).toHaveAttribute("data-in");
});

test("the track's first line slides in on arrival, and the ground carries the site's film grain (spec §2, §3.3; final review I6)", async () => {
  const css = (await import("node:fs")).readFileSync(`${process.cwd()}/src/app/about/about.css`, "utf8");
  expect(css).toMatch(/\.ab\[data-mode="track"\] \.ab-slide:first-child \{[^}]*animation: ab-in/);
  expect(css).toMatch(/@keyframes ab-in/);
  expect(css).toMatch(/url\("?\/lab\/grain\.png"?\)/);
});

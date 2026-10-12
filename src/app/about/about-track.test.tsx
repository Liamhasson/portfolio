// src/app/about/about-track.test.tsx
import { render, screen, within } from "@testing-library/react";
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

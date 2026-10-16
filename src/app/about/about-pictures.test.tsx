// src/app/about/about-pictures.test.tsx: the pictures in their places along the track (spec 2026-10-16-about-pictures-design.md §2)
import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: React.ComponentProps<"a">) => <a href={href} {...rest}>{children}</a> }));

import { AboutTrack } from "./about-track";
import { ABOUT } from "@/content/about";

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
});

const pic = (c: ParentNode, id: string) => c.querySelector<HTMLElement>(`.ab-pic[data-pic="${id}"]`)!;
const slideOf = (el: Element) => el.closest<HTMLElement>(".ab-track > .ab-slide")!;

test("the band loops sit inside the playground link, after \"two rock bands\"", () => {
  const { container } = render(<AboutTrack />);
  const link = container.querySelector<HTMLAnchorElement>('a[href="/playground"]')!;
  const chips = [...link.querySelectorAll<HTMLElement>(".ab-pic")];
  expect(chips.map((c) => c.getAttribute("title"))).toEqual(["Marni Came", "Sanskrit"]);
  // after the words in the DOM order, and the link's name stays the words
  expect(link.firstChild!.textContent).toBe("eight years managing two rock bands");
  expect(link.querySelector(".ab-pic")!.compareDocumentPosition(link.firstChild!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  expect(screen.getByRole("link", { name: "eight years managing two rock bands" })).toBe(link);
  for (const c of chips) {
    const v = c.querySelector("video")!;
    expect(v).toHaveAttribute("loop");
    expect(v.muted).toBe(true);
    expect(v).toHaveAttribute("preload", "none");
    expect(v).toHaveAttribute("poster");
    expect(c.querySelector(".ab-pic-f")).not.toBeNull();
  }
});

test("the studio sits in paragraph 2's slide, with its caption", () => {
  const { container } = render(<AboutTrack />);
  const studio = pic(container, "studio");
  expect(studio).not.toBeNull();
  expect(slideOf(studio).textContent).toContain("Before design, I spent");
  expect(studio.querySelector(".ab-pic-f img")).toHaveAttribute("alt", ABOUT.pictures.studio.alt);
  expect(within(studio).getByText("Producing · Marni Came").className).toContain("ab-pic-cap");
});

test("the strip sits under End to end, three linked pictures", () => {
  const { container } = render(<AboutTrack />);
  const strip = container.querySelector<HTMLElement>('[data-pendant="strip"]')!;
  expect(slideOf(strip).textContent).toContain("End to end");
  const links = [...strip.querySelectorAll("a")];
  expect(links.map((a) => a.getAttribute("href"))).toEqual(["/cyvore", "/eventread", "/nordic-logic"]);
  expect(links.map((a) => a.querySelector(".ab-pic")!.getAttribute("data-pic"))).toEqual(["cyvore", "eventread", "nordic-logic"]);
  // named by their captions
  for (const n of ["Cyvore", "Eventread", "Nordic Logic"]) expect(within(strip).getByRole("link", { name: n })).toBeInTheDocument();
});

test("the glass slot sits between the two quotes and is empty", () => {
  const { container } = render(<AboutTrack />);
  const slot = container.querySelector<HTMLElement>('[data-pendant="glass"]')!;
  expect(slot).not.toBeNull();
  expect(slot).toHaveAttribute("aria-hidden", "true");
  expect(slot.childElementCount).toBe(0);
  expect(slot.textContent).toBe("");
  expect(slot.previousElementSibling!.textContent).toContain("Yoav Rotem");
  expect(slot.nextElementSibling!.textContent).toContain("Andrada Popan-Dorca");
});

test("the desk film follows Build it, with its caption", () => {
  const { container } = render(<AboutTrack />);
  const film = container.querySelector<HTMLElement>('.ab-pic[data-pendant="deskfilm"]')!;
  expect(film).toHaveAttribute("data-pic", "desk");
  expect(slideOf(film).textContent).toContain("Build it.");
  expect(within(film).getByText("This desk · wire to final").className).toContain("ab-pic-cap");
  expect(film.querySelector("video")).toHaveAttribute("src", ABOUT.pictures.desk.src);
});

test("nothing appears twice", () => {
  const { container } = render(<AboutTrack />);
  const srcs = [...container.querySelectorAll(".ab-pic")].map((p) => {
    const m = p.querySelector("video, img")!;
    return m.getAttribute("src");
  });
  expect(srcs).toHaveLength(7);
  expect(new Set(srcs).size).toBe(srcs.length);
});

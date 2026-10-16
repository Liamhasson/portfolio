// src/app/about/about-pictures.test.tsx: the pictures in their places along the track (spec 2026-10-16-about-pictures-design.md §2)
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: React.ComponentProps<"a">) => <a href={href} {...rest}>{children}</a> }));

import { AboutTrack } from "./about-track";
import { ABOUT } from "@/content/about";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); Object.defineProperty(window, "scrollY", { value: 0, configurable: true }); });
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

test("stacked (phones, reduced motion): the Build it body is not held to the track's 60vw", async () => {
  const css = (await import("node:fs")).readFileSync(`${process.cwd()}/src/app/about/about.css`, "utf8");
  expect(css).toMatch(/\.ab\[data-mode="stack"\] \.ab-verb-body \{[^}]*max-width: none/);
});

/** jsdom has no layout: give the track a width, and the pictures their places along it (the track's own left stays 0) */
function laidOut(places: Record<string, [left: number, width: number]>) {
  vi.spyOn(Element.prototype, "scrollWidth", "get").mockReturnValue(5000);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 0; });
  const rect = (left: number, width: number) => ({ left, right: left + width, width, top: 0, bottom: 0, height: 0, x: left, y: 0, toJSON() {} }) as DOMRect;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const id = this.closest<HTMLElement>(".ab-pic")?.dataset.pic;
    const [left, width] = (id && places[id]) || [0, 0];
    return this.classList.contains("ab-track") ? rect(0, 5000) : rect(left, width);
  });
}
const scrollTo = (y: number) => { Object.defineProperty(window, "scrollY", { value: y, configurable: true }); act(() => { window.dispatchEvent(new Event("scroll")); }); };

test("on the track a picture rises out of its line as it arrives and is cut at the margin line as it leaves", () => {
  laidOut({ studio: [2000, 100], desk: [100, 100] });
  const { container } = render(<AboutTrack />);
  const studio = pic(container, "studio");
  // at the start: the studio is far to the right: not there yet; the desk (at 100px, risen) is
  expect(studio.style.visibility).toBe("hidden");
  expect(studio.style.clipPath).toMatch(/^inset\(100% /);
  expect(pic(container, "desk").style.visibility).toBe("");
  // scrolled 1500px along: the studio is at 500px of the 1024px screen (under 70%): fully risen
  scrollTo(1500);
  expect(studio.style.visibility).toBe("");
  expect(studio.style.clipPath).toMatch(/^inset\(0% -100vw 0 0px round /);
  // scrolled until its left edge is 50px past the margin line (6% of 1024 = 61.44): half of its 100px is cut
  scrollTo(2000 - 61.44 + 50);
  expect(parseFloat(studio.style.clipPath.match(/^inset\(0% -100vw 0 ([\d.]+)px/)![1])).toBeCloseTo(50, 6);
  // its right edge reached the margin line: gone
  scrollTo(2000 - 61.44 + 100);
  expect(studio.style.visibility).toBe("hidden");
});

test("a strip picture (inside its link) is clipped away, never visibility:hidden, so the link stays in the tab order", () => {
  laidOut({ cyvore: [3000, 100] });
  const { container } = render(<AboutTrack />);
  const c = pic(container, "cyvore");
  expect(c.style.clipPath).toBe("inset(50%)");   // (unrisen: an empty clip, not a fractional-width sliver)
  expect(c.style.visibility).toBe("");
  // focusing it scrolls its slide to the margin: the picture is then in the shown range
  scrollTo(3000 - 0.06 * 1024);
  expect(c.style.clipPath).toMatch(/^inset\(0% -100vw 0 0px /);
  // and as it leaves: part-cut is a left inset, fully cut (its right edge at the margin line) is the empty clip, still visible to the tab order
  scrollTo(3000 - 0.06 * 1024 + 40);
  expect(parseFloat(c.style.clipPath.match(/^inset\(0% -100vw 0 ([\d.]+)px/)![1])).toBeCloseTo(40, 6);
  scrollTo(3000 - 0.06 * 1024 + 100.5);
  expect(c.style.clipPath).toBe("inset(50%)");
  expect(c.style.visibility).toBe("");
});

test("stacked: the pictures' clip and visibility are cleared", () => {
  laidOut({ studio: [2000, 100] });
  const { container } = render(<AboutTrack />);
  expect(pic(container, "studio").style.visibility).toBe("hidden");
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} }) as never;
  act(() => { window.dispatchEvent(new Event("resize")); });
  expect(pic(container, "studio").style.visibility).toBe("");
  expect(pic(container, "studio").style.clipPath).toBe("");
});

test("a strip picture without a link fails loudly, not a quiet link to the home page", async () => {
  vi.resetModules();
  vi.doMock("@/content/about", async (orig) => {
    const m = await orig<typeof import("@/content/about")>();
    const strip = m.ABOUT.pictures.strip.map((s, i) => (i === 1 ? { ...s, href: undefined } : s));
    return { ...m, ABOUT: { ...m.ABOUT, pictures: { ...m.ABOUT.pictures, strip } } };
  });
  const { AboutTrack: Broken } = await import("./about-track");
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(() => render(<Broken />)).toThrow(/eventread/);
  err.mockRestore();
  vi.doUnmock("@/content/about");
});

/** the loops (task 5): jsdom has no IntersectionObserver or media playback; a mock IO we can fire, and a play/pause we can watch */
type IOCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;
function mockLoops(reduced = false) {
  const observers: { cb: IOCallback; els: Set<Element>; disconnected: boolean }[] = [];
  vi.stubGlobal("IntersectionObserver", class {
    rec: (typeof observers)[number];
    constructor(cb: IOCallback) { this.rec = { cb, els: new Set(), disconnected: false }; observers.push(this.rec); }
    observe(el: Element) { this.rec.els.add(el); }
    unobserve(el: Element) { this.rec.els.delete(el); }
    disconnect() { this.rec.disconnected = true; this.rec.els.clear(); }
  });
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) { return Promise.resolve(); });
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const mq = { matches: reduced, listeners: new Set<() => void>(), addEventListener(_: string, l: () => void) { this.listeners.add(l); }, removeEventListener(_: string, l: () => void) { this.listeners.delete(l); } };
  window.matchMedia = vi.fn().mockReturnValue(mq) as never;
  const loopObserver = () => observers.find((o) => [...o.els].some((e) => e.tagName === "VIDEO"))!;
  const see = (v: Element, isIntersecting: boolean) => act(() => { loopObserver().cb([{ target: v, isIntersecting }]); });
  return { observers, play, pause, mq, loopObserver, see };
}
const flush = () => act(async () => { await Promise.resolve(); });
const videoOf = (c: ParentNode, id: string) => pic(c, id).querySelector("video")!;
/** every loop sits in the shown range of the 1024px screen (on the track the pictures are otherwise 0px wide: cut away) */
const allShown = () => laidOut(Object.fromEntries(["marni-came", "sanskrit", "cyvore", "eventread", "nordic-logic", "desk"].map((id) => [id, [300, 100] as [number, number]])));

test("a loop plays when it enters the screen and pauses when it leaves; off screen it is never started", () => {
  allShown();
  const m = mockLoops();
  const { container } = render(<AboutTrack />);
  // all six loops are watched, none started (preload none: no play, no load, so nothing downloads)
  expect(m.loopObserver().els.size).toBe(6);
  expect(m.play).not.toHaveBeenCalled();
  const v = videoOf(container, "desk");
  m.see(v, true);
  expect(m.play).toHaveBeenCalledTimes(1);
  expect(m.play.mock.contexts[0]).toBe(v);
  m.see(v, false);
  expect(m.pause).toHaveBeenCalledTimes(1);
  expect(m.pause.mock.contexts[0]).toBe(v);
});

test("under reduced motion loops never play; their posters show", () => {
  const m = mockLoops(true);
  const { container } = render(<AboutTrack />);
  const v = videoOf(container, "desk");
  m.see(v, true);
  expect(m.play).not.toHaveBeenCalled();
  expect(v).toHaveAttribute("poster", ABOUT.pictures.desk.poster);
  expect(v).toHaveAttribute("preload", "none");
});

test("choosing reduced motion while a loop plays pauses it; choosing it away lets the visible ones play again", () => {
  allShown();
  const m = mockLoops();
  const { container } = render(<AboutTrack />);
  const v = videoOf(container, "desk");
  m.see(v, true);
  expect(m.play).toHaveBeenCalledTimes(1);
  m.mq.matches = true; act(() => { m.mq.listeners.forEach((l) => l()); });
  expect(m.pause).toHaveBeenCalledTimes(1);
  m.mq.matches = false; act(() => { m.mq.listeners.forEach((l) => l()); });
  expect(m.play).toHaveBeenCalledTimes(2);
});

test("a loop that fails to play keeps its poster and logs nothing", async () => {
  allShown();
  const m = mockLoops();
  m.play.mockImplementation(() => Promise.reject(new DOMException("not allowed", "NotAllowedError")));
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const unhandled = vi.fn();
  process.on("unhandledRejection", unhandled);
  const { container } = render(<AboutTrack />);
  const v = videoOf(container, "desk");
  m.see(v, true);
  await flush(); await new Promise((r) => setTimeout(r, 0));
  process.off("unhandledRejection", unhandled);
  expect(m.play).toHaveBeenCalled();
  expect(v).toHaveAttribute("poster", ABOUT.pictures.desk.poster);
  expect(err).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();
  expect(unhandled).not.toHaveBeenCalled();
  // a play() that throws outright is as quiet
  m.play.mockImplementation(() => { throw new Error("boom"); });
  expect(() => m.see(videoOf(container, "sanskrit"), true)).not.toThrow();
});

test("a video error leaves the poster, logs nothing, and is not retried", () => {
  const m = mockLoops();
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  const { container } = render(<AboutTrack />);
  const v = videoOf(container, "desk");
  act(() => { v.dispatchEvent(new Event("error")); });
  m.see(v, true);
  expect(m.play).not.toHaveBeenCalled();
  expect(v).toHaveAttribute("poster", ABOUT.pictures.desk.poster);
  expect(err).not.toHaveBeenCalled();
});

test("the tab hidden pauses every loop; coming back resumes the visible ones only", () => {
  allShown();
  const m = mockLoops();
  const { container } = render(<AboutTrack />);
  const a = videoOf(container, "desk"), b = videoOf(container, "cyvore");
  m.see(a, true); m.see(b, true); m.see(b, false);
  m.play.mockClear(); m.pause.mockClear();
  let hidden = true;
  Object.defineProperty(document, "hidden", { get: () => hidden, configurable: true });
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(m.pause.mock.contexts).toEqual([a]);
  hidden = false;
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(m.play.mock.contexts).toEqual([a]);
  delete (document as { hidden?: boolean }).hidden;
});

test("a loop whose picture is cut away or not yet risen does not play even if its box is on screen", () => {
  laidOut({ desk: [3000, 100] });
  const m = mockLoops();
  const { container } = render(<AboutTrack />);
  const v = videoOf(container, "desk");
  // the desk film is far to the right: hidden by the track's clip; the observer sees its box (inside the viewport, say) but it must not play
  expect(pic(container, "desk").style.visibility).toBe("hidden");
  m.see(v, true);
  expect(m.play).not.toHaveBeenCalled();
  // scrolled until it has risen: it plays
  scrollTo(3000 - 0.06 * 1024);
  expect(pic(container, "desk").style.visibility).toBe("");
  expect(m.play).toHaveBeenCalledTimes(1);
  // and cut away at the margin again: it pauses
  scrollTo(3000 - 0.06 * 1024 + 100.5);
  expect(m.pause).toHaveBeenCalledTimes(1);
});

test("on unmount the loops' observer and listeners are gone", () => {
  allShown();
  const m = mockLoops();
  const remove = vi.spyOn(document, "removeEventListener");
  const { container, unmount } = render(<AboutTrack />);
  const v = videoOf(container, "desk");
  m.see(v, true);
  const obs = m.loopObserver();
  unmount();
  expect(obs.disconnected).toBe(true);
  expect(m.mq.listeners.size).toBe(0);
  expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  expect(m.pause.mock.contexts).toContain(v);
});

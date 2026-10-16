import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: React.ComponentProps<"a">) => <a href={href} {...rest}>{children}</a> }));
// eslint-disable-next-line @next/next/no-img-element -- a stand-in for next/image in the test
vi.mock("next/image", () => ({ default: (p: React.ComponentProps<"img"> & { priority?: boolean }) => { const rest = { ...p }; delete rest.priority; return <img {...rest} alt={p.alt} />; } }));
vi.mock("@/content/about", async (orig) => {
  const m = await orig<typeof import("@/content/about")>();
  return { ...m, ABOUT: { ...m.ABOUT, portrait: { src: "/about/portrait.jpg", alt: "Liam", width: 800, height: 1000 } } };
});

import { AboutTrack } from "./about-track";

test("the portrait opens the track, left of the first line", () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
  const { container } = render(<AboutTrack />);
  const slides = container.querySelectorAll(".ab-track > .ab-slide");
  expect(slides[0].classList.contains("ab-photo")).toBe(true);
  expect(slides[0].querySelector("img")).toHaveAttribute("src", "/about/portrait.jpg");
  expect(slides[1].textContent).toContain("I’m Liam.");
  expect(container.querySelector(".ab > .ab-pin > .ab-portrait")).toBeNull();
});

test("the track travels its overflow past the clip, not the window: the closing line still arrives (final review I5)", () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
  const sw = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth");
  const cw = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, get() { return this.classList.contains("ab-track") ? 6000 : 0; } });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get() { return this.classList.contains("ab-clip") ? 965 : 0; } });
  try {
    const { container } = render(<AboutTrack />);
    const sec = container.querySelector<HTMLElement>(".ab")!;
    expect(sec.style.height).toBe(`${900 + (6000 - 965)}px`);
  } finally {
    if (sw) Object.defineProperty(HTMLElement.prototype, "scrollWidth", sw);
    if (cw) Object.defineProperty(HTMLElement.prototype, "clientWidth", cw);
  }
});

test("as the track rolls left the portrait holds still and is cropped from its left edge", () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 25 });
  const sw = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth");
  const cw = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  const rect = HTMLElement.prototype.getBoundingClientRect;
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, get() { return this.classList.contains("ab-track") ? 6000 : 0; } });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get() { return this.classList.contains("ab-clip") ? 1440 : 0; } });
  // the photo's box ends 400px along the track and the first line starts 100px after it: the crop is done after 100px of travel.
  // The rects are what the opening animation has them at right now (the photo slid 80px, the line 300px): the offsets must be what counts.
  const ol = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetLeft");
  const ow = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
  const isPhoto = (el: HTMLElement) => el.classList.contains("ab-photo");
  const isFirstLine = (el: HTMLElement) => !!el.previousElementSibling?.classList.contains("ab-photo");
  Object.defineProperty(HTMLElement.prototype, "offsetLeft", { configurable: true, get() { return isPhoto(this) ? 100 : isFirstLine(this) ? 500 : 0; } });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get() { return isPhoto(this) ? 300 : 0; } });
  HTMLElement.prototype.getBoundingClientRect = function () {
    const r = isPhoto(this) ? { left: 20, right: 320 } : isFirstLine(this) ? { left: 800, right: 1200 } : { left: 0, right: 0 };
    return r as DOMRect;
  };
  try {
    const { container } = render(<AboutTrack />);
    const img = container.querySelector<HTMLElement>(".ab-portrait")!;
    // 25px of scroll = 25px of travel: held in place by the opposite movement, a quarter of the way cropped
    expect(img.style.transform).toBe("translate3d(25px, 0, 0)");
    expect(img.style.clipPath).toContain("inset(0 0 0 25%");
  } finally {
    HTMLElement.prototype.getBoundingClientRect = rect;
    if (ol) Object.defineProperty(HTMLElement.prototype, "offsetLeft", ol);
    if (ow) Object.defineProperty(HTMLElement.prototype, "offsetWidth", ow);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    if (sw) Object.defineProperty(HTMLElement.prototype, "scrollWidth", sw);
    if (cw) Object.defineProperty(HTMLElement.prototype, "clientWidth", cw);
  }
});

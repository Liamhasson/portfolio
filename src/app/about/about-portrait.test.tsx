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

test("with the portrait beside it, the track travels its overflow past the clip, not the window: the closing line still arrives (final review I5)", () => {
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

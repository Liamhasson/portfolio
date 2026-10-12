import { expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), usePathname: () => "/" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: React.ComponentProps<"a">) => <a href={href} {...rest}>{children}</a> }));
import Home from "./page";
import { LOADER_BOOT } from "./lab/sand/loader-mode";

const kids = (el: React.ReactElement) => [(el.props as { children: React.ReactNode }).children].flat(3).filter(Boolean) as React.ReactElement[];

test("the home page is the story (pre-launch audit, 2026-10-12): the loader's boot script before first paint, then the story itself", () => {
  const parts = kids(Home());
  expect(parts[0].type).toBe("script");
  expect((parts[0].props as { dangerouslySetInnerHTML: { __html: string } }).dangerouslySetInnerHTML.__html).toBe(LOADER_BOOT);
  const story = parts.find((p) => (p.props as { hero?: boolean }).hero !== undefined)!;
  expect((story.props as { hero: boolean }).hero).toBe(true);
});

test("the page carries a plain version of itself, hidden until it's needed: the copy and every project (Liam, 2026-10-13: the story's script failing left the nav over black)", async () => {
  const { render, screen } = await import("@testing-library/react");
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
  const { StoryFallback } = await import("./story-fallback");
  const { container } = render(<StoryFallback />);
  expect(screen.getByRole("heading", { level: 1, name: "Hi, I’m Liam." })).toBeInTheDocument();
  for (const href of ["/eventread", "/cyvore", "/pulse", "/about"]) expect(container.querySelector(`a[href="${href}"]`)).not.toBeNull();
  expect(container.querySelector("[data-story-fallback]")).not.toBeNull();
  expect(container.querySelector("[data-story-fallback] [data-projects]")).not.toBeNull();
});

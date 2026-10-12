import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: React.ComponentProps<"a">) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/font/google", () => ({ Caveat: () => ({ className: "caveat", style: { fontFamily: "Caveat" } }) }));

import { SandLab } from "./sand-lab";

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as never;
  HTMLCanvasElement.prototype.getContext = (() => null) as never;   // (no WebGL: some company laptops, virtual machines)
});

test("without WebGL the home page still has the copy and every project, under a working Projects anchor (pre-launch audit)", async () => {
  render(<SandLab hero />);
  await waitFor(() => expect(screen.getByTestId("sand-fallback")).toBeInTheDocument());
  expect(screen.getByRole("heading", { level: 1, name: "Hi, I’m Liam." })).toBeInTheDocument();
  expect(document.getElementById("projects")).not.toBeNull();
  for (const href of ["/eventread", "/cyvore", "/pulse"]) expect(document.querySelector(`#projects a[href="${href}"]`)).not.toBeNull();
  expect(document.querySelector('#projects a[href="/about"]')).not.toBeNull();   // (the pull on to About)
  expect(document.documentElement.dataset.loader).toBeUndefined();   // (never locked)
});

test("without WebGL, arriving at /#projects (Back from a case study) lands on the projects, not the top (final review #7)", async () => {
  window.history.replaceState(null, "", "/#projects");
  const seen: string[] = [];
  Element.prototype.scrollIntoView = function (this: Element) { seen.push(this.id); };
  render(<SandLab hero />);
  await waitFor(() => expect(seen).toContain("projects"));
  window.history.replaceState(null, "", "/");
});

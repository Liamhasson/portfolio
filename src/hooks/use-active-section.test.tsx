import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useActiveSection } from "./use-active-section";

let callback: IntersectionObserverCallback;
const observe = vi.fn();
const disconnect = vi.fn();

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn(function (this: unknown, cb: IntersectionObserverCallback) {
      callback = cb;
      return { observe, disconnect, unobserve: vi.fn(), takeRecords: () => [] };
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  observe.mockClear();
  disconnect.mockClear();
});

function Probe() {
  const active = useActiveSection(["projects", "about", "contact"]);
  return (
    <>
      <section id="projects" />
      <section id="about" />
      <section id="contact" />
      <output>{active ?? "none"}</output>
    </>
  );
}

function fire(id: string) {
  const target = document.getElementById(id)!;
  act(() => {
    callback([{ target, isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
  });
}

test("starts with no active section and observes every section", () => {
  render(<Probe />);
  expect(screen.getByRole("status")).toHaveTextContent("none");
  expect(observe).toHaveBeenCalledTimes(3);
});

test("reports the section crossing the middle of the viewport", () => {
  render(<Probe />);
  fire("about");
  expect(screen.getByRole("status")).toHaveTextContent("about");
  fire("contact");
  expect(screen.getByRole("status")).toHaveTextContent("contact");
});

test("disconnects on unmount", () => {
  const { unmount } = render(<Probe />);
  unmount();
  expect(disconnect).toHaveBeenCalled();
});

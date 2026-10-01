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

function Probe({ resetKey, variant = "a" }: { resetKey?: string; variant?: string }) {
  const active = useActiveSection(["projects", "about", "contact"], resetKey);
  return (
    <>
      <section key={`projects-${variant}`} id="projects" />
      <section key={`about-${variant}`} id="about" />
      <section key={`contact-${variant}`} id="contact" />
      <output>{active ?? "none"}</output>
    </>
  );
}

function fire(id: string, isIntersecting = true) {
  fireMany([[id, isIntersecting]]);
}

function fireMany(batch: [string, boolean][]) {
  const entries = batch.map(
    ([id, isIntersecting]) =>
      ({ target: document.getElementById(id)!, isIntersecting }) as unknown as IntersectionObserverEntry,
  );
  act(() => {
    callback(entries, {} as IntersectionObserver);
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
  expect(disconnect).toHaveBeenCalledTimes(1);
});

test("observes with a thin band across the middle of the viewport", () => {
  render(<Probe />);
  expect(IntersectionObserver).toHaveBeenCalledWith(expect.any(Function), {
    rootMargin: "-45% 0px -45% 0px",
  });
});

test("clears the active section when it leaves the band", () => {
  render(<Probe />);
  fire("about");
  fire("about", false);
  expect(screen.getByRole("status")).toHaveTextContent("none");
});

test("falls back to the earlier section when the later one leaves an overlap", () => {
  render(<Probe />);
  fireMany([
    ["projects", true],
    ["about", true],
  ]);
  expect(screen.getByRole("status")).toHaveTextContent("about");
  fire("about", false);
  expect(screen.getByRole("status")).toHaveTextContent("projects");
});

test("re-subscribes and resets when resetKey changes (route change)", () => {
  const { rerender } = render(<Probe resetKey="/" variant="a" />);
  fire("about");
  expect(screen.getByRole("status")).toHaveTextContent("about");
  expect(observe).toHaveBeenCalledTimes(3);

  rerender(<Probe resetKey="/cyvore" variant="b" />);
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(observe).toHaveBeenCalledTimes(6);
  expect(screen.getByRole("status")).toHaveTextContent("none");

  fire("contact");
  expect(screen.getByRole("status")).toHaveTextContent("contact");

  rerender(<Probe resetKey="/" variant="c" />);
  expect(disconnect).toHaveBeenCalledTimes(2);
  expect(observe).toHaveBeenCalledTimes(9);
  expect(screen.getByRole("status")).toHaveTextContent("none");
});

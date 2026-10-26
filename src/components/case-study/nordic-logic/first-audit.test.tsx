import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { FirstAudit } from "./first-audit";

/** A stand-in IntersectionObserver the test drives: `seen(true)` puts the flow on screen, `seen(false)` takes it off. */
let fire: (visible: boolean) => void = () => {};
class IO {
  constructor(private cb: IntersectionObserverCallback) { fire = (v) => this.cb([{ isIntersecting: v } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
  observe() {}
  disconnect() {}
}
const seen = (v: boolean) => act(() => fire(v));
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const node = (c: HTMLElement, n: string) => c.querySelector(`[data-n="${n}"]`)!.className;

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("IntersectionObserver", IO); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test("without the observer (or with reduced motion) the whole flow shows drawn, at rest, and nothing is a button", () => {
  vi.unstubAllGlobals();
  vi.stubGlobal("IntersectionObserver", undefined);
  const { container } = render(<FirstAudit />);
  for (const n of ["send", "breakdown", "decide", "sign", "walk", "file", "credit"]) expect(node(container, n)).toContain("on");
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  expect(screen.getByText(/Or you walk away/)).toBeTruthy();
});

test("on screen it plays itself: signing runs to the carrier's credit, then walking away, with each one's line", () => {
  const { container } = render(<FirstAudit />);
  expect(node(container, "send")).not.toContain("on");
  seen(true);
  wait(6000);
  expect(node(container, "credit")).toContain("end");
  expect(node(container, "walk")).toContain("rest");
  expect(container.querySelector(".fa-out")!.textContent).toMatch(/Your carrier account is credited first/);
  wait(4000);
  expect(node(container, "file")).not.toContain("on");
  expect(node(container, "walk")).toContain("end");
  expect(node(container, "sign")).toContain("rest");
  expect(container.querySelector(".fa-out")!.textContent).toBe("The breakdown was free. Nothing signed, nothing owed.");
});

test("it starts over after the second ending, and clears when it leaves the screen", () => {
  const { container } = render(<FirstAudit />);
  seen(true);
  wait(13600);
  expect(node(container, "decide")).not.toContain("on");
  wait(3000);
  expect(node(container, "decide")).toContain("on");
  seen(false);
  wait(20000);
  expect(container.querySelectorAll(".fa-node.on")).toHaveLength(0);
});

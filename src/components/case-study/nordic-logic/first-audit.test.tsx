import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { FirstAudit } from "./first-audit";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const run = () => act(() => { vi.runAllTimers(); });

test("before anything runs, the trunk and the fork show drawn, both branches as equal buttons", () => {
  const { container } = render(<FirstAudit />);
  const fa = container.querySelector(".fa")!;
  expect(fa.hasAttribute("data-armed")).toBe(false);
  const sign = screen.getByRole("button", { name: /Sign a power of attorney/ });
  const walk = screen.getByRole("button", { name: /You walk away/ });
  expect(sign.className).toBe(walk.className);
  expect(screen.queryByRole("button", { name: "Choose again" })).toBeNull();
});

test("signing runs to its end: the disputes are filed, the carrier credits, then our invoice", () => {
  const { container } = render(<FirstAudit />);
  fireEvent.click(screen.getByRole("button", { name: /Sign a power of attorney/ }));
  run();
  expect(container.querySelector('[data-n="credit"]')!.className).toContain("on");
  expect(container.querySelector('[data-n="walk"]')!.className).toContain("rest");
  expect(screen.getByText(/Your carrier account is credited first/).className).toContain("on");
  expect(screen.getByRole("button", { name: /Sign a power of attorney/ })).toHaveAttribute("aria-pressed", "true");
});

test("walking away ends at once, nothing owed; choosing again resets the fork and hands focus back", () => {
  const { container } = render(<FirstAudit />);
  fireEvent.click(screen.getByRole("button", { name: /You walk away/ }));
  run();
  expect(screen.getByText("The breakdown was free. Nothing signed, nothing owed.").className).toContain("on");
  expect(container.querySelector('[data-n="file"]')!.className).not.toContain("on");
  fireEvent.click(screen.getByRole("button", { name: "Choose again" }));
  run();
  expect(container.querySelector(".fa")!.className).not.toContain("chosen");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: /Sign a power of attorney/ }));
});

test("a second click after choosing changes nothing", () => {
  const { container } = render(<FirstAudit />);
  fireEvent.click(screen.getByRole("button", { name: /You walk away/ }));
  fireEvent.click(screen.getByRole("button", { name: /Sign a power of attorney/ }));
  run();
  expect(container.querySelector('[data-n="file"]')!.className).not.toContain("on");
});

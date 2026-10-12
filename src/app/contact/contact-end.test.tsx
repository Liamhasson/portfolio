// src/app/contact/contact-end.test.tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ContactEnd } from "./contact-end";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("Contact's words (spec 2026-10-12 §4)", () => {
  test("the headline and the three ways in", () => {
    render(<ContactEnd show={1} />);
    expect(screen.getByRole("heading", { level: 1, name: "Got something on your mind?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Liamhasson@gmail.com/ })).toHaveAttribute("href", "mailto:Liamhasson@gmail.com");
    const li = screen.getByRole("link", { name: /LinkedIn/ });
    expect(li).toHaveAttribute("href", "https://www.linkedin.com/in/liamhasson/");
    expect(li).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "+49 160 771 0652" })).toHaveAttribute("href", "tel:+491607710652");
  });
  test("a click on the email copies it and says so for 2 s", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ContactEnd show={1} />);
    const email = screen.getByRole("link", { name: /Liamhasson@gmail.com/ });
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 });
    await act(async () => { email.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(true);
    expect(writeText).toHaveBeenCalledWith("Liamhasson@gmail.com");
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    act(() => { vi.advanceTimersByTime(2100); });
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
  test("from the keyboard (Enter: a click with no detail) the mailto: opens", () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<ContactEnd show={1} />);
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 0 });
    screen.getByRole("link", { name: /Liamhasson@gmail.com/ }).dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
  test("no clipboard (insecure page, refused): the mailto: opens instead (Review Focus 4)", () => {
    Object.assign(navigator, { clipboard: undefined });
    render(<ContactEnd show={1} />);
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 });
    screen.getByRole("link", { name: /Liamhasson@gmail.com/ }).dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
  test("before they arrive the words are invisible and out of the focus order", () => {
    render(<ContactEnd show={0} />);
    const wrap = screen.getByTestId("contact-words");
    expect(wrap).toHaveAttribute("inert");
    expect(wrap.style.opacity).toBe("0");
  });
});

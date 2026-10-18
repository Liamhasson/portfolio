import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { HeroOverlay, driftOut } from "./hero-overlay";

describe("HeroOverlay", () => {
  test("the hero copy is there from the first frame: no delayed rise", () => {
    render(<HeroOverlay exit={() => 0} scrolled={() => 0} />);
    const name = screen.getByText("Hi, I’m Liam.");
    expect(name.closest(".hero-rise")).toBeNull();
    expect(screen.getByText("I build ambiguous ideas into products").closest(".hero-rise")).toBeNull();
  });

  test("no text over the desk (Liam, 2026-10-11: the desk speaks for itself)", () => {
    render(<HeroOverlay exit={() => 0} scrolled={() => 0} />);
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    expect(screen.queryByText("Tested until people believe in it.")).toBeNull();
    expect(screen.queryByText("From chaos to product.")).toBeNull();
    expect(screen.queryByText(/I find the problem nobody pointed at/)).toBeNull();
  });

  test("the copy drifts up and out, line by line, and is gone at the end", () => {
    expect(driftOut(0, 0)).toEqual({ y: 0, opacity: 1 });
    expect(driftOut(1, 0).opacity).toBe(0);
    expect(driftOut(1, 2).opacity).toBe(0);
    expect(driftOut(0.4, 0).opacity).toBeLessThan(driftOut(0.4, 2).opacity);   // the first line leaves first
    expect(driftOut(0.5, 1).y).toBeLessThan(0);                                 // upward
  });
  test("no Product Designer label of its own: the name lives in the nav now (Liam, 2026-10-12)", () => {
    render(<HeroOverlay exit={() => 0} scrolled={() => 0} />);
    expect(screen.queryByText("Product Designer")).toBeNull();
  });

  test("the desk's Keep scrolling: in the hero cue's place and type, only once asked for, and it goes when scrolling starts", async () => {
    let on = false;
    const { container } = render(<HeroOverlay exit={() => 1} scrolled={() => 2.7} keep={() => on} />);
    const keep = container.querySelector<HTMLElement>("[data-keep-cue]")!;
    const cue = container.querySelector<HTMLElement>("[data-cue]")!;
    expect(keep.className).toBe(cue.className + " opacity-0 transition-opacity duration-500 ease-out");   // same place, same type
    expect(screen.queryByText("Keep scrolling")).toBeNull();
    on = true;
    await waitFor(() => expect(screen.getByText("Keep scrolling")).toBeTruthy());
    expect(screen.getByText("Keep scrolling").closest(".hero-rise")).not.toBeNull();   // the hero cue's line reveal
    await waitFor(() => expect(keep.style.opacity).toBe("1"));
    expect(keep.getAttribute("aria-hidden")).toBe("false");
    on = false;
    await waitFor(() => expect(keep.style.opacity).toBe("0"));
    expect(keep.getAttribute("aria-hidden")).toBe("true");
  });

  test("no Keep scrolling where nobody asks for it (the fallback's hero)", () => {
    const { container } = render(<HeroOverlay exit={() => 0} scrolled={() => 0} />);
    expect(container.querySelector("[data-keep-cue]")).toBeNull();
  });
});

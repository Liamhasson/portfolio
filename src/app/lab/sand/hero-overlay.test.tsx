import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { HeroOverlay, driftOut } from "./hero-overlay";

describe("HeroOverlay", () => {
  test("the hero copy is there from the first frame: no delayed rise", () => {
    render(<HeroOverlay exit={() => 0} scrolled={() => 0} enter={() => 0} leave={() => 0} />);
    const name = screen.getByText("Hi, I’m Liam.");
    expect(name.closest(".hero-rise")).toBeNull();
    expect(screen.getByText("I build ambiguous ideas into products").closest(".hero-rise")).toBeNull();
  });

  test("the desk's headline only, in Liam's words", () => {
    render(<HeroOverlay exit={() => 0} scrolled={() => 0} enter={() => 0} leave={() => 0} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Tested until people believe in it.");
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
});

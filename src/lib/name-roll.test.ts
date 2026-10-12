import { describe, expect, test, vi } from "vitest";
import { NAME, letterRoll, nameRoll } from "./name-roll";

describe("the name in the nav rolls over letter by letter (Liam, 2026-10-12)", () => {
  test("PRODUCT DESIGNER becomes LIAM HASSON", () => {
    expect(NAME.from).toBe("PRODUCT DESIGNER");
    expect(NAME.to).toBe("LIAM HASSON");
  });
  test("each letter rolls in turn, left to right, from 0 (as it was) to 1 (rolled)", () => {
    const n = 16;
    expect(letterRoll(0, 0, n)).toBe(0);
    expect(letterRoll(1, n - 1, n)).toBe(1);
    expect(letterRoll(0.3, 0, n)).toBeGreaterThan(letterRoll(0.3, 8, n));   // (the first letters go first)
    for (let i = 0; i < n; i++) expect(letterRoll(1, i, n)).toBe(1);
  });
  test("one shared value the story sets and the nav reads", () => {
    const seen = vi.fn();
    const off = nameRoll.subscribe(seen);
    nameRoll.set(0.4);
    expect(seen).toHaveBeenLastCalledWith(0.4);
    expect(nameRoll.get()).toBe(0.4);
    off();
    nameRoll.set(0.9);
    expect(seen).toHaveBeenCalledTimes(1);
  });
});

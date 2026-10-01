import { describe, expect, test } from "vitest";
import { dur, ease, distance, exitDuration, spring, stagger } from "./motion";

describe("motion tokens", () => {
  test("durations match the spec", () => {
    expect(dur).toEqual({ micro: 0.18, ui: 0.32, reveal: 0.6, page: 0.9 });
  });

  test("exits run at ~65% of the enter duration", () => {
    expect(exitDuration(dur.reveal)).toBe(0.39);
    expect(exitDuration(dur.ui)).toBe(0.208);
  });

  test("easing curves are cubic-bezier tuples", () => {
    expect(ease.settle).toEqual([0.22, 1, 0.36, 1]);
    expect(ease.exit).toEqual([0.55, 0, 1, 0.45]);
  });

  test("distances, stagger and spring", () => {
    expect(distance).toEqual({ text: 24, card: 48 });
    expect(stagger).toBe(0.06);
    expect(spring.pop).toEqual({ type: "spring", stiffness: 400, damping: 22 });
  });
});

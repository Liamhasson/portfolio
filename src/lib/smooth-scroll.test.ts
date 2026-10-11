import { expect, test } from "vitest";
import { shouldUseSmoothScroll } from "./smooth-scroll";

const media = (matches: Record<string, boolean>) => (q: string) => matches[q] ?? false;

test("on for a mouse/trackpad without reduced motion", () => {
  expect(shouldUseSmoothScroll(media({ "(pointer: fine)": true }))).toBe(true);
});

test("off on touch devices (native scrolling stays intact)", () => {
  expect(shouldUseSmoothScroll(media({ "(pointer: fine)": false }))).toBe(false);
});

test("off when the user prefers reduced motion", () => {
  expect(
    shouldUseSmoothScroll(
      media({ "(pointer: fine)": true, "(prefers-reduced-motion: reduce)": true }),
    ),
  ).toBe(false);
});

test("a carried scroll goes through the smooth scroller when there is one, locked (the user can't stop it halfway)", async () => {
  const { glideTo, registerScroller } = await import("./smooth-scroll");
  const calls: unknown[][] = [];
  const off = registerScroller({ scrollTo: (...a: unknown[]) => { calls.push(a); } });
  let done = 0;
  glideTo(1234, 0.9, () => done++);
  expect(calls[0][0]).toBe(1234);
  expect(calls[0][1]).toMatchObject({ duration: 0.9, lock: true });
  (calls[0][1] as { onComplete: () => void }).onComplete();
  expect(done).toBe(1);
  off();
});

test("without one (touch, reduced motion), the browser's own scroll: smooth, or instant under reduced motion", async () => {
  const { glideTo } = await import("./smooth-scroll");
  const seen: ScrollToOptions[] = [];
  const orig = window.scrollTo;
  window.scrollTo = ((o: ScrollToOptions) => { seen.push(o); }) as typeof window.scrollTo;
  let done = 0;
  glideTo(500, 0.9, () => done++);
  glideTo(600, 0.9, () => done++, true);
  window.scrollTo = orig;
  expect(seen[0]).toEqual({ top: 500, behavior: "smooth" });
  expect(seen[1]).toEqual({ top: 600, behavior: "instant" });
  expect(done).toBe(1);   // the instant one is done at once; the smooth one when it lands (the caller watches)
});

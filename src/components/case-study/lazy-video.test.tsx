import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { LazyVideo } from "./lazy-video";

test("a board video waits: no source until near the screen, poster shown, muted and inline", () => {
  const { container } = render(<LazyVideo src="/case-studies/pulse/home.mp4" poster="/case-studies/pulse/home-poster.jpg" label="Pulse's home screen" />);
  const v = container.querySelector("video")!;
  expect(v.getAttribute("src")).toBeNull();
  expect(v.getAttribute("preload")).toBe("none");
  expect(v.getAttribute("poster")).toBe("/case-studies/pulse/home-poster.jpg");
  expect(v.muted).toBe(true);
  expect(v.hasAttribute("playsinline")).toBe(true);
  expect(v.getAttribute("aria-label")).toBe("Pulse's home screen");
});

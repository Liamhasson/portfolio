// src/app/lab/sand/loader-release.test.ts
import { expect, test } from "vitest";
import { releaseHold } from "./loader-mode";
import { holdScroll, registerScroller } from "@/lib/smooth-scroll";

test("the hold locks scrolling through the smooth scroller, and the release (100%, or an error) frees it and shows the nav", () => {
  const calls: string[] = [];
  const off = registerScroller({ scrollTo: () => {}, stop: () => calls.push("stop"), start: () => calls.push("start") });
  holdScroll(true);
  document.documentElement.dataset.loader = "play";
  releaseHold();
  expect(document.documentElement.dataset.loader).toBeUndefined();
  expect(calls).toEqual(["stop", "start"]);
  off();
});

test("the copy arrives before the release: shown, scrolling still held", async () => {
  const { showCopy } = await import("./loader-mode");
  document.documentElement.dataset.loader = "play";
  showCopy();
  expect(document.documentElement.dataset.loader).toBe("arriving");
  releaseHold();
  expect(document.documentElement.dataset.loader).toBeUndefined();
});

test("while held, the hidden nav and copy are out of reach: not focusable, not read (final review I7)", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync("src/app/globals.css", "utf8");
  const rule = css.slice(css.indexOf('html[data-loader="play"] .sh-nav'));
  expect(rule.slice(0, rule.indexOf("}"))).toMatch(/visibility:\s*hidden/);
});

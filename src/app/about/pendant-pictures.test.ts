// src/app/about/pendant-pictures.test.ts: what of a picture the pendant keeps clear of
import { expect, test } from "vitest";
import { pictureShown } from "./pendant-pictures";

const vw = 1000;
// a picture at track x 2000, 300 px wide with its caption, 200 tall, its top at 100 in the pinned frame
const p = { l: 2000, t: 100, w: 300, h: 200 };
const at = (screenLeft: number) => p.l - screenLeft; // (the travel that puts its left edge at this screen x)

test("not yet risen: nothing counts", () => {
  expect(pictureShown(p, vw)(at(0.95 * vw))).toBeNull();
});

test("rising: only the risen part counts", () => {
  const f = pictureShown(p, vw)(at(0.82 * vw))!;
  expect(f.x).toBe(820);
  expect(f.y).toBeGreaterThan(100);
  expect(f.y).toBeLessThan(300);
});

test("fully shown: all of it counts", () => {
  expect(pictureShown(p, vw)(at(400))).toEqual({ x: 400, y: 100 });
});

test("leaving (its cut at the margin has started): it no longer counts, caption and all", () => {
  // the margin is 6% (60 px): at screen x 59 the cut has just started
  expect(pictureShown(p, vw)(at(60))).toEqual({ x: 60, y: 100 }); // (on the line: not cut yet)
  expect(pictureShown(p, vw)(at(59))).toBeNull();
  expect(pictureShown(p, vw)(at(-100))).toBeNull();
  expect(pictureShown(p, vw)(at(60 - 300))).toBeNull(); // (fully cut)
});

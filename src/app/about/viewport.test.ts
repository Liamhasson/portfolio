// src/app/about/viewport.test.ts
import { expect, test } from "vitest";
import { resizeKind, TOOLBAR_MAX } from "./viewport";

const phone = { w: 390, h: 664 };

test("a phone's toolbar showing or hiding (height only, under TOOLBAR_MAX) is a scroll, not a resize", () => {
  expect(resizeKind(phone, { w: 390, h: 664 + 83 }, true)).toBe("toolbar");
  expect(resizeKind({ w: 390, h: 747 }, phone, true)).toBe("toolbar");
  expect(resizeKind(phone, { w: 390, h: 664 + TOOLBAR_MAX - 1 }, true)).toBe("toolbar");
  expect(resizeKind(phone, phone, true)).toBe("toolbar"); // (nothing changed: the boxes alone)
});

test("a width change, a big height change, or any change with a mouse is a real resize", () => {
  expect(resizeKind(phone, { w: 844, h: 390 }, true)).toBe("layout"); // (a rotation)
  expect(resizeKind(phone, { w: 391, h: 664 }, true)).toBe("layout");
  expect(resizeKind(phone, { w: 390, h: 664 - 300 }, true)).toBe("layout"); // (the keyboard)
  expect(resizeKind(phone, { w: 390, h: 664 + TOOLBAR_MAX }, true)).toBe("layout");
  expect(resizeKind(phone, { w: 390, h: 700 }, false)).toBe("layout"); // (a desktop window dragged shorter)
});

// src/app/about/viewport.ts
/**
 * A phone's browser toolbar (iOS Safari's address bar, Chrome's on Android) shows and hides as the page scrolls, and each
 * time the window's height changes by its height. That is a scroll, not a new screen: the stacked pendant lays out against
 * the large viewport (100lvh, which the toolbar doesn't change), so it only measures the boxes again (the fixed resume moves
 * with the toolbar), never resizing its canvas or solving again. A width change, a big height change (a rotation, a
 * keyboard, a split screen) or any change with a mouse is a real resize.
 */
export type ResizeKind = "toolbar" | "layout";

/** A height change under this (px) with the width unchanged is the toolbar. */
export const TOOLBAR_MAX = 150;

export function resizeKind(prev: { w: number; h: number }, next: { w: number; h: number }, coarse: boolean): ResizeKind {
  if (!coarse || next.w !== prev.w) return "layout";
  return Math.abs(next.h - prev.h) < TOOLBAR_MAX ? "toolbar" : "layout";
}

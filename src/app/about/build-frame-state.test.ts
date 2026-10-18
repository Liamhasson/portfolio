import { afterEach, expect, test, vi } from "vitest";
import { clearFrame, getFrameState, resetFrameForTests, setFrameState, subscribeFrame, type FrameState } from "./build-frame-state";

afterEach(() => resetFrameForTests());

const at = (o: Partial<FrameState>): FrameState => ({ phase: "build", cx: 700, cy: 450, w: 518, h: 445, grow: 1, retract: 0, ...o });

test("starts empty: no phase, nothing to draw", () => {
  expect(getFrameState()).toEqual({ phase: null, cx: 0, cy: 0, w: 0, h: 0, grow: 0, retract: 0 });
});

test("a set is copied in: the caller may reuse its object", () => {
  const mine = at({ phase: "grow", grow: 0.3 });
  setFrameState(mine);
  mine.grow = 0.9;
  expect(getFrameState().grow).toBe(0.3);
  expect(getFrameState()).not.toBe(mine);
});

test("grow and retract are clamped to 0..1", () => {
  setFrameState(at({ grow: 1.4, retract: -0.2 }));
  expect(getFrameState().grow).toBe(1);
  expect(getFrameState().retract).toBe(0);
});

test("subscribers hear every change, and only changes (the held build costs nothing)", () => {
  const fn = vi.fn();
  const off = subscribeFrame(fn);
  setFrameState(at({ phase: "grow", grow: 0.5 }));
  setFrameState(at({ phase: "grow", grow: 0.5 }));
  expect(fn).toHaveBeenCalledTimes(1);
  setFrameState(at({ phase: "grow", grow: 0.6 }));
  setFrameState(at({ phase: "grow", grow: 0.6, cx: 701 }));
  expect(fn).toHaveBeenCalledTimes(3);
  off();
  setFrameState(at({ phase: "build" }));
  expect(fn).toHaveBeenCalledTimes(3);
});

test("the whole sequence goes through: null, grow, build, retract, null", () => {
  const seen: string[] = [];
  subscribeFrame(() => seen.push(`${getFrameState().phase}:${getFrameState().grow}:${getFrameState().retract}`));
  setFrameState(at({ phase: "flight", grow: 0 }));
  setFrameState(at({ phase: "snap", grow: 0 }));
  for (const g of [0, 0.5, 1]) setFrameState(at({ phase: "grow", grow: g }));
  setFrameState(at({ phase: "build" }));
  for (const r of [0, 0.5, 1]) setFrameState(at({ phase: "retract", retract: r }));
  setFrameState(at({ phase: null, grow: 0, retract: 0 }));
  expect(seen).toEqual(["flight:0:0", "snap:0:0", "grow:0:0", "grow:0.5:0", "grow:1:0", "build:1:0", "retract:1:0", "retract:1:0.5", "retract:1:1", "null:0:0"]);
});

test("reset drops the state and the listeners", () => {
  const fn = vi.fn();
  subscribeFrame(fn);
  setFrameState(at({}));
  resetFrameForTests();
  setFrameState(at({}));
  expect(fn).toHaveBeenCalledTimes(1);
});

test("sub-pixel jitter is no change: px rounded to 0.01, grow and retract to 0.001", () => {
  const fn = vi.fn();
  subscribeFrame(fn);
  setFrameState(at({ cx: 700.123, cy: 450.004, w: 518.391, h: 445.0049, grow: 0.5004, retract: 0 }));
  expect(getFrameState()).toMatchObject({ cx: 700.12, cy: 450, w: 518.39, h: 445, grow: 0.5, retract: 0 });
  // (jitter under the rounding, frame after frame: nobody is told)
  setFrameState(at({ cx: 700.1249, cy: 449.996, w: 518.389, h: 444.996, grow: 0.4996, retract: 0.0004 }));
  expect(fn).toHaveBeenCalledTimes(1);
  setFrameState(at({ cx: 700.13, cy: 450, w: 518.39, h: 445, grow: 0.5, retract: 0 }));
  expect(fn).toHaveBeenCalledTimes(2);
  setFrameState(at({ cx: 700.13, cy: 450, w: 518.39, h: 445, grow: 0.501, retract: 0 }));
  expect(fn).toHaveBeenCalledTimes(3);
});

test("clearFrame: back to no frame, the listeners kept and told", () => {
  const fn = vi.fn();
  subscribeFrame(fn);
  setFrameState(at({ phase: "build" }));
  clearFrame();
  expect(getFrameState()).toEqual({ phase: null, cx: 0, cy: 0, w: 0, h: 0, grow: 0, retract: 0 });
  expect(fn).toHaveBeenCalledTimes(2);
  clearFrame();   // (already clear: nobody told again)
  expect(fn).toHaveBeenCalledTimes(2);
  setFrameState(at({ phase: "grow", grow: 0.2 }));
  expect(fn).toHaveBeenCalledTimes(3);   // (still listening)
});

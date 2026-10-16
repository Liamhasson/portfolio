// src/app/about/about-pendant.test.tsx
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// (jsdom has no WebGL: the scene is mocked, the mount's own logic is what's under test)
vi.mock("@/three/pendant/scene", () => ({ PendantScene: { load: vi.fn() } }));

import { PendantScene } from "@/three/pendant/scene";
import { AboutPendant } from "./about-pendant";

const load = vi.mocked(PendantScene.load);
// (loosely typed: the tests add and remove these browser globals)
const g = globalThis as unknown as Record<string, unknown>;

/** About's pinned frame, as about-track.tsx renders it, with the pendant mounted inside `.ab-pin`. */
const Page = () => (
  <section className="ab" data-mode="track">
    <div className="ab-pin">
      <div className="ab-clip"><div className="ab-track" /></div>
      <AboutPendant />
    </div>
  </section>
);

function setup({ webgl2 = true, reduced = false } = {}) {
  g.WebGL2RenderingContext = class {};
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    ((type: string) => (type === "webgl2" && webgl2 ? { getExtension: () => ({ loseContext() {} }) } : null)) as never,
  );
  window.matchMedia = vi.fn((q: string) => ({ matches: reduced && q.includes("reduce"), addEventListener() {}, removeEventListener() {} })) as never;
  let fontsDone!: () => void;
  const ready = new Promise<void>((r) => { fontsDone = r; });
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready } });
  const idle: (() => void)[] = [];
  g.requestIdleCallback = vi.fn((cb: () => void) => idle.push(cb));
  g.cancelIdleCallback = vi.fn();
  return {
    fontsDone: async () => { await act(async () => { fontsDone(); await ready; }); },
    runIdle: async () => { await act(async () => { idle.splice(0).forEach((cb) => cb()); }); },
  };
}

beforeEach(() => { load.mockReset(); });
afterEach(() => {
  vi.restoreAllMocks();
  delete g.WebGL2RenderingContext;
  delete g.requestIdleCallback;
  delete g.cancelIdleCallback;
});

test("renders no canvas without WebGL2", async () => {
  const { fontsDone, runIdle } = setup({ webgl2: false });
  const { container } = render(<Page />);
  await fontsDone();
  await runIdle();
  await waitFor(() => expect(container.querySelector(".ab-pendant")).toBeNull());
  expect(load).not.toHaveBeenCalled();
});

test("loads the scene only after About's text has painted", async () => {
  load.mockReturnValue(new Promise(() => {})); // (still on its way)
  const { fontsDone, runIdle } = setup();
  const { container } = render(<Page />);
  const canvas = container.querySelector("canvas.ab-pendant");
  expect(canvas).not.toBeNull();
  expect(load).not.toHaveBeenCalled(); // not on mount
  await fontsDone();
  expect(load).not.toHaveBeenCalled(); // the fonts alone aren't enough: it waits for an idle moment too
  await runIdle();
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  expect(load).toHaveBeenCalledWith(canvas);
});

test("a load failure removes the canvas and logs nothing", async () => {
  load.mockRejectedValue(new Error("pendant.glb: 404"));
  const error = vi.spyOn(console, "error");
  const { fontsDone, runIdle } = setup();
  const { container } = render(<Page />);
  await fontsDone();
  await runIdle();
  await waitFor(() => expect(load).toHaveBeenCalled());
  await waitFor(() => expect(container.querySelector(".ab-pendant")).toBeNull());
  expect(error).not.toHaveBeenCalled();
});

test("reduced motion still mounts it, in still mode", () => {
  setup({ reduced: true });
  const { container } = render(<Page />);
  expect(container.querySelector(".ab-pendant")).toHaveAttribute("data-mode", "still");
});

test("without reduced motion it is live", () => {
  setup();
  const { container } = render(<Page />);
  expect(container.querySelector(".ab-pendant")).toHaveAttribute("data-mode", "live");
});

test("a scene that arrives after About has gone is freed at once", async () => {
  const dispose = vi.fn();
  let arrive!: (s: unknown) => void;
  load.mockReturnValue(new Promise((r) => { arrive = r; }) as never);
  const { fontsDone, runIdle } = setup();
  const { unmount } = render(<Page />);
  await fontsDone();
  await runIdle();
  await waitFor(() => expect(load).toHaveBeenCalled());
  unmount();
  await act(async () => { arrive({ dispose, resize() {}, draw() {}, hit: () => false }); });
  expect(dispose).toHaveBeenCalledTimes(1);
});

// src/app/about/about-pendant.test.tsx
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// (jsdom has no WebGL: the scene is mocked, the mount's own logic is what's under test)
vi.mock("@/three/pendant/scene", () => ({ PendantScene: { load: vi.fn() } }));

import { PendantScene } from "@/three/pendant/scene";
import { glassOwner } from "@/lib/about-glass";
import { AboutPendant } from "./about-pendant";

const load = vi.mocked(PendantScene.load);
// (loosely typed: the tests add and remove these browser globals)
const g = globalThis as unknown as Record<string, unknown>;

/** About's pinned frame, as about-track.tsx renders it, with the pendant mounted inside `.ab-pin`; the site nav above it
 *  and a proof link on the track. */
const Page = ({ mode = "track" }: { mode?: "track" | "stack" }) => (
  <>
    <nav><a href="/contact">Contact</a></nav>
    <section className="ab" data-mode={mode}>
      <div className="ab-pin">
        <div className="ab-clip"><div className="ab-track"><a href="/pulse">a proof</a></div></div>
        <AboutPendant />
      </div>
    </section>
  </>
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

test("stacked, it waits for the track before loading three and the files", async () => {
  load.mockReturnValue(new Promise(() => {}));
  const { fontsDone, runIdle } = setup();
  const { container } = render(<Page mode="stack" />);
  await fontsDone();
  await runIdle();
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  expect(load).not.toHaveBeenCalled();
  await act(async () => { container.querySelector<HTMLElement>(".ab")!.dataset.mode = "track"; });
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
});

test("unmounting removes the page hook", () => {
  setup();
  const { unmount } = render(<Page />);
  expect(window.__pendant).toBeDefined();
  unmount();
  expect(window.__pendant).toBeUndefined();
});

/** A scene stand-in with real three objects (the frame poses them), whose every press hits the pendant. */
async function liveScene() {
  const { Box3, Object3D, PerspectiveCamera, Vector3 } = await import("three");
  const outer = new Object3D(), inner = new Object3D();
  outer.add(inner);
  const scene = {
    camera: new PerspectiveCamera(), outer, inner, bounds: new Box3(new Vector3(-0.2, -0.5, -0.2), new Vector3(0.2, 0.5, 0.2)),
    resize: vi.fn(), draw: vi.fn(), hit: vi.fn(() => true), dispose: vi.fn(), glassLook: 1 / 2.2,
  };
  load.mockResolvedValue(scene as never);
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue(
    { left: 0, top: 0, right: 1440, bottom: 900, width: 1440, height: 900, x: 0, y: 0, toJSON() {} } as DOMRect,
  );
  return scene;
}
const press = (el: Element) => {
  const down = new PointerEvent("pointerdown", { bubbles: true, cancelable: true, isPrimary: true, button: 0, clientX: 200, clientY: 200 });
  el.dispatchEvent(down);
  window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, isPrimary: true, button: 0, clientX: 200, clientY: 200 }));
  const click = new MouseEvent("click", { bubbles: true, cancelable: true, clientX: 200, clientY: 200 });
  el.dispatchEvent(click);
  return { grabbed: down.defaultPrevented, followed: !click.defaultPrevented };
};

test("a press on a link painted above the pendant (the site nav, or the track behind it) still follows the link", async () => {
  const scene = await liveScene();
  const { fontsDone, runIdle } = setup();
  const { getByRole, container } = render(<Page />);
  await fontsDone();
  await runIdle();
  await waitFor(() => expect(window.__pendant?.ready).toBe(true));
  // the site nav is above the canvas: never a grab, even over the pendant
  expect(press(getByRole("link", { name: "Contact" }))).toEqual({ grabbed: false, followed: true });
  expect(scene.hit).not.toHaveBeenCalled();
  // a track link with the pendant behind the words: the words are on top
  container.querySelector<HTMLElement>(".ab-pendant")!.dataset.layer = "back";
  expect(press(getByRole("link", { name: "a proof" }))).toEqual({ grabbed: false, followed: true });
});

test("a press on the pendant in front of a track link grabs it, and that link doesn't follow", async () => {
  const scene = await liveScene();
  const { fontsDone, runIdle } = setup();
  const { getByRole, container } = render(<Page />);
  await fontsDone();
  await runIdle();
  await waitFor(() => expect(window.__pendant?.ready).toBe(true));
  container.querySelector<HTMLElement>(".ab-pendant")!.dataset.layer = "front";
  expect(press(getByRole("link", { name: "a proof" }))).toEqual({ grabbed: true, followed: false });
  expect(scene.hit).toHaveBeenCalledTimes(1);
});

test("the pendant claims the glass once its scene is ready, and gives it back when it goes", async () => {
  await liveScene();
  const { fontsDone, runIdle } = setup();
  const { unmount } = render(<Page />);
  expect(glassOwner()).toBe("testimonials"); // (nothing loaded yet: the testimonials draw the ball)
  await fontsDone();
  await runIdle();
  await waitFor(() => expect(window.__pendant?.ready).toBe(true));
  expect(glassOwner()).toBe("pendant");
  unmount();
  expect(glassOwner()).toBe("testimonials");
});

test("a lost context gives the glass back to the testimonials", async () => {
  await liveScene();
  const { fontsDone, runIdle } = setup();
  const { container, unmount } = render(<Page />);
  await fontsDone();
  await runIdle();
  await waitFor(() => expect(window.__pendant?.ready).toBe(true));
  expect(glassOwner()).toBe("pendant");
  act(() => { container.querySelector(".ab-pendant")!.dispatchEvent(new Event("webglcontextlost", { cancelable: true })); });
  expect(glassOwner()).toBe("testimonials");
  unmount();
  expect(glassOwner()).toBe("testimonials");
});

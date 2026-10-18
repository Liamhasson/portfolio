// src/app/about/about-pendant.test.tsx
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// (jsdom has no WebGL: the scene is mocked, the mount's own logic is what's under test)
vi.mock("@/three/pendant/scene", () => ({ PendantScene: { load: vi.fn() } }));

import { PendantScene } from "@/three/pendant/scene";
import { claimGlass, glassOwner, resetGlassForTests, setGlassLight } from "@/lib/about-glass";
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
  resetGlassForTests(); // (the glass store is global: a test that claimed it must not leave it claimed for the next)
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

test("stacked (phones, reduced motion), it loads too: the phone framing, not a hidden canvas", async () => {
  load.mockReturnValue(new Promise(() => {}));
  const { fontsDone, runIdle } = setup();
  render(<Page mode="stack" />);
  await fontsDone();
  await runIdle();
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
});

test("stacked, it films the stack's shots (the six, and the build) on the page's own scroll", async () => {
  await liveScene();
  const { fontsDone, runIdle } = setup();
  render(<Page mode="stack" />);
  await fontsDone();
  await runIdle();
  await waitFor(() => expect(window.__pendant?.ready).toBe(true));
  expect(window.__pendant!.mode).toBe("stack");
  expect(window.__pendant!.keys.map((k) => k.id)).toEqual(["opening", "tumble", "above", "glass", "whirl", "build", "buildEnd", "hero"]);
});

test("a change of layout films the other shots", async () => {
  await liveScene();
  const { fontsDone, runIdle } = setup();
  const { container } = render(<Page />);
  await fontsDone();
  await runIdle();
  await waitFor(() => expect(window.__pendant?.ready).toBe(true));
  expect(window.__pendant!.keys).toHaveLength(12);
  await act(async () => { container.querySelector<HTMLElement>(".ab")!.dataset.mode = "stack"; });
  await waitFor(() => expect(window.__pendant!.keys).toHaveLength(8));
  expect(window.__pendant!.mode).toBe("stack");
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

test("the stack's glass slot takes its room only while the pendant holds the ball and draws", async () => {
  await liveScene();
  const { fontsDone, runIdle } = setup();
  const { container, unmount } = render(<Page mode="stack" />);
  const sec = container.querySelector<HTMLElement>(".ab")!;
  expect(sec.dataset.glass).toBeUndefined(); // (nothing drawn yet: no slot)
  await fontsDone();
  await runIdle();
  await waitFor(() => expect(window.__pendant?.ready).toBe(true));
  expect(sec.dataset.glass).toBe("on");
  act(() => { container.querySelector(".ab-pendant")!.dispatchEvent(new Event("webglcontextlost", { cancelable: true })); });
  expect(sec.dataset.glass).toBeUndefined(); // (the GPU gone: the slot collapses)
  unmount();
});


/** The track with the glass slot at `left` px along it (245 px wide: 17vw at 1440), the screen 1024 wide (jsdom's window). */
function slotAt(container: HTMLElement, left: number) {
  const tr = container.querySelector<HTMLElement>(".ab-track")!;
  const slot = document.createElement("div");
  slot.dataset.pendant = "glass";
  tr.appendChild(slot);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) { return this === slot ? 245 : 0; });
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) { return this === slot ? left : 0; });
}

test("the ball is drawn full size wherever the slot is on screen, far from the glass shot, with the light passed in", async () => {
  const scene = await liveScene();
  const { fontsDone, runIdle } = setup();
  const { container } = render(<Page />);
  slotAt(container, 600); // (on screen at the opening: the shot is nowhere near the glass)
  setGlassLight({ q: 0.4, t: 7, pulse: 1 });
  await fontsDone();
  await runIdle();
  await waitFor(() => expect(window.__pendant?.ready).toBe(true));
  await waitFor(() => expect(window.__pendant!.glass).not.toBeNull());
  const [f, glass, , light] = scene.draw.mock.lastCall!;
  expect(f.glass).toBe(0);
  expect(glass.x).toBeCloseTo((600 + 245 / 2) / innerWidth, 6);
  expect(glass.r).toBeCloseTo((0.44 * 245) / innerHeight, 6); // (full size: not scaled by the shot's glass)
  expect(glass.dimmed).toBe(false); // (riding its slot on the track: it keeps its look whatever the pendant's dim)
  expect(window.__pendant!.glass!.r).toBeCloseTo(glass.r, 9);
  expect(light).toEqual({ q: 0.4, t: 7, pulse: 1 });
  setGlassLight(null);
  await waitFor(() => expect(scene.draw.mock.lastCall![3]).toBeNull());
});

test("no ball while the slot is more than a slot's width off screen, or while the testimonials own the glass", async () => {
  const scene = await liveScene();
  const { fontsDone, runIdle } = setup();
  const { container } = render(<Page />);
  slotAt(container, innerWidth + 250); // (its centre 372 px past the right edge: more than its 245 px width)
  await fontsDone();
  await runIdle();
  await waitFor(() => expect(window.__pendant?.ready).toBe(true));
  await waitFor(() => expect(scene.draw.mock.calls.length).toBeGreaterThan(2));
  expect(scene.draw.mock.lastCall![1]).toBeNull();
  expect(window.__pendant!.glass).toBeNull();
  vi.mocked(Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetLeft")!.get!).mockImplementation(function (this: HTMLElement) {
    return this.dataset.pendant === "glass" ? 600 : 0;
  });
  window.dispatchEvent(new Event("resize"));
  await waitFor(() => expect(window.__pendant!.glass).not.toBeNull());
  claimGlass("testimonials"); // (a newer claim: the testimonials draw it)
  await waitFor(() => expect(window.__pendant!.glass).toBeNull());
  expect(scene.draw.mock.lastCall![1]).toBeNull();
});

test("the debug hooks are ignored without ?pendant-debug: no GPU timer from window.__pendantPerf", async () => {
  const scene = await liveScene();
  const enableGpuTiming = vi.fn(() => true);
  Object.assign(scene, { enableGpuTiming });
  window.__pendantPerf = true;
  try {
    const { fontsDone, runIdle } = setup();
    const { unmount } = render(<Page />);
    await fontsDone();
    await runIdle();
    await waitFor(() => expect(window.__pendant?.ready).toBe(true));
    expect(enableGpuTiming).not.toHaveBeenCalled();
    expect(window.__pendant!.gpuMs).toBeNull();
    unmount();
  } finally {
    delete window.__pendantPerf;
  }
});

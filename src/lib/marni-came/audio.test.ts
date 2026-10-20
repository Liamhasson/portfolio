import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MC_AUDIO_MESSAGE, bridgeParent, createAudioController, isEmbedded } from "./audio";

type Fake = { src: string; paused: boolean; play: () => Promise<void>; pause: () => void; currentTime: number; addEventListener: () => void; removeEventListener: () => void };
let made: Fake[] = [];
const make = () => createAudioController(window, (src) => {
  const a: Fake = { src, paused: true, currentTime: 0, play() { a.paused = false; return Promise.resolve(); }, pause() { a.paused = true; }, addEventListener() {}, removeEventListener() {} };
  made.push(a); return a as unknown as HTMLAudioElement;
});
const playing = () => made.filter((a) => !a.paused).map((a) => a.src.split("/").pop());
const hide = () => { Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); };
const post = (data: unknown, origin: string) => window.dispatchEvent(new MessageEvent("message", { data, origin }));

beforeEach(() => { made = []; Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); });
afterEach(() => vi.restoreAllMocks());

test("starts off on After Heartbreaks and plays only on request", () => {
  const c = make();
  expect(c.state()).toEqual({ on: false, track: "after-heartbreaks" });
  expect(playing()).toEqual([]);
  c.toggle();
  expect(c.state().on).toBe(true);
  expect(playing()).toEqual(["after-heartbreaks.m4a"]);
});

test("playing a second track stops the first", () => {
  const c = make();
  c.play("dopamine"); c.play("youll-be-you");
  expect(playing()).toEqual(["youll-be-you.m4a"]);
  expect(c.state()).toEqual({ on: true, track: "youll-be-you" });
});

test("a hidden tab pauses", () => {
  const c = make(); c.play("after-heartbreaks");
  hide();
  expect(c.state().on).toBe(false);
  expect(playing()).toEqual([]);
});

test("subscribers hear every change", () => {
  const c = make(); const fn = vi.fn(); const off = c.subscribe(fn);
  c.play("dopamine"); c.pause(); off(); c.play("dopamine");
  expect(fn).toHaveBeenCalledTimes(2);
});

test("the bridge ignores other origins and malformed messages", () => {
  const c = make(); const stop = bridgeParent(c, window);
  post({ type: MC_AUDIO_MESSAGE, action: "play" }, "https://evil.test");
  post({ type: MC_AUDIO_MESSAGE, action: "play", track: "nope" }, location.origin);
  post({ type: "other", action: "play" }, location.origin);
  expect(c.state().on).toBe(false);
  stop();
});

test("the bridge plays and pauses a same-origin request", () => {
  const c = make(); const stop = bridgeParent(c, window);
  post({ type: MC_AUDIO_MESSAGE, action: "play", track: "dopamine" }, location.origin);
  expect(c.state()).toEqual({ on: true, track: "dopamine" });
  post({ type: MC_AUDIO_MESSAGE, action: "pause" }, location.origin);
  expect(c.state().on).toBe(false);
  stop();
});

test("a top-level page is not embedded", () => {
  expect(isEmbedded(window)).toBe(false);
});

test("a remote controller mirrors the page's state and ignores other origins", async () => {
  const { createRemoteController, MC_AUDIO_STATE } = await import("./audio");
  const r = createRemoteController(window);
  post({ type: MC_AUDIO_STATE, state: { on: true, track: "dopamine" } }, "https://evil.test");
  expect(r.state().on).toBe(false);
  post({ type: MC_AUDIO_STATE, state: { on: true, track: "dopamine" } }, location.origin);
  expect(r.state()).toEqual({ on: true, track: "dopamine" });
  r.dispose();
});

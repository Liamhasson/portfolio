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
const post = (data: unknown, origin: string) => window.dispatchEvent(new MessageEvent("message", { data, origin, source: window }));

beforeEach(() => { made = []; Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); });
afterEach(() => vi.restoreAllMocks());

test("starts off on After Heartbreaks and plays only on request", () => {
  const c = make();
  expect(c.state()).toMatchObject({ on: false, track: "after-heartbreaks" });
  expect(playing()).toEqual([]);
  c.toggle();
  expect(c.state().on).toBe(true);
  expect(playing()).toEqual(["after-heartbreaks.m4a"]);
});

test("playing a second track stops the first", () => {
  const c = make();
  c.play("dopamine"); c.play("youll-be-you");
  expect(playing()).toEqual(["youll-be-you.m4a"]);
  expect(c.state()).toMatchObject({ on: true, track: "youll-be-you" });
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
  expect(c.state()).toMatchObject({ on: true, track: "dopamine" });
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
  expect(r.state()).toMatchObject({ on: true, track: "dopamine" });
  r.dispose();
});

test("a play cut short by a quick switch doesn't turn the state off", async () => {
  let reject: (e: unknown) => void = () => {};
  let first = true;
  const c = createAudioController(window, (src) => {
    const a = { src, paused: true, currentTime: 0, play() { a.paused = false; if (first) { first = false; return new Promise<void>((_, r) => { reject = r; }); } return Promise.resolve(); }, pause() { a.paused = true; }, addEventListener() {}, removeEventListener() {} };
    return a as unknown as HTMLAudioElement;
  });
  c.play("after-heartbreaks"); c.play("dopamine");
  reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
  await Promise.resolve(); await Promise.resolve();
  expect(c.state()).toMatchObject({ on: true, track: "dopamine" });
});

test("a remote controller ignores state from a window that isn't its parent", async () => {
  const { createRemoteController, MC_AUDIO_STATE } = await import("./audio");
  const r = createRemoteController(window);
  const other = document.createElement("iframe"); document.body.append(other);
  window.dispatchEvent(new MessageEvent("message", { data: { type: MC_AUDIO_STATE, state: { on: true, track: "dopamine" } }, origin: location.origin, source: other.contentWindow }));
  expect(r.state().on).toBe(false);
  r.dispose(); other.remove();
});

test("a waveform click jumps into the track and plays from there (Liam, 2026-10-21)", () => {
  made = [];
  const c = createAudioController(window, (src) => {
    const a = { src, paused: true, currentTime: 0, duration: 200, play() { a.paused = false; return Promise.resolve(); }, pause() { a.paused = true; }, addEventListener() {}, removeEventListener() {} };
    made.push(a as unknown as Fake); return a as unknown as HTMLAudioElement;
  });
  c.seek("dopamine", 0.5);
  expect(c.state()).toMatchObject({ on: true, track: "dopamine", time: 100, duration: 200 });
  c.seek("dopamine", 2);
  expect(c.state().time).toBe(100);
});

test("the bridge passes a seek on, and only a sane one", () => {
  const c = make();
  const seek = vi.spyOn(c, "seek");
  const off = bridgeParent(c, window);
  post({ type: MC_AUDIO_MESSAGE, action: "seek", track: "dopamine", fraction: 0.25 }, window.location.origin);
  post({ type: MC_AUDIO_MESSAGE, action: "seek", track: "dopamine", fraction: 7 }, window.location.origin);
  post({ type: MC_AUDIO_MESSAGE, action: "seek", track: "nope", fraction: 0.2 }, window.location.origin);
  expect(seek).toHaveBeenCalledTimes(1);
  expect(seek).toHaveBeenCalledWith("dopamine", 0.25);
  off();
});

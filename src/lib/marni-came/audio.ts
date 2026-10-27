import { MC_ASSETS } from "./assets";

/** One audio state for the case study and the band site inside it (spec §4.5): off by default, one track at a time,
 *  paused when the tab is hidden. The site in its iframe asks the page to play (postMessage) instead of playing itself. */
export type TrackId = "after-heartbreaks" | "dopamine" | "youll-be-you";
export const TRACKS: Record<TrackId, { src: string; peaks: string; energy: string; title: string }> = {
  "after-heartbreaks": { ...MC_ASSETS.tracks.afterHeartbreaks, title: "After Heartbreaks" },
  dopamine: { ...MC_ASSETS.tracks.dopamine, title: "Dopamine" },
  "youll-be-you": { ...MC_ASSETS.tracks.youllBeYou, title: "You'll Be You" },
};
export const MC_AUDIO_MESSAGE = "mc-audio";

/** time and duration (seconds) are the current track's position, for its waveform (0 until it has loaded). */
export interface AudioState { on: boolean; track: TrackId; time: number; duration: number }
export interface AudioController {
  play(id: TrackId): void;
  pause(): void;
  /** Jump to a point of a track (0..1 of its length) and play from there, as a waveform click does (Liam, 2026-10-21). */
  seek(id: TrackId, fraction: number): void;
  toggle(): void;
  state(): AudioState;
  subscribe(fn: () => void): () => void;
  /** The current element, for a waveform's progress (null until something has played). */
  element(): HTMLAudioElement | null;
  dispose(): void;
}

const isTrack = (t: unknown): t is TrackId => typeof t === "string" && t in TRACKS;
const isFraction = (f: unknown): f is number => typeof f === "number" && Number.isFinite(f) && f >= 0 && f <= 1;
const START: AudioState = { on: false, track: "after-heartbreaks", time: 0, duration: 0 };

export function createAudioController(win: Window, make: (src: string) => HTMLAudioElement = (src) => new Audio(src)): AudioController {
  let st: AudioState = START;
  let el: HTMLAudioElement | null = null;
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((f) => f());
  const set = (next: AudioState) => { st = next; emit(); };
  const ended = () => set({ ...st, on: false, time: 0 });
  // (the position, about four times a second while it plays, and once the length is known)
  const tick = () => { if (el) set({ ...st, time: el.currentTime || 0, duration: Number.isFinite(el.duration) ? el.duration : 0 }); };
  const pause = () => { el?.pause(); if (st.on) set({ ...st, on: false }); };
  const load = (id: TrackId) => {
    if (el && st.track === id) return;
    if (el) { el.pause(); el.removeEventListener("ended", ended); el.removeEventListener("timeupdate", tick); el.removeEventListener("loadedmetadata", tick); }
    el = make(TRACKS[id].src);
    el.addEventListener("ended", ended); el.addEventListener("timeupdate", tick); el.addEventListener("loadedmetadata", tick);
    st = { ...st, track: id, time: 0, duration: 0 };
  };
  const start = () => {
    set({ ...st, on: true });
    // (a play() cut short by a later switch rejects with AbortError: that is not the music stopping)
    const mine = el!;
    void mine.play()?.catch((e: unknown) => { if (el === mine && (e as { name?: string })?.name !== "AbortError") set({ ...st, on: false }); });
  };
  const play = (id: TrackId) => { load(id); start(); };
  const seek = (id: TrackId, fraction: number) => {
    if (!isFraction(fraction)) return;
    load(id);
    const a = el!;
    const go = () => { if (Number.isFinite(a.duration) && a.duration > 0) { a.currentTime = fraction * a.duration; tick(); } };
    if (Number.isFinite(a.duration) && a.duration > 0) go(); else a.addEventListener("loadedmetadata", go, { once: true });
    start();
  };
  const onVis = () => { if (win.document.visibilityState === "hidden") pause(); };
  win.document.addEventListener("visibilitychange", onVis);
  return {
    play, pause, seek,
    toggle: () => (st.on ? pause() : play(st.track)),
    state: () => st,
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    element: () => el,
    dispose: () => { pause(); win.document.removeEventListener("visibilitychange", onVis); subs.clear(); },
  };
}

export const MC_AUDIO_STATE = "mc-audio-state";

/** The study listens for its embedded site's requests (same origin only, known tracks only) and tells every site that
 *  has spoken to it what is playing, so its buttons can show it. */
export function bridgeParent(ctrl: AudioController, win: Window): () => void {
  const sources = new Set<MessageEventSource>();
  const tell = () => sources.forEach((s) => (s as Window).postMessage({ type: MC_AUDIO_STATE, state: ctrl.state() }, win.location.origin));
  const on = (e: MessageEvent) => {
    if (e.origin !== win.location.origin) return;
    const d = e.data as { type?: unknown; action?: unknown; track?: unknown; fraction?: unknown } | null;
    if (!d || d.type !== MC_AUDIO_MESSAGE) return;
    if (e.source && e.source !== win) sources.add(e.source);
    if (d.action === "pause") ctrl.pause();
    else if (d.action === "seek" && isTrack(d.track) && isFraction(d.fraction)) ctrl.seek(d.track, d.fraction);
    else if (d.action === "play" && (d.track === undefined || isTrack(d.track))) ctrl.play(d.track ?? ctrl.state().track);
    else if (d.action === "hello") tell();
  };
  win.addEventListener("message", on);
  const off = ctrl.subscribe(tell);
  return () => { win.removeEventListener("message", on); off(); };
}

/** Inside the study's iframe: the same controls, but the page plays; this side only asks, and mirrors what it hears. */
export function createRemoteController(win: Window): AudioController {
  let st: AudioState = START;
  const subs = new Set<() => void>();
  const on = (e: MessageEvent) => {
    if (e.origin !== win.location.origin || e.source !== win.parent) return;
    const d = e.data as { type?: unknown; state?: AudioState } | null;
    if (!d || d.type !== MC_AUDIO_STATE || !d.state || !isTrack(d.state.track)) return;
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
    st = { on: !!d.state.on, track: d.state.track, time: n(d.state.time), duration: n(d.state.duration) }; subs.forEach((f) => f());
  };
  win.addEventListener("message", on);
  win.parent.postMessage({ type: MC_AUDIO_MESSAGE, action: "hello" }, win.location.origin);
  const play = (id: TrackId) => requestFromParent(win, "play", id);
  const pause = () => requestFromParent(win, "pause");
  const seek = (id: TrackId, fraction: number) => { if (isFraction(fraction)) win.parent.postMessage({ type: MC_AUDIO_MESSAGE, action: "seek", track: id, fraction }, win.location.origin); };
  return {
    play, pause, seek,
    toggle: () => (st.on ? pause() : play(st.track)),
    state: () => st,
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    element: () => null,
    dispose: () => { win.removeEventListener("message", on); subs.clear(); },
  };
}

export function isEmbedded(win: Window): boolean {
  try { return win.parent !== win; } catch { return true; }
}

export function requestFromParent(win: Window, action: "play" | "pause", track?: TrackId): void {
  win.parent.postMessage({ type: MC_AUDIO_MESSAGE, action, track }, win.location.origin);
}

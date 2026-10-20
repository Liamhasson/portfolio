import { MC_ASSETS } from "./assets";

/** One audio state for the case study and the band site inside it (spec §4.5): off by default, one track at a time,
 *  paused when the tab is hidden. The site in its iframe asks the page to play (postMessage) instead of playing itself. */
export type TrackId = "after-heartbreaks" | "dopamine" | "youll-be-you";
export const TRACKS: Record<TrackId, { src: string; peaks: string; title: string }> = {
  "after-heartbreaks": { ...MC_ASSETS.tracks.afterHeartbreaks, title: "After Heartbreaks" },
  dopamine: { ...MC_ASSETS.tracks.dopamine, title: "Dopamine" },
  "youll-be-you": { ...MC_ASSETS.tracks.youllBeYou, title: "You'll Be You" },
};
export const MC_AUDIO_MESSAGE = "mc-audio";

export interface AudioState { on: boolean; track: TrackId }
export interface AudioController {
  play(id: TrackId): void;
  pause(): void;
  toggle(): void;
  state(): AudioState;
  subscribe(fn: () => void): () => void;
  /** The current element, for a waveform's progress (null until something has played). */
  element(): HTMLAudioElement | null;
  dispose(): void;
}

const isTrack = (t: unknown): t is TrackId => typeof t === "string" && t in TRACKS;

export function createAudioController(win: Window, make: (src: string) => HTMLAudioElement = (src) => new Audio(src)): AudioController {
  let st: AudioState = { on: false, track: "after-heartbreaks" };
  let el: HTMLAudioElement | null = null;
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((f) => f());
  const set = (next: AudioState) => { st = next; emit(); };
  const ended = () => set({ ...st, on: false });
  const pause = () => { el?.pause(); if (st.on) set({ ...st, on: false }); };
  const play = (id: TrackId) => {
    if (!el || st.track !== id) {
      el?.pause(); el?.removeEventListener("ended", ended);
      el = make(TRACKS[id].src); el.addEventListener("ended", ended);
    }
    set({ on: true, track: id });
    // (a play() cut short by a later switch rejects with AbortError: that is not the music stopping)
    const mine = el;
    void mine.play()?.catch((e: unknown) => { if (el === mine && (e as { name?: string })?.name !== "AbortError") set({ ...st, on: false }); });
  };
  const onVis = () => { if (win.document.visibilityState === "hidden") pause(); };
  win.document.addEventListener("visibilitychange", onVis);
  return {
    play, pause,
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
    const d = e.data as { type?: unknown; action?: unknown; track?: unknown } | null;
    if (!d || d.type !== MC_AUDIO_MESSAGE) return;
    if (e.source && e.source !== win) sources.add(e.source);
    if (d.action === "pause") ctrl.pause();
    else if (d.action === "play" && (d.track === undefined || isTrack(d.track))) ctrl.play(d.track ?? ctrl.state().track);
    else if (d.action === "hello") tell();
  };
  win.addEventListener("message", on);
  const off = ctrl.subscribe(tell);
  return () => { win.removeEventListener("message", on); off(); };
}

/** Inside the study's iframe: the same controls, but the page plays; this side only asks, and mirrors what it hears. */
export function createRemoteController(win: Window): AudioController {
  let st: AudioState = { on: false, track: "after-heartbreaks" };
  const subs = new Set<() => void>();
  const on = (e: MessageEvent) => {
    if (e.origin !== win.location.origin || e.source !== win.parent) return;
    const d = e.data as { type?: unknown; state?: AudioState } | null;
    if (!d || d.type !== MC_AUDIO_STATE || !d.state || !isTrack(d.state.track)) return;
    st = { on: !!d.state.on, track: d.state.track }; subs.forEach((f) => f());
  };
  win.addEventListener("message", on);
  win.parent.postMessage({ type: MC_AUDIO_MESSAGE, action: "hello" }, win.location.origin);
  const play = (id: TrackId) => requestFromParent(win, "play", id);
  const pause = () => requestFromParent(win, "pause");
  return {
    play, pause,
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

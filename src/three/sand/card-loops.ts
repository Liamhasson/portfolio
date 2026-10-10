/**
 * The project cards' loops: one detached <video> per source, shared by the laptop screen (as VideoTextures) and the live
 * index (drawn into canvases), so the handover shows one picture and only one decoder runs per loop.
 * Detached on purpose: Chrome drops the whole page to 30 fps once two or more <video> elements play in the document
 * (measured: 1 -> 120 fps, 2..4 -> 30, in Chrome 1xx on a 120 Hz display); videos outside it don't count.
 * A loop plays while anyone holds it.
 */

const videos = new Map<string, HTMLVideoElement>();
const holders = new Map<string, Set<string>>();

export function loopVideo(src: string): HTMLVideoElement {
  let v = videos.get(src);
  if (!v) {
    v = document.createElement("video");
    // muted and inline: allowed to autoplay
    v.src = src; v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto"; v.crossOrigin = "anonymous";
    videos.set(src, v);
    holders.set(src, new Set());
  }
  return v;
}

/** `who` wants the loop at `src` playing (on) or no longer needs it (off). */
export function holdLoop(src: string, who: string, on: boolean): void {
  const v = loopVideo(src);
  const h = holders.get(src)!;
  if (on) h.add(who); else h.delete(who);
  if (h.size > 0 && v.paused) v.play().catch(() => {});
  else if (h.size === 0 && !v.paused) v.pause();
}
